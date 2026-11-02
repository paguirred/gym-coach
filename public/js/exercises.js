// Catálogo GLOBAL de ejercicios de la máquina Ten Series G3000.
// Es compartido por los tres perfiles (misma máquina). Cada perfil decide,
// en su rutina, cuáles usa y con qué parámetros.
//
// progressionType:
//   "weight"  -> progresa subiendo bloques (entero).
//   "incline" -> progresa subiendo el nivel de inclinación (abdominales).
//
// group: se usa para agrupar y para marcar el 1er ejercicio de cada grupo
//        como calentamiento cuando el perfil lo pide.

export const EXERCISES = [
  {
    id: "press_pecho",
    name: "Press de pecho",
    order: 1,
    group: "pecho",
    progressionType: "weight",
    cue: "Espalda apoyada, empujar los manillares. Tempo 2 seg empuje / 3 seg retorno.",
  },
  {
    id: "mariposa",
    name: "Mariposa",
    order: 2,
    group: "pecho",
    progressionType: "weight",
    cue: "Antebrazos en las almohadillas, juntar los codos lento y controlado.",
  },
  {
    id: "jalon_pecho",
    name: "Jalón al pecho",
    order: 3,
    group: "espalda",
    progressionType: "weight",
    cue: "Sentado de frente, agarre amplio. Tirar AL PECHO (no al cuello), codos abajo y atrás, omóplatos apretados.",
  },
  {
    id: "remo_sentado",
    name: "Remo sentado",
    order: 4,
    group: "espalda",
    progressionType: "weight",
    cue: "Polea baja, tirar al abdomen, codos pegados al cuerpo.",
  },
  {
    id: "remo_menton",
    name: "Remo al mentón",
    order: 5,
    group: "hombros",
    progressionType: "weight",
    cue: "Polea baja, tirar a la barbilla, codos al techo. OJO con el hombro: sin dolor.",
  },
  {
    id: "curl_biceps",
    name: "Curl bíceps",
    order: 6,
    group: "brazos",
    progressionType: "weight",
    cue: "Polea baja, palmas arriba, mover solo los antebrazos.",
  },
  {
    id: "triceps_polea",
    name: "Tríceps (empuje polea alta)",
    order: 7,
    group: "brazos",
    progressionType: "weight",
    cue: "Barra corta arriba, codos fijos al costado, extender.",
  },
  {
    id: "ext_cuadriceps",
    name: "Extensión de cuádriceps",
    order: 8,
    group: "piernas",
    progressionType: "weight",
    cue: "Sentado, extender la rodilla de forma controlada.",
  },
  {
    id: "curl_femoral",
    name: "Curl femoral",
    order: 9,
    group: "piernas",
    progressionType: "weight",
    cue: "De pie, una pierna a la vez, flexionar llevando el talón al glúteo.",
  },
  {
    id: "abdominales",
    name: "Abdominales",
    order: 10,
    group: "core",
    progressionType: "incline",
    cue: "Camilla inclinable, manos al pecho, sin tirón de cuello. Sube por nivel de inclinación.",
  },
  {
    id: "elev_talones",
    name: "Elevación de talones",
    order: 11,
    group: "piernas",
    progressionType: "weight",
    cue: "Empujar con la punta de los pies, subir los talones al máximo y bajar lento.",
  },
];

export const EXERCISE_BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
