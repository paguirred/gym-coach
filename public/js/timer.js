// Temporizador de descanso con barra visual, sonido (WebAudio) y vibración.
let audioCtx = null;

function beep(freq = 880, ms = 180) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + ms / 1000);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + ms / 1000);
  } catch (_) { /* sin audio, seguimos */ }
}

function vibrate(pattern) {
  if (navigator.vibrate) try { navigator.vibrate(pattern); } catch (_) {}
}

export class RestTimer {
  constructor({ barEl, labelEl, onDone, onHalf, onCountdown }) {
    this.barEl = barEl;
    this.labelEl = labelEl;
    this.onDone = onDone;
    this.onHalf = onHalf; // se llama una vez al pasar el 50% (timers de ≥15s)
    // Se llama con 3, 2 y 1. Si devuelve true (p. ej. lo cantó la voz), no se
    // hace el pitido, para no encimar los dos avisos.
    this.onCountdown = onCountdown;
    this._raf = null;
    this._end = 0;
    this._total = 0;
  }

  start(seconds) {
    this.stop();
    this._total = seconds;
    this._halfDone = false;
    this._end = performance.now() + seconds * 1000;
    const tick = () => {
      const remainMs = Math.max(0, this._end - performance.now());
      const remain = Math.ceil(remainMs / 1000);
      const pct = 100 * (1 - remainMs / (this._total * 1000));
      if (this.barEl) this.barEl.style.width = Math.min(100, pct) + "%";
      if (this.labelEl) this.labelEl.textContent = `${remain}s`;
      // aviso "vas por la mitad" al pasar el 50% (solo timers de ≥15s)
      if (!this._halfDone && this._total >= 15 && remainMs <= (this._total * 1000) / 2) {
        this._halfDone = true;
        this.onHalf && this.onHalf();
      }
      // cuenta regresiva final: 3, 2, 1
      if (remain <= 3 && remain >= 1 && remain !== this._lastBeep) {
        this._lastBeep = remain;
        const cantado = this.onCountdown ? this.onCountdown(remain) : false;
        if (!cantado) beep(660, 90); // sin voz disponible, queda el pitido
        vibrate(60);
      }
      if (remainMs <= 0) {
        this.stop();
        beep(990, 300);
        vibrate([120, 60, 120]);
        if (this.labelEl) this.labelEl.textContent = "¡Listo!";
        this.onDone && this.onDone();
        return;
      }
      this._raf = requestAnimationFrame(tick);
    };
    tick();
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this._lastBeep = null;
  }
}
