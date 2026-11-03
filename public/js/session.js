// Flujo guiado de una sesión, ejercicio por ejercicio.
import { suggestFor, evaluateExercise } from "./progression.js";
import { EXERCISE_BY_ID } from "./exercises.js";
import { RestTimer } from "./timer.js";
import { speak, isVoiceOutputOn } from "./voice.js";
import { animationFor } from "./animations.js";
import { montarFigura3D, tieneFigura3D } from "./figura3d.js";
import { getPref } from "./prefs.js";
import { saveDraft, clearDraft } from "./draft.js";

// perSide: true => se hace 30 s por cada lado (izquierdo y derecho).
export const WARMUP_GENERAL = [
  { name: "Círculos de hombros", cue: "Adelante y atrás." },
  { name: "Círculos de brazos completos", cue: "Amplios y controlados." },
  { name: "Rotación de cintura", cue: "Manos en la cadera, girar el tronco." },
  { name: "Círculos de rodillas", cue: "Rodillas juntas, girar suave." },
  { name: "Sentadillas al aire", cue: "Repeticiones lentas durante el tiempo." },
  { name: "Jumping jacks o trote", cue: "En el puesto, suave." },
];

export const COOLDOWN = [
  { name: "Pecho", cue: "Mano en el marco a la altura del hombro, girar el cuerpo al lado contrario.", perSide: true },
  { name: "Espalda", cue: "Agarrar el marco con ambas manos, brazos estirados, dejar caer el cuerpo atrás en C." },
  { name: "Hombros", cue: "Cruzar el brazo por delante del pecho, empujar desde el codo con la otra mano.", perSide: true },
  { name: "Bíceps", cue: "Brazo estirado contra el marco, palma abierta, girar el cuerpo al lado contrario.", perSide: true },
  { name: "Tríceps", cue: "Mano detrás de la nuca, empujar suave el codo hacia abajo.", perSide: true },
  { name: "Cuádriceps", cue: "Parado, talón al glúteo (con calma en la derecha por el tobillo).", perSide: true },
  { name: "Femoral", cue: "Pie sobre el asiento, pierna estirada, inclinarse desde la cadera. Sin rebotar.", perSide: true },
];

// Construye la lista de ejercicios de HOY según fase y día (A/B).
export function buildExerciseList(user, phase, dayLabel) {
  return user.routine
    .filter((it) => it.status === "active")
    .filter((it) => {
      if (Array.isArray(it.phases) && !it.phases.includes(phase)) return false;
      if (dayLabel && dayLabel !== "full" && it.day && it.day !== dayLabel) return false;
      return true;
    })
    .sort((a, b) => a.order - b.order);
}

// Genera los "pasos" (series/lados) de un ejercicio.
// Los ejercicios marcados como calentamiento llevan una serie de calentamiento
// aparte al inicio (liviana, no cuenta para la progresión).
function stepsFor(item, suggestion) {
  const steps = [];
  if (item.warmup && suggestion.type !== "reps") steps.push({ warmup: true });
  const n = suggestion.sets || 1;
  if (item.unilateral) {
    const order = suggestion.sides.map((s) => s.side); // ya viene R,L (empieza derecha)
    for (let set = 0; set < n; set++) {
      for (const side of order) steps.push({ setIndex: set, side });
    }
  } else {
    for (let set = 0; set < n; set++) steps.push({ setIndex: set });
  }
  return steps;
}

export class SessionRunner {
  constructor({ container, user, state, week, phase, dayLabel, onFinish, onExit, prevByExercise }) {
    this.c = container;
    this.user = user;
    this.state = state.byExercise || {};
    this.prevByExercise = prevByExercise || {}; // reps de la última sesión, por ejercicio
    this.week = week;
    this.phase = phase;
    this.dayLabel = dayLabel || "full";
    this.onFinish = onFinish;
    this.onExit = onExit;
    this.config = user.progressionConfig;
    this.list = buildExerciseList(user, phase, dayLabel);
    this.i = -1; // índice de ejercicio (empieza en intro)
    this.logged = {}; // exerciseId -> {sets:[], level?}
    this.results = {}; // exerciseId -> resultado del motor
    this.timer = null;
  }

