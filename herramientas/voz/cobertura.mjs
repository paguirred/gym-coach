// Prueba: todo lo que puede decir el entrenador se puede armar con las
// piezas grabadas. Uso: node herramientas/voz/cobertura.mjs [public/audio/voz.json]
// Sin archivo, revisa contra la lista de frases (antes de generar el audio).
globalThis.window ??= { addEventListener() {}, matchMedia: () => ({ matches: false }) };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
import { readFileSync } from "node:fs";

const base = new URL("../../public/js/", import.meta.url);
const { EXERCISES, versionDe } = await import(new URL("exercises.js", base));
const { WARMUP_GENERAL, COOLDOWN, SessionRunner, textoCarga } = await import(new URL("session.js", base));
const { PROFILE_TEMPLATES } = await import(new URL("profiles.js", base));
const { suggestFor, evaluateExercise, admiteMancuernas } = await import(new URL("progression.js", base));
const { piezas, frasesAGrabar, NUMERO_MAX } = await import(new URL("voz-texto.js", base));

let claves;
if (process.argv[2]) claves = JSON.parse(readFileSync(process.argv[2], "utf8")).piezas;
else {
  claves = new Set(frasesAGrabar({ ejercicios: EXERCISES, calentamiento: WARMUP_GENERAL, elongacion: COOLDOWN }));
  for (let n = 0; n <= NUMERO_MAX; n++) claves.add("#" + n);
}

const textos = new Set(["Sesión guardada. Buen trabajo.", "Vas por la mitad", "Listo. Revisa el veredicto por pierna."]);
for (let n = 1; n <= 3; n++) textos.add(String(n));
for (const it of [...WARMUP_GENERAL, ...COOLDOWN]) {
  textos.add(it.name);
  if (it.perSide) { textos.add(`${it.name} · lado izquierdo`); textos.add(`${it.name} · lado derecho`); }
}

const estados = [
  {}, { blocks: 1, level: 1, right: { blocks: 2 }, left: { blocks: 3 }, mancuernas: { kg: 4.5 } },
  { blocks: 12, level: 9, right: { blocks: 10 }, left: { blocks: 11 }, mancuernas: { kg: 22 } },
];
const anuncio = SessionRunner.prototype.voiceAnnounce;
for (const tpl of Object.values(PROFILE_TEMPLATES)) {
  const config = tpl.progressionConfig;
  for (const item of tpl.routine) {
    const equipos = admiteMancuernas(item) ? ["maquina", "mancuernas"] : ["maquina"];
    for (const equipo of equipos) {
      const ex = versionDe(item.exerciseId, equipo);
      for (const week of [1, 3, 6]) for (const st of estados) {
        const sug = suggestFor(item, st, config, week, equipo);
        textos.add(anuncio.call(null, item, ex, sug));
        const carga = textoCarga(sug);
        textos.add(`Siguiente ejercicio: ${ex.name}${carga ? ", " + carga.replace(" kg ", " kilos ") : ""}`);
      }
      // Veredictos con distintas repes, pesos y número de series.
      const ev = evaluateExercise({ item, config });
      for (const reps of [[3], [8], [12], [20], [17, 6, 6], [10, 11, 9], [25, 22]]) {
        for (const peso of [1, 7, 4.5]) {
          const sets = reps.map((r, i) => item.unilateral
            ? [{ setIndex: i, side: "R", reps: r, blocks: peso }, { setIndex: i, side: "L", reps: r, blocks: peso }]
            : [{ setIndex: i, reps: r, blocks: Math.round(peso), kg: peso, level: Math.round(peso) }]).flat();
          const r = ev({ sets, level: Math.round(peso), ...(equipo === "mancuernas" ? { equipo } : {}) });
          if (!item.unilateral) textos.add(`Veredicto: ${r.message}`);
        }
      }
    }
  }
}

const faltan = [...textos].filter((t) => !piezas(t, claves));
console.log(`${textos.size} frases revisadas, ${faltan.length} sin cubrir.`);
for (const t of faltan) console.log("  ✗", t);
process.exit(faltan.length ? 1 : 0);
