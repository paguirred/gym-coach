// Guía por voz (speechSynthesis, español) — PRIORITARIA (voz de salida).
// Y dictado opcional de repes (SpeechRecognition) — SECUNDARIO, activable.

let enabledOut = true;
let esVoice = null;

function pickSpanishVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  // preferimos es-CL / es-419 / es-ES en ese orden
  esVoice =
    voices.find((v) => /es[-_]CL/i.test(v.lang)) ||
    voices.find((v) => /es[-_]419/i.test(v.lang)) ||
    voices.find((v) => /^es/i.test(v.lang)) ||
    null;
}
if (window.speechSynthesis) {
  pickSpanishVoice();
  window.speechSynthesis.onvoiceschanged = pickSpanishVoice;
}

export function setVoiceOutput(on) { enabledOut = on; }
export function isVoiceOutputOn() { return enabledOut; }

// Habla `text`. Si se pasa `onEnd`, se llama cuando la voz TERMINA de leer
// (o de inmediato si la voz está apagada/no soportada). Siempre se llama una
// sola vez, con un respaldo por si el evento `onend` no dispara.
export function speak(text, onEnd) {
  const finish = once(onEnd);
  if (!enabledOut || !window.speechSynthesis) { finish(); return; }
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = esVoice?.lang || "es-CL";
    if (esVoice) u.voice = esVoice;
    u.rate = 1;
    u.pitch = 1;
    u.onend = finish;
    u.onerror = finish;
    window.speechSynthesis.speak(u);
    // Respaldo: si onend no dispara (pasa en algunos navegadores), seguimos
    // igual tras un tiempo estimado según el largo del texto.
    const ms = Math.min(6000, 900 + text.length * 90);
    setTimeout(finish, ms);
  } catch (_) { finish(); }
}

// Envuelve un callback para que se ejecute a lo más una vez.
function once(fn) {
  let done = false;
  return () => { if (done || !fn) return; done = true; try { fn(); } catch (_) {} };
}

// --- Dictado de repes (opcional) -----------------------------------------
export function speechRecognitionAvailable() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// Escucha una vez y trata de extraer un número. onResult(nOrNull).
export function listenNumber(onResult) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { onResult(null); return null; }
  const rec = new SR();
  rec.lang = "es-CL";
  rec.interimResults = false;
  rec.maxAlternatives = 3;
  rec.onresult = (e) => {
    let n = null;
    for (const res of e.results) {
      for (const alt of res) {
        const parsed = parseSpanishNumber(alt.transcript);
        if (parsed != null) { n = parsed; break; }
      }
      if (n != null) break;
    }
    onResult(n);
  };
  rec.onerror = () => onResult(null);
  try { rec.start(); } catch (_) { onResult(null); }
  return rec;
}

// Convierte "doce", "12", "quince repes" -> número. Español confunde números,
// por eso probamos dígitos y palabras.
const WORDS = {
  cero: 0, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, dieciseis: 16, dieciséis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20,
};
export function parseSpanishNumber(text) {
  if (!text) return null;
  const t = text.toLowerCase().trim();
  const digit = t.match(/\d{1,2}/);
  if (digit) return Number(digit[0]);
  for (const w of t.split(/\s+/)) if (w in WORDS) return WORDS[w];
  return null;
}
