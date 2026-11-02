# Coach G3000 — instrucciones para Claude

PWA de entrenamiento para la familia de Patricio (él, su esposa Myriam y su hijo
Isaac), todos en la misma máquina **Ten Series G3000**. En producción en
**https://mp-gym-coach.web.app** (Firebase: Hosting + Firestore + Auth Google).

## Cómo se publica (leer antes de tocar nada)
- **Todo push a `main` se despliega solo** (`.github/workflows/desplegar.yml`):
  valida la sintaxis de los JS y publica hosting + reglas de Firestore.
  No hay que correr `firebase deploy` a mano.
- **Al cambiar cualquier archivo de `public/`, subir la versión en DOS lugares**:
  `APP_VERSION` en `public/js/app.js` y `CACHE` en `public/sw.js` (vN → vN+1,
  siempre el mismo número). Es lo que Patricio ve en Ajustes para saber que
  tiene lo último.
- Después del push, **verificar que llegó**: la versión publicada tiene que
  coincidir, por ejemplo con
  `curl -s https://mp-gym-coach.web.app/js/app.js | grep -o 'APP_VERSION = "v[0-9]*"'`.
  "Funciona" solo si se comprobó en el sitio real.
- Patricio trabaja **desde el teléfono**: no puede abrir una terminal ni la
  consola de Firebase con comodidad. Lo que se pueda hacer desde acá, se hace acá.

## Estructura
- `public/js/profiles.js` — los 3 perfiles: rutinas, reglas y pesos de partida.
- `public/js/progression.js` — motor de progresión (función pura): el veredicto
  usa el **promedio** de repes de las series reales (no la mejor serie).
- `public/js/session.js` — flujo guiado de la sesión. `app.js` — inicio, ajustes.
- `public/js/draft.js` — borrador de la sesión en curso (sobrevive a recargas).
- `public/js/bodymap.js` — figura articulada con músculos encendidos (todavía
  NO está integrada; la app usa `animations.js`). Muestra en `muestra-musculos.html`.
- Sin bundler ni build: JS vanilla en módulos + Bootstrap 5.3 por CDN.

## Reglas del dominio (no se negocian)
- **Isaac (16 años): NUNCA al fallo**, RIR 1–2 siempre.
- **Myriam: post-bariátrica**, nunca al fallo, RIR 2; abdominales en pausa hasta
  autorización médica; el press de pecho está quitado de su rutina (la máquina
  le queda grande, mide 1,46 m).
- **Patricio: pie equino derecho** → cuádriceps y femoral unilaterales (derecha
  primero, la izquierda iguala repes, peso propio por pierna); elevación de
  talones omitida hasta que lo vea el kinesiólogo. Rutina actual: split 5 días.
- Al cambiar la rutina de una plantilla, **subir su `routineVersion`**: la app le
  ofrece al usuario actualizar sin perder pesos ni historial.
- No tocar el perfil de alguien si no se pidió.

## Forma de trabajo
- Español de Chile, **sin voseo** (nada de "tenés/podés/hacé"). Tildes en todo
  texto visible. Textos formales y ciertos.
- Interfaz: una sola acción primaria por vista; label visible sobre cada campo;
  colores por variables CSS, nunca literales; objetivo táctil de 44 px; el error
  dice qué pasó y qué hacer. Probar a 375 px de ancho.
- Validar con evidencia después de cada cambio (`node --check`, una prueba,
  la versión publicada). No proponer borrar archivos.
- Las decisiones técnicas las toma Claude, informando qué decidió y por qué.
  A Patricio se le pregunta solo lo que es suyo (reglas del entrenamiento,
  prioridades, lo que afecta a Myriam o a Isaac).
- Cerrar cada respuesta con una "Reexplicación breve" (qué quedó hecho y qué no)
  y, al final, separado, "Qué tienes que hacer tú".
