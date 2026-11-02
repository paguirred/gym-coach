// Animaciones SVG del movimiento de cada ejercicio (propias, sin internet).
// Estilo esquemático: cuerpo estático en gris + la parte que se mueve en lima,
// con flecha de dirección. Pensado para quien no es del gym.
//
// Colores vía variables CSS (heredan del tema): var(--muted) / var(--accent).
// Movimiento con SMIL <animateTransform> (soportado en Safari iOS y Chrome).

const DUR = "2.4s";
const MUT = "var(--muted)";
const ACC = "var(--accent)";
const MAC = "#46536b"; // máquina/estructura

function frame(inner) {
  return `<svg viewBox="0 0 240 150" class="ex-anim" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Animación del movimiento">
    <rect x="1" y="1" width="238" height="148" rx="16" fill="rgba(255,255,255,0.035)"/>
    ${inner}
  </svg>`;
}
// Segmento que oscila girando alrededor de (cx,cy) entre los ángulos a y b.
function spin(a, b, cx, cy) {
  return `<animateTransform attributeName="transform" type="rotate" dur="${DUR}" repeatCount="indefinite"
    values="${a} ${cx} ${cy}; ${b} ${cx} ${cy}; ${a} ${cx} ${cy}" keyTimes="0;0.5;1" calcMode="spline" keySplines=".4 0 .2 1;.4 0 .2 1"/>`;
}
// Elemento que oscila desplazándose entre (0,0) y (dx,dy).
function slide(dx, dy) {
  return `<animateTransform attributeName="transform" type="translate" dur="${DUR}" repeatCount="indefinite"
    values="0 0; ${dx} ${dy}; 0 0" keyTimes="0;0.5;1" calcMode="spline" keySplines=".4 0 .2 1;.4 0 .2 1"/>`;
}
const L = (x1, y1, x2, y2, c = MUT, w = 8) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
const dot = (cx, cy, r, c = ACC) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}"/>`;
const head = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="12" fill="${MUT}"/>`;

// Cuerpo sentado mirando a la derecha (banca a la izquierda).
const SEATED = `
  ${L(70, 112, 118, 112, MAC, 7)}  <!-- asiento -->
  ${L(70, 112, 70, 74, MAC, 7)}    <!-- respaldo -->
  ${head(96, 52)}
  ${L(96, 64, 100, 112)}           <!-- torso -->`;

// Cuerpo de pie mirando a la derecha.
const STANDING = `
  ${head(96, 40)}
  ${L(96, 52, 98, 104)}            <!-- torso -->
  ${L(98, 104, 98, 138)}          <!-- pierna -->
  ${L(88, 140, 112, 140, MAC, 7)} <!-- piso -->`;

export const ANIM = {
  // 1. Press de pecho: empujar un manillar hacia adelante.
  press_pecho: frame(`${SEATED}
    ${L(100, 70, 150, 74)}  <!-- brazo -->
    <g>${slide(30, 0)}
      ${L(158, 58, 158, 92, ACC, 9)}  <!-- manillar -->
      ${dot(150, 74, 6)}
    </g>
    ${L(196, 66, 214, 66, ACC, 5)}<polygon points="214,60 226,66 214,72" fill="${ACC}"/>`),

  // 2. Mariposa: juntar los codos al frente (dos almohadillas que se cierran).
  mariposa: frame(`${head(120, 40)} ${L(120, 52, 120, 96)}
    <g transform="rotate(0 120 66)">${spin(-28, 6, 120, 66)}${L(120, 66, 74, 96, ACC, 9)}${dot(74, 96, 7)}</g>
    <g transform="rotate(0 120 66)">${spin(28, -6, 120, 66)}${L(120, 66, 166, 96, ACC, 9)}${dot(166, 96, 7)}</g>
    <path d="M92 118 q28 14 56 0" fill="none" stroke="${ACC}" stroke-width="4"/>
    <polygon points="150,110 150,124 140,117" fill="${ACC}"/>`),

  // 3. Jalón al pecho: bajar una barra alta hasta el pecho.
  jalon_pecho: frame(`${SEATED}
    ${L(100, 68, 150, 60)}
    <g>${slide(0, 34)}
      ${L(128, 30, 176, 30, ACC, 9)}  <!-- barra -->
      ${dot(150, 30, 6)}
    </g>
    ${L(196, 44, 196, 66, ACC, 5)}<polygon points="190,66 196,80 202,66" fill="${ACC}"/>`),

  // 4. Remo sentado: tirar el manillar hacia el abdomen.
  remo_sentado: frame(`${SEATED}
    ${L(100, 74, 150, 78)}
    <g>${slide(-34, 0)}
      ${L(158, 62, 158, 96, ACC, 9)}
      ${dot(150, 78, 6)}
    </g>
    ${L(150, 116, 132, 116, ACC, 5)}<polygon points="132,110 120,116 132,122" fill="${ACC}"/>`),

  // 5. Remo al mentón: subir la barra hasta la barbilla.
  remo_menton: frame(`${STANDING}
    <g>${slide(0, -34)}
      ${L(78, 104, 118, 104, ACC, 9)}  <!-- barra -->
      ${dot(98, 104, 6)}
    </g>
    ${L(150, 104, 150, 82, ACC, 5)}<polygon points="144,82 150,68 156,82" fill="${ACC}"/>`),

  // 6. Curl bíceps: subir el antebrazo doblando el codo.
  curl_biceps: frame(`${head(70, 46)} ${L(70, 58, 74, 110)}
    ${L(74, 70, 74, 104)}  <!-- brazo superior fijo -->
    <g>${spin(0, -120, 74, 104)}${L(74, 104, 74, 140, ACC, 9)}${dot(74, 140, 7)}</g>
    <path d="M120 120 q22 -30 0 -60" fill="none" stroke="${ACC}" stroke-width="4"/>
    <polygon points="112,66 120,54 126,68" fill="${ACC}"/>`),

  // 7. Tríceps: extender el antebrazo hacia abajo (codo fijo).
  triceps_polea: frame(`${head(70, 40)} ${L(70, 52, 74, 104)}
    ${L(74, 62, 74, 96)}  <!-- brazo superior fijo -->
    <g>${spin(-75, 0, 74, 96)}${L(74, 96, 74, 132, ACC, 9)}${dot(74, 132, 7)}</g>
    ${L(150, 74, 150, 118, ACC, 5)}<polygon points="144,118 150,132 156,118" fill="${ACC}"/>`),

  // 8. Extensión de cuádriceps: estirar la pierna hacia adelante/arriba.
  ext_cuadriceps: frame(`${SEATED}
    ${L(100, 112, 150, 112)}  <!-- muslo -->
    <g>${spin(0, -78, 150, 112)}${L(150, 112, 150, 146, ACC, 9)}${dot(150, 146, 7)}</g>
    <path d="M176 140 q26 -22 12 -52" fill="none" stroke="${ACC}" stroke-width="4"/>
    <polygon points="180,92 188,80 194,94" fill="${ACC}"/>`),

  // 9. Curl femoral: flexionar la pierna llevando el talón atrás/arriba.
  curl_femoral: frame(`${head(96, 40)} ${L(96, 52, 98, 100)}
    ${L(98, 100, 132, 118)}  <!-- muslo -->
    <g>${spin(0, 105, 132, 118)}${L(132, 118, 132, 150, ACC, 9)}${dot(132, 150, 7)}</g>
    ${L(80, 140, 118, 140, MAC, 7)}
    <path d="M168 138 q18 -18 2 -40" fill="none" stroke="${ACC}" stroke-width="4"/>
    <polygon points="162,100 170,88 176,102" fill="${ACC}"/>`),

  // 10. Elevación de talones: subir el cuerpo empujando con las puntas.
  elev_talones: frame(`
    <g>${slide(0, -14)}
      ${head(120, 44)} ${L(120, 56, 120, 108)}
      ${L(120, 108, 120, 132, ACC, 9)}  <!-- pierna -->
      ${dot(120, 134, 7)}
    </g>
    ${L(96, 140, 144, 140, MAC, 7)}
    ${L(176, 118, 176, 96, ACC, 5)}<polygon points="170,96 176,82 182,96" fill="${ACC}"/>`),

  // 11. Abdominales: enrollar el tronco hacia adelante.
  abdominales: frame(`
    ${L(70, 120, 150, 120, MAC, 7)}  <!-- banca -->
    ${L(78, 120, 150, 120)}          <!-- piernas -->
    <g>${spin(0, -55, 78, 118)}${L(78, 118, 78, 74, ACC, 9)}${head2(78, 66)}</g>
    <path d="M120 70 q24 8 30 34" fill="none" stroke="${ACC}" stroke-width="4"/>
    <polygon points="146,96 152,108 138,102" fill="${ACC}"/>`),
};

// Cabeza en color acento (para el tronco que se mueve en abdominales).
function head2(cx, cy) { return `<circle cx="${cx}" cy="${cy}" r="11" fill="${ACC}"/>`; }

export function animationFor(exerciseId) {
  return ANIM[exerciseId] || null;
}
