export type PersistentStateSchedulerOptions = {
  debounceMs: number;
  persist: () => Promise<void>;
  onError: (error: unknown) => void;
};

export class PersistentStateScheduler {
  private dirty = false;
  private queue: Promise<void> = Promise.resolve();
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly options: PersistentStateSchedulerOptions) {}

  schedule(): void {
    this.dirty = true;
    if (this.timer) return;

    this.timer = setTimeout(() => {
      this.timer = null;
      this.enqueueIfDirty();
    }, this.options.debounceMs);
  }

  flushNow(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.enqueueIfDirty();
    return this.queue;
  }

  private enqueueIfDirty(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.queue = this.queue
      .then(async () => {
        await this.options.persist();
      })
      .catch((error) => {
        this.options.onError(error);
      });
  }
}
