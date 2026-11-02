// Capa de datos: todas las lecturas/escrituras a Firestore pasan por aquí.
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  query, orderBy, limit, writeBatch, serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase.js";
import { EXERCISES, EXERCISE_BY_ID } from "./exercises.js";
import { PROFILE_TEMPLATES } from "./profiles.js";

// Construye una sesión "base" a partir de los pesos de partida del perfil,
// para que el historial no arranque vacío (representa el último estado conocido).
// Devuelve null si el perfil no trae pesos sembrados (p.ej. esposa por confirmar).
function buildBaselineSession(tpl) {
  const st = tpl.seedState || {};
  if (!Object.keys(st).length) return null;
  const seen = new Set();
  const entries = [];
  for (const item of tpl.routine) {
    if (item.status !== "active") continue;
    if (seen.has(item.exerciseId)) continue; // dedup (abs A/B)
    const s = st[item.exerciseId];
    if (!s) continue;
    seen.add(item.exerciseId);
    const range = item.repRange || [8, 12];
    const reps = range[0]; // piso del rango: sin gatillar "subir" de inmediato
    const type = item.progressionType || EXERCISE_BY_ID[item.exerciseId]?.progressionType || "weight";
    let sets;
    if (type === "incline") sets = [{ setIndex: 0, reps, level: s.level }];
    else if (item.unilateral) sets = [
      { setIndex: 0, side: "R", reps, blocks: s.right?.blocks },
      { setIndex: 0, side: "L", reps, blocks: s.left?.blocks },
    ];
    else sets = [{ setIndex: 0, reps, blocks: s.blocks }];
    entries.push({ exerciseId: item.exerciseId, order: item.order, sets, verdict: "hold" });
  }
  if (!entries.length) return null;
  const date = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10); // hace ~3 días
  return {
    date, weekNumber: tpl.program.currentWeek || 1, phase: tpl.program.currentPhase || 1,
    dayLabel: "full", status: "baseline", entries,
  };
}

// --- Catálogo global de ejercicios ---------------------------------------
export async function ensureCatalog() {
  const snap = await getDocs(collection(db, "exercises"));
  if (!snap.empty) return;
  const batch = writeBatch(db);
  for (const ex of EXERCISES) batch.set(doc(db, "exercises", ex.id), ex);
  await batch.commit();
}

// --- Usuario --------------------------------------------------------------
export async function getUser(uid) {
  const s = await getDoc(doc(db, "users", uid));
  return s.exists() ? s.data() : null;
}

// Siembra el documento del usuario a partir de una plantilla de perfil.
export async function seedUser(uid, profileKey, { email, displayName } = {}) {
  const tpl = PROFILE_TEMPLATES[profileKey];
  if (!tpl) throw new Error("Perfil desconocido: " + profileKey);

  const userDoc = {
    uid,
    email: email || null,
    displayName: displayName || tpl.displayName,
    profileKey,
    program: { ...tpl.program, startDate: Date.now() },
    progressionConfig: tpl.progressionConfig,
    safety: tpl.safety,
    routine: tpl.routine,
    routineVersion: tpl.routineVersion || 1,
    confirmWeights: !!tpl.confirmWeights, // pesos por confirmar (esposa/hijo)
    lastDayLabel: null, // para alternar A/B (esposa)
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(db, "users", uid), userDoc);

  // Estado inicial con los pesos/nivel de partida del perfil (si los trae).
  await setDoc(doc(db, "users", uid, "state", "current"), {
    byExercise: tpl.seedState || {},
    updatedAt: serverTimestamp(),
  });

  // Sesión base en el historial (si el perfil trae pesos), para no partir vacío.
  const baseline = buildBaselineSession(tpl);
  if (baseline) {
    await addDoc(collection(db, "users", uid, "sessions"), {
      ...baseline,
      exercisesTouched: baseline.entries.map((e) => e.exerciseId),
      createdAt: serverTimestamp(),
    });
  }
  return userDoc;
}

export async function updateProgram(uid, fields) {
  await updateDoc(doc(db, "users", uid), fields);
}

export async function updateRoutine(uid, routine) {
  await updateDoc(doc(db, "users", uid), { routine });
}

// Reemplaza rutina/reglas por las de la plantilla del perfil, conservando lo
// personal: pesos (state/current), historial (sessions), semana y fecha de inicio.
export async function applyRoutineUpdate(uid, profileKey) {
  const tpl = PROFILE_TEMPLATES[profileKey];
  if (!tpl) throw new Error("Perfil desconocido: " + profileKey);
  const snap = await getDoc(doc(db, "users", uid));
  const cur = snap.exists() ? snap.data() : {};
  const program = {
    ...tpl.program,
    startDate: cur.program?.startDate ?? Date.now(),
    currentWeek: cur.program?.currentWeek ?? tpl.program.currentWeek ?? 1,
    currentPhase: cur.program?.currentPhase ?? tpl.program.currentPhase ?? 1,
  };
  await updateDoc(doc(db, "users", uid), {
    program,
    progressionConfig: tpl.progressionConfig,
    routine: tpl.routine,
    safety: tpl.safety,
    routineVersion: tpl.routineVersion || 1,
    lastDayLabel: null, // el ciclo nuevo parte en su primera sesión
  });
  return program;
}

// --- Estado de progresión (state/current) ---------------------------------
export async function getState(uid) {
  const s = await getDoc(doc(db, "users", uid, "state", "current"));
  return s.exists() ? s.data() : { byExercise: {} };
}

export async function setExerciseState(uid, exerciseId, next) {
  await setDoc(
    doc(db, "users", uid, "state", "current"),
    { byExercise: { [exerciseId]: next }, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// Escribe el estado de varios ejercicios de una (usado por el seed real).
export async function mergeState(uid, byExercise) {
  await setDoc(
    doc(db, "users", uid, "state", "current"),
    { byExercise, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// Re-aplica los pesos de partida del perfil (para usuarios ya creados con
// datos en blanco de intentos anteriores). Agrega la sesión base si no hay
// ninguna sesión aún. Devuelve un resumen de lo aplicado.
export async function applySeedValues(uid, profileKey) {
  const tpl = PROFILE_TEMPLATES[profileKey];
  const seed = tpl?.seedState || {};
  if (!Object.keys(seed).length) return { weights: 0, baseline: false };
  await mergeState(uid, seed);
  let baseline = false;
  const existing = await listSessions(uid, 1);
  if (!existing.length) {
    const base = buildBaselineSession(tpl);
    if (base) {
      await addDoc(collection(db, "users", uid, "sessions"), {
        ...base,
        exercisesTouched: base.entries.map((e) => e.exerciseId),
        createdAt: serverTimestamp(),
      });
      baseline = true;
    }
  }
  return { weights: Object.keys(seed).length, baseline };
}

// --- Sesiones -------------------------------------------------------------
export async function saveSession(uid, session) {
  const exercisesTouched = (session.entries || []).map((e) => e.exerciseId);
  const ref = await addDoc(collection(db, "users", uid, "sessions"), {
    ...session,
    exercisesTouched,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listSessions(uid, max = 60) {
  const q = query(collection(db, "users", uid, "sessions"), orderBy("date", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
