export class SerialTaskQueue {
  private queue: Promise<void> = Promise.resolve();

  enqueue(task: () => Promise<void>, onError: (error: unknown) => void): Promise<void> {
    this.queue = this.queue
      .then(async () => {
        await task();
      })
      .catch((error) => {
        onError(error);
      });
    return this.queue;
  }

  flush(): Promise<void> {
    return this.queue;
  }
}
