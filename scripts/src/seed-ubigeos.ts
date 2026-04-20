import { db, ubigeosTable } from "@workspace/db";

/**
 * Seed de ubigeos para la provincia de Chanchamayo (Junín, Perú).
 *
 * Los 6 distritos de Chanchamayo con sus códigos UBIGEO INEI oficiales
 * y coordenadas reales (latitud/longitud del centro poblado principal).
 *
 * Fuente: INEI + RENIEC (códigos UBIGEO estándar del Perú).
 *
 * Para ejecutar:
 *   pnpm --filter @workspace/scripts run seed:ubigeos
 */

const CHANCHAMAYO_UBIGEOS = [
  {
    codigo: "120301",
    departamento: "JUNIN",
    provincia: "CHANCHAMAYO",
    distrito: "CHANCHAMAYO",
    latitud: "-11.0550",
    longitud: "-75.3300",
    superficieKm2: "66.45",
    altitud: 751,
  },
  {
    codigo: "120302",
    departamento: "JUNIN",
    provincia: "CHANCHAMAYO",
    distrito: "PERENE",
    latitud: "-10.9386",
    longitud: "-75.3261",
    superficieKm2: "1194.47",
    altitud: 650,
  },
  {
    codigo: "120303",
    departamento: "JUNIN",
    provincia: "CHANCHAMAYO",
    distrito: "PICHANAQUI",
    latitud: "-10.9244",
    longitud: "-74.8722",
    superficieKm2: "1232.00",
    altitud: 525,
  },
  {
    codigo: "120304",
    departamento: "JUNIN",
    provincia: "CHANCHAMAYO",
    distrito: "SAN LUIS DE SHUARO",
    latitud: "-10.9125",
    longitud: "-75.3306",
    superficieKm2: "154.02",
    altitud: 1050,
  },
  {
    codigo: "120305",
    departamento: "JUNIN",
    provincia: "CHANCHAMAYO",
    distrito: "SAN RAMON",
    latitud: "-11.1236",
    longitud: "-75.3539",
    superficieKm2: "591.67",
    altitud: 830,
  },
  {
    codigo: "120306",
    departamento: "JUNIN",
    provincia: "CHANCHAMAYO",
    distrito: "VITOC",
    latitud: "-11.2156",
    longitud: "-75.3011",
    superficieKm2: "286.03",
    altitud: 1050,
  },
];

async function seed() {
  console.log("🌱 Iniciando seed de ubigeos de Chanchamayo...");

  let insertados = 0;
  let actualizados = 0;

  for (const ubigeo of CHANCHAMAYO_UBIGEOS) {
    const existing = await db
      .select({ codigo: ubigeosTable.codigo })
      .from(ubigeosTable)
      .where(eq(ubigeosTable.codigo, ubigeo.codigo))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(ubigeosTable).values(ubigeo);
      insertados++;
      console.log(`  ✓ Insertado: ${ubigeo.distrito} (${ubigeo.codigo})`);
    } else {
      await db
        .update(ubigeosTable)
        .set(ubigeo)
        .where(eq(ubigeosTable.codigo, ubigeo.codigo));
      actualizados++;
      console.log(`  ↻ Actualizado: ${ubigeo.distrito} (${ubigeo.codigo})`);
    }
  }

  console.log(`\n✅ Seed completado:`);
  console.log(`   Insertados: ${insertados}`);
  console.log(`   Actualizados: ${actualizados}`);
  console.log(`   Total: ${CHANCHAMAYO_UBIGEOS.length} distritos\n`);

  process.exit(0);
}

import { eq } from "drizzle-orm";

seed().catch((err) => {
  console.error("❌ Error en el seed:", err);
  process.exit(1);
});
