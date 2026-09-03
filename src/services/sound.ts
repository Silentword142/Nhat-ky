/**
 * Audio synthesis helper using Web Audio API
 * Generates delicate romantic sounds without external audio files
 */

class SoundService {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    // Lazy init on first user gesture
  }

  public init() {
    this.getContext();
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  // Play a soft sweet heart chime (two warm sine tones like lub-dub)
  public playHeartbeat() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // First beat
      this.playTone(ctx, 120, now, 0.12, 0.4);
      // Second beat
      this.playTone(ctx, 140, now + 0.18, 0.15, 0.35);

      // Subtle gentle chime harmonic
      this.playTone(ctx, 523.25, now + 0.35, 0.25, 0.15); // C5
      this.playTone(ctx, 659.25, now + 0.45, 0.3, 0.12);  // E5
    } catch {
      // ignore
    }
  }

  // Soft sparkle / celebration chime
  public playSparkle() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        this.playTone(ctx, freq, now + i * 0.08, 0.3, 0.15);
      });
    } catch {
      // ignore
    }
  }

  // Sweet pleasant success chime
  public playSuccess() {
    this.playSparkle();
  }

  // Paper rustle / envelope open click
  public playPaperOpen() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      this.playTone(ctx, 330, now, 0.08, 0.2);
      this.playTone(ctx, 440, now + 0.06, 0.1, 0.18);
      this.playTone(ctx, 660, now + 0.12, 0.2, 0.15);
    } catch {
      // ignore
    }
  }

  // Cute pop sound for button clicks & stamps
  public playPop() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // ignore
    }
  }

  private playTone(ctx: AudioContext, freq: number, startTime: number, duration: number, maxGain: number) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(maxGain, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    } catch {
      // ignore web audio edge cases
    }
  }
}

export const soundService = new SoundService();