  start() { this.renderIntro(); }

  // --- Borrador: guardar el avance para sobrevivir a una recarga -----------
  persist() {
    saveDraft(this.user?.uid, {
      dayLabel: this.dayLabel, week: this.week, phase: this.phase,
      i: this.i, stepIdx: this._stepIdx || 0,
      logged: this.logged, results: this.results,
    });
  }

  // Retoma un entrenamiento a medias: reconstruye el ejercicio y la serie donde
  // iba, sin pasar por renderExercise() (que reiniciaría lo ya registrado).
  resumeFrom(d) {
    this.logged = d.logged || {};
    this.results = d.results || {};
    this.i = typeof d.i === "number" ? d.i : 0;
    if (this.i < 0 || this.i >= this.list.length) return this.renderIntro();
    const item = this.list[this.i];
    const suggestion = suggestFor(item, this.state[item.exerciseId], this.config, this.week);
    this._suggestion = suggestion;
    this._steps = stepsFor(item, suggestion);
    this._stepIdx = Math.min(Math.max(d.stepIdx || 0, 0), this._steps.length - 1);
    if (!this.logged[item.exerciseId]) {
      this.logged[item.exerciseId] = { sets: [], level: suggestion.level };
    }
    this.renderStep();
  }

  // Temporizador con los avisos estándar: "vas por la mitad" y la cuenta
  // regresiva hablada 3-2-1, para saber cuándo retomar sin mirar el teléfono.
  makeTimer({ barEl, labelEl, onDone }) {
    return new RestTimer({
      barEl, labelEl, onDone,
      onHalf: () => speak("Vas por la mitad"),
      onCountdown: (n) => {
        if (!isVoiceOutputOn()) return false; // sin voz, que suene el pitido
        speak(String(n));
        return true;
      },
    });
  }

  // ---- Navegación (anterior / reiniciar / salir) --------------------------
  // Barra superior reutilizable. prevFn define qué hace "◀ Anterior".
  navBar(prevLabel = "◀ Anterior", showPrev = true) {
    return `<div class="d-flex justify-content-between align-items-center mb-2">
      ${showPrev ? `<button id="navPrev" class="btn btn-sm btn-outline-secondary">${prevLabel}</button>` : "<span></span>"}
      <div class="d-flex gap-2">
        <button id="navRestart" class="btn btn-sm btn-outline-secondary" title="Reiniciar sesión">↻</button>
        <button id="navExit" class="btn btn-sm btn-outline-secondary" title="Salir">✕</button>
      </div>
    </div>`;
  }
  attachNav(prevFn) {
    const p = this.c.querySelector("#navPrev"); if (p && prevFn) p.onclick = prevFn;
    const r = this.c.querySelector("#navRestart"); if (r) r.onclick = () => this.restartSession();
    const x = this.c.querySelector("#navExit"); if (x) x.onclick = () => this.exitSession();
  }
  restartSession() {
    if (!confirm("¿Reiniciar la sesión desde el principio? Se pierde lo registrado.")) return;
    if (this.timer) this.timer.stop();
    this.logged = {}; this.results = {}; this.i = -1;
    clearDraft(this.user?.uid);
    this.renderIntro();
  }
  exitSession() {
    if (!confirm("¿Salir sin guardar esta sesión?")) return;
    if (this.timer) this.timer.stop();
    clearDraft(this.user?.uid);
    if (this.onExit) this.onExit();
  }
  prevExercise() {
    if (this.timer) this.timer.stop();
    if (this.i <= 0) { this.i = -1; return this.renderIntro(); }
    this.i -= 1;
    this.renderExercise();
  }
  prevStep() {
    // Dentro de un ejercicio: deshacer la última serie; si es la 1ª, ir al ejercicio anterior.
    if (this._stepIdx > 0) {
      if (this.timer) this.timer.stop();
      this.logged[this.list[this.i].exerciseId].sets.pop();
      this._stepIdx -= 1;
      this.renderStep();
    } else {
      this.prevExercise();
    }
  }
  seqPrev() {
    if (this._seq.idx > 0) { this._seqAdvanceReset(); this._seq.idx -= 1; this._seqStep(); }
  }
  _seqAdvanceReset() {
    if (this._seqTimeout) { clearTimeout(this._seqTimeout); this._seqTimeout = null; }
    if (this.timer) this.timer.stop();
  }

