const MIN_VOICED_MS = 250;
const END_SILENCE_MS = 900;
const PRE_ROLL_MS = 200;
const MAX_UTTERANCE_MS = 20_000;
const SUPPRESS_TAIL_MS = 700;

/** Finds utterance boundaries from speech-band energy, independent of modem frames. */
export class SpeechDetector {
  private floor: number | undefined;
  private startedAt: number | undefined;
  private lastVoiceAt = 0;
  private voicedMs = 0;
  private lastUpdate = 0;
  private suppressedUntil = 0;

  get active(): boolean {
    return this.startedAt !== undefined && this.voicedMs >= MIN_VOICED_MS;
  }

  /** Returns the number of recent seconds to transcribe once an utterance ends. */
  update(levelDb: number, now: number, blocked: boolean): number | undefined {
    const elapsed = Math.max(0, Math.min(100, now - this.lastUpdate));
    this.lastUpdate = now;
    if (blocked) {
      this.suppressedUntil = now + SUPPRESS_TAIL_MS;
      this.resetUtterance();
      return;
    }
    if (now < this.suppressedUntil) return;

    const finite = Number.isFinite(levelDb) && levelDb > -140;
    if (finite) this.floor ??= Math.min(levelDb, -55);
    const threshold = Math.max(-65, (this.floor ?? -80) + 12);
    const voiced = finite && levelDb > threshold;
    if (voiced) {
      this.startedAt ??= now;
      this.lastVoiceAt = now;
      this.voicedMs += elapsed;
    } else if (finite && this.startedAt === undefined) {
      const rate = levelDb < (this.floor ?? levelDb) ? 0.1 : 0.005;
      this.floor =
        (this.floor ?? levelDb) + (levelDb - (this.floor ?? levelDb)) * rate;
    }

    if (this.startedAt === undefined) return;
    const duration = now - this.startedAt;
    if (now - this.lastVoiceAt < END_SILENCE_MS && duration < MAX_UTTERANCE_MS)
      return;
    const usable = this.voicedMs >= MIN_VOICED_MS;
    this.resetUtterance();
    // Bound continuous noise/very long speech; the caller also gates while transcribing.
    if (duration >= MAX_UTTERANCE_MS)
      this.suppressedUntil = now + END_SILENCE_MS;
    return usable ? (duration + PRE_ROLL_MS) / 1_000 : undefined;
  }

  private resetUtterance(): void {
    this.startedAt = undefined;
    this.voicedMs = 0;
  }
}
