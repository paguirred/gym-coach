// Figura humana articulada: hace el movimiento del ejercicio y enciende los
// músculos que trabaja. Todo SVG, sin dependencias ni internet.
//   primario   -> lima fuerte, además "late" para que se note
//   secundario -> lima tenue (los que ayudan)
//
// El muñeco está agrupado por articulaciones (hombro > codo, cadera > rodilla),
// así una rotación del hombro arrastra el antebrazo y la mano, como un brazo real.

const CUERPO = "#2b3547";
const MUSCULO = "#3d4b63";
const BORDE = "rgba(10,14,21,0.35)";
const DUR = "2.6s";

// Pivotes de cada articulación, en coordenadas de la figura.
const EJE = {
  hombroI: "40 48", hombroD: "80 48",
  codoI: "32 84", codoD: "88 84",
  caderaI: "52 112", caderaD: "68 112",
  rodillaI: "53 161", rodillaD: "67 161",
  tronco: "60 108",
};

export const MUSCULOS_POR_EJERCICIO = {
  press_pecho:    { primarios: ["pecho"],               secundarios: ["hombros", "triceps"] },
  mariposa:       { primarios: ["pecho"],               secundarios: ["hombros"] },
  jalon_pecho:    { primarios: ["dorsal"],              secundarios: ["biceps", "hombros"] },
  remo_sentado:   { primarios: ["dorsal", "trapecio"],  secundarios: ["biceps", "lumbar"] },
  remo_menton:    { primarios: ["hombros", "trapecio"], secundarios: ["biceps"] },
  curl_biceps:    { primarios: ["biceps"],              secundarios: ["antebrazo"] },
  triceps_polea:  { primarios: ["triceps"],             secundarios: ["antebrazo"] },
  ext_cuadriceps: { primarios: ["cuadriceps"],          secundarios: [] },
  curl_femoral:   { primarios: ["femoral"],             secundarios: ["gluteo", "gemelos"] },
  abdominales:    { primarios: ["abdomen"],             secundarios: ["oblicuos"] },
  elev_talones:   { primarios: ["gemelos"],             secundarios: [] },
};

// Movimiento por ejercicio: [ángulo inicial, ángulo final] por articulación.
// Los ángulos van en espejo entre lado izquierdo y derecho.
// Signos: en el lado izquierdo de la imagen, flexionar (subir la mano hacia el
// hombro) es ángulo NEGATIVO; en el derecho, positivo. Al revés se va hacia afuera.
const MOVIMIENTO = {
  press_pecho:    { hombroI: [-30, -10], hombroD: [30, 10], codoI: [-75, -15], codoD: [75, 15] },
  mariposa:       { hombroI: [-48, -8], hombroD: [48, 8], codoI: [-20, -8], codoD: [20, 8] },
  jalon_pecho:    { hombroI: [-140, -18], hombroD: [140, 18], codoI: [-5, -55], codoD: [5, 55] },
  remo_sentado:   { hombroI: [-15, -5], hombroD: [15, 5], codoI: [-10, -72], codoD: [10, 72] },
  remo_menton:    { hombroI: [-5, -52], hombroD: [5, 52], codoI: [0, -85], codoD: [0, 85] },
  curl_biceps:    { codoI: [0, -125], codoD: [0, 125] },
  triceps_polea:  { codoI: [-100, -8], codoD: [100, 8] },
  // Rodilla: flexionar/extender pasa hacia adelante y atrás, que no se ve de
  // frente ni de espalda. Con giros grandes la pierna se abría como un split,
  // así que queda una insinuación y el trabajo lo comunica el músculo latiendo.
  ext_cuadriceps: { rodillaI: [0, -22], rodillaD: [0, 22] },
  curl_femoral:   { rodillaI: [0, 26], rodillaD: [0, -26] },
  abdominales:    { tronco: [0, -24] },
  elev_talones:   {},
};

