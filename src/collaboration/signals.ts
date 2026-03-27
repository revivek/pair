export interface BehavioralSignals {
  charsPerSecond: number;
  deleteRatio: number;
  pauseDuration: number;
  cursorPosition: "beginning" | "middle" | "end";
}

export interface Baseline {
  avgSpeed: number;
  avgDeleteRatio: number;
  avgPauseDuration: number;
  calibrated: boolean;
}

export class SignalTracker {
  private charsSinceLastPause = 0;
  private deletesSinceLastPause = 0;
  private lastKeystrokeTime = 0;
  private lastPauseTime = 0;
  private lastDocLength = 0;

  private pauseSamples: BehavioralSignals[] = [];
  private baseline: Baseline = {
    avgSpeed: 0,
    avgDeleteRatio: 0,
    avgPauseDuration: 0,
    calibrated: false,
  };

  onKeystroke(charCount: number, deleteCount: number, docLength: number, cursorPos: number): void {
    const now = Date.now();
    this.charsSinceLastPause += charCount;
    this.deletesSinceLastPause += deleteCount;
    this.lastKeystrokeTime = now;
    this.lastDocLength = docLength;

    // Store cursor position context
    this._lastCursorPos = cursorPos;
  }

  private _lastCursorPos = 0;

  onPause(): BehavioralSignals {
    const now = Date.now();
    const elapsed = this.lastPauseTime > 0
      ? (now - this.lastPauseTime) / 1000
      : 0;

    const pauseDuration = this.lastKeystrokeTime > 0
      ? (now - this.lastKeystrokeTime) / 1000
      : 0;

    const totalChars = this.charsSinceLastPause + this.deletesSinceLastPause;
    const charsPerSecond = elapsed > 0 ? this.charsSinceLastPause / elapsed : 0;
    const deleteRatio = totalChars > 0 ? this.deletesSinceLastPause / totalChars : 0;

    const cursorPosition = this.getCursorRegion(this._lastCursorPos, this.lastDocLength);

    const signals: BehavioralSignals = {
      charsPerSecond: Math.round(charsPerSecond * 100) / 100,
      deleteRatio: Math.round(deleteRatio * 100) / 100,
      pauseDuration: Math.round(pauseDuration * 100) / 100,
      cursorPosition,
    };

    // Add to calibration samples
    this.pauseSamples.push(signals);
    if (this.pauseSamples.length <= 3) {
      this.recalculateBaseline();
    }

    // Reset counters
    this.charsSinceLastPause = 0;
    this.deletesSinceLastPause = 0;
    this.lastPauseTime = now;

    return signals;
  }

  private getCursorRegion(pos: number, docLength: number): "beginning" | "middle" | "end" {
    if (docLength === 0) return "end";
    const ratio = pos / docLength;
    if (ratio < 0.33) return "beginning";
    if (ratio > 0.67) return "end";
    return "middle";
  }

  private recalculateBaseline(): void {
    const samples = this.pauseSamples.slice(0, 3);
    const n = samples.length;

    this.baseline = {
      avgSpeed: Math.round((samples.reduce((s, p) => s + p.charsPerSecond, 0) / n) * 100) / 100,
      avgDeleteRatio: Math.round((samples.reduce((s, p) => s + p.deleteRatio, 0) / n) * 100) / 100,
      avgPauseDuration: Math.round((samples.reduce((s, p) => s + p.pauseDuration, 0) / n) * 100) / 100,
      calibrated: n >= 3,
    };
  }

  getBaseline(): Baseline {
    return { ...this.baseline };
  }

  getRelativeSignals(current: BehavioralSignals): string {
    const count = Math.min(this.pauseSamples.length, 3);

    if (!this.baseline.calibrated) {
      return (
        `CALIBRATING(${count}/3) ` +
        `speed: ${current.charsPerSecond}ch/s | ` +
        `delete: ${current.deleteRatio} | ` +
        `pause=${current.pauseDuration}s`
      );
    }

    const speedDelta = this.baseline.avgSpeed !== 0
      ? Math.round(((current.charsPerSecond - this.baseline.avgSpeed) / this.baseline.avgSpeed) * 100)
      : 0;
    const deleteDelta = this.baseline.avgDeleteRatio !== 0
      ? Math.round(((current.deleteRatio - this.baseline.avgDeleteRatio) / this.baseline.avgDeleteRatio) * 100)
      : 0;

    const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

    return (
      `BASELINE(3) ` +
      `speed: ${this.baseline.avgSpeed}\u2192${current.charsPerSecond}ch/s (${sign(speedDelta)}%) | ` +
      `delete: ${this.baseline.avgDeleteRatio}\u2192${current.deleteRatio} (${sign(deleteDelta)}%) | ` +
      `pause=${current.pauseDuration}s`
    );
  }

  isFlowState(signals: BehavioralSignals): boolean {
    if (!this.baseline.calibrated) return false;

    const speedOk = this.baseline.avgSpeed === 0 ||
      Math.abs(signals.charsPerSecond - this.baseline.avgSpeed) / this.baseline.avgSpeed <= 0.2;
    const deleteOk = this.baseline.avgDeleteRatio === 0 ||
      Math.abs(signals.deleteRatio - this.baseline.avgDeleteRatio) / Math.max(this.baseline.avgDeleteRatio, 0.01) <= 0.2;
    const pauseOk = this.baseline.avgPauseDuration === 0 ||
      Math.abs(signals.pauseDuration - this.baseline.avgPauseDuration) / this.baseline.avgPauseDuration <= 0.2;

    return speedOk && deleteOk && pauseOk;
  }
}
