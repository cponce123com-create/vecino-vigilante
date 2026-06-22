import { Router, type IRouter } from "express";
import { db, personasTable, relacionesTable, etiquetasTable, personaEtiquetasTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { BuscarPersonaQueryParams, EtiquetarPersonaBody } from "@workspace/api-zod";
import multer from "multer";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const PYTHON_MS_URL = process.env.PYTHON_MICROSERVICE_URL || "http://localhost:8000";

// ──────────────────────────────────────────────────────────────
// GET /api/personas/buscar?dni=XXXX&profundidad=4
// Busca persona por DNI y construye árbol genealógico hasta N niveles
// ──────────────────────────────────────────────────────────────
router.get("/personas/buscar", async (req, res): Promise<void> => {
  const parsed = BuscarPersonaQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { dni, profundidad } = parsed.data;

  try {
    // Find the person
    const [persona] = await db
      .select()
      .from(personasTable)
      .where(eq(personasTable.dni, dni))
      .limit(1);

    if (!persona) {
      res.json({ persona: null, arbol: { nodos: [], aristas: [] } });
      return;
    }

    // CTE Recursive query for family tree up to profundidad levels
    const treeResult = await db.execute(sql`
      WITH RECURSIVE arbol AS (
        -- Base case: the searched person
        SELECT id, dni, nombre, foto_url, 0 AS nivel
        FROM personas
        WHERE id = ${persona.id}

        UNION

        -- Recursive step: find related persons
        SELECT p.id, p.dni, p.nombre, p.foto_url, a.nivel + 1
        FROM arbol a
        JOIN relaciones r ON r.persona1_id = a.id OR r.persona2_id = a.id
        JOIN personas p ON p.id = CASE WHEN r.persona1_id = a.id THEN r.persona2_id ELSE r.persona1_id END
        WHERE a.nivel < ${profundidad}
      )
      SELECT DISTINCT id, dni, nombre, foto_url, nivel FROM arbol
    `);

    const treeRows = treeResult.rows as Array<{ id: string; dni: string; nombre: string; foto_url: string | null; nivel: number }>;

    // Get all relationships between nodes in the tree
    const treeIds = treeRows.map((r) => r.id);
    let relaciones: Array<{ id: string; persona1_id: string; persona2_id: string; tipo_relacion: string }> = [];
    if (treeIds.length > 0) {
      const relResult = await db.execute(sql`
        SELECT r.id, r.persona1_id, r.persona2_id, r.tipo_relacion
        FROM relaciones r
        WHERE r.persona1_id = ANY(${treeIds}::uuid[])
           OR r.persona2_id = ANY(${treeIds}::uuid[])
      `);
      relaciones = relResult.rows as any;
    }

    // Get all tags for these persons
    const etiquetasMap: Record<string, string[]> = {};
    if (treeIds.length > 0) {
      const tagResult = await db.execute(sql`
        SELECT pe.persona_id, e.nombre
        FROM persona_etiquetas pe
        JOIN etiquetas e ON e.id = pe.etiqueta_id
        WHERE pe.persona_id = ANY(${treeIds}::uuid[])
      `);
      for (const row of tagResult.rows as Array<{ persona_id: string; nombre: string }>) {
        const pid = row.persona_id;
        if (!etiquetasMap[pid]) etiquetasMap[pid] = [];
        etiquetasMap[pid].push(row.nombre);
      }
    }

    // Build response
    const nodos = treeRows.map((r) => ({
      id: r.id,
      dni: r.dni,
      nombre: r.nombre,
      fotoUrl: r.foto_url,
      nivel: Number(r.nivel),
      etiquetas: etiquetasMap[r.id] || [],
    }));

    const aristas = relaciones.map((r) => ({
      source: r.persona1_id,
      target: r.persona2_id,
      tipoRelacion: r.tipo_relacion,
    }));

    res.json({
      persona: nodos.find((n) => n.id === persona.id) || null,
      arbol: { nodos, aristas },
    });
  } catch (error) {
    console.error("Error searching person:", error);
    res.status(500).json({ error: "Error al buscar persona" });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/personas/:id/etiquetar
// Asigna una etiqueta existente o crea una nueva
// ──────────────────────────────────────────────────────────────
router.post("/personas/:id/etiquetar", async (req, res): Promise<void> => {
  const personaId = req.params.id as string;
  const parsed = EtiquetarPersonaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { etiquetaId, nombre } = parsed.data;

  try {
    // Verify person exists
    const [persona] = await db
      .select({ id: personasTable.id })
      .from(personasTable)
      .where(eq(personasTable.id, personaId))
      .limit(1);

    if (!persona) {
      res.status(404).json({ error: "Persona no encontrada" });
      return;
    }

    let targetEtiquetaId = etiquetaId;

    // If no etiquetaId but a name is given, find or create the tag
    if (!targetEtiquetaId && nombre) {
      const [existing] = await db
        .select()
        .from(etiquetasTable)
        .where(eq(etiquetasTable.nombre, nombre))
        .limit(1);

      if (existing) {
        targetEtiquetaId = existing.id;
      } else {
        const [created] = await db
          .insert(etiquetasTable)
          .values({ nombre, descripcion: null })
          .returning({ id: etiquetasTable.id });
        targetEtiquetaId = created.id;
      }
    }

    if (!targetEtiquetaId) {
      res.status(400).json({ error: "Debe proporcionar etiquetaId o nombre" });
      return;
    }

    // Upsert: insert the persona-etiqueta relation if not exists
    await db
      .insert(personaEtiquetasTable)
      .values({ personaId, etiquetaId: targetEtiquetaId })
      .onConflictDoNothing();

    res.json({ message: "Etiqueta asignada correctamente" });
  } catch (error) {
    console.error("Error tagging person:", error);
    res.status(500).json({ error: "Error al etiquetar persona" });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/personas/:id/foto
// Sube una foto, la reenvía al microservicio Python y guarda URL
// ──────────────────────────────────────────────────────────────
router.post("/personas/:id/foto", upload.single("file"), async (req, res): Promise<void> => {
  const personaId = req.params.id as string;

  if (!req.file) {
    res.status(400).json({ error: "Debe enviar un archivo de imagen" });
    return;
  }

  try {
    // Get person DNI
    const [persona] = await db
      .select({ dni: personasTable.dni })
      .from(personasTable)
      .where(eq(personasTable.id, personaId))
      .limit(1);

    if (!persona) {
      res.status(404).json({ error: "Persona no encontrada" });
      return;
    }

    // Forward to Python microservice
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype });
    formData.append("file", blob, req.file.originalname);
    formData.append("dni", persona.dni);

    const pythonResponse = await fetch(`${PYTHON_MS_URL}/subir_foto`, {
      method: "POST",
      body: formData,
    });

    if (!pythonResponse.ok) {
      const errorText = await pythonResponse.text();
      console.error("Python microservice error:", errorText);
      res.status(502).json({ error: "Error al subir foto al microservicio" });
      return;
    }

    const fotoData = await pythonResponse.json() as { url: string };
    const url = fotoData.url;

    // Update photo URL in database
    await db
      .update(personasTable)
      .set({ fotoUrl: url })
      .where(eq(personasTable.id, personaId));

    res.json({ url });
  } catch (error) {
    console.error("Error uploading photo:", error);
    res.status(500).json({ error: "Error al subir foto" });
  }
});

export default router;