  restSeconds(item) {
    const r = this.config.rest || {};
    return item.unilateral ? r.unilateral || 60 : r.default || 120;
  }

  // ---- Pantallas ----------------------------------------------------------
  renderIntro() {
    const p = this.user.program;
    this.c.innerHTML = `
      ${this.navBar("", false)}
      <div class="card shadow-sm">
        <div class="card-body">
          <h4 class="mb-1">Calentamiento general</h4>
          <p class="text-muted mb-2">Semana ${this.week} · ${this.dayLabel !== "full" ? "Sesión " + this.dayLabel + " · " : ""}${p.tempo || ""}</p>
          <p class="small mb-2">Guiado, 30 seg por movimiento (con cuenta regresiva 3-2-1).</p>
          <ol class="mb-3 small text-muted">${WARMUP_GENERAL.map((t) => `<li>${t.name}${t.perSide ? " (por lado)" : ""}</li>`).join("")}</ol>
          <p class="small text-muted">Hoy: ${this.list.length} ejercicios.</p>
          <button id="btnStart" class="btn btn-primary btn-lg w-100">Empezar calentamiento</button>
          <button id="btnSkipWarm" class="btn btn-link w-100 mt-1">Saltar al 1er ejercicio</button>
        </div>
      </div>`;
    this.c.querySelector("#btnStart").onclick = () =>
      this.runGuidedSequence(WARMUP_GENERAL, { title: "Calentamiento", seconds: 30, onComplete: () => this.nextExercise() });
    this.c.querySelector("#btnSkipWarm").onclick = () => this.nextExercise();
    this.attachNav();
  }

  // Secuencia guiada (calentamiento / elongación): ítem por ítem, con
  // cuenta regresiva 3-2-1 y luego temporizador de N segundos.
  runGuidedSequence(items, { title, seconds, onComplete }) {
    // Expandimos los ítems "por lado" en dos pasos: lado izquierdo y derecho.
    const steps = [];
    for (const it of items) {
      const obj = typeof it === "string" ? { name: it } : it;
      if (obj.perSide) {
        steps.push({ ...obj, side: "lado izquierdo" });
        steps.push({ ...obj, side: "lado derecho" });
      } else {
        steps.push({ ...obj });
      }
    }
    this._seq = { steps, title, seconds, onComplete, idx: 0 };
    this._seqStep();
  }

  _seqStep() {
    const s = this._seq;
    if (s.idx >= s.steps.length) return s.onComplete();
    const st = s.steps[s.idx];
    const name = st.side ? `${st.name} · ${st.side}` : st.name;
    const cue = st.cue || "";
    this.c.innerHTML = `
      ${this.navBar("◀ Anterior", s.idx > 0)}
      <div class="mb-2 d-flex justify-content-between align-items-center">
        <span class="badge text-bg-secondary">${s.title} ${s.idx + 1}/${s.steps.length}</span>
        <button id="btnSkipSeq" class="btn btn-sm btn-outline-secondary">Saltar ▶</button>
      </div>
      <div class="card shadow-sm">
        <div class="card-body text-center">
          <h4 class="mb-2">${name}</h4>
          ${st.side ? `<span class="badge text-bg-warning mb-2">${st.side}</span>` : ""}
          ${cue ? `<p class="text-muted mb-3">${cue}</p>` : ""}
          <div id="seqCount" class="display-1 fw-bold my-2" style="min-height:1.2em;">•</div>
          <div class="progress mb-2" style="height:18px;"><div id="seqBar" class="progress-bar" style="width:0%"></div></div>
          <div id="seqLabel" class="text-muted small">Escuchando…</div>
        </div>
      </div>`;
    this.c.querySelector("#btnSkipSeq").onclick = () => this._seqAdvance();
    this.attachNav(() => this.seqPrev());
    // La cuenta regresiva 3-2-1 arranca sólo cuando la voz termina de leer el nombre.
    const startedIdx = s.idx;
    speak(name, () => {
      if (this._seq.idx !== startedIdx) return; // el usuario saltó mientras hablaba
      const lbl = this.c.querySelector("#seqLabel");
      if (lbl) lbl.textContent = "Prepárate…";
      this._preCountdown(3, () => this._seqRunTimer());
    });
  }

