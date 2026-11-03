// Orquestador principal: auth, router simple, dashboard y sembrado.
import {
  auth, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  signOut, onAuthStateChanged,
} from "./firebase.js";
import {
  ensureCatalog, getUser, seedUser, getState, setExerciseState,
  mergeState, saveSession, listSessions, updateProgram, applySeedValues, applyRoutineUpdate,
} from "./data.js";
import { PROFILE_TEMPLATES, SAFETY, profileForEmail } from "./profiles.js";
import { EXERCISE_BY_ID } from "./exercises.js";
import { suggestedWeek } from "./progression.js";
import { SessionRunner } from "./session.js";
import { renderHistory, renderSessionLog } from "./history.js";
import { speak, setVoiceOutput, isVoiceOutputOn } from "./voice.js";
import { getPref, setPref } from "./prefs.js";
import { loadDraft, clearDraft, hace } from "./draft.js";

// Inicializa la voz según la preferencia guardada.
setVoiceOutput(getPref("voice", true));

const $app = document.getElementById("app");
let CURRENT = { user: null, uid: null };

const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const APP_VERSION = "v25"; // se sube junto con el caché del service worker

// Completa un login por redirección al volver (y muestra el error si lo hubo).
getRedirectResult(auth).catch((e) => {
  console.warn("redirect:", e);
  if (e?.code) alert("No se pudo completar el login: " + e.code);
});

// --- Arranque -------------------------------------------------------------
onAuthStateChanged(auth, async (u) => {
  if (!u) return renderLogin();
  CURRENT.uid = u.uid;
  try { await ensureCatalog(); } catch (e) { console.warn("catálogo:", e); }
  const userDoc = await getUser(u.uid);
  if (!userDoc) return firstLogin(u);
  CURRENT.user = userDoc;
  renderHome();
});

// Primer ingreso: si el correo está mapeado, asigna la rutina automáticamente.
async function firstLogin(u) {
  const key = profileForEmail(u.email);
  if (!key) return renderChooseProfile(u); // correo no mapeado -> selector manual
  $app.innerHTML = `<div class="text-center py-5 text-muted">Preparando tu rutina…</div>`;
  try {
    CURRENT.user = await seedUser(u.uid, key, { email: u.email, displayName: u.displayName });
    renderHome();
  } catch (e) {
    alert("No se pudo preparar la rutina: " + e.message);
    renderChooseProfile(u);
  }
}

// --- Login ----------------------------------------------------------------
function renderLogin() {
  $app.innerHTML = `
    <div class="login-hero">
      <div class="login-logo">🏋️</div>
      <div class="login-title">Coach <span style="color:var(--accent)">G3000</span></div>
      <p class="login-sub">Tu entrenador personal · Ten Series G3000</p>
      <button id="btnLogin" class="btn btn-primary btn-lg w-100 hero-cta">Entrar con Google</button>
    </div>`;
  document.getElementById("btnLogin").onclick = async () => {
    // En móvil el popup lo bloquea el navegador ("no se puede abrir esta página"):
    // usamos redirección. En escritorio, popup (más fluido) con fallback a redirect.
    try {
      if (IS_MOBILE) await signInWithRedirect(auth, googleProvider);
      else await signInWithPopup(auth, googleProvider);
    } catch (e) {
      try { await signInWithRedirect(auth, googleProvider); }
      catch (e2) { alert("No se pudo iniciar sesión: " + (e2.code || e2.message)); }
    }
  };
}

