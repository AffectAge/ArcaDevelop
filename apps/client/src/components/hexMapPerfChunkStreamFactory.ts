export type DisposableChunkStream = {
  destroy: () => void;
};

export class PrewarmedChunkStreamFactory<
  TStream extends DisposableChunkStream,
> {
  private prewarmed: TStream | null = null;

  constructor(private readonly createStream: () => TStream) {}

  prewarm(): TStream {
    this.prewarmed ??= this.createStream();
    return this.prewarmed;
  }

  withUnclaimed(
    candidate: TStream,
    prepare: (stream: TStream) => void,
  ): boolean {
    if (this.prewarmed !== candidate) return false;
    prepare(candidate);
    return true;
  }

  take = (): TStream => {
    const stream = this.prewarmed ?? this.createStream();
    this.prewarmed = null;
    return stream;
  };

  destroyUnused(): void {
    this.prewarmed?.destroy();
    this.prewarmed = null;
  }
}
