// Plantillas de los TRES perfiles con sus reglas reales + datos de seed.
// Fuente: "Rutinas Familiares — Ten Series G3000" (documento maestro).
// La misma máquina de reglas (progression.js) lee estos parámetros; lo único
// que cambia entre personas son estos valores.
//
// Cada perfil trae:
//   program / progressionConfig / safety / routine  (la rutina y sus reglas)
//   seedState  -> byExercise inicial (pesos/nivel de partida) para no partir de cero

// Recordatorios de recuperación / seguridad, por clave.
export const SAFETY = {
  // Patricio
  hidratacion: "Hidrátate: te cuesta tomar agua y eso te afecta el rendimiento. Sorbos entre series.",
  proteina_pat: "Proteína 1.6–2.2 g/kg de peso corporal.",
  sueno_pat: "Dormir 7–9 h: ahí ocurre la ganancia.",
  desbalance_estructural:
    "El desbalance de la pierna derecha (pie equino) es estructural. La calibración fina la valida tu kinesiólogo. No fuerces el tobillo.",
  talones_pendiente:
    "Elevación de talones: PENDIENTE. Consultar con kinesiólogo antes de incluirla.",
  // Esposa (post-bariátrica)
  senales_alerta:
    "Detente si hay mareo, náuseas o dolor articular. El esfuerzo muscular es normal; el malestar general NO.",
  respiracion: "Nunca aguantes la respiración: EXHALA al empujar o tirar.",
  hidratacion_sorbos: "Hidratación en sorbos entre series.",
  proteina_nutri: "Proteína coordinada con la nutricionista (mínimo 60–80 g/día).",
  comer_antes: "Come algo antes de entrenar.",
  dias_baja_energia:
    "En días de baja energía, baja el volumen sin culpa. Preservar músculo, no agotarte.",
  abs_medico:
    "Abdominales: camilla PLANA, suave, manos al pecho. Requiere visto bueno médico por las incisiones. Detén ante cualquier molestia en la zona.",
  // Hijo (16)
  no_al_fallo:
    "NUNCA al fallo total. Deja siempre 1–2 repes buenas en reserva (RIR 1–2). A tu edad la técnica se rompe al final y ahí aparecen lesiones.",
  carga_mma:
    "Levanta los mismos días que entrenas MMA y deja al menos 1 día realmente libre.",
  sueno_crecimiento:
    "Dormir 8–10 h y comer suficiente. Estás creciendo: nada de déficits agresivos, harta proteína.",
};

const R_UPPER = [8, 12];
const R_LEGS = [12, 15];
const R_ISO = [10, 15]; // aislamientos: rango algo más alto para hipertrofia

// Notas reutilizables de la limitación de la pierna derecha (pie equino).
const N_UNI_CUAD = "Empezar por la DERECHA. La izquierda hace las mismas repes, con su propio peso.";
const N_UNI_FEM = "Empezar por la DERECHA. La izquierda iguala repes, con su propio peso. Agárrate firme.";

