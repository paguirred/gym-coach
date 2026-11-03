// Figura 3D articulada que hace el movimiento de cada ejercicio de la G3000
// y enciende los músculos que trabaja. three.js va guardado dentro de la app
// (js/vendor), así funciona sin señal en el gimnasio.
//
//   montarFigura3D(contenedor, idEjercicio, opciones) -> { destruir() } | null
//
// - Músculo principal: lima, brilla más justo cuando se contrae.
// - Músculos que ayudan: lima tenue.
// - Ritmo real del tempo 2/3: 2 s de esfuerzo, 3 s de vuelta controlada.
// - Se gira arrastrando de lado a lado; el desplazamiento vertical de la
//   página sigue funcionando (touch-action: pan-y).
// - Si no hay WebGL devuelve null y quien llama muestra la animación plana.
// - Se apaga sola cuando sale de pantalla o cuando su contenedor se reemplaza.

import * as THREE from "./vendor/three.module.min.js";
import { MUSCULOS_POR_EJERCICIO } from "./bodymap.js";

const G = Math.PI / 180;

// ---- Colores: siempre desde variables CSS ---------------------------------
function colorCSS(nombre, porDefecto) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  try { return new THREE.Color(v || porDefecto); } catch { return new THREE.Color(porDefecto); }
}

// ---- Geometrías ------------------------------------------------------------
// Extremidad que cuelga hacia abajo desde su articulación (y=0) con largo
// "largo", más gruesa arriba que abajo y con puntas redondeadas.
function geoExtremidad(rArriba, rAbajo, largo) {
  const p = [];
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2);
    p.push(new THREE.Vector2(rAbajo * Math.cos(a), -largo + rAbajo * Math.sin(a)));
  }
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    p.push(new THREE.Vector2(rArriba * Math.cos(a), rArriba * Math.sin(a)));
  }
  return new THREE.LatheGeometry(p, 22);
}
const ESFERA = new THREE.SphereGeometry(1, 28, 18);

// ---- Esqueleto ---------------------------------------------------------------
// La figura mira hacia +Z; su izquierda es +X. Medidas en metros (~1,78 m).
function crearCuerpo(mat) {
  const j = {};
  const grupo = (nombre, padre, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.order = "YXZ";
    padre.add(g);
    j[nombre] = g;
    return g;
  };
  const elipse = (padre, sx, sy, sz, x, y, z, m = mat.cuerpo) => {
    const e = new THREE.Mesh(ESFERA, m);
    e.scale.set(sx, sy, sz);
    e.position.set(x, y, z);
    padre.add(e);
    return e;
  };
  const extremidad = (padre, r1, r2, largo) => padre.add(new THREE.Mesh(geoExtremidad(r1, r2, largo), mat.cuerpo));

  const raiz = new THREE.Group();
  raiz.rotation.order = "YXZ";
  j.raiz = raiz;

  // Pelvis y tronco
  elipse(raiz, 0.155, 0.11, 0.105, 0, 0, 0);
  const tronco = grupo("tronco", raiz, 0, 0.05, 0);
  elipse(tronco, 0.135, 0.15, 0.098, 0, 0.12, 0);
  const pecho = grupo("pecho", tronco, 0, 0.21, 0);
  elipse(pecho, 0.17, 0.175, 0.108, 0, 0.15, 0);
  // Cuello y cabeza
  const cuello = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.05, 0.1, 18), mat.cuerpo);
  cuello.position.set(0, 0.34, 0);
  pecho.add(cuello);
  const cabeza = grupo("cabeza", pecho, 0, 0.37, 0);
  elipse(cabeza, 0.083, 0.104, 0.095, 0, 0.1, 0.005);

  // Brazos y piernas: "I" = izquierda (+X), "D" = derecha (−X)
  for (const lado of ["I", "D"]) {
    const s = lado === "I" ? 1 : -1;
    const hombro = grupo("hombro" + lado, pecho, 0.195 * s, 0.255, 0);
    extremidad(hombro, 0.05, 0.04, 0.29);
    const codo = grupo("codo" + lado, hombro, 0, -0.29, 0);
    extremidad(codo, 0.041, 0.03, 0.26);
    const mano = grupo("mano" + lado, codo, 0, -0.3, 0);
    elipse(mano, 0.03, 0.048, 0.022, 0, 0.005, 0);

    const cadera = grupo("cadera" + lado, raiz, 0.088 * s, -0.06, 0);
    extremidad(cadera, 0.078, 0.052, 0.42);
    const rodilla = grupo("rodilla" + lado, cadera, 0, -0.42, 0);
    extremidad(rodilla, 0.054, 0.036, 0.4);
    const tobillo = grupo("tobillo" + lado, rodilla, 0, -0.4, 0);
    elipse(tobillo, 0.042, 0.03, 0.11, 0, -0.045, 0.055);
  }
  return { raiz, j };
}