// --- Elegir perfil (primer login) -----------------------------------------
function renderChooseProfile(u) {
  const opts = Object.values(PROFILE_TEMPLATES).map((p) => `
    <button class="list-group-item list-group-item-action" data-key="${p.profileKey}">
      <div class="avatar">${p.displayName.charAt(0).toUpperCase()}</div>
      <div>
        <div class="fw-bold">${p.displayName}</div>
        <div class="small text-muted">${p.program.methodology}</div>
      </div>
    </button>`).join("");
  $app.innerHTML = `
    <div class="py-3">
      <h4 class="mb-1">¿Quién eres?</h4>
      <p class="text-muted small mb-3">Esto carga tu rutina, reglas y progresión. (${u.email || ""})</p>
      <div class="list-group profile-pick">${opts}</div>
    </div>`;
  $app.querySelectorAll("[data-key]").forEach((b) => {
    b.onclick = async () => {
      b.disabled = true;
      const user = await seedUser(u.uid, b.dataset.key, { email: u.email, displayName: u.displayName });
      CURRENT.user = user;
      renderHome();
    };
  });
}

// --- Dashboard ------------------------------------------------------------
async function renderHome() {
  const user = CURRENT.user;
  const p = user.program;
  const wSug = suggestedWeek(p.startDate, Date.now());
  const dayLabel = todaysDay(user);

  const advanceBanner = wSug > p.currentWeek
    ? `<div class="alert alert-primary d-flex justify-content-between align-items-center py-2">
         <span>Según el calendario vas en la <b>semana ${wSug}</b>.</span>
         <button id="btnAdvance" class="btn btn-sm btn-primary">Avanzar</button></div>`
    : "";

  // Aviso cuando la plantilla del perfil trae una rutina más nueva que la guardada.
  const tplVersion = PROFILE_TEMPLATES[user.profileKey]?.routineVersion || 1;
  const routineBanner = tplVersion > (user.routineVersion || 1)
    ? `<div class="alert alert-warning py-2 mb-2">
         <div class="fw-bold">🔄 Tienes una rutina nueva disponible</div>
         <div class="small mb-2">${PROFILE_TEMPLATES[user.profileKey]?.program?.methodology || ""}. Se mantienen tus pesos y tu historial.</div>
         <button id="btnUpdRoutine" class="btn btn-sm btn-outline-primary">Actualizar mi rutina</button>
       </div>`
    : "";

  // Selector de sesión: con ciclo de varios días conviene poder elegir cuál toca.
  const days = programDays(user);
  const daySelector = days.length
    ? `<label class="form-label" for="selDay">Sesión de hoy</label>
       <select id="selDay" class="form-select mb-3">
         ${days.map((d) => `<option value="${d.key}" ${d.key === dayLabel ? "selected" : ""}>${d.key} · ${d.label}</option>`).join("")}
       </select>`
    : `<p class="mb-2 text-muted">${dayLabel !== "full" ? "Sesión de hoy: <b>" + dayLabel + "</b>" : "Entrenamiento de cuerpo completo"}</p>`;

  // Entrenamiento a medias guardado en el teléfono: retomar es lo principal.
  const draft = loadDraft(user.uid);
  const draftSeries = draft
    ? Object.values(draft.logged || {}).reduce((a, e) => a + (e.sets?.length || 0), 0) : 0;
  const bloqueSesion = draft
    ? `<div class="alert alert-primary py-2 mb-3">
         <div class="fw-bold">⏸️ Tienes un entrenamiento a medias</div>
         <div class="small">${dayLabelOf(user, draft.dayLabel)} · ${draftSeries} ${draftSeries === 1 ? "serie registrada" : "series registradas"} · ${hace(draft.savedAt)}</div>
       </div>
       <button id="btnResume" class="btn btn-primary btn-lg w-100">▶️ Retomar entrenamiento</button>
       <button id="btnNuevo" class="btn btn-link w-100 mt-1">Empezar uno nuevo (descarta lo anterior)</button>`
    : `${daySelector}
       <button id="btnTrain" class="btn btn-primary btn-lg w-100">▶️ Empezar entrenamiento</button>`;

  const notices = transitionNotices(user, wSug).map((t) =>
    `<div class="alert alert-warning py-2 small mb-2">💡 ${t}</div>`).join("");

  const safety = (user.safety || []).map((k) =>
    `<li class="small mb-1">${SAFETY[k] || k}</li>`).join("");

  $app.innerHTML = `
    <div class="app-header d-flex justify-content-between align-items-center">
      <div class="d-flex align-items-center gap-2">
        <div class="avatar">${(user.displayName || "?").trim().charAt(0).toUpperCase()}</div>
        <div>
          <div class="h5 mb-0">Hola, ${user.displayName}</div>
          <div class="small text-muted">Semana ${p.currentWeek} · ${p.methodology || ""}</div>
        </div>
      </div>
      <button id="btnMenu" class="icon-btn">⚙️</button>
    </div>
    ${routineBanner}
    ${advanceBanner}
    ${notices}
    <div class="card shadow-sm mb-3">
      <div class="card-body">
        ${bloqueSesion}
      </div>
    </div>
    <div class="d-flex gap-2 mb-3">
      <button id="btnHist" class="btn btn-outline-primary flex-fill">📈 Historial</button>
      <button id="btnSeed" class="btn btn-outline-secondary flex-fill">🌱 Valores</button>
    </div>
    <div class="card">
      <div class="card-body">
        <h6 class="mb-2">Recordatorios para ti</h6>
        <ul class="mb-0 ps-3">${safety}</ul>
      </div>
    </div>`;

  const btnTrain = document.getElementById("btnTrain");
  if (btnTrain) btnTrain.onclick = () =>
    startTraining(document.getElementById("selDay")?.value || dayLabel);
  const btnResume = document.getElementById("btnResume");
  if (btnResume) btnResume.onclick = () => startTraining(draft.dayLabel, draft);
  const btnNuevo = document.getElementById("btnNuevo");
  if (btnNuevo) btnNuevo.onclick = () => {
    if (!confirm("Se descartará el entrenamiento a medias. ¿Empezar uno nuevo?")) return;
    clearDraft(user.uid);
    renderHome();
  };
  document.getElementById("btnHist").onclick = renderHistoryScreen;
  document.getElementById("btnSeed").onclick = renderSeedScreen;
  document.getElementById("btnMenu").onclick = renderSettings;
  const adv = document.getElementById("btnAdvance");
  if (adv) adv.onclick = () => advanceWeek(wSug);
  const upd = document.getElementById("btnUpdRoutine");
  if (upd) upd.onclick = async () => {
    upd.disabled = true; upd.textContent = "Actualizando…"; // evita doble envío
    try {
      await applyRoutineUpdate(user.uid, user.profileKey);
      CURRENT.user = await getUser(user.uid);
      renderHome();
    } catch (e) {
      upd.disabled = false; upd.textContent = "Actualizar mi rutina";
      alert("No se pudo actualizar la rutina: " + e.message);
    }
  };
}

