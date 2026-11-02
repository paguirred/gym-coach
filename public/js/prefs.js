// Preferencias locales del dispositivo (persisten en localStorage).
// Por defecto todo activado.
export function getPref(key, def = true) {
  try {
    const v = localStorage.getItem("pref_" + key);
    return v === null ? def : v === "1";
  } catch (_) { return def; }
}
export function setPref(key, on) {
  try { localStorage.setItem("pref_" + key, on ? "1" : "0"); } catch (_) {}
}