  _preCountdown(n, done) {
    let k = n;
    const tick = () => {
      const el = this.c.querySelector("#seqCount");
      if (!el) return; // la pantalla cambió (skip)
      if (k <= 0) { el.textContent = "¡Ya!"; done(); return; }
      el.textContent = k;
      speak(String(k));
      k--;
      this._seqTimeout = setTimeout(tick, 1000);
    };
    tick();
  }

  _seqRunTimer() {
    const s = this._seq;
    const countEl = this.c.querySelector("#seqCount");
    if (countEl) countEl.textContent = "";
    const timer = this.makeTimer({
      barEl: this.c.querySelector("#seqBar"),
      labelEl: this.c.querySelector("#seqLabel"),
      onDone: () => this._seqAdvance(),
    });
    timer.start(s.seconds);
    this.timer = timer;
  }

  _seqAdvance() {
    if (this._seqTimeout) { clearTimeout(this._seqTimeout); this._seqTimeout = null; }
    if (this.timer) this.timer.stop();
    this._seq.idx++;
    this._seqStep();
  }

  nextExercise() {
    this.i++;
    this.persist();
    if (this.i >= this.list.length) return this.renderCooldown();
    this.renderExercise();
  }

  renderExercise() {
    const item = this.list[this.i];
    const ex = EXERCISE_BY_ID[item.exerciseId];
    const suggestion = suggestFor(item, this.state[item.exerciseId], this.config, this.week);
    this.logged[item.exerciseId] = { sets: [], level: suggestion.level };
    this._suggestion = suggestion;
    this._steps = stepsFor(item, suggestion);
    this._stepIdx = 0;

    // Anuncio por voz
    speak(this.voiceAnnounce(item, ex, suggestion));

    this.renderStep();
  }

  voiceAnnounce(item, ex, s) {
    if (s.type === "reps") return `Siguiente ejercicio: ${ex.name}`;
    if (s.type === "incline") return `Siguiente ejercicio: ${ex.name}, nivel ${s.level}`;
    if (s.type === "unilateral") {
      const b = s.sides[0].blocks;
      return `Siguiente ejercicio: ${ex.name}, empezar por la derecha${b != null ? `, ${b} bloques` : ""}`;
    }
    return `Siguiente ejercicio: ${ex.name}${s.blocks != null ? `, ${s.blocks} bloques` : ""}`;
  }