// Días del programa como [{key,label}]; vacío si el perfil no usa split.
function programDays(user) {
  const d = user.program?.days;
  if (!Array.isArray(d) || !d.length) return [];
  return d.map((x) => (typeof x === "string" ? { key: x, label: x } : x));
}

// Qué sesión toca: la siguiente del ciclo respecto de la última hecha.
function todaysDay(user) {
  const days = programDays(user);
  if (days.length) {
    const i = days.findIndex((d) => d.key === user.lastDayLabel);
    return days[(i + 1) % days.length].key; // sin última sesión (i = -1) parte en la primera
  }
  if (user.program.split === "A/B") return user.lastDayLabel === "A" ? "B" : "A";
  return "full";
}

function dayLabelOf(user, key) {
  const d = programDays(user).find((x) => x.key === key);
  return d ? d.label : key;
}

function transitionNotices(user, wSug) {
  const out = [];
  const cfg = user.progressionConfig;
  const p = user.program;
  if (user.profileKey === "patricio") {
    if (cfg.intensity?.mode === "hypertrophy")
      out.push("Hipertrofia en 5 sesiones cortas: RIR 1–2 y sólo la última serie al fallo. Cada grupo se trabaja 2 veces por semana.");
    else if (p.currentWeek >= (cfg.sets?.compoundSetsFromWeek || 3))
      out.push("Modo semana 3+: al fallo real + 2 series en compuestos.");
  }
  if (user.profileKey === "esposa") {
    out.push("Alterna A (empuje) y B (tirón). Nunca al fallo, RIR 2. Abdominales: pendiente visto bueno médico.");
  }
  if (user.profileKey === "hijo") {
    out.push("RIR 1–2 siempre. Nunca al fallo. La técnica primero.");
  }
  return out;
}

