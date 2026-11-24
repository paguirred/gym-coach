// Voz grabada del entrenador: reproduce frases desde /audio/voz.mp3 con Web
// Audio, para que la música de otras apps baje y siga (ver sonido.js).
// El archivo y su índice los genera herramientas/voz/generar.py.

import { contextoAudio } from "./sonido.js";
import { piezas } from "./voz-texto.js";

const PAUSA_CORTA = 0.04;  // entre piezas de una misma frase (s)
const PAUSA_LARGA = 0.22;  // en comas y puntos (s)
// Márgenes al recortar cada pieza del archivo (s). El del final es mayor
// porque algunos decodificadores de MP3 desplazan el audio ~50 ms.
const MARGEN_INICIO = 0.03;
const MARGEN_FIN = 0.08;

let indice = null;   // { clave: [inicio, duración] }
let buffer = null;   // AudioBuffer con todas las piezas
let carga = null;    // promesa de carga en curso
let sonando = [];    // fuentes en reproducción (para poder callar)
let fin = null;      // temporizador del aviso de término
let generacion = 0;  // sube al callar: lo anterior ya no avisa que terminó

// Descarga y decodifica la voz una sola vez (queda en caché para usar sin señal).
export function precargarVoz() {
  if (carga) return carga;
  carga = (async () => {
    const c = contextoAudio();
    if (!c) throw new Error("sin Web Audio");
    const [idx, datos] = await Promise.all([
      fetch("/audio/voz.json").then((r) => { if (!r.ok) throw new Error("voz.json " + r.status); return r.json(); }),
      fetch("/audio/voz.mp3").then((r) => { if (!r.ok) throw new Error("voz.mp3 " + r.status); return r.arrayBuffer(); }),
    ]);
    buffer = await new Promise((ok, mal) => c.decodeAudioData(datos, ok, mal));
    indice = idx.piezas;
    return true;
  })().catch((e) => { console.warn("Voz grabada no disponible:", e); carga = null; return false; });
  return carga;
}

export function callarGrabado() {
  generacion++;
  for (const s of sonando) { try { s.stop(); } catch (_) {} }
  sonando = [];
  if (fin) { clearTimeout(fin); fin = null; }
}

// Intenta decir `texto` con la voz grabada. Llama `alTerminar` al final (no
// si otra frase la interrumpe). `vigente()` dice si todavía corresponde
// hablar: mientras se carga el audio puede haber llegado otra frase.
// Devuelve una promesa: true si lo dijo (o ya no corresponde), false si no
// se puede (sin audio o con palabras no grabadas) y hay que usar otra voz.
export async function hablarGrabado(texto, alTerminar, vigente = () => true) {
  const listo = indice ? true : await precargarVoz();
  if (!vigente()) return true;
  if (!listo || !buffer) return false;
  const plan = piezas(texto, indice);
  if (!plan || !plan.length) {
    console.warn("Frase sin grabar, se usa la voz del sistema:", texto);
    return false;
  }
  const c = contextoAudio();
  if (c.state !== "running") {
    // Sin un toque previo el iPhone puede no despertar nunca el audio:
    // se espera poco y, si no, se usa la otra voz.
    await Promise.race([c.resume().catch(() => {}), new Promise((ok) => setTimeout(ok, 400))]);
  }
  if (!vigente()) return true;
  if (c.state !== "running") return false;

  callarGrabado();
  const miGeneracion = generacion;
  let t = c.currentTime + 0.05;
  let ultima = null;
  for (const p of plan) {
    if (p.pausa) { t += PAUSA_LARGA - PAUSA_CORTA; continue; }
    const [ini, dur] = indice[p.clave];
    const desde = Math.max(0, ini - MARGEN_INICIO);
    const largo = dur + MARGEN_INICIO + MARGEN_FIN;
    const fuente = c.createBufferSource();
    fuente.buffer = buffer;
    fuente.connect(c.destination);
    fuente.start(t, desde, largo);
    sonando.push(fuente);
    ultima = fuente;
    t += largo + PAUSA_CORTA;
  }
  const total = t - c.currentTime;
  let avisado = false;
  const terminar = () => {
    if (avisado) return;
    avisado = true;
    if (miGeneracion !== generacion) return; // la interrumpió otra frase
    sonando = [];
    fin = null;
    alTerminar?.();
  };
  if (ultima) ultima.onended = terminar;
  fin = setTimeout(terminar, total * 1000 + 400); // respaldo si onended no llega
  return true;
}
