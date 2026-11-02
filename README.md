# Coach G3000 — PWA de entrenamiento familiar

Coach personal para la máquina **Ten Series G3000**, multi-usuario, para tres perfiles
(Patricio, esposa, hijo) con reglas y progresión distintas sobre el mismo motor.

- **PWA** instalable (Bootstrap 5 + JavaScript vanilla, sin bundler).
- **Firebase**: Hosting + Firestore + Auth (Google).
- **Progresión por bloques** (entero), abdominales por **nivel de inclinación**.
- **Voz** (`speechSynthesis`), **timer** de descanso con sonido/vibración, **histórico** con gráficos.
- Offline: persistencia de Firestore activada (tolera cortes). El offline "serio" es fase 2.

## Lo que falta hacer TÚ (2 cosas)

1. **Pegar la config de tu proyecto Firebase** en [`public/js/firebase-config.js`](public/js/firebase-config.js).
2. **Confirmar el split A/B de tu esposa (Fase 2)** en [`public/js/profiles.js`](public/js/profiles.js)
   (viene un default marcado como editable).

## Puesta en marcha

### 1. Crear el proyecto Firebase
1. [console.firebase.google.com](https://console.firebase.google.com) → **Agregar proyecto**.
2. **Authentication** → Sign-in method → habilitar **Google**.
3. **Firestore Database** → Crear base de datos (modo producción).
4. **Project settings → Tus apps → Web (`</>`)** → registra la app y copia el objeto `firebaseConfig`.
5. Pega ese objeto en `public/js/firebase-config.js`.

### 2. Instalar Firebase CLI y enlazar
```bash
npm i -g firebase-tools
firebase login
# edita .firebaserc y pon tu PROJECT_ID (o):
firebase use --add
```

### 3. Publicar reglas de Firestore
```bash
npm run deploy:rules
```

### 4. Probar local
```bash
npm run dev      # sirve public/ en http://localhost:5000
```
> El login con Google necesita un dominio autorizado. `localhost` ya viene autorizado
> en Firebase Auth. Si usas otro host, agrégalo en Auth → Settings → Authorized domains.

### 5. Desplegar
```bash
npm run deploy   # hosting + rules
```

## Primer uso
1. Cada persona entra con **su** cuenta de Google (en su propio teléfono).
2. En el primer login elige su perfil (Patricio / Esposa / Hijo) → se siembra su rutina.
3. En **🌱 Valores** pon los bloques/nivel actuales de cada ejercicio para no partir de cero.
4. **▶️ Empezar entrenamiento** guía la sesión completa.

## Modelo de datos (Firestore)

```
exercises/{id}                     catálogo global (11 ejercicios G3000 + cue)
users/{uid}                        perfil, program (semana/fase), progressionConfig, safety, routine
users/{uid}/state/current          byExercise{ id: {blocks|level|{right,left}, lastReps, ...} }
users/{uid}/sessions/{id}          log inmutable de cada sesión (histórico y gráficos)
```

## Estructura del código
| Archivo | Rol |
|---|---|
| `js/exercises.js` | Catálogo de los 11 ejercicios + cues técnicos |
| `js/profiles.js` | Los 3 perfiles con sus reglas reales (seed) |
| `js/progression.js` | **Motor de progresión** (función pura, offline) |
| `js/data.js` | Capa de acceso a Firestore |
| `js/session.js` | Flujo guiado de la sesión |
| `js/timer.js` | Timer de descanso (barra + sonido + vibración) |
| `js/voice.js` | Voz de salida + dictado opcional de repes |
| `js/history.js` | Gráficos de progreso (SVG) |
| `js/app.js` | Auth, router, dashboard, avisos de fase, sembrado |

## Reglas por perfil (implementadas)
- **Patricio**: 8–12 sup / 12–15 piernas; sem 1–2 con reserva, **sem 3+ al fallo + 2 series** en compuestos;
  cuádriceps y femoral **unilaterales** (empieza derecha, izquierda iguala repes con su propio peso);
  **elevación de talones omitida** (pendiente kinesiólogo).
- **Esposa**: 3 fases (adaptación → A/B → sobrecarga), **nunca al fallo**, avisos post-bariátricos.
- **Hijo**: **RIR 1–2 permanente**, nunca al fallo, avisos de carga MMA y descanso.