// Dónde va cada músculo: [articulación, escala xyz, posición xyz, giro z].
// Las piezas pares llevan "±": se repiten en el otro lado en espejo.
const PIEZAS = {
  pecho:      [["pecho", [0.078, 0.062, 0.032], [0.074, 0.2, 0.084], 0, "±"]],
  abdomen:    [["tronco", [0.062, 0.105, 0.03], [0, 0.11, 0.078]]],
  oblicuos:   [["tronco", [0.032, 0.085, 0.06], [0.108, 0.1, 0.02], 0, "±"]],
  trapecio:   [["pecho", [0.11, 0.07, 0.042], [0, 0.255, -0.062]]],
  dorsal:     [["pecho", [0.07, 0.13, 0.034], [0.098, 0.08, -0.074], 0.28, "±"]],
  lumbar:     [["tronco", [0.07, 0.06, 0.03], [0, 0.07, -0.078]]],
  hombros:    [["hombro", [0.066, 0.072, 0.066], [0, -0.03, 0]]],
  biceps:     [["hombro", [0.038, 0.1, 0.036], [0, -0.145, 0.024]]],
  triceps:    [["hombro", [0.04, 0.11, 0.036], [0, -0.135, -0.024]]],
  antebrazo:  [["codo", [0.041, 0.095, 0.037], [0, -0.085, 0]]],
  gluteo:     [["raiz", [0.075, 0.082, 0.06], [0.068, -0.035, -0.068], 0, "±"]],
  cuadriceps: [["cadera", [0.066, 0.17, 0.052], [0, -0.2, 0.03]]],
  femoral:    [["cadera", [0.06, 0.16, 0.046], [0, -0.21, -0.034]]],
  gemelos:    [["rodilla", [0.046, 0.1, 0.042], [0, -0.11, -0.026]]],
};
// Articulaciones que existen a ambos lados (brazos y piernas).
const PAR = new Set(["hombro", "codo", "mano", "cadera", "rodilla", "tobillo"]);

function ponerMusculos(j, colores, idEjercicio) {
  const m = MUSCULOS_POR_EJERCICIO[idEjercicio] || { primarios: [], secundarios: [] };
  const principales = [];
  for (const [musculo, piezas] of Object.entries(PIEZAS)) {
    const esP = m.primarios.includes(musculo);
    const esS = m.secundarios.includes(musculo);
    const color = esP ? colores.acento.clone()
      : esS ? colores.musculo.clone().lerp(colores.acento, 0.5)
      : colores.musculo.clone();
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: 0.45, metalness: 0.05,
      emissive: esP || esS ? colores.acento.clone() : new THREE.Color(0),
      emissiveIntensity: esS ? 0.12 : 0,
    });
    if (esP) principales.push(mat);
    for (const [art, esc, pos, giro = 0, par] of piezas) {
      const lados = PAR.has(art) || par ? [1, -1] : [1];
      for (const s of lados) {
        const padre = PAR.has(art) ? j[art + (s === 1 ? "I" : "D")] : j[art];
        const pieza = new THREE.Mesh(ESFERA, mat);
        pieza.scale.set(...esc);
        pieza.position.set(PAR.has(art) ? pos[0] : pos[0] * s, pos[1], pos[2]);
        pieza.rotation.z = giro * s;
        padre.add(pieza);
      }
    }
  }
  return principales;
}

