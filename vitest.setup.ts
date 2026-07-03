if (typeof globalThis.navigator === "undefined") {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      userAgent: "vitest",
      language: "en-US",
    },
  });
}
