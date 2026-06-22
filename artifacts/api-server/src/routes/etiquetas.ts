import { Router, type IRouter } from "express";
import { db, etiquetasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateEtiquetaBody } from "@workspace/api-zod";

const router: IRouter = Router();

// ──────────────────────────────────────────────────────────────
// GET /api/etiquetas
// Lista todas las etiquetas
// ──────────────────────────────────────────────────────────────
router.get("/etiquetas", async (_req, res): Promise<void> => {
  try {
    const etiquetas = await db
      .select({
        id: etiquetasTable.id,
        nombre: etiquetasTable.nombre,
        descripcion: etiquetasTable.descripcion,
      })
      .from(etiquetasTable)
      .orderBy(etiquetasTable.nombre);

    res.json(etiquetas);
  } catch (error) {
    console.error("Error listing tags:", error);
    res.status(500).json({ error: "Error al listar etiquetas" });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/etiquetas
// Crea una nueva etiqueta
// ──────────────────────────────────────────────────────────────
router.post("/etiquetas", async (req, res): Promise<void> => {
  const parsed = CreateEtiquetaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { nombre, descripcion } = parsed.data;

  try {
    // Check if already exists
    const [existing] = await db
      .select()
      .from(etiquetasTable)
      .where(eq(etiquetasTable.nombre, nombre))
      .limit(1);

    if (existing) {
      res.json(existing); // Return existing instead of error
      return;
    }

    const [created] = await db
      .insert(etiquetasTable)
      .values({ nombre, descripcion })
      .returning({
        id: etiquetasTable.id,
        nombre: etiquetasTable.nombre,
        descripcion: etiquetasTable.descripcion,
      });

    res.status(201).json(created);
  } catch (error) {
    console.error("Error creating tag:", error);
    res.status(500).json({ error: "Error al crear etiqueta" });
  }
});

export default router;
