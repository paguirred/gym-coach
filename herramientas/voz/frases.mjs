// Imprime (JSON) todas las frases que hay que grabar para la voz del entrenador.
// Uso: node herramientas/voz/frases.mjs > frases.json
// Lee el catálogo real de la app, así un ejercicio nuevo entra solo.
globalThis.window ??= { addEventListener() {}, matchMedia: () => ({ matches: false }) };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };

const base = new URL("../../public/js/", import.meta.url);
const { EXERCISES } = await import(new URL("exercises.js", base));
const { WARMUP_GENERAL, COOLDOWN } = await import(new URL("session.js", base));
const { frasesAGrabar, NUMERO_MAX } = await import(new URL("voz-texto.js", base));

const frases = frasesAGrabar({ ejercicios: EXERCISES, calentamiento: WARMUP_GENERAL, elongacion: COOLDOWN });
const numeros = Array.from({ length: NUMERO_MAX + 1 }, (_, n) => "#" + n);
console.log(JSON.stringify({ frases, numeros }, null, 1));