async function advanceWeek(wSug) {
  const user = CURRENT.user;
  await updateProgram(user.uid, { "program.currentWeek": wSug });
  user.program.currentWeek = wSug;
  renderHome();
}

// Repes de la última sesión de cada ejercicio (para mostrar "la vez anterior").
function prevRepsByExercise(sessions) {
  const map = {};
  for (const s of sessions) { // vienen ordenadas de más reciente a más antigua
    for (const e of s.entries || []) {
      if (map[e.exerciseId]) continue; // ya tenemos la más reciente
      const work = (e.sets || []).filter((x) => !x.warmup);
      if (!work.length) continue;
      map[e.exerciseId] = { date: s.date, reps: work.map((x) => ({ reps: x.reps, side: x.side })) };
    }
  }
  return map;
}

// --- Entrenamiento --------------------------------------------------------
async function startTraining(dayLabel, draft) {
  const user = CURRENT.user;
  $app.innerHTML = `<div class="text-center py-5 text-muted">Preparando tu sesión…</div>`;
  const state = await getState(user.uid);
  const sessions = await listSessions(user.uid, 30);
  const prevByExercise = prevRepsByExercise(sessions);
  $app.innerHTML = `<div id="session"></div>`;
  const runner = new SessionRunner({
    container: document.getElementById("session"),
    prevByExercise,
    user,
    state,
    week: user.program.currentWeek,
    phase: user.program.currentPhase,
    dayLabel,
    onExit: () => renderHome(),
    onFinish: async (session, results) => {
      try {
        await saveSession(user.uid, session);
        // actualizar estado de progresión por ejercicio
        for (const [exId, r] of Object.entries(results)) {
          if (r?.next) await setExerciseState(user.uid, exId, r.next);
        }
        // alternar A/B
        if (dayLabel !== "full") {
          user.lastDayLabel = dayLabel;
          await updateProgram(user.uid, { lastDayLabel: dayLabel });
        }
        clearDraft(user.uid); // guardada: el borrador ya no hace falta
        speak("Sesión guardada. Buen trabajo.");
      } catch (e) {
        // Se conserva el borrador a propósito, para no perder lo registrado.
        alert("Error al guardar (se reintentará al reconectar): " + e.message);
      }
      renderDone();
    },
  });
  if (draft) runner.resumeFrom(draft); // retoma donde iba
  else runner.start();
}

function renderDone() {
  $app.innerHTML = `
    <div class="text-center py-5">
      <div class="display-6 mb-2">✅</div>
      <p class="mb-4">Sesión guardada.</p>
      <button id="btnHome" class="btn btn-primary">Volver al inicio</button>
    </div>`;
  document.getElementById("btnHome").onclick = renderHome;
}

// --- Historial ------------------------------------------------------------
async function renderHistoryScreen() {
  $app.innerHTML = `
    <button id="btnBack" class="btn btn-link ps-0 mb-2">← Volver</button>
    <h4 class="mb-3">Progreso</h4>
    <div id="charts"><div class="text-muted">Cargando…</div></div>
    <div id="log"></div>`;
  document.getElementById("btnBack").onclick = renderHome;
  const sessions = await listSessions(CURRENT.user.uid);
  renderHistory(document.getElementById("charts"), sessions);
  renderSessionLog(document.getElementById("log"), sessions);
}

