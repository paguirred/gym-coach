// Audio propio de la app (voz grabada y pitidos), compartido por todos.
//
// En iPhone, la voz del sistema (speechSynthesis) DETIENE la música de otras
// apps. El audio que reproduce la app misma con Web Audio, en cambio, obedece
// navigator.audioSession: con "transient" la música baja y sigue sonando.
// Por eso todo sonido de la app pasa por este contexto.

let ctx = null;

// Pide al teléfono compartir el audio con la música (Safari 16.4+).
// Hay que fijarlo ANTES de crear el contexto de audio.
export function compartirAudioConMusica() {
  try {
    if (navigator.audioSession && navigator.audioSession.type !== "transient") {
      navigator.audioSession.type = "transient";
    }
  } catch (_) { /* sin soporte: queda el comportamiento del sistema */ }
}

export function contextoAudio() {
  compartirAudioConMusica();
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

// iPhone solo deja sonar el audio después de un toque del usuario: el primer
// toque en la app (y cualquiera después de una llamada o de bloquear la
// pantalla) "despierta" el contexto.
function despertar() {
  const c = contextoAudio();
  if (c && c.state !== "running") c.resume().catch(() => {});
}
for (const ev of ["pointerdown", "touchend", "keydown"]) {
  window.addEventListener(ev, despertar, { passive: true, capture: true });
}
