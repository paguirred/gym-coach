// Motor de progresión — FUNCIÓN PURA, sin dependencias, offline-friendly.
// La misma lógica para los tres perfiles; sólo cambian los parámetros
// (progressionConfig + routine item) que se le pasan.
//
// Estado guardado por ejercicio (state/current.byExercise[id]):
//   peso normal:  { blocks, lastReps, lastVerdict, updatedAt }
//   unilateral:   { right:{blocks,lastReps}, left:{blocks,lastReps}, lastVerdict, updatedAt }
//   inclinación:  { level, holdDisc, lastReps, lastVerdict, updatedAt }
import { EXERCISE_BY_ID } from "./exercises.js";

// El tipo de progresión vive en el catálogo; los ítems de rutina pueden no traerlo.
function typeOf(item) {
  return item.progressionType || EXERCISE_BY_ID[item.exerciseId]?.progressionType || "weight";
}

// Nº de series para un ejercicio en una semana dada.
// Prioridad: regla de compuestos (Patricio sem 3+) > series propias del ítem > default.
export function setsFor(item, config, week) {
  const s = config.sets || {};
  if (
    Array.isArray(s.compoundIds) &&
    s.compoundIds.includes(item.exerciseId) &&
    week >= (s.compoundSetsFromWeek || Infinity)
  ) {
    return s.compoundSets || s.default || 1;
  }
  if (item.sets != null) return item.sets;
  return s.default || 1;
}

// Texto de intensidad según el perfil y la semana (cue de coaching, no matemática).
export function intensityCue(config, week) {
  const i = config.intensity || {};
  switch (i.mode) {
    case "progressiveFailure": // Patricio
      if (week >= (i.toFailureFromWeek || 3)) return "Al fallo muscular real.";
      return `Deja ${i.earlyRir[0]}–${i.earlyRir[1]} repes en reserva (aún no al fallo).`;
    case "hypertrophy": // Patricio (split 5 días)
      return `RIR ${i.rir[0]}–${i.rir[1]} en las primeras series${i.failLastSet ? "; la última puedes llevarla al fallo" : ""}.`;
    case "rirFixed": // Hijo
      return `RIR ${i.rir[0]}–${i.rir[1]}: para con ${i.rir[0]}–${i.rir[1]} repes buenas en reserva. Nunca al fallo.`;
    case "prudent": // Esposa
      return `Prudente (RIR ${i.rir?.[0] ?? 2}): sin agotamiento, el peso sólo cuesta en las últimas 2–3 repes.`;
    default:
      return "";
  }
}

// Núcleo del veredicto para UN valor de peso+repes contra un rango.
// Devuelve { verdict, nextBlocks }.
function verdictWeight(blocks, reps, [min, max]) {
  if (reps >= max) return { verdict: "up", nextBlocks: blocks + 1 };
  if (reps >= min) return { verdict: "hold", nextBlocks: blocks };
  if (reps < min - 2) return { verdict: "down", nextBlocks: Math.max(0, blocks - 1) };
  return { verdict: "hold", nextBlocks: blocks };
}

// Veredicto para abdominales (progresa por nivel de inclinación).
// Sube de nivel al pasar el umbral de repes (por defecto 20, según protocolo).
function verdictIncline(level, reps, upAt) {
  if (reps >= upAt) return { verdict: "up", nextLevel: level + 1 };
  return { verdict: "hold", nextLevel: level };
}

// De las series registradas (un lado), saca el peso de trabajo y el PROMEDIO
// de repeticiones.
// Se usa el promedio y no la mejor serie a propósito: con la mejor, una primera
// serie muy alta hacía subir el peso aunque las siguientes cayeran bastante.
// Con el promedio, 17-6-6 en un rango 8-12 da 9,7 y se mantiene el peso.
function bestOf(sets) {
  const blocks = Math.max(...sets.map((s) => Number(s.blocks) || 0));
  const total = sets.reduce((acc, s) => acc + (Number(s.reps) || 0), 0);
  const reps = sets.length ? total / sets.length : 0;
  return { blocks, reps, series: sets.length };
}

// Promedio legible para los mensajes ("9,7" en vez de "9.666666").
function fmtReps(n) {
  return (Math.round(n * 10) / 10).toString().replace(".", ",");
}

