// ============================================================
// FORGE — Web Audio API Sound Synthesis Utilities
// ============================================================

let audioCtx: AudioContext | null = null;

/**
 * Retrieve or initialize the shared browser AudioContext.
 * Automatically tries to resume the context if it was suspended.
 */
export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  
  if (!audioCtx) {
    try {
      const audioWindow = window as Window & {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const AudioContextCtor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;

      if (!AudioContextCtor) {
        return null;
      }

      audioCtx = new AudioContextCtor();
    } catch (err) {
      console.warn("Web Audio API is not supported in this environment:", err);
      return null;
    }
  }
  
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {
      // Ignored: browser autoplay policy will prevent resume until user interaction
    });
  }
  
  return audioCtx;
}

/**
 * Perform a clean global unlock of the AudioContext on user interaction.
 * Usually invoked via click, touch, or keypress listeners.
 */
export function unlockAudioContext(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch((err) => {
      console.warn("Failed to unlock AudioContext:", err);
    });
  }
}

/**
 * Play a light, lower-pitched clock-like tick sound (every second during normal run).
 */
export function playNormalTick(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Subtle low tick
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.015);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.02);
  } catch (err) {
    // Silently swallow — audio is non-critical
    console.debug("Audio normal tick playback failed:", err);
  }
}

/**
 * Play a sharper, higher-pitched warning tick sound (every second in the last 10s).
 */
export function playWarningTick(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Sharp warning tick
    osc.type = "sine";
    osc.frequency.setValueAtTime(1500, ctx.currentTime);
    gain.gain.setValueAtTime(0.20, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);
  } catch (err) {
    // Silently swallow — audio is non-critical
    console.debug("Audio warning tick playback failed:", err);
  }
}

/**
 * Play a pleasant ascending chime (C5→E5→G5→C6) on session completion.
 */
export function playAlarm(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const t = ctx.currentTime;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t + i * 0.12);
      gain.gain.setValueAtTime(0.35, t + i * 0.12); // Louder chime volume
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.35);

      osc.start(t + i * 0.12);
      osc.stop(t + i * 0.12 + 0.4);
    });
  } catch (err) {
    // Silently swallow — audio is non-critical
    console.debug("Audio alarm playback failed:", err);
  }
}