  renderStep() {
    const item = this.list[this.i];
    const ex = EXERCISE_BY_ID[item.exerciseId];
    const s = this._suggestion;
    const step = this._steps[this._stepIdx];
    const isWarmupSet = step.warmup === true;
    const isIncline = s.type === "incline";
    const isReps = s.type === "reps";
    const [rmin, rmax] = s.repRange;
    const animOn = getPref("anim", true);

    // valores sugeridos por defecto
    let blocksDefault = "";
    let sideLabel = "";
    let repsDefault = "";
    if (isWarmupSet) {
      blocksDefault = 1; // calentamiento: 1 bloque (piernas: al aire)
      repsDefault = 10; // repes por defecto del calentamiento
    } else if (s.type === "unilateral") {
      const sideInfo = s.sides.find((x) => x.side === step.side);
      blocksDefault = sideInfo?.blocks ?? "";
      sideLabel = step.side === "R" ? "DERECHA" : "IZQUIERDA";
      if (step.side === "L" && item.mirrorReps) {
        const rightStep = this.logged[item.exerciseId].sets.find((x) => x.side === "R" && x.setIndex === step.setIndex);
        if (rightStep) repsDefault = rightStep.reps;
      }
    } else if (isIncline) {
      blocksDefault = "";
    } else {
      blocksDefault = s.blocks ?? "";
    }

    // Si ya registró series de este ejercicio, manda el peso que realmente usó
    // (si lo sobrescribió, sería molesto que la serie siguiente volviera al viejo).
    if (!isWarmupSet && !isIncline && !isReps) {
      const previas = (this.logged[item.exerciseId]?.sets || []).filter((x) => !x.warmup);
      const ultima = [...previas].reverse().find((x) => (step.side ? x.side === step.side : true));
      if (ultima && ultima.blocks != null) blocksDefault = ultima.blocks;
    }

    // Bloque de carga.
    let loadInput;
    if (isWarmupSet) {
      loadInput = `<label class="form-label fw-bold" for="inBlocks">Bloques (calentamiento)</label>
            <input id="inBlocks" type="number" inputmode="numeric" class="form-control form-control-lg mb-3" value="${blocksDefault}" placeholder="1" min="0">`;
    } else if (isReps) {
      loadInput = "";
    } else if (isIncline) {
      loadInput = `<label class="form-label fw-bold" for="inLevel">Nivel de inclinación</label>
            <input id="inLevel" type="number" inputmode="numeric" class="form-control form-control-lg mb-3" value="${s.level}" min="0">`;
    } else {
      loadInput = `<label class="form-label fw-bold" for="inBlocks">Bloques ${s.type === "unilateral" ? "(" + sideLabel + ")" : ""}</label>
            <input id="inBlocks" type="number" inputmode="numeric" class="form-control form-control-lg mb-3" value="${blocksDefault}" placeholder="bloques" min="1">`;
    }

    const badge = isWarmupSet
      ? `<span class="badge text-bg-warning">🔥 Calentamiento</span>`
      : `<span class="badge text-bg-light">Serie ${step.setIndex + 1}/${s.sets}${s.type === "unilateral" ? " · " + sideLabel : ""}</span>`;
    const infoLine = isWarmupSet
      ? "Serie de calentamiento: liviana, ~10 repes lentas, sin fallar. (Piernas: al aire, sin peso.)"
      : `${s.cue || ""} · Rango objetivo: ${rmin}–${rmax} repes · Tempo 2/3`;

    // Repes de la última sesión, para motivar a superarlas.
    const prev = this.prevByExercise[item.exerciseId];
    const prevLine = (!isWarmupSet && prev && prev.reps && prev.reps.length)
      ? `<div class="alert alert-primary py-2 small mb-3">💪 La vez anterior: <b>${prev.reps.map((r) => r.reps + (r.side ? (r.side === "R" ? " der" : " izq") : "")).join(" · ")}</b> repes — ¡supéralo!</div>`
      : "";

    this.c.innerHTML = `
      ${this.navBar(this._stepIdx > 0 ? "◀ Serie anterior" : "◀ Ejercicio anterior")}
      <div class="mb-2 d-flex justify-content-between align-items-center">
        <span class="badge text-bg-secondary">Ejercicio ${this.i + 1}/${this.list.length}</span>
        ${badge}
      </div>

      <!-- El descanso va ARRIBA y pegado: al terminar una serie es lo único
           que interesa, y abajo quedaba fuera de pantalla en el teléfono. -->
      <div id="restBox" class="card shadow-sm rest-box mb-3 d-none">
        <div class="card-body text-center py-3">
          <div class="mb-1">Descanso <span id="restLabel" class="fw-bold"></span></div>
          <div id="restNext" class="small text-muted mb-2"></div>
          <div class="progress" style="height: 18px;"><div id="restBar" class="progress-bar" style="width:0%"></div></div>
          <button id="btnSkipRest" class="btn btn-link mt-2">Saltar descanso</button>
        </div>
      </div>

      <div class="card shadow-sm">
        <div class="card-body">
          <h4 class="mb-1">${ex.name}</h4>
          ${animOn ? espacioAnimacion(item.exerciseId, ex.name) : ""}
          <p class="text-muted small mb-2">${ex.cue}</p>
          ${item.note && !isWarmupSet ? `<div class="alert alert-${isReps ? "danger" : "warning"} py-2 small mb-2">⚠️ ${item.note}</div>` : ""}
          <div class="alert alert-info py-2 small mb-3">${infoLine}</div>
          ${prevLine}

          ${loadInput}

          <label class="form-label fw-bold" for="inReps">Repes ${s.type === "unilateral" && step.side === "L" && item.mirrorReps ? "(mismas que derecha)" : ""}</label>
          <input id="inReps" type="number" inputmode="numeric" class="form-control form-control-lg mb-3" value="${repsDefault}" placeholder="${isWarmupSet ? "~10" : rmin + "–" + rmax}" min="0">

          <div id="errMsg" class="alert alert-danger py-2 small mb-2 d-none" role="alert"></div>
          <button id="btnRegister" class="btn btn-success btn-lg w-100">${isWarmupSet ? "Registrar calentamiento" : "Registrar serie"}</button>
        </div>
      </div>`;
    montarAnimaciones(this.c);

    this.c.querySelector("#btnRegister").onclick = () => this.registerStep();
    this.attachNav(() => this.prevStep());
  }