// ---------------------------------------------------------------------------
// PERFIL 1 — PATRICIO
// Hipertrofia en 5 sesiones cortas (ciclo D1→D5). Se deja el HIT al fallo de
// 3 días porque entrenar al fallo 5 veces por semana no se recupera: ahora el
// volumen semanal se reparte y la intensidad baja a RIR 1–2 (última serie al
// fallo). Cada grupo muscular se trabaja 2 veces por semana.
// ---------------------------------------------------------------------------
export const PATRICIO = {
  profileKey: "patricio",
  displayName: "Patricio",
  routineVersion: 2, // sube al cambiar la rutina: la app ofrece actualizarla
  program: {
    methodology: "Hipertrofia · split 5 días",
    schedule: "5 días por semana (sesiones cortas)",
    sessionsPerWeek: 5,
    currentWeek: 3,
    currentPhase: 1,
    split: "cycle",
    days: [
      { key: "D1", label: "Pecho y tríceps" },
      { key: "D2", label: "Espalda y bíceps" },
      { key: "D3", label: "Piernas y core" },
      { key: "D4", label: "Hombros y brazos" },
      { key: "D5", label: "Cuerpo completo (2ª dosis)" },
    ],
    tempo: "2 seg empuje/tirón, 3 seg retorno",
  },
  progressionConfig: {
    repRanges: { upper: R_UPPER, legs: R_LEGS },
    // 5 días exige dejar el fallo permanente: RIR 1–2 y sólo la última al fallo.
    intensity: { mode: "hypertrophy", rir: [1, 2], failLastSet: true },
    sets: { default: 3 }, // cada ítem define las suyas
    rest: { default: 90, unilateral: 45 }, // más corto para sesiones breves
  },
  safety: ["desbalance_estructural", "talones_pendiente", "hidratacion", "proteina_pat", "sueno_pat"],
  routine: [
    // --- D1 · Pecho y tríceps ---
    { exerciseId: "press_pecho", order: 1, day: "D1", sets: 3, repRange: R_UPPER, warmup: true, status: "active" },
    { exerciseId: "mariposa", order: 2, day: "D1", sets: 3, repRange: R_ISO, status: "active" },
    { exerciseId: "triceps_polea", order: 3, day: "D1", sets: 3, repRange: R_ISO, status: "active" },

    // --- D2 · Espalda y bíceps ---
    { exerciseId: "jalon_pecho", order: 4, day: "D2", sets: 3, repRange: R_UPPER, warmup: true, status: "active" },
    { exerciseId: "remo_sentado", order: 5, day: "D2", sets: 3, repRange: R_UPPER, status: "active" },
    { exerciseId: "curl_biceps", order: 6, day: "D2", sets: 3, repRange: R_ISO, status: "active" },

    // --- D3 · Piernas y core ---
    { exerciseId: "ext_cuadriceps", order: 7, day: "D3", sets: 3, repRange: R_LEGS, warmup: true, status: "active",
      unilateral: true, startSide: "R", mirrorReps: true, note: N_UNI_CUAD },
    { exerciseId: "curl_femoral", order: 8, day: "D3", sets: 3, repRange: R_LEGS, status: "active",
      unilateral: true, startSide: "R", mirrorReps: true, note: N_UNI_FEM },
    { exerciseId: "abdominales", order: 9, day: "D3", sets: 2, repRange: R_LEGS, inclineUpReps: 20, status: "active" },

    // --- D4 · Hombros y brazos ---
    { exerciseId: "remo_menton", order: 10, day: "D4", sets: 3, repRange: R_UPPER, warmup: true, status: "active",
      note: "Ojo con el hombro: si molesta, baja el peso o acorta el recorrido." },
    { exerciseId: "curl_biceps", order: 11, day: "D4", sets: 2, repRange: R_ISO, status: "active" },
    { exerciseId: "triceps_polea", order: 12, day: "D4", sets: 2, repRange: R_ISO, status: "active" },
    { exerciseId: "abdominales", order: 13, day: "D4", sets: 2, repRange: R_LEGS, inclineUpReps: 20, status: "active" },

    // --- D5 · Cuerpo completo (2ª dosis de la semana) ---
    { exerciseId: "press_pecho", order: 14, day: "D5", sets: 2, repRange: R_UPPER, warmup: true, status: "active" },
    { exerciseId: "jalon_pecho", order: 15, day: "D5", sets: 2, repRange: R_UPPER, status: "active" },
    { exerciseId: "ext_cuadriceps", order: 16, day: "D5", sets: 2, repRange: R_LEGS, warmup: true, status: "active",
      unilateral: true, startSide: "R", mirrorReps: true, note: N_UNI_CUAD },
    { exerciseId: "curl_femoral", order: 17, day: "D5", sets: 2, repRange: R_LEGS, status: "active",
      unilateral: true, startSide: "R", mirrorReps: true, note: N_UNI_FEM },

    // Sin día asignado: queda fuera de todas las sesiones mientras esté "pending".
    { exerciseId: "elev_talones", order: 18, repRange: R_LEGS, status: "pending",
      note: "OMITIDA por ahora (pie equino). Consultar kinesiólogo." },
  ],
  seedState: {
    press_pecho: { blocks: 8 },
    mariposa: { blocks: 5 },
    jalon_pecho: { blocks: 5 },
    remo_sentado: { blocks: 7 },
    remo_menton: { blocks: 4 },
    curl_biceps: { blocks: 3 },
    triceps_polea: { blocks: 4 },
    ext_cuadriceps: { right: { blocks: 2 }, left: { blocks: 2 } },
    curl_femoral: { right: { blocks: 2 }, left: { blocks: 2 } },
    abdominales: { level: 2 },
  },
};

