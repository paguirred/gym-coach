# Voz grabada del entrenador

En iPhone, la voz del sistema (`speechSynthesis`) detiene la música de otras
apps. Por eso el entrenador habla con audio propio: `public/audio/voz.mp3`
(todas las frases y los números 0–100) + `public/audio/voz.json` (dónde
empieza cada pieza). La app arma cada frase con esas piezas
(`public/js/voz-texto.js`) y las reproduce con Web Audio
(`public/js/voz-grabada.js`), que con `audioSession = "transient"` baja la
música y la deja seguir. Si una frase no está grabada, usa la voz del sistema.

## Cuándo regenerar

Al agregar o renombrar un ejercicio, un movimiento de calentamiento o
elongación, o una frase nueva que diga el entrenador (agregarla a
`FRASES_FIJAS` en `public/js/voz-texto.js`). La prueba avisa qué falta:

    node herramientas/voz/cobertura.mjs public/audio/voz.json

## Cómo regenerar

Voz: Piper `es_MX-claude-high` (licencia Apache-2.0), descargada de las
versiones de sherpa-onnx en GitHub:

    python3 -m venv venv && ./venv/bin/pip install piper-tts num2words numpy
    curl -LO https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_MX-claude-high.tar.bz2
    tar xjf vits-piper-es_MX-claude-high.tar.bz2
    ./venv/bin/python herramientas/voz/generar.py \
        --modelo vits-piper-es_MX-claude-high/es_MX-claude-high.onnx
    node herramientas/voz/cobertura.mjs public/audio/voz.json

Requiere `ffmpeg` y `node`. Después, subir la versión de la app como siempre.