  // Error visible junto al formulario, con foco en el campo que falta.
  mostrarError(texto, selector) {
    const box = this.c.querySelector("#errMsg");
    if (box) { box.textContent = "⚠️ " + texto; box.classList.remove("d-none"); }
    const campo = this.c.querySelector(selector);
    if (campo) { campo.focus(); campo.select?.(); }
  }

  registerStep() {
    const item = this.list[this.i];
    const s = this._suggestion;
    const step = this._steps[this._stepIdx];
    const isWarmupSet = step.warmup === true;
    const reps = Number(this.c.querySelector("#inReps").value);
    if (!reps || reps < 1) return this.mostrarError("Anota cuántas repeticiones hiciste.", "#inReps");

    // Con peso, 0 bloques no es una serie válida: antes se registraba en
    // silencio y el veredicto quedaba mal.
    if (!isWarmupSet && s.type !== "reps" && s.type !== "incline") {
      const b = Number(this.c.querySelector("#inBlocks").value);
      if (!b || b < 1) return this.mostrarError("Anota con cuántos bloques hiciste la serie.", "#inBlocks");
    }

    let rec;
    if (isWarmupSet) {
      // La serie de calentamiento no cuenta para la progresión.
      rec = { warmup: true, reps, blocks: Number(this.c.querySelector("#inBlocks").value) || 0 };
    } else {
      rec = { setIndex: step.setIndex, reps };
      if (s.type === "incline") {
        rec.level = Number(this.c.querySelector("#inLevel").value) || s.level;
      } else if (s.type !== "reps") {
        rec.blocks = Number(this.c.querySelector("#inBlocks").value) || 0;
      }
      if (step.side) rec.side = step.side;
    }
    this.logged[item.exerciseId].sets.push(rec);
    if (!isWarmupSet && s.type === "incline") this.logged[item.exerciseId].level = rec.level;

    this._stepIdx++;
    this.persist(); // cada serie queda guardada en el teléfono
    if (this._stepIdx >= this._steps.length) {
      this.finishExercise();
    } else {
      // Tras el calentamiento, descanso corto antes de la 1ª serie real.
      this.startRest(item, isWarmupSet ? 30 : undefined);
    }
  }

  startRest(item, seconds) {
    const box = this.c.querySelector("#restBox");
    box.classList.remove("d-none");
    this.c.querySelector("#btnRegister").disabled = true;
    // Subimos la vista: el temporizador tiene que verse sin hacer scroll.
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (_) { window.scrollTo(0, 0); }

    // Qué viene después: el badge de arriba sigue mostrando la serie recién
    // terminada, así que acá se dice explícitamente cuál toca.
    const sig = this._steps[this._stepIdx];
    const rotulo = this.c.querySelector("#restNext");
    if (rotulo && sig) {
      if (sig.warmup) rotulo.textContent = "Viene: serie de calentamiento";
      else {
        const lado = sig.side ? (sig.side === "R" ? " · DERECHA" : " · IZQUIERDA") : "";
        rotulo.textContent = `Viene: serie ${sig.setIndex + 1} de ${this._suggestion.sets}${lado}`;
      }
    }
    const timer = this.makeTimer({
      barEl: this.c.querySelector("#restBar"),
      labelEl: this.c.querySelector("#restLabel"),
      onDone: () => this.renderStep(),
    });
    timer.start(seconds != null ? seconds : this.restSeconds(item));
    this.c.querySelector("#btnSkipRest").onclick = () => { timer.stop(); this.renderStep(); };
    this.timer = timer;
  }