// ---- Posturas ------------------------------------------------------------------
// Ángulos en grados [x, y, z] (orden YXZ). Se escriben para el lado
// IZQUIERDO y el derecho se refleja solo (x igual, y/z con signo cambiado);
// "hombroD", "rodillaD", etc. permiten mover un solo lado.
//   x negativo en hombro/cadera = hacia adelante; en codo = doblar.
//   x positivo en rodilla = doblar; en tobillo = punta abajo; en tronco = hacia adelante.
//   z positivo en hombro izquierdo = abrir el brazo hacia el costado.
//   y negativo en hombro izquierdo = llevar el brazo hacia el frente.
const SENTADO = { raiz: { p: [0, 0.52, 0] }, cadera: [-90, 0, 3], rodilla: [90, 0, 0] };
const DE_PIE = { raiz: { p: [0, 0.98, 0] }, cadera: [0, 0, 2], hombro: [0, 0, 6] };

// Cada ejercicio: base (fija), a (inicio) y b (fin del esfuerzo), utilería
// de la máquina y cámara inicial (giro en grados alrededor de la figura;
// 0 = de frente, 90 = desde su izquierda, 180 = de espalda).
const EJERCICIOS = {
  press_pecho: {
    base: SENTADO,
    a: { hombro: [0, 18, 70], codo: [-105, 0, 0] },
    b: { hombro: [0, -76, 80], codo: [-12, 0, 0] },
    utileria: ["asiento", "respaldo", "manillares"],
    camara: { giro: 52, alto: 0.25 },
    verbos: ["Empuja", "Vuelve"],
  },
  mariposa: {
    base: SENTADO,
    a: { hombro: [0, 18, 86], codo: [0, 0, 92] },
    b: { hombro: [0, -62, 86], codo: [0, 0, 92] },
    utileria: ["asiento", "respaldo", "almohadillas"],
    camara: { giro: 28, alto: 0.3 },
    verbos: ["Junta", "Abre"],
  },
  jalon_pecho: {
    base: SENTADO,
    a: { hombro: [0, -8, 160], codo: [0, 0, 12] },
    b: { hombro: [0, 18, 72], codo: [0, 0, 104], tronco: [-8, 0, 0] },
    utileria: ["asiento", "rodillo", "barra:0.16", "cable:arriba"],
    camara: { giro: 150, alto: 0.2 },
    verbos: ["Tira", "Sube"],
  },
  remo_sentado: {
    base: SENTADO,
    a: { hombro: [-78, 0, -4], codo: [0, 0, 0], tronco: [10, 0, 0] },
    b: { hombro: [22, 0, 8], codo: [-108, 0, 0], tronco: [0, 0, 0] },
    utileria: ["asiento", "barra:0.02", "cable:abajo"],
    camara: { giro: 118, alto: 0.25 },
    verbos: ["Tira", "Estira"],
  },
  remo_menton: {
    base: DE_PIE,
    a: { hombro: [-8, 0, -6], codo: [-4, 0, 0] },
    b: { hombro: [0, -34, 56], codo: [0, 0, 98] },
    utileria: ["barra:0.04", "cable:piso"],
    camara: { giro: 32, alto: 0.15 },
    verbos: ["Sube", "Baja"],
  },
  curl_biceps: {
    base: DE_PIE,
    a: { hombro: [-4, 0, 4], codo: [-6, 0, 0] },
    b: { hombro: [-14, 0, 4], codo: [-138, 0, 0] },
    utileria: ["barra:0.06", "cable:piso"],
    camara: { giro: 62, alto: 0.15 },
    verbos: ["Sube", "Baja"],
  },
  triceps_polea: {
    base: { ...DE_PIE, tronco: [10, 0, 0] },
    a: { hombro: [-16, 0, 5], codo: [-108, 0, 0] },
    b: { hombro: [-10, 0, 5], codo: [-6, 0, 0] },
    utileria: ["barra:0.03", "cable:alto"],
    camara: { giro: 125, alto: 0.15 },
    verbos: ["Empuja", "Sube"],
  },
  ext_cuadriceps: {
    base: { ...SENTADO, hombro: [-14, 0, 14], codo: [-28, 0, 0] },
    a: { rodilla: [90, 0, 0] },
    b: { rodilla: [6, 0, 0] },
    utileria: ["asiento", "respaldo", "rodillos"],
    camara: { giro: 64, alto: 0.25 },
    verbos: ["Estira", "Baja"],
  },
  curl_femoral: {
    base: { ...DE_PIE, tronco: [8, 0, 0], hombro: [-42, 0, 6], codo: [-38, 0, 0], caderaI: [-6, 0, 2] },
    a: { rodillaI: [4, 0, 0] },
    b: { rodillaI: [108, 0, 0] },
    utileria: ["barra:0.08", "rodilloTalon"],
    camara: { giro: 105, alto: 0.15 },
    verbos: ["Flexiona", "Baja"],
  },
  elev_talones: {
    base: { ...DE_PIE, hombro: [-34, 0, 6], codo: [-48, 0, 0] },
    a: { raiz: { p: [0, 0.98, 0] }, tobillo: [0, 0, 0] },
    b: { raiz: { p: [0, 1.035, 0] }, tobillo: [32, 0, 0] },
    utileria: ["barra:0.08"],
    camara: { giro: 140, alto: 0.1 },
    verbos: ["Sube", "Baja"],
  },
  abdominales: {
    base: {
      raiz: { p: [0, 0.71, 0.05], r: [-104, 0, 0] },
      cadera: [-72, 0, 3], rodilla: [108, 0, 0],
      hombro: [-58, 0, -14], codo: [-128, 0, 0],
    },
    a: { tronco: [0, 0, 0], pecho: [0, 0, 0], cabeza: [0, 0, 0] },
    b: { tronco: [36, 0, 0], pecho: [18, 0, 0], cabeza: [12, 0, 0] },
    utileria: ["camilla"],
    camara: { giro: 72, alto: 0.3 },
    verbos: ["Sube", "Baja"],
  },
};

