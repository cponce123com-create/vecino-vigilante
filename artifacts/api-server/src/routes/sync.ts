import { Router, type IRouter } from "express";
import {
  db,
  contratacionesTable,
  entidadesTable,
  proveedoresTable,
  articulosAdjudicadosTable,
  syncLogTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const router: IRouter = Router();

function isChanchamayo(region: string): boolean {
  return region.toUpperCase().includes("CHANCHAMAYO");
}

function mapProcedimiento(method: string): string {
  const m = method.toUpperCase();
  if (m.includes("LICITACION")) return "LP";
  if (m.includes("ADJUDICACION SIMPLIFICADA")) return "AS";
  if (m.includes("SUBASTA")) return "SM";
  if (m.includes("CONCURSO")) return "CP";
  if (m.includes("DIRECTA")) return "CD";
  if (m.includes("COMPARACION")) return "CE";
  return method.slice(0, 10) || "AS";
}

function mapTipo(cat: string): string {
  const m: Record<string, string> = {
    goods: "BIENES", services: "SERVICIOS", works: "OBRAS", consultingServices: "CONSULTORIA",
  };
  return m[cat] ?? "SERVICIOS";
}

function safeDecimal(v: string | undefined | null): string | null {
  if (!v) return null;
  const f = parseFloat(v);
  return isNaN(f) || f <= 0 ? null : String(f);
}

function safeDate(v: string | undefined | null): Date | null {
  if (!v) return null;
  try {
    const d = new Date(v.trim().slice(0, 19));
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

// ── POST /api/sync/csv ───────────────────────────────────────────────
router.post("/sync/csv", async (req, res): Promise<void> => {
  const secret = process.env.SYNC_SECRET;
  if (secret && req.headers["x-sync-secret"] !== secret) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }

  try {
    const { registros, partes, adjudicaciones, contratos, articulosAdj, ordenes, observaciones } = req.body as {
      registros: Record<string, string>[];
      partes: Record<string, string>[];
      adjudicaciones: Record<string, string>[];
      contratos: Record<string, string>[];
      articulosAdj?: Record<string, string>[];
      ordenes?: Record<string, string>[];
      observaciones?: Record<string, string>[];
    };

    if (!registros?.length || !partes?.length) {
      res.status(400).json({ error: "Se requieren los arrays: registros, partes" });
      return;
    }

    // Identificar OCIDs de Chanchamayo desde partes
    const chanchamayoOcids = new Set<string>();
    const entidadMap: Record<string, { ruc: string; nombre: string; distrito: string }> = {};
    const proveedorMap: Record<string, { ruc: string; nombre: string }> = {};

    for (const p of partes) {
      const region = p["Entrega compilada:Partes involucradas:Dirección:Región"] ?? "";
      const roles = p["Entrega compilada:Partes involucradas:Roles de las partes"] ?? "";
      const ocid = p["Open Contracting ID"];
      const ruc = p["Entrega compilada:Partes involucradas:Identificador principal:ID"]?.trim();
      const nombre = p["Entrega compilada:Partes involucradas:Nombre común"]?.trim();
      const distrito = p["Entrega compilada:Partes involucradas:Dirección:Localidad"]?.trim() || "";

      if (isChanchamayo(region)) chanchamayoOcids.add(ocid);
      if (roles.includes("buyer") && ruc) entidadMap[ocid] = { ruc, nombre: nombre || ruc, distrito };
      if (roles.includes("supplier") && ruc && !proveedorMap[ocid]) proveedorMap[ocid] = { ruc, nombre: nombre || ruc };
    }

    // Mapear adjudicaciones
    const adjMap: Record<string, { monto: string; fecha: string }> = {};
    for (const a of (adjudicaciones ?? [])) {
      const ocid = a["Open Contracting ID"];
      adjMap[ocid] = {
        monto: a["Entrega compilada:Adjudicaciones:Valor:Monto"] ?? "",
        fecha: a["Entrega compilada:Adjudicaciones:Fecha de adjudicación"] ?? "",
      };
    }

    // Mapear contratos
    const conMap: Record<string, { fecha: string; plazo: string }> = {};
    for (const c of (contratos ?? [])) {
      const ocid = c["Open Contracting ID"];
      conMap[ocid] = {
        fecha: c["Entrega compilada:Contratos:Fecha de firma"] ?? "",
        plazo: c["Entrega compilada:Contratos:Periodo:Duración (días)"] ?? "",
      };
    }

    // Indexar observaciones por OCID
    const observacionesMap: Record<string, number> = {};
    if (observaciones && observaciones.length > 0) {
      for (const obs of observaciones) {
        const ocid = obs["Open Contracting ID"];
        if (ocid) observacionesMap[ocid] = (observacionesMap[ocid] ?? 0) + 1;
      }
    }

    // Filtrar registros de Chanchamayo
    const chanRegs = registros.filter(r => chanchamayoOcids.has(r["Open Contracting ID"]));

    let nuevos = 0, actualizados = 0, errores = 0;
    const seenEntidades = new Set<string>();
    const seenProveedores = new Set<string>();
    const procesadosOcids = new Set<string>();

    for (const reg of chanRegs) {
      const ocid = reg["Open Contracting ID"];
      try {
        const entidad = entidadMap[ocid];
        const proveedor = proveedorMap[ocid];
        const adj = adjMap[ocid] ?? {};
        const con = conMap[ocid] ?? {};

        const titulo = reg["Entrega compilada:Licitación:Título de la licitación"]?.trim() || ocid;
        const descripcion = reg["Entrega compilada:Licitación:Descripción de la licitación"]?.trim() || null;
        const tipo = mapTipo(reg["Entrega compilada:Licitación:Categoría principal de contratación"] ?? "");
        const procedimiento = mapProcedimiento(reg["Entrega compilada:Licitación:Detalles del método de contratación"] ?? "");
        const montoRef = safeDecimal(reg["Entrega compilada:Licitación:Valor:Monto"]);
        const montoAdj = safeDecimal(adj.monto);
        const fechaConv = safeDate(reg["Entrega compilada:Licitación:Periodo de licitación:Fecha de inicio"]);
        const fechaAdj = safeDate(adj.fecha);
        const fechaCon = safeDate(con.fecha);
        let plazo: number | null = null;
        try { plazo = con.plazo ? Math.round(parseFloat(con.plazo)) : null; } catch { plazo = null; }

        const CHANCHAMAYO_MAP: Record<string, string> = {
          "CHANCHAMAYO": "120301",
          "PERENE": "120302",
          "PICHANAQUI": "120303",
          "SAN LUIS DE SHUARO": "120304",
          "SAN RAMON": "120305",
          "VITOC": "120306"
        };
        const ubigeoCodigo = entidad?.distrito ? (CHANCHAMAYO_MAP[entidad.distrito.toUpperCase()] || null) : null;

        // Upsert entidad
        if (entidad && !seenEntidades.has(entidad.ruc)) {
          seenEntidades.add(entidad.ruc);
          await db.insert(entidadesTable).values({
            ruc: entidad.ruc,
            nombre: entidad.nombre.slice(0, 500),
            tipo: "MUNICIPALIDAD",
            nivelGobierno: "LOCAL",
            ubigeoCodigo: ubigeoCodigo,
          }).onConflictDoUpdate({
            target: [entidadesTable.ruc],
            set: { ubigeoCodigo: ubigeoCodigo }
          });
        }

        // Upsert proveedor
        if (proveedor && !seenProveedores.has(proveedor.ruc)) {
          seenProveedores.add(proveedor.ruc);
          await db.insert(proveedoresTable).values({
            ruc: proveedor.ruc,
            razonSocial: proveedor.nombre.slice(0, 500),
            ubigeoCodigo: null,
            vigenteRnp: null,
          }).onConflictDoNothing();
        }

        // Upsert contratacion
        const existing = await db.select({ ocid: contratacionesTable.ocid })
          .from(contratacionesTable)
          .where(eq(contratacionesTable.ocid, ocid))
          .limit(1);

        let estadoReal = "CONVOCADO";
        if (fechaCon) estadoReal = "CONTRATADO";
        else if (fechaAdj) estadoReal = "ADJUDICADO";

        const obsCount = observacionesMap[ocid] ?? 0;

        if (existing.length === 0) {
          await db.insert(contratacionesTable).values({
            ocid,
            titulo: titulo.slice(0, 500),
            descripcion,
            tipo,
            procedimiento,
            estado: estadoReal,
            entidadRuc: entidad?.ruc ?? null,
            proveedorRuc: proveedor?.ruc ?? null,
            ubigeoCodigo: ubigeoCodigo,
            montoReferencial: montoRef,
            montoAdjudicado: montoAdj,
            moneda: "PEN",
            fechaConvocatoria: fechaConv || new Date(),
            fechaAdjudicacion: fechaAdj,
            fechaContrato: fechaCon,
            plazoEjecucionDias: plazo,
            observacionesCount: obsCount,
            rawOcds: reg as Record<string, unknown>,
          });
          nuevos++;
        } else {
          await db.update(contratacionesTable).set({
            estado: estadoReal,
            ubigeoCodigo: ubigeoCodigo,
            montoAdjudicado: montoAdj,
            fechaConvocatoria: fechaConv || undefined,
            fechaAdjudicacion: fechaAdj,
            fechaContrato: fechaCon,
            proveedorRuc: proveedor?.ruc ?? null,
            ...(obsCount > 0 ? { observacionesCount: obsCount } : {}),
          }).where(eq(contratacionesTable.ocid, ocid));
          actualizados++;
        }

        procesadosOcids.add(ocid);
      } catch (err) {
        console.error(`Error procesando ${ocid}:`, err);
        errores++;
      }
    }

    // ── Importar artículos adjudicados ───────────────────────────────
    let articulosImportados = 0;
    if (articulosAdj && articulosAdj.length > 0) {
      for (const art of articulosAdj) {
        const ocid = art["Open Contracting ID"];
        if (!procesadosOcids.has(ocid)) continue;

        const id = art["Entrega compilada:Adjudicaciones:Artículos Adjudicados:ID"];
        if (!id) continue;

        try {
          await db.insert(articulosAdjudicadosTable).values({
            id,
            ocid,
            posicion: art["compiledRelease/awards/0/items/0/position"]
              ? parseInt(art["compiledRelease/awards/0/items/0/position"])
              : null,
            descripcion: (art["Entrega compilada:Adjudicaciones:Artículos Adjudicados:Descripción"] || "Sin descripción").slice(0, 500),
            clasificacionId: art["Entrega compilada:Adjudicaciones:Artículos Adjudicados:Clasificación:ID"] || null,
            clasificacionDesc: (art["Entrega compilada:Adjudicaciones:Artículos Adjudicados:Clasificación:Descripción"] || null)?.slice(0, 500),
            cantidad: art["Entrega compilada:Adjudicaciones:Artículos Adjudicados:Cantidad"] || null,
            unidadNombre: art["Entrega compilada:Adjudicaciones:Artículos Adjudicados:Unidad:Nombre"] || null,
            montoTotal: art["compiledRelease/awards/0/items/0/totalValue/amount"] || null,
            moneda: art["compiledRelease/awards/0/items/0/totalValue/currency"] || "PEN",
            estado: art["compiledRelease/awards/0/items/0/statusDetails"] || null,
          }).onConflictDoNothing();
          articulosImportados++;
        } catch (err) {
          console.error(`Error importando artículo ${id}:`, err);
        }
      }
    }

    // ── Importar órdenes de compra/servicio ──────────────────────────
    let ordenesImportadas = 0;
    if (ordenes && ordenes.length > 0) {
      for (const ord of ordenes) {
        const ocid = ord["Open Contracting ID"];
        if (!procesadosOcids.has(ocid)) continue;
        // Las órdenes enriquecen la contratación con info adicional
        // Por ahora las contamos y guardamos en rawOcds si la contratación existe
        try {
          const fechaOrden = safeDate(ord["Entrega compilada:Contratos:Fecha de firma"] ?? ord["Entrega compilada:Implementación:Transacciones:Fecha"]);
          const montoOrden = safeDecimal(ord["Entrega compilada:Implementación:Transacciones:Valor:Monto"] ?? ord["Entrega compilada:Contratos:Valor:Monto"]);
          if (fechaOrden || montoOrden) {
            await db.update(contratacionesTable).set({
              ...(fechaOrden && !conMap[ocid]?.fecha ? { fechaContrato: fechaOrden } : {}),
              ...(montoOrden ? { montoAdjudicado: montoOrden } : {}),
              estado: "CONTRATADO",
            }).where(eq(contratacionesTable.ocid, ocid));
          }
          ordenesImportadas++;
        } catch (err) {
          console.error(`Error importando orden para ${ocid}:`, err);
        }
      }
    }

    const observacionesImportadas = Object.values(observacionesMap).reduce((s, v) => s + v, 0);

    // Registrar sync log
    await db.insert(syncLogTable).values({
      id: randomUUID(),
      registrosProcesados: chanRegs.length,
      registrosNuevos: nuevos,
      registrosActualizados: actualizados,
      errores: errores > 0 ? [{ errores }] : null,
      estado: errores === 0 ? "OK" : "PARCIAL",
    });

    res.json({
      message: "Carga completada",
      chanchamayoEncontrados: chanchamayoOcids.size,
      procesados: chanRegs.length,
      nuevos,
      actualizados,
      errores,
      articulosImportados,
      ordenesImportadas,
      observacionesImportadas,
    });
  } catch (err) {
    console.error("CSV upload error:", err);
    res.status(500).json({ error: "Error procesando CSV", message: String(err) });
  }
});

// ── GET /api/sync/status ─────────────────────────────────────────────
router.get("/sync/status", async (_req, res): Promise<void> => {
  const lastSync = await db.select().from(syncLogTable)
    .orderBy(syncLogTable.fechaEjecucion).limit(1);
  res.json({ ultimaEjecucion: lastSync[0] ?? null });
});

export default router;