// --- Sembrar valores reales ----------------------------------------------
async function renderSeedScreen() {
  const user = CURRENT.user;
  const state = await getState(user.uid);
  const st = state.byExercise || {};
  const seen = new Set();
  const rows = user.routine
    .filter((it) => it.status === "active")
    .filter((it) => (it.progressionType || EXERCISE_BY_ID[it.exerciseId]?.progressionType) !== "reps") // abs planos: sin peso
    .filter((it) => (seen.has(it.exerciseId) ? false : seen.add(it.exerciseId))) // dedup (abs en A y B)
    .map((it) => {
    const ex = EXERCISE_BY_ID[it.exerciseId];
    if (ex.progressionType === "incline") {
      return `<tr><td>${ex.name}</td>
        <td><input class="form-control form-control-sm" data-ex="${it.exerciseId}" data-kind="level" type="number" inputmode="numeric" value="${st[it.exerciseId]?.level ?? 1}" placeholder="nivel"></td>
        <td class="text-muted small">nivel</td></tr>`;
    }
    if (it.unilateral) {
      return `<tr><td>${ex.name} <span class="text-muted small">(uni)</span></td>
        <td class="d-flex gap-1">
          <input class="form-control form-control-sm" data-ex="${it.exerciseId}" data-kind="right" type="number" inputmode="numeric" value="${st[it.exerciseId]?.right?.blocks ?? ""}" placeholder="der">
          <input class="form-control form-control-sm" data-ex="${it.exerciseId}" data-kind="left" type="number" inputmode="numeric" value="${st[it.exerciseId]?.left?.blocks ?? ""}" placeholder="izq">
        </td><td class="text-muted small">bloques R/L</td></tr>`;
    }
    return `<tr><td>${ex.name}</td>
      <td><input class="form-control form-control-sm" data-ex="${it.exerciseId}" data-kind="blocks" type="number" inputmode="numeric" value="${st[it.exerciseId]?.blocks ?? ""}" placeholder="bloques"></td>
      <td class="text-muted small">bloques</td></tr>`;
  }).join("");

  $app.innerHTML = `
    <button id="btnBack" class="btn btn-link ps-0 mb-2">← Volver</button>
    <h4 class="mb-1">Valores de partida</h4>
    <p class="text-muted small mb-3">Pon el peso/nivel actual de cada ejercicio para no partir de cero. La app lo usará como sugerencia.</p>
    <table class="table table-sm align-middle"><tbody>${rows}</tbody></table>
    <button id="btnSaveSeed" class="btn btn-success w-100">Guardar valores</button>`;
  document.getElementById("btnBack").onclick = renderHome;
  document.getElementById("btnSaveSeed").onclick = async () => {
    const byExercise = {};
    $app.querySelectorAll("input[data-ex]").forEach((inp) => {
      const id = inp.dataset.ex, kind = inp.dataset.kind, v = inp.value;
      if (v === "") return;
      byExercise[id] = byExercise[id] || {};
      if (kind === "right") { byExercise[id].right = { blocks: Number(v), lastReps: null }; }
      else if (kind === "left") { byExercise[id].left = { blocks: Number(v), lastReps: null }; }
      else if (kind === "level") { byExercise[id].level = Number(v); }
      else { byExercise[id].blocks = Number(v); }
    });
    await mergeState(user.uid, byExercise);
    renderHome();
  };
}