// ---------------------------------------------------------------------------
// PERFIL 2 — ESPOSA  (post-bariátrica, split A/B, RIR 2, nunca al fallo)
// ---------------------------------------------------------------------------
export const ESPOSA = {
  profileKey: "esposa",
  displayName: "Esposa",
  program: {
    methodology: "Post-bariátrica · split A/B (RIR 2)",
    sessionsPerWeek: 2, // 2–3, alternando A/B
    currentWeek: 1,
    currentPhase: 1,
    split: "A/B",
    tempo: "2 seg empuje/tirón, 3 seg retorno",
  },
  progressionConfig: {
    repRanges: { upper: R_UPPER, legs: R_LEGS },
    // Nunca al fallo. RIR 2. El peso solo cuesta en las últimas 2–3 repes.
    intensity: { mode: "prudent", neverToFailure: true, rir: [2, 2] },
    sets: { default: 3 },
    rest: { default: 90, unilateral: 60 },
  },
  confirmWeights: true, // pesos reales por confirmar con ella antes del seed definitivo
  safety: ["senales_alerta", "respiracion", "hidratacion_sorbos", "proteina_nutri", "comer_antes", "dias_baja_energia", "abs_medico"],
  // day: A (empuje + core) / B (tirón + core). Alterna en sus 2–3 sesiones.
  routine: [
    // --- Rutina A: empuje + core ---
    // (Press de pecho omitido: la máquina le queda grande a Myriam, 1.46 m, y el
    //  recorrido de brazos le resulta demasiado corto. El pecho lo cubre la mariposa.)
    { exerciseId: "mariposa", order: 2, day: "A", sets: 3, repRange: R_LEGS, warmup: true, status: "active", note: "Lento, sin impulso." },
    { exerciseId: "triceps_polea", order: 3, day: "A", sets: 2, repRange: R_LEGS, status: "active",
      note: "1 bloque de partida (muy liviano). No pudo con 2,5–3 kg: si no rinde, usar banda elástica." },
    { exerciseId: "ext_cuadriceps", order: 4, day: "A", sets: 3, repRange: R_LEGS, warmup: true, status: "active", note: "Subir controlado." },
    { exerciseId: "abdominales", order: 5, day: "A", sets: 2, repRange: R_LEGS, progressionType: "reps", status: "active",
      note: "PLANA. Suave, manos al pecho. Pendiente visto bueno médico (incisiones). Detén ante cualquier molestia." },
    // --- Rutina B: tirón + core ---
    { exerciseId: "jalon_pecho", order: 6, day: "B", sets: 3, repRange: R_LEGS, warmup: true, status: "active", note: "Tirar a la clavícula, no al cuello." },
    { exerciseId: "remo_sentado", order: 7, day: "B", sets: 3, repRange: R_LEGS, status: "active" },
    { exerciseId: "remo_menton", order: 8, day: "B", sets: 2, repRange: R_LEGS, status: "active", note: "Suave, ojo hombro." },
    { exerciseId: "curl_biceps", order: 9, day: "B", sets: 3, repRange: R_LEGS, status: "active",
      note: "1 bloque de partida (muy liviano). No pudo con 2,5–3 kg: si no rinde, usar banda elástica." },
    { exerciseId: "curl_femoral", order: 10, day: "B", sets: 3, repRange: [10, 12], status: "active",
      unilateral: true, startSide: "R", note: "Una pierna a la vez. Agárrate firme." },
    { exerciseId: "abdominales", order: 11, day: "B", sets: 2, repRange: R_LEGS, progressionType: "reps", status: "active",
      note: "PLANA. Suave, manos al pecho. Pendiente visto bueno médico (incisiones). Detén ante cualquier molestia." },
  ],
  // Datos reales de Myriam (última sesión registrada).
  // curl_femoral: usa el peso de su ejercicio de pierna (2 bloques → "sube a 3
  // la próxima"), por eso arranca en 3. remo_menton sin dato en la tabla.
  seedState: {
    ext_cuadriceps: { blocks: 4 },
    mariposa: { blocks: 2 },
    jalon_pecho: { blocks: 4 },
    remo_sentado: { blocks: 5 },
    triceps_polea: { blocks: 1 },
    curl_biceps: { blocks: 1 },
    curl_femoral: { right: { blocks: 3 }, left: { blocks: 3 } },
  },
};