export function bodyMap(exerciseId) {
  const m = MUSCULOS_POR_EJERCICIO[exerciseId];
  if (!m) return null;
  const { primarios = [], secundarios = [] } = m;
  const mov = MOVIMIENTO[exerciseId] || {};

  // Pieza muscular: color según si trabaja, y latido si es la principal.
  const M = (k, d) => {
    const esP = primarios.includes(k);
    const esS = secundarios.includes(k);
    const fill = esP || esS ? "var(--accent)" : MUSCULO;
    const op = esS ? ` fill-opacity="0.42"` : "";
    const latido = esP
      ? `<animate attributeName="fill-opacity" values="1;0.5;1" dur="${DUR}" repeatCount="indefinite"/>` : "";
    return `<path d="${d}" fill="${fill}"${op}>${latido}</path>`;
  };
  const N = (d) => `<path d="${d}" fill="${CUERPO}"/>`;
  const NE = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${CUERPO}"/>`;

  // Rotación animada de una articulación (vacío si ese ejercicio no la mueve).
  const giro = (art) => {
    const a = mov[art];
    if (!a) return "";
    const p = EJE[art];
    return `<animateTransform attributeName="transform" type="rotate" dur="${DUR}"
      repeatCount="indefinite" values="${a[0]} ${p}; ${a[1]} ${p}; ${a[0]} ${p}"
      keyTimes="0;0.5;1" calcMode="spline" keySplines=".4 0 .2 1;.4 0 .2 1"/>`;
  };

  // --- Miembros (iguales de frente y de espalda, cambia el músculo) --------
  const brazo = (lado, musBrazo) => {
    const I = lado === "I";
    const hombro = I ? "hombroI" : "hombroD";
    const codo = I ? "codoI" : "codoD";
    return `
    <g>${giro(hombro)}
      ${M("hombros", I ? "M40 45 q-11 3 -13 14 q-1 8 3 12 q4 -13 12 -19 z"
                       : "M80 45 q11 3 13 14 q1 8 -3 12 q-4 -13 -12 -19 z")}
      ${M(musBrazo, I ? "M31 66 q-6 10 -4 21 q6 4 10 -1 q1 -12 3 -19 z"
                      : "M89 66 q6 10 4 21 q-6 4 -10 -1 q-1 -12 -3 -19 z")}
      <g>${giro(codo)}
        ${M("antebrazo", I ? "M27 88 q-3 13 1 24 q6 2 8 -3 q-1 -12 -1 -20 z"
                           : "M93 88 q3 13 -1 24 q-6 2 -8 -3 q1 -12 1 -20 z")}
        ${NE(I ? 30 : 90, 118, 5, 6.5)}
      </g>
    </g>`;
  };

  const pierna = (lado, musMuslo, musPantorrilla) => {
    const I = lado === "I";
    const rodilla = I ? "rodillaI" : "rodillaD";
    return `
    <g>${giro(I ? "caderaI" : "caderaD")}
      ${M(musMuslo, I ? "M48 114 q-6 26 -1 44 q8 4 13 -1 q2 -23 2 -43 q-8 3 -14 0 z"
                      : "M72 114 q6 26 1 44 q-8 4 -13 -1 q-2 -23 -2 -43 q8 3 14 0 z")}
      <g>${giro(rodilla)}
        ${NE(I ? 53 : 67, 163, 7, 5.5)}
        ${musPantorrilla
          ? M(musPantorrilla, I ? "M47 169 q-3 18 0 30 q7 3 11 -1 q-1 -16 0 -29 z"
                                : "M73 169 q3 18 0 30 q-7 3 -11 -1 q1 -16 0 -29 z")
          : N(I ? "M47 169 q-2 23 1 38 q7 3 11 -1 q-1 -20 0 -37 z"
                : "M73 169 q2 23 -1 38 q-7 3 -11 -1 q1 -20 0 -37 z")}
        ${N(I ? "M47 205 q6 3 12 0 l1 8 q-7 3 -14 0 z" : "M73 205 q-6 3 -12 0 l-1 8 q7 3 14 0 z")}
      </g>
    </g>`;
  };

  // --- Figura completa -----------------------------------------------------
  const figura = (x, cara) => {
    const frente = cara === "frente";
    const torso = frente
      ? `${M("pecho", "M59 47 q-11 -1 -18 5 q-3 8 2 14 q9 4 16 -2 z")}
         ${M("pecho", "M61 47 q11 -1 18 5 q3 8 -2 14 q-9 4 -16 -2 z")}
         ${M("oblicuos", "M42 68 q-3 16 2 30 l7 -4 q-4 -14 -3 -26 z")}
         ${M("oblicuos", "M78 68 q3 16 -2 30 l-7 -4 q4 -14 3 -26 z")}
         ${M("abdomen", "M51 67 q9 -3 18 0 q2 17 -1 31 q-8 4 -16 0 q-3 -14 -1 -31 z")}`
      : `${M("dorsal", "M42 62 q-3 18 4 30 q8 3 13 -2 q-2 -16 -2 -29 q-8 3 -15 1 z")}
         ${M("dorsal", "M78 62 q3 18 -4 30 q-8 3 -13 -2 q2 -16 2 -29 q8 3 15 1 z")}
         ${M("lumbar", "M51 92 q9 3 18 0 l2 13 q-11 4 -22 0 z")}`;
    const trapecio = frente
      ? M("trapecio", "M49 38 q11 -4 22 0 l9 8 q-20 -5 -40 0 z")
      : M("trapecio", "M60 36 q-14 2 -21 10 q-2 12 4 22 q8 5 17 5 q9 0 17 -5 q6 -10 4 -22 q-7 -8 -21 -10 z");
    const musBrazo = frente ? "biceps" : "triceps";
    const musMuslo = frente ? "cuadriceps" : "femoral";
    const glut = frente ? "" : `${M("gluteo", "M59 105 q-12 0 -13 10 q0 9 7 11 q6 1 6 -6 z")}
         ${M("gluteo", "M61 105 q12 0 13 10 q0 9 -7 11 q-6 1 -6 -6 z")}`;

    return `
  <g transform="translate(${x},0)" stroke="${BORDE}" stroke-width="0.7" stroke-linejoin="round">
    <g>${giro("tronco")}
      ${NE(60, 19, 11, 13.5)}
      ${N("M54.5 30 h11 v7.5 q-5.5 2.5 -11 0 z")}
      ${trapecio}
      ${torso}
      ${brazo("I", musBrazo)}
      ${brazo("D", musBrazo)}
    </g>
    ${N("M49 97 q11 4 22 0 l2 16 q-13 5 -26 0 z")}
    ${glut}
    ${pierna("I", musMuslo, frente ? null : "gemelos")}
    ${pierna("D", musMuslo, frente ? null : "gemelos")}
    <text x="60" y="231" text-anchor="middle" font-size="9" fill="#8b97a8" stroke="none">${frente ? "Frente" : "Espalda"}</text>
  </g>`;
  };

  return `<svg viewBox="0 0 250 238" class="body-map" xmlns="http://www.w3.org/2000/svg"
    role="img" aria-label="Movimiento y músculos que trabaja este ejercicio">
    <rect x="0" y="0" width="250" height="238" rx="16" fill="rgba(255,255,255,0.035)"/>
    ${figura(2, "frente")}
    ${figura(128, "espalda")}
  </svg>`;
}

export const NOMBRE_MUSCULO = {
  pecho: "Pecho", hombros: "Hombros", biceps: "Bíceps", triceps: "Tríceps",
  antebrazo: "Antebrazos", abdomen: "Abdomen", oblicuos: "Oblicuos",
  trapecio: "Trapecio", dorsal: "Dorsal", lumbar: "Lumbar", gluteo: "Glúteos",
  cuadriceps: "Cuádriceps", femoral: "Femorales", gemelos: "Gemelos",
};

export function leyendaMusculos(exerciseId) {
  const m = MUSCULOS_POR_EJERCICIO[exerciseId];
  if (!m) return "";
  const n = (k) => NOMBRE_MUSCULO[k] || k;
  const p = m.primarios.map(n).join(", ");
  const s = m.secundarios.map(n).join(", ");
  return `<div class="small mt-1">
      <span style="color:var(--accent)">●</span> <b>${p}</b>
      ${s ? `<span class="text-muted"> · <span style="color:var(--accent);opacity:.45">●</span> ${s}</span>` : ""}
    </div>`;
}
