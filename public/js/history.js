// Histórico y gráficos de progreso por ejercicio (SVG puro, sin librerías).
import { EXERCISE_BY_ID } from "./exercises.js";

// Extrae la serie temporal de un ejercicio desde las sesiones.
// Devuelve [{date, blocks, reps, level, side}] ordenado ascendente.
function seriesFor(sessions, exerciseId) {
  const points = [];
  for (const s of [...sessions].reverse()) {
    const entry = (s.entries || []).find((e) => e.exerciseId === exerciseId);
    if (!entry) continue;
    const date = s.date;
    // peso de trabajo = máx bloques; repes = máx repes de la sesión
    const sets = entry.sets || [];
    if (!sets.length) continue;
    const blocks = Math.max(...sets.map((x) => Number(x.blocks) || 0));
    const reps = Math.max(...sets.map((x) => Number(x.reps) || 0));
    const level = sets[0]?.level;
    points.push({ date, blocks, reps, level });
  }
  return points;
}

function lineChart(points, key, color, unit) {
  if (points.length === 0) return `<div class="text-muted small">Sin datos aún.</div>`;
  const W = 300, H = 90, P = 22;
  const vals = points.map((p) => Number(p[key]) || 0);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const n = points.length;
  const x = (i) => P + (n === 1 ? (W - 2 * P) / 2 : (i * (W - 2 * P)) / (n - 1));
  const y = (v) => H - P - ((v - min) / span) * (H - 2 * P);
  const dots = points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(vals[i]).toFixed(1)}" r="3" fill="${color}"/>`).join("");
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(vals[i]).toFixed(1)}`).join(" ");
  return `
    <svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img">
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2"/>
      ${dots}
      <text x="${P}" y="12" font-size="10" fill="currentColor">${max}${unit}</text>
      <text x="${P}" y="${H - 4}" font-size="10" fill="currentColor">${min}${unit}</text>
    </svg>`;
}

// Renderiza el histórico completo dentro de un contenedor.
export function renderHistory(container, sessions) {
  if (!sessions.length) {
    container.innerHTML = `<div class="text-center text-muted py-4">Aún no hay sesiones registradas.</div>`;
    return;
  }
  const exIds = [...new Set(sessions.flatMap((s) => (s.entries || []).map((e) => e.exerciseId)))];
  let html = `<div class="d-flex flex-column gap-3">`;
  for (const id of exIds) {
    const ex = EXERCISE_BY_ID[id];
    const pts = seriesFor(sessions, id);
    const isIncline = ex?.progressionType === "incline";
    const chart = isIncline
      ? lineChart(pts, "level", "#0d6efd", " niv")
      : lineChart(pts, "blocks", "#0d6efd", " bl");
    const repsChart = lineChart(pts, "reps", "#20c997", " rep");
    html += `
      <div class="card shadow-sm">
        <div class="card-body">
          <h6 class="card-title mb-2">${ex?.name || id}</h6>
          <div class="row g-2">
            <div class="col-6">
              <div class="small text-muted mb-1">${isIncline ? "Nivel inclinación" : "Bloques"}</div>
              ${chart}
            </div>
            <div class="col-6">
              <div class="small text-muted mb-1">Repes</div>
              ${repsChart}
            </div>
          </div>
        </div>
      </div>`;
  }
  html += `</div>`;
  container.innerHTML = html;
}

export function renderSessionLog(container, sessions) {
  if (!sessions.length) { container.innerHTML = ""; return; }
  let html = `<h6 class="mt-4 mb-2">Últimas sesiones</h6><div class="list-group">`;
  for (const s of sessions.slice(0, 12)) {
    const d = new Date(s.date);
    const day = isNaN(d) ? s.date : d.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });
    const n = (s.entries || []).length;
    html += `<div class="list-group-item d-flex justify-content-between">
      <span>${day} ${s.dayLabel && s.dayLabel !== "full" ? `· ${s.dayLabel}` : ""}</span>
      <span class="text-muted">S${s.weekNumber || "?"} · ${n} ejercicios</span></div>`;
  }
  html += `</div>`;
  container.innerHTML = html;
}
