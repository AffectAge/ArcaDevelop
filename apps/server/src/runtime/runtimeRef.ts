export type RuntimeRef<T> = {
  current?: T;
};

export function createRuntimeRef<T>(name: string): {
  ref: RuntimeRef<T>;
  get: () => T;
} {
  const ref: RuntimeRef<T> = {};
  return {
    ref,
    get: () => {
      if (!ref.current) {
        throw new Error(`${name} is not initialized`);
      }
      return ref.current;
    },
  };
}
