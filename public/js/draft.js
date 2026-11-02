// Borrador del entrenamiento en curso, guardado en el teléfono.
// El progreso de una sesión vive en memoria hasta que se guarda al final; si la
// página se recarga (bloqueo del teléfono, cambio de app, actualización) se
// perdía todo. Acá se guarda serie a serie para poder retomar donde iba.

const CLAVE = "sesion_en_curso_";
const VIGENCIA_MS = 24 * 60 * 60 * 1000; // pasadas 24 h ya no se ofrece

export function saveDraft(uid, data) {
  if (!uid) return;
  try {
    localStorage.setItem(CLAVE + uid, JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch (_) { /* sin espacio o modo privado: seguimos sin borrador */ }
}

export function loadDraft(uid) {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(CLAVE + uid);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || !d.savedAt || Date.now() - d.savedAt > VIGENCIA_MS) {
      clearDraft(uid);
      return null;
    }
    // Sin series registradas no vale la pena ofrecer retomar.
    const series = Object.values(d.logged || {}).reduce((a, e) => a + (e.sets?.length || 0), 0);
    if (!series) return null;
    return d;
  } catch (_) { return null; }
}

export function clearDraft(uid) {
  if (!uid) return;
  try { localStorage.removeItem(CLAVE + uid); } catch (_) {}
}

// "hace 5 minutos" / "hace 2 horas", para el aviso de retomar.
export function hace(ms) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return `hace ${h} ${h === 1 ? "hora" : "horas"}`;
}
