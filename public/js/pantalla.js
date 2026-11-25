// Mantiene la pantalla encendida durante la sesión (Screen Wake Lock).
// Sin esto, en la elongación (varios minutos sin tocar el teléfono) el iPhone
// apaga la pantalla, congela la app y la voz deja de sonar.
// iPhone: Safari 16.4+; app instalada en la pantalla de inicio: iOS 18.4+.

let bloqueo = null;
let querida = false;

async function pedir() {
  if (!querida || bloqueo || document.visibilityState !== "visible") return;
  try {
    bloqueo = await navigator.wakeLock.request("screen");
    bloqueo.addEventListener("release", () => { bloqueo = null; });
  } catch (_) { bloqueo = null; /* sin soporte o denegado: sigue igual */ }
}

// El sistema suelta el bloqueo al cambiar de app; se vuelve a pedir al regresar.
document.addEventListener("visibilitychange", () => { if (querida) pedir(); });

export function mantenerPantallaEncendida(si) {
  if (!("wakeLock" in navigator)) return;
  querida = si;
  if (si) pedir();
  else if (bloqueo) { bloqueo.release().catch(() => {}); bloqueo = null; }
}
