"""Genera la voz grabada del entrenador: public/audio/voz.mp3 + voz.json.

Todas las frases que dice la app (herramientas/voz/frases.mjs) y los números
0-100 se sintetizan con Piper (voz neuronal libre, sin internet), se recortan,
se igualan en volumen y se juntan en un solo archivo con su índice.

Uso (ver README.md de esta carpeta):
    python herramientas/voz/generar.py --modelo ruta/es_MX-claude-high.onnx
"""
import argparse, json, subprocess, sys, tempfile, wave
from datetime import date
from pathlib import Path

import numpy as np
from num2words import num2words
from piper import PiperVoice
from piper.config import SynthesisConfig

RAIZ = Path(__file__).resolve().parents[2]
SALIDA = RAIZ / "public" / "audio"
SEPARACION = 0.30   # silencio entre piezas dentro del archivo (s)
UMBRAL = 0.02       # nivel bajo el cual se considera silencio (recorte)
COLA = 0.015        # silencio natural que se deja en cada punta (s)
PICO = 0.89         # volumen máximo de cada pieza (≈ -1 dBFS)


def frases():
    r = subprocess.run(["node", str(RAIZ / "herramientas/voz/frases.mjs")],
                       capture_output=True, text=True, check=True)
    d = json.loads(r.stdout)
    return d["frases"], d["numeros"]


def texto_de(clave):
    """Lo que se le pide decir a la voz para cada pieza."""
    if clave.startswith("#"):
        return num2words(int(clave[1:]), lang="es")
    return clave


def sintetizar(voz, texto, velocidad):
    cfg = SynthesisConfig(length_scale=velocidad)
    partes = [c.audio_float_array for c in voz.synthesize(texto, syn_config=cfg)]
    return np.concatenate(partes).astype(np.float32), voz.config.sample_rate


def recortar(audio, tasa):
    fuerte = np.where(np.abs(audio) > UMBRAL)[0]
    if not len(fuerte):
        return audio
    cola = int(COLA * tasa)
    return audio[max(0, fuerte[0] - cola): min(len(audio), fuerte[-1] + cola)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--modelo", required=True, help="archivo .onnx de la voz Piper")
    ap.add_argument("--velocidad", type=float, default=1.0, help="<1 más rápido, >1 más lento")
    ap.add_argument("--kbps", type=int, default=56)
    a = ap.parse_args()

    voz = PiperVoice.load(a.modelo)
    lista_frases, lista_numeros = frases()
    claves = lista_frases + lista_numeros
    tasa = voz.config.sample_rate
    silencio = np.zeros(int(SEPARACION * tasa), dtype=np.float32)

    bloques, piezas, t = [silencio], {}, SEPARACION
    for i, clave in enumerate(claves, 1):
        audio, _ = sintetizar(voz, texto_de(clave), a.velocidad)
        audio = recortar(audio, tasa)
        audio = audio * (PICO / max(1e-6, float(np.max(np.abs(audio)))))
        dur = len(audio) / tasa
        piezas[clave] = [round(t, 4), round(dur, 4)]
        bloques += [audio, silencio]
        t += dur + SEPARACION
        print(f"\r{i}/{len(claves)} {clave[:40]:40}", end="", file=sys.stderr)
    print(file=sys.stderr)

    todo = np.concatenate(bloques)
    SALIDA.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "voz.wav"
        with wave.open(str(wav), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(tasa)
            w.writeframes((np.clip(todo, -1, 1) * 32767).astype("<i2").tobytes())
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-ac", "1",
                        "-c:a", "libmp3lame", "-b:a", f"{a.kbps}k", str(SALIDA / "voz.mp3")], check=True)

    indice = {
        "voz": Path(a.modelo).stem,
        "generado": date.today().isoformat(),
        "duracion": round(t, 2),
        "piezas": piezas,
    }
    (SALIDA / "voz.json").write_text(json.dumps(indice, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    print(f"{len(piezas)} piezas, {t:.1f} s -> {SALIDA / 'voz.mp3'}", file=sys.stderr)


if __name__ == "__main__":
    main()
