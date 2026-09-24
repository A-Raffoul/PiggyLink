const DIGITAL_SILENCE_DB = -140;
const BUSY_MARGIN_DB = 9;
const FLOOR_FALL_RATE = 0.1;
const FLOOR_RISE_RATE = 0.003;
const CLEAR_AFTER_MS = 600;
const MAX_BUSY_MS = 15_000;

// Tracks the in-band noise floor and reports when energy stands clearly above it.
export class ChannelSense {
  private floor: number | undefined;
  private lastBusyAt = Number.NEGATIVE_INFINITY;
  private busySince: number | undefined;

  update(levelDb: number, now: number, transmitting: boolean): boolean {
    if (transmitting) {
      this.lastBusyAt = now;
      return true;
    }

    // Warm-up frames and dropouts are pure digital silence; learning from them would make real noise look busy.
    if (Number.isFinite(levelDb) && levelDb > DIGITAL_SILENCE_DB) {
      if (this.floor === undefined) this.floor = levelDb;
      const aboveFloor = levelDb > this.floor + BUSY_MARGIN_DB;
      if (aboveFloor) {
        this.busySince ??= now;
        // Nothing we listen for lasts this long, so the floor itself must be wrong.
        if (now - this.busySince > MAX_BUSY_MS) {
          this.floor = levelDb;
          this.busySince = undefined;
        } else {
          this.lastBusyAt = now;
        }
      } else {
        this.busySince = undefined;
        const rate = levelDb < this.floor ? FLOOR_FALL_RATE : FLOOR_RISE_RATE;
        this.floor += (levelDb - this.floor) * rate;
      }
    }

    return now - this.lastBusyAt < CLEAR_AFTER_MS;
  }
}