// ---------------------------------------------------------------------------
// PERFIL 3 — HIJO (16, MMA, RIR 1–2 permanente, nunca al fallo)
// ---------------------------------------------------------------------------
export const HIJO = {
  profileKey: "hijo",
  displayName: "Hijo",
  program: {
    methodology: "HIT full-body (adaptado edad) · MMA",
    sessionsPerWeek: 3,
    currentWeek: 1,
    currentPhase: 1,
    tempo: "2 seg empuje/tirón, 3 seg retorno",
  },
  progressionConfig: {
    repRanges: { upper: R_UPPER, legs: R_LEGS },
    intensity: { mode: "rirFixed", rir: [1, 2], neverToFailure: true },
    sets: { default: 1 },
    rest: { default: 120, unilateral: 60 },
  },
  confirmWeights: true, // último estado registrado; confirmar con él
  safety: ["no_al_fallo", "carga_mma", "sueno_crecimiento"],
  routine: [
    { exerciseId: "press_pecho", order: 1, repRange: R_UPPER, warmup: true, status: "active" },
    { exerciseId: "mariposa", order: 2, repRange: R_UPPER, status: "active" },
    { exerciseId: "jalon_pecho", order: 3, repRange: R_UPPER, warmup: true, status: "active" },
    { exerciseId: "remo_sentado", order: 4, repRange: R_UPPER, status: "active" },
    { exerciseId: "remo_menton", order: 5, repRange: R_UPPER, status: "active", note: "Ojo con el hombro." },
    { exerciseId: "curl_biceps", order: 6, repRange: R_UPPER, status: "active" },
    { exerciseId: "triceps_polea", order: 7, repRange: R_UPPER, status: "active" },
    { exerciseId: "ext_cuadriceps", order: 8, repRange: R_LEGS, warmup: true, status: "active" },
    { exerciseId: "curl_femoral", order: 9, repRange: R_LEGS, status: "active", unilateral: true, startSide: "R", note: "Una pierna a la vez." },
    { exerciseId: "abdominales", order: 10, repRange: R_LEGS, inclineUpReps: 20, status: "active", note: "+disco al pecho si falta intensidad." },
    { exerciseId: "elev_talones", order: 11, repRange: R_LEGS, status: "active" },
  ],
  seedState: {
    press_pecho: { blocks: 8 },
    mariposa: { blocks: 3 },
    jalon_pecho: { blocks: 4 },
    remo_sentado: { blocks: 5 },
    remo_menton: { blocks: 4 },
    curl_biceps: { blocks: 3 },
    triceps_polea: { blocks: 2 },
    ext_cuadriceps: { blocks: 4 },
    curl_femoral: { right: { blocks: 3 }, left: { blocks: 3 } },
    abdominales: { level: 1 },
    // elev_talones: sin peso registrado (se define en la 1ª sesión)
  },
};

export const PROFILE_TEMPLATES = {
  patricio: PATRICIO,
  esposa: ESPOSA,
  hijo: HIJO,
};

// Asignación automática de perfil por correo (para no mostrar el selector).
const EMAIL_TO_PROFILE = {
  "patricio.aguirre10@gmail.com": "patricio",
  "mirian.29.mgb@gmail.com": "esposa",
  "padunab@gmail.com": "hijo",
};

// Normaliza un correo: minúsculas y, en gmail, ignora puntos y "+alias"
// (Gmail los ignora, así que mirian.29.mgb == mirian29mgb).
function normalizeEmail(email) {
  if (!email) return "";
  const [rawLocal, rawDomain] = email.trim().toLowerCase().split("@");
  if (!rawDomain) return rawLocal;
  let local = rawLocal, domain = rawDomain;
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.split("+")[0].replace(/\./g, "");
    domain = "gmail.com";
  }
  return `${local}@${domain}`;
}

// Índice normalizado para el lookup.
const NORMALIZED_INDEX = Object.fromEntries(
  Object.entries(EMAIL_TO_PROFILE).map(([mail, key]) => [normalizeEmail(mail), key])
);

// Devuelve el profileKey para un correo, o null si no está mapeado.
export function profileForEmail(email) {
  return NORMALIZED_INDEX[normalizeEmail(email)] || null;
}