// --- Ajustes --------------------------------------------------------------
function renderSettings() {
  const user = CURRENT.user;
  $app.innerHTML = `
    <button id="btnBack" class="btn btn-link ps-0 mb-2">← Volver</button>
    <h4 class="mb-3">Ajustes</h4>
    <div class="form-check form-switch mb-2">
      <input class="form-check-input" type="checkbox" id="swVoice" ${getPref("voice", true) ? "checked" : ""}>
      <label class="form-check-label" for="swVoice">Guía por voz</label>
    </div>
    <div class="form-check form-switch mb-3">
      <input class="form-check-input" type="checkbox" id="swAnim" ${getPref("anim", true) ? "checked" : ""}>
      <label class="form-check-label" for="swAnim">Animación guía del ejercicio</label>
    </div>
    <div class="mb-3">
      <label class="form-label">Semana actual</label>
      <input id="inWeek" type="number" class="form-control" value="${user.program.currentWeek}" min="1">
    </div>
    <button id="btnSaveSettings" class="btn btn-primary w-100 mb-3">Guardar</button>
    <div class="card mb-3"><div class="card-body">
      <h6 class="mb-1">Valores del perfil</h6>
      <p class="small text-muted mb-2">Vuelve a cargar los pesos de partida de tu rutina (por si algo quedó en blanco).</p>
      <button id="btnReseed" class="btn btn-outline-primary w-100">Cargar valores de mi rutina</button>
    </div></div>
    <div class="card mb-3"><div class="card-body">
      <h6 class="mb-1">Versión de la app</h6>
      <p class="small text-muted mb-2">Estás en <b>${APP_VERSION}</b>. Si crees que no tienes lo último, esto borra lo guardado en el teléfono y recarga.</p>
      <button id="btnUpdateApp" class="btn btn-outline-primary w-100">🔄 Buscar actualización</button>
      <div id="updMsg" class="small text-muted mt-2" role="status" aria-live="polite"></div>
    </div></div>
    <button id="btnLogout" class="btn btn-outline-danger w-100">Cerrar sesión</button>
    <div class="text-center small text-muted mt-3">Coach G3000 · ${APP_VERSION}</div>`;
  document.getElementById("btnBack").onclick = renderHome;
  document.getElementById("swVoice").onchange = (e) => { setVoiceOutput(e.target.checked); setPref("voice", e.target.checked); };
  document.getElementById("swAnim").onchange = (e) => setPref("anim", e.target.checked);
  document.getElementById("btnSaveSettings").onclick = async () => {
    const w = Number(document.getElementById("inWeek").value) || 1;
    await updateProgram(user.uid, { "program.currentWeek": w });
    user.program.currentWeek = w;
    renderHome();
  };
  document.getElementById("btnReseed").onclick = async () => {
    const btn = document.getElementById("btnReseed");
    btn.disabled = true; btn.textContent = "Cargando…";
    try {
      const r = await applySeedValues(user.uid, user.profileKey);
      if (r.weights) alert(`Listo: se cargaron los pesos de ${r.weights} ejercicios${r.baseline ? " + una sesión base en tu historial" : ""}.`);
      else alert("Tu perfil no trae pesos precargados (se definen en la 1ª sesión).");
    } catch (e) { alert("No se pudo: " + e.message); }
    btn.disabled = false; btn.textContent = "Cargar valores de mi rutina";
    renderHome();
  };
  document.getElementById("btnUpdateApp").onclick = (e) => forceUpdate(e.currentTarget);
  document.getElementById("btnLogout").onclick = async () => { await signOut(auth); };
}

// Fuerza traer la última versión: borra las cachés del navegador, desregistra
// el service worker (el index.html lo vuelve a registrar) y recarga.
async function forceUpdate(btn) {
  const msg = document.getElementById("updMsg");
  btn.disabled = true;
  btn.textContent = "Actualizando…";
  if (msg) msg.textContent = "Limpiando lo guardado en el teléfono…";
  try {
    // Primero el service worker: si se borra la caché antes, el worker viejo
    // sigue controlando la página y la vuelve a llenar al siguiente fetch.
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (_) {
    // Si algo falla igual recargamos: sin service worker se pide todo a la red.
  }
  if (msg) msg.textContent = "Recargando…";
  location.reload();
}