// Evalúa un ejercicio completo tras una sesión.
// logged: { sets:[{blocks,reps,side?}], level? }
// Devuelve { verdict, next, message } donde `next` es el nuevo estado a guardar.
export function evaluateExercise({ item, config }) {
  return (loggedRaw) => {
    // La serie de calentamiento no cuenta para el veredicto.
    const workSets = (loggedRaw.sets || []).filter((s) => !s.warmup);
    const logged = { ...loggedRaw, sets: workSets.length ? workSets : (loggedRaw.sets || []) };
    const range = item.repRange || config.repRanges.upper;
    const exType = typeOf(item);

    // Solo-repes (p.ej. abdominales planos post-bariátricos): registrar sin progresión.
    if (exType === "reps") {
      const { reps, series } = bestOf(logged.sets);
      return {
        verdict: "hold",
        next: { lastReps: Math.round(reps), lastVerdict: "hold", updatedAt: Date.now() },
        message: `Registrado: ${fmtReps(reps)} repes${series > 1 ? " de promedio" : ""}. Sin subir intensidad (pendiente confirmación médica).`,
      };
    }

    if (exType === "incline") {
      const { reps, series } = bestOf(logged.sets);
      const level = Number(logged.level ?? logged.sets[0]?.level ?? 1);
      const upAt = item.inclineUpReps || range[1];
      const r = verdictIncline(level, reps, upAt);
      const prom = series > 1 ? ` Promedio: ${fmtReps(reps)} repes.` : "";
      return {
        verdict: r.verdict,
        next: { level: r.nextLevel, holdDisc: !!logged.holdDisc, lastReps: Math.round(reps), lastVerdict: r.verdict, updatedAt: Date.now() },
        message: r.verdict === "up"
          ? `¡Pasaste las ${upAt}! Próxima vez sube a nivel ${r.nextLevel}. Puedes sostener un disco al pecho.${prom}`
          : `Mantén el nivel ${level} (sube al pasar ${upAt} repes).${prom}`,
      };
    }

    if (item.unilateral) {
      const right = logged.sets.filter((s) => s.side === "R");
      const left = logged.sets.filter((s) => s.side === "L");
      const rB = bestOf(right.length ? right : logged.sets);
      const lB = bestOf(left.length ? left : logged.sets);
      const rV = verdictWeight(rB.blocks, rB.reps, range);
      const lV = verdictWeight(lB.blocks, lB.reps, range);
      const promUni = (rB.series > 1 || lB.series > 1)
        ? ` (promedio ${fmtReps(rB.reps)} der / ${fmtReps(lB.reps)} izq)` : "";
      return {
        verdict: { right: rV.verdict, left: lV.verdict },
        next: {
          right: { blocks: rV.nextBlocks, lastReps: Math.round(rB.reps) },
          left: { blocks: lV.nextBlocks, lastReps: Math.round(lB.reps) },
          lastVerdict: { right: rV.verdict, left: lV.verdict },
          updatedAt: Date.now(),
        },
        message: `Derecha: ${verdictText(rV.verdict, rV.nextBlocks)} · Izquierda: ${verdictText(lV.verdict, lV.nextBlocks)}${promUni}`,
      };
    }

    const { blocks, reps, series } = bestOf(logged.sets);
    const r = verdictWeight(blocks, reps, range);
    const prom = series > 1 ? ` (promedio ${fmtReps(reps)} repes en ${series} series)` : "";
    return {
      verdict: r.verdict,
      next: { blocks: r.nextBlocks, lastReps: Math.round(reps), lastVerdict: r.verdict, updatedAt: Date.now() },
      message: `${verdictText(r.verdict, r.nextBlocks)}${prom}`,
    };
  };
}

function verdictText(verdict, nextBlocks) {
  if (verdict === "up") return `SUBIR a ${nextBlocks} bloques la próxima.`;
  if (verdict === "down") return `Bajar a ${nextBlocks} bloques la próxima.`;
  return `MANTENER (${nextBlocks} bloques).`;
}

// Sugerencia a mostrar al INICIAR el ejercicio (lee el estado actual).
// Devuelve la meta: series, rango, y peso(s) sugerido(s) por lado.
export function suggestFor(item, state, config, week) {
  const range = item.repRange || config.repRanges.upper;
  const sets = setsFor(item, config, week);
  const st = state || {};
  const exType = typeOf(item);

  if (exType === "reps") {
    return { type: "reps", sets, repRange: range, cue: intensityCue(config, week), note: item.note };
  }
  if (exType === "incline") {
    return { type: "incline", sets, repRange: range, level: st.level ?? 1, holdDisc: !!st.holdDisc, inclineUpReps: item.inclineUpReps || range[1], cue: intensityCue(config, week) };
  }
  if (item.unilateral) {
    const startSide = item.startSide || "R";
    return {
      type: "unilateral", sets, repRange: range, startSide, mirrorReps: !!item.mirrorReps,
      sides: startSide === "R"
        ? [{ side: "R", blocks: st.right?.blocks ?? null }, { side: "L", blocks: st.left?.blocks ?? null }]
        : [{ side: "L", blocks: st.left?.blocks ?? null }, { side: "R", blocks: st.right?.blocks ?? null }],
      cue: intensityCue(config, week),
    };
  }
  return { type: "weight", sets, repRange: range, blocks: st.blocks ?? null, cue: intensityCue(config, week) };
}

// Semana teórica sugerida a partir de la fecha de inicio (para "avance manual con sugerencia").
export function suggestedWeek(startDateMs, nowMs) {
  if (!startDateMs) return 1;
  const days = Math.floor((nowMs - startDateMs) / 86400000);
  return Math.max(1, Math.floor(days / 7) + 1);
}

// Fase sugerida para la esposa según semana y definición de fases.
export function suggestedPhase(phases, week) {
  if (!phases) return 1;
  for (const [k, p] of Object.entries(phases)) {
    if (week >= p.weeks[0] && week <= p.weeks[1]) return Number(k);
  }
  // más allá de la última fase -> última fase
  return Math.max(...Object.keys(phases).map(Number));
}