export function tieneFigura3D(id) {
  return Boolean(EJERCICIOS[id]);
}

// Junta base + fase en una postura plana { "hombroI": [x,y,z], ... }.
function expandir(postura) {
  const out = {};
  for (const [k, v] of Object.entries(postura || {})) {
    if (k === "raiz") { out.raiz = v; continue; }
    if (PAR.has(k)) {
      out[k + "I"] = v;
      out[k + "D"] = [v[0], -v[1], -v[2]];
    } else {
      out[k] = v;
    }
  }
  // Las de un solo lado (hombroD, rodillaI...) mandan sobre el par.
  for (const [k, v] of Object.entries(postura || {})) {
    if (/[ID]$/.test(k) && PAR.has(k.slice(0, -1))) out[k] = v;
  }
  return out;
}

// ---- Utilería de la máquina ----------------------------------------------------
function crearUtileria(def, j, mat, escena) {
  const actualizar = []; // funciones que se llaman en cada cuadro
  const caja = (sx, sy, sz, x, y, z, padre = escena, m = mat.maquina) => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m);
    c.position.set(x, y, z);
    padre.add(c);
    return c;
  };
  const cilindro = (r, largo, m = mat.maquina) =>
    new THREE.Mesh(new THREE.CylinderGeometry(r, r, largo, 18), m);
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  // Cilindro que une dos puntos del mundo (se actualiza en cada cuadro).
  const unir = (malla, a, b, extra = 0) => {
    const dir = tmpB.copy(b).sub(a);
    const largo = dir.length();
    malla.position.copy(a).addScaledVector(dir, 0.5);
    malla.scale.set(1, (largo + extra) / 1, 1);
    if (largo > 1e-6) malla.quaternion.setFromUnitVectors(Y, dir.normalize());
  };

  let puntoAgarre = null; // centro de la barra, para el cable
  for (const u of def.utileria) {
    const [tipo, arg] = u.split(":");
    if (tipo === "asiento") {
      caja(0.42, 0.06, 0.42, 0, 0.43, 0.08);
      caja(0.06, 0.4, 0.06, 0, 0.2, 0.06);
      caja(0.5, 0.03, 0.5, 0, 0.015, 0.06);
    } else if (tipo === "respaldo") {
      caja(0.38, 0.62, 0.06, 0, 0.82, -0.15);
    } else if (tipo === "camilla") {
      const c = caja(0.38, 0.06, 1.55, 0, 0.5, -0.25);
      c.rotation.x = -14 * G;
      caja(0.06, 0.5, 0.06, 0, 0.25, -0.25);
    } else if (tipo === "rodillo") {
      const r = cilindro(0.045, 0.42, mat.almohadilla);
      r.rotation.z = Math.PI / 2;
      r.position.set(0, 0.6, 0.3);
      escena.add(r);
    } else if (tipo === "rodillos" || tipo === "rodilloTalon") {
      const lados = tipo === "rodillos" ? ["I", "D"] : ["I"];
      for (const l of lados) {
        const r = cilindro(0.042, 0.13, mat.almohadilla);
        r.rotation.z = Math.PI / 2;
        r.position.set(0, -0.34, tipo === "rodillos" ? 0.08 : -0.08);
        j["rodilla" + l].add(r);
      }
    } else if (tipo === "almohadillas") {
      for (const l of ["I", "D"]) {
        const a = cilindro(0.04, 0.24, mat.almohadilla);
        a.position.set(0, -0.13, 0.06);
        j["codo" + l].add(a);
      }
    } else if (tipo === "manillares") {
      for (const l of ["I", "D"]) {
        const m = cilindro(0.02, 0.16);
        m.position.set(0, -0.01, 0);
        j["mano" + l].add(m);
      }
    } else if (tipo === "barra") {
      const extra = 2 * (parseFloat(arg) || 0.05);
      const barra = cilindro(0.016, 1);
      escena.add(barra);
      puntoAgarre = new THREE.Vector3();
      actualizar.push(() => {
        j.manoI.getWorldPosition(tmpA);
        j.manoD.getWorldPosition(tmpB);
        puntoAgarre.copy(tmpA).add(tmpB).multiplyScalar(0.5);
        unir(barra, tmpA, tmpB, extra);
      });
    } else if (tipo === "cable") {
      const anclas = { arriba: [0, 2.25, 0.12], abajo: [0, 0.28, 1.25], piso: [0, 0.12, 0.62], alto: [0, 2.15, 0.5] };
      const ancla = new THREE.Vector3(...anclas[arg]);
      const polea = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 10, 24), mat.maquina);
      polea.position.copy(ancla);
      escena.add(polea);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 1, 8), mat.cable);
      escena.add(cable);
      actualizar.push(() => { if (puntoAgarre) unir(cable, ancla, puntoAgarre); });
    }
  }
  return actualizar;
}

