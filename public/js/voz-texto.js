// Texto -> piezas de la voz grabada. Función pura (sin navegador), la usan
// la app al hablar y la herramienta que genera el audio (herramientas/voz).
//
// La voz grabada es un solo archivo con frases cortas y los números 0-100.
// Para decir un texto se separa en esas piezas, buscando siempre la frase
// más larga que calce, y se reproducen seguidas con pausas cortas.

// Frases fijas que dice el entrenador (además de nombres de ejercicios,
// calentamiento y elongación, que se toman del catálogo).
export const FRASES_FIJAS = [
  "sesión guardada", "buen trabajo", "vas por la mitad",
  "siguiente ejercicio", "nivel", "empezar por la derecha", "empieza derecha",
  "bloques", "kilos por mancuerna", "listo", "revisa el veredicto por pierna",
  "veredicto", "subir a", "bloques la próxima", "bajar a", "mantener",
  "kilos por mancuerna la próxima", "o lo más cercano que permitan tus discos",
  "promedio", "repes en", "series", "repes", "de promedio", "registrado",
  "sin subir intensidad", "pendiente confirmación médica",
  "pasaste las", "próxima vez sube a nivel", "puedes sostener un disco al pecho",
  "mantén el nivel", "sube al pasar", "derecha", "izquierda", "der", "izq",
  "lado izquierdo", "lado derecho", "coma",
];

// Números como piezas propias: "#0" ... "#100".
export const NUMERO_MAX = 100;

// Minúsculas, sin signos que no se pronuncian. Las pausas quedan como "|".
export function normalizar(texto) {
  return String(texto)
    .toLowerCase()
    .replace(/(\d+),(\d+)/g, "$1 coma $2")   // 9,7 -> 9 coma 7
    .replace(/(\d+)\.(\d+)/g, "$1 coma $2")
    .replace(/\bkg\b/g, "kilos")
    .replace(/[–—]/g, " a ")
    .replace(/[¡¿"'()]/g, " ")
    .replace(/[.:;·,!?/]/g, " | ")
    .replace(/\s+/g, " ")
    .trim();
}

// Clave de una frase del catálogo (sin pausas internas).
export function claveDe(frase) {
  return normalizar(frase).replace(/\s*\|\s*/g, " ").trim();
}

// Divide un texto en piezas usando las claves disponibles.
// Devuelve [{ clave } | { pausa: true }] o null si alguna palabra no está.
export function piezas(texto, claves) {
  const tieneClave = claves instanceof Set ? (k) => claves.has(k) : (k) => k in claves;
  let maxPalabras = 1;
  for (const k of claves instanceof Set ? claves : Object.keys(claves)) {
    maxPalabras = Math.max(maxPalabras, k.split(" ").length);
  }
  const t = normalizar(texto).split(" ").filter(Boolean);
  const out = [];
  let i = 0;
  while (i < t.length) {
    if (t[i] === "|") {
      if (out.length && !out[out.length - 1].pausa) out.push({ pausa: true });
      i++;
      continue;
    }
    if (/^\d+$/.test(t[i])) {
      const n = Number(t[i]);
      if (n > NUMERO_MAX || !tieneClave("#" + n)) return null;
      out.push({ clave: "#" + n });
      i++;
      continue;
    }
    let hallada = null;
    for (let n = Math.min(maxPalabras, t.length - i); n >= 1; n--) {
      const tramo = t.slice(i, i + n);
      if (tramo.includes("|")) continue;
      const k = tramo.join(" ");
      if (tieneClave(k)) { hallada = { k, n }; break; }
    }
    if (!hallada) return null;
    out.push({ clave: hallada.k });
    i += hallada.n;
  }
  while (out.length && out[out.length - 1].pausa) out.pop();
  return out;
}

// Todas las frases a grabar, dado el catálogo de la app.
export function frasesAGrabar({ ejercicios = [], calentamiento = [], elongacion = [] } = {}) {
  const set = new Set(FRASES_FIJAS.map(claveDe));
  for (const e of ejercicios) {
    set.add(claveDe(e.name));
    if (e.mancuernas) set.add(claveDe(e.mancuernas.name));
  }
  for (const it of [...calentamiento, ...elongacion]) set.add(claveDe(it.name || it));
  return [...set].filter(Boolean);
}
