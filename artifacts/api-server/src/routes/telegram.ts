import { Router, type IRouter } from "express";
import { db, personasTable, relacionesTable, etiquetasTable, personaEtiquetasTable, mensajesTelegramTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { ProcesarMensajeBody } from "@workspace/api-zod";

const router: IRouter = Router();

const PYTHON_MS_URL = process.env.PYTHON_MICROSERVICE_URL || "http://localhost:8000";

// ──────────────────────────────────────────────────────────────
// POST /api/telegram/procesar
// Recibe un texto de chat, llama al microservicio Python,
// procesa la respuesta y guarda/actualiza en la base de datos
// ──────────────────────────────────────────────────────────────
router.post("/telegram/procesar", async (req, res): Promise<void> => {
  const parsed = ProcesarMensajeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { texto, chatId } = parsed.data;

  try {
    // 1. Save the original message
    const [mensaje] = await db
      .insert(mensajesTelegramTable)
      .values({ chatId, mensajeTexto: texto, procesado: false })
      .returning({ id: mensajesTelegramTable.id });

    // 2. Call Python microservice
    const pythonResponse = await fetch(`${PYTHON_MS_URL}/procesar_mensaje`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto, chat_id: chatId }),
    });

    if (!pythonResponse.ok) {
      const errorText = await pythonResponse.text();
      console.error("Python microservice error:", errorText);
      res.status(502).json({ error: "Error al procesar mensaje en el microservicio NLP" });
      return;
    }

    interface EntidadResult { dni?: string; nombre: string; tipo?: string; }
    interface RelacionResult { persona1Dni?: string; persona1Nombre: string; persona2Dni?: string; persona2Nombre: string; tipoRelacion: string; }
    interface EtiquetaResult { nombre: string; }
    interface PythonResult { entidades: EntidadResult[]; relaciones: RelacionResult[]; etiquetas: EtiquetaResult[]; }

    const result = await pythonResponse.json() as PythonResult;
    const entidades = result.entidades;
    const relaciones = result.relaciones;
    const etiquetas = result.etiquetas;

    // 3. Process entities: upsert persons
    const dniToIdMap: Record<string, string> = {};

    for (const entidad of entidades) {
      if (!entidad.dni) continue;

      // Check if person exists by DNI
      const [existingPersona] = await db
        .select({ id: personasTable.id })
        .from(personasTable)
        .where(eq(personasTable.dni, entidad.dni))
        .limit(1);

      if (existingPersona) {
        // Update name if needed
        await db
          .update(personasTable)
          .set({ nombre: entidad.nombre })
          .where(eq(personasTable.id, existingPersona.id));
        dniToIdMap[entidad.dni] = existingPersona.id;
      } else {
        // Insert new person
        const [newPersona] = await db
          .insert(personasTable)
          .values({ dni: entidad.dni, nombre: entidad.nombre })
          .returning({ id: personasTable.id });
        dniToIdMap[entidad.dni] = newPersona.id;
      }
    }

    // 4. Process relationships
    for (const rel of relaciones) {
      const p1Id = rel.persona1Dni ? dniToIdMap[rel.persona1Dni] : null;
      const p2Id = rel.persona2Dni ? dniToIdMap[rel.persona2Dni] : null;

      if (!p1Id || !p2Id) continue;

      // Check if relationship already exists
      const [existingRel] = await db
        .select({ id: relacionesTable.id })
        .from(relacionesTable)
        .where(
          and(
            eq(relacionesTable.persona1Id, p1Id),
            eq(relacionesTable.persona2Id, p2Id),
            eq(relacionesTable.tipoRelacion, rel.tipoRelacion as "PADRE_DE" | "MADRE_DE" | "HERMANO_DE" | "CONYUGE_DE" | "HIJO_DE"),
          )
        )
        .limit(1);

      if (!existingRel) {
        await db.insert(relacionesTable).values({
          persona1Id: p1Id,
          persona2Id: p2Id,
          tipoRelacion: rel.tipoRelacion as any,
        });
      }
    }

    // 5. Process labels/tags
    for (const etiqueta of etiquetas) {
      // Find or create the tag
      const [existingTag] = await db
        .select({ id: etiquetasTable.id })
        .from(etiquetasTable)
        .where(eq(etiquetasTable.nombre, etiqueta.nombre))
        .limit(1);

      let tagId: string;
      if (existingTag) {
        tagId = existingTag.id;
      } else {
        const [newTag] = await db
          .insert(etiquetasTable)
          .values({ nombre: etiqueta.nombre })
          .returning({ id: etiquetasTable.id });
        tagId = newTag.id;
      }

      // Assign tag to all found persons
      for (const dni of Object.keys(dniToIdMap)) {
        await db
          .insert(personaEtiquetasTable)
          .values({ personaId: dniToIdMap[dni], etiquetaId: tagId })
          .onConflictDoNothing();
      }
    }

    // 6. Mark message as processed
    await db
      .update(mensajesTelegramTable)
      .set({ procesado: true })
      .where(eq(mensajesTelegramTable.id, mensaje.id));

    res.json({
      message: "Mensaje procesado correctamente",
      personasCreadas: Object.keys(dniToIdMap).length,
      relacionesCreadas: relaciones.length,
      etiquetasCreadas: etiquetas.length,
    });
  } catch (error) {
    console.error("Error processing Telegram message:", error);
    res.status(500).json({ error: "Error al procesar mensaje de Telegram" });
  }
});

export default router;