// ---- Montaje --------------------------------------------------------------------
export function montarFigura3D(contenedor, idEjercicio, opciones = {}) {
  const def = EJERCICIOS[idEjercicio];
  if (!def || !contenedor) return null;

  let renderer;
  try {
    const lienzo = document.createElement("canvas");
    const ctx = lienzo.getContext("webgl2") || lienzo.getContext("webgl");
    if (!ctx) return null;
    renderer = new THREE.WebGLRenderer({ canvas: lienzo, context: ctx, antialias: true, alpha: true });
  } catch {
    return null;
  }

  const colores = {
    acento: colorCSS("--accent", "#c6f24e"),
    cuerpo: colorCSS("--fig-cuerpo", "#5b6a82"),
    musculo: colorCSS("--fig-musculo", "#6f809b"),
    maquina: colorCSS("--fig-maquina", "#2a3446"),
    almohadilla: colorCSS("--fig-almohadilla", "#1c2230"),
    luz: colorCSS("--fig-luz", "#ffffff"),
    piso: colorCSS("--fig-piso", "#000000"),
  };
  const mat = {
    cuerpo: new THREE.MeshStandardMaterial({ color: colores.cuerpo, roughness: 0.55, metalness: 0.05 }),
    maquina: new THREE.MeshStandardMaterial({ color: colores.maquina, roughness: 0.35, metalness: 0.6 }),
    almohadilla: new THREE.MeshStandardMaterial({ color: colores.almohadilla, roughness: 0.85 }),
    cable: new THREE.MeshBasicMaterial({ color: colores.musculo }),
  };

  const escena = new THREE.Scene();
  escena.add(new THREE.HemisphereLight(colores.luz, colores.maquina, 1.6));
  const clave = new THREE.DirectionalLight(colores.luz, 2.2);
  clave.position.set(2, 3.5, 3);
  escena.add(clave);
  const contraluz = new THREE.DirectionalLight(colores.acento, 0.5);
  contraluz.position.set(-2.5, 2, -3);
  escena.add(contraluz);

  // Sombra suave en el piso (degradado, más barato que sombras reales).
  const sombraTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, "rgba(0,0,0,0.55)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const sombra = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({ map: sombraTex, transparent: true, depthWrite: false, color: colores.piso })
  );
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = 0.001;
  escena.add(sombra);

  const { raiz, j } = crearCuerpo(mat);
  escena.add(raiz);
  const principales = ponerMusculos(j, colores, idEjercicio);
  const actualizarUtileria = crearUtileria(def, j, mat, escena);

  // Posturas ya expandidas
  const pBase = expandir(def.base);
  const pA = { ...pBase, ...expandir(def.a) };
  const pB = { ...pBase, ...expandir(def.b) };
  const nombres = new Set([...Object.keys(pA), ...Object.keys(pB)]);
  nombres.delete("raiz");

  const aplicar = (t) => {
    const ra = pA.raiz || { p: [0, 0.98, 0] }, rb = pB.raiz || ra;
    const pa = ra.p || [0, 0.98, 0], pb = rb.p || pa;
    const qa = ra.r || [0, 0, 0], qb = rb.r || qa;
    raiz.position.set(pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, pa[2] + (pb[2] - pa[2]) * t);
    raiz.rotation.set((qa[0] + (qb[0] - qa[0]) * t) * G, (qa[1] + (qb[1] - qa[1]) * t) * G, (qa[2] + (qb[2] - qa[2]) * t) * G);
    for (const n of nombres) {
      const a = pA[n] || [0, 0, 0], b = pB[n] || a;
      j[n]?.rotation.set((a[0] + (b[0] - a[0]) * t) * G, (a[1] + (b[1] - a[1]) * t) * G, (a[2] + (b[2] - a[2]) * t) * G);
    }
  };

  // Cámara: órbita alrededor de la figura.
  const sentado = (pBase.raiz?.p?.[1] ?? 0.98) < 0.8;
  const objetivo = new THREE.Vector3(0, sentado ? 0.8 : 0.9, sentado ? 0.08 : 0);
  const camara = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
  const giroInicial = def.camara.giro * G;
  let giro = giroInicial;
  const alto = def.camara.alto;
  const distancia = sentado ? 3.6 : 4.6;
  const ubicarCamara = () => {
    camara.position.set(
      objetivo.x + distancia * Math.sin(giro),
      objetivo.y + distancia * alto,
      objetivo.z + distancia * Math.cos(giro)
    );
    camara.lookAt(objetivo);
  };

  // Lienzo dentro del contenedor
  const lienzo = renderer.domElement;
  lienzo.className = "fig3d-lienzo";
  lienzo.setAttribute("role", "img");
  lienzo.setAttribute("aria-label", opciones.etiqueta || "Figura 3D que muestra el movimiento del ejercicio");
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  contenedor.appendChild(lienzo);

  const ajustarTamano = () => {
    const w = contenedor.clientWidth || 300;
    const h = Math.round(w * 0.9);
    renderer.setSize(w, h, false);
    lienzo.style.width = "100%";
    lienzo.style.height = "auto";
    lienzo.style.aspectRatio = `${w} / ${h}`;
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
  };
  ajustarTamano();

  // Giro con el dedo (solo horizontal; lo vertical desplaza la página).
  let arrastre = null;
  const alBajar = (e) => { arrastre = { x: e.clientX, giro }; lienzo.setPointerCapture?.(e.pointerId); };
  const alMover = (e) => {
    if (!arrastre) return;
    giro = arrastre.giro - ((e.clientX - arrastre.x) / lienzo.clientWidth) * Math.PI * 1.6;
    dibujarSiPausado();
  };
  const alSoltar = () => { arrastre = null; };
  const alDobleToque = () => { giro = giroInicial; dibujarSiPausado(); };
  lienzo.addEventListener("pointerdown", alBajar);
  lienzo.addEventListener("pointermove", alMover);
  lienzo.addEventListener("pointerup", alSoltar);
  lienzo.addEventListener("pointercancel", alSoltar);
  lienzo.addEventListener("dblclick", alDobleToque);

  // Tempo 2/3: 2 s de esfuerzo, pausa, 3 s de vuelta, pausa.
  const T_SUBE = 2, T_ARRIBA = 0.5, T_BAJA = 3, T_ABAJO = 0.7;
  const CICLO = T_SUBE + T_ARRIBA + T_BAJA + T_ABAJO;
  const suave = (x) => x * x * (3 - 2 * x);
  const reducido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const verbos = def.verbos || ["Esfuerzo", "Vuelve"];
  let ultimaFase = "";
  const faseDe = (s) => {
    if (s < T_SUBE) return { t: suave(s / T_SUBE), texto: `${verbos[0]} · 2 s` };
    if (s < T_SUBE + T_ARRIBA) return { t: 1, texto: `${verbos[0]} · 2 s` };
    if (s < T_SUBE + T_ARRIBA + T_BAJA) return { t: 1 - suave((s - T_SUBE - T_ARRIBA) / T_BAJA), texto: `${verbos[1]} lento · 3 s` };
    return { t: 0, texto: `${verbos[1]} lento · 3 s` };
  };

  const dibujar = (t) => {
    aplicar(t);
    raiz.updateMatrixWorld(true);
    for (const f of actualizarUtileria) f();
    for (const m of principales) m.emissiveIntensity = 0.15 + 0.75 * t;
    ubicarCamara();
    renderer.render(escena, camara);
  };

  let visible = true, cuadro = 0, inicio = performance.now(), activo = true, tPausa = 0.55;
  const bucle = (ahora) => {
    cuadro = 0;
    if (!activo) return;
    if (!lienzo.isConnected) { destruir(); return; }
    if (!visible || document.hidden) return;
    const s = ((ahora - inicio) / 1000) % CICLO;
    const f = faseDe(s);
    if (opciones.alCambiarFase && f.texto !== ultimaFase) { ultimaFase = f.texto; opciones.alCambiarFase(f.texto); }
    dibujar(f.t);
    cuadro = requestAnimationFrame(bucle);
  };
  const arrancar = () => { if (!cuadro && activo && !reducido) cuadro = requestAnimationFrame(bucle); };
  function dibujarSiPausado() { if (reducido || !visible) dibujar(tPausa); }

  const obs = "IntersectionObserver" in window
    ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) arrancar(); })
    : null;
  obs?.observe(lienzo);
  const alCambiarVisibilidad = () => { if (!document.hidden) arrancar(); };
  document.addEventListener("visibilitychange", alCambiarVisibilidad);
  const ro = "ResizeObserver" in window ? new ResizeObserver(() => { ajustarTamano(); dibujarSiPausado(); }) : null;
  ro?.observe(contenedor);

  if (reducido) { dibujar(tPausa); opciones.alCambiarFase?.("Animación detenida (movimiento reducido)"); }
  else arrancar();

  function destruir() {
    if (!activo) return;
    activo = false;
    if (cuadro) cancelAnimationFrame(cuadro);
    obs?.disconnect();
    ro?.disconnect();
    document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    escena.traverse((o) => {
      if (o.geometry && o.geometry !== ESFERA) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    sombraTex.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
    lienzo.remove();
  }

  // Para pruebas: fija la figura en un punto del movimiento (0 = inicio, 1 = fin).
  const fijar = (t) => { activo && (tPausa = t, dibujar(t)); };
  return { destruir, fijar, girar: (g) => { giro = g * G; dibujarSiPausado(); } };
}