  finishExercise() {
    const item = this.list[this.i];
    const ex = EXERCISE_BY_ID[item.exerciseId];
    const evaluate = evaluateExercise({ item, config: this.config });
    const result = evaluate(this.logged[item.exerciseId]);
    this.results[item.exerciseId] = { ...result, item };
    this.persist();

    const isLast = this.i + 1 >= this.list.length;

    // Vista previa del SIGUIENTE ejercicio (para no quedar a ciegas en el descanso).
    let nextPreview = "";
    let nextVoice = "";
    if (!isLast) {
      const nItem = this.list[this.i + 1];
      const nEx = EXERCISE_BY_ID[nItem.exerciseId];
      const nSug = suggestFor(nItem, this.state[nItem.exerciseId], this.config, this.week);
      const nLoad = nSug.type === "incline" ? `nivel ${nSug.level}`
        : nSug.type === "reps" ? ""
        : nSug.type === "unilateral" ? `${nSug.sides[0].blocks ?? "?"} bloques (empieza derecha)`
        : (nSug.blocks != null ? `${nSug.blocks} bloques` : "");
      const animOn = getPref("anim", true);
      nextPreview = `
        <div class="alert alert-primary py-2 mb-2">
          <div class="small text-uppercase" style="opacity:.7;letter-spacing:.5px">Siguiente ejercicio</div>
          <div class="fw-bold">${nEx.name}${nLoad ? " · " + nLoad : ""}${nItem.warmup ? " · con calentamiento" : ""}</div>
          ${animOn ? espacioAnimacion(nItem.exerciseId, nEx.name, "previa") : ""}
        </div>`;
      nextVoice = `Siguiente ejercicio: ${nEx.name}${nLoad ? ", " + nLoad : ""}`;
    }

    // Habla el veredicto y, al terminar, anuncia el siguiente ejercicio.
    speak(item.unilateral ? "Listo. Revisa el veredicto por pierna." : `Veredicto: ${result.message}`,
      nextVoice ? () => speak(nextVoice) : undefined);

    this.c.innerHTML = `
      ${this.navBar("◀ Rehacer ejercicio")}
      <div class="card shadow-sm border-success">
        <div class="card-body">
          <h4 class="mb-2">✅ ${ex.name}</h4>
          <div class="alert alert-success">${result.message}</div>
          ${isLast ? `<p class="text-muted small mb-3">Se guardará y se sugerirá este valor la próxima sesión. Siempre puedes sobrescribirlo.</p>` : `
            <div class="text-center mb-3">
              <div class="mb-2 text-muted">Descanso entre ejercicios <span id="restLabel" class="fw-bold"></span></div>
              <div class="progress mb-2" style="height:18px;"><div id="restBar" class="progress-bar" style="width:0%"></div></div>
            </div>
            ${nextPreview}`}
          <button id="btnNext" class="btn btn-primary btn-lg w-100">${isLast ? "Ir a elongación" : "Saltar descanso ▶"}</button>
        </div>
      </div>`;
    montarAnimaciones(this.c);
    this.c.querySelector("#btnNext").onclick = () => { if (this.timer) this.timer.stop(); this.nextExercise(); };
    this.attachNav(() => { if (this.timer) this.timer.stop(); this.renderExercise(); });
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (_) { window.scrollTo(0, 0); }

    if (!isLast) {
      const restSec = (this.config.rest && this.config.rest.default) || 120;
      const timer = this.makeTimer({
        barEl: this.c.querySelector("#restBar"),
        labelEl: this.c.querySelector("#restLabel"),
        onDone: () => this.nextExercise(),
      });
      timer.start(restSec);
      this.timer = timer;
    }
  }

  renderCooldown() {
    const soft = this.user.profileKey === "esposa" ? " (suave, sin llegar a molestia)" : "";
    this.c.innerHTML = `
      ${this.navBar("◀ Último ejercicio")}
      <div class="card shadow-sm">
        <div class="card-body">
          <h4 class="mb-2">Elongación / vuelta a la calma</h4>
          <p class="small mb-2">Guiada, 30 seg por posición${soft} (con cuenta regresiva 3-2-1).</p>
          <ol class="mb-3 small text-muted">${COOLDOWN.map((t) => `<li>${t.name}${t.perSide ? " (por lado)" : ""}</li>`).join("")}</ol>
          <button id="btnStretch" class="btn btn-primary btn-lg w-100">Empezar elongación</button>
          <button id="btnFinish" class="btn btn-link w-100 mt-1">Saltar al resumen</button>
        </div>
      </div>`;
    this.c.querySelector("#btnStretch").onclick = () =>
      this.runGuidedSequence(COOLDOWN, { title: "Elongación", seconds: 30, onComplete: () => this.renderSummary() });
    this.c.querySelector("#btnFinish").onclick = () => this.renderSummary();
    this.attachNav(() => this.prevExercise());
  }

  renderSummary() {
    const entries = this.list
      .filter((item) => this.logged[item.exerciseId]?.sets.length)
      .map((item) => {
        const r = this.results[item.exerciseId];
        return {
          exerciseId: item.exerciseId,
          order: item.order,
          sets: this.logged[item.exerciseId].sets,
          verdict: r?.verdict ?? "hold",
          suggested: this._suggestionSnapshot(item),
        };
      });

    const session = {
      date: new Date().toISOString().slice(0, 10),
      weekNumber: this.week,
      phase: this.phase,
      dayLabel: this.dayLabel,
      status: "completed",
      entries,
    };

    // resumen visual
    const rows = entries.map((e) => {
      const ex = EXERCISE_BY_ID[e.exerciseId];
      const item = this.list.find((x) => x.exerciseId === e.exerciseId);
      const type = item?.progressionType || ex.progressionType || "weight";
      const best = Math.max(...e.sets.map((s) => s.reps));
      const load = type === "reps"
        ? "—"
        : type === "incline"
          ? `niv ${e.sets[0]?.level ?? "?"}`
          : `${Math.max(...e.sets.map((s) => s.blocks || 0))} bl`;
      return `<tr><td>${ex.name}</td><td class="text-end">${load}</td><td class="text-end">${best} rep</td></tr>`;
    }).join("");

    this.c.innerHTML = `
      <div class="card shadow-sm">
        <div class="card-body">
          <h4 class="mb-2">Resumen de la sesión</h4>
          <table class="table table-sm"><tbody>${rows}</tbody></table>
          <button id="btnSave" class="btn btn-success btn-lg w-100">Guardar sesión</button>
        </div>
      </div>`;
    this.c.querySelector("#btnSave").onclick = () => {
      this.c.querySelector("#btnSave").disabled = true;
      this.onFinish(session, this.results);
    };
  }

  _suggestionSnapshot(item) {
    const s = suggestFor(item, this.state[item.exerciseId], this.config, this.week);
    return s;
  }
}

// ---- Animación del ejercicio --------------------------------------------
// Deja un espacio con el dibujo plano y, una vez en pantalla, lo cambia por
// la figura 3D. Si el teléfono no puede mostrar 3D, queda el dibujo plano.
function espacioAnimacion(exerciseId, nombre, tipo = "") {
  const plano = animationFor(exerciseId);
  if (!plano && !tieneFigura3D(exerciseId)) return "";
  const previa = tipo === "previa";
  return `<div class="ex-anim-wrap${previa ? " ex-anim-previa" : ""}" data-anim="${exerciseId}" data-nombre="${nombre}">${plano || ""}</div>`;
}

function montarAnimaciones(raiz) {
  raiz.querySelectorAll("[data-anim]").forEach((espacio) => {
    const id = espacio.dataset.anim;
    if (!tieneFigura3D(id)) return;
    const plano = espacio.innerHTML;
    const caja = document.createElement("div");
    caja.className = "fig3d";
    const fase = document.createElement("span");
    fase.className = "fig3d-fase";
    caja.appendChild(fase);
    espacio.replaceChildren(caja);
    const fig = montarFigura3D(caja, id, {
      etiqueta: `Figura 3D haciendo ${espacio.dataset.nombre || "el ejercicio"}`,
      alCambiarFase: (t) => { fase.textContent = t; },
    });
    if (!fig) espacio.innerHTML = plano;
  });
}
