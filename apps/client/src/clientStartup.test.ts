import { describe, expect, it } from "vitest";
import {
  beginParallelClientStartup,
  CLIENT_OPTIONAL_FONT_STYLESHEET,
  isStyledMapSurfaceReady,
  waitForClientFullStylesReady,
} from "./clientStartup";

describe("client startup", () => {
  it("starts the stylesheet and selected entry imports without awaiting either one", () => {
    const started: string[] = [];
    const styles = Promise.resolve("styles");
    const entry = Promise.resolve({ default: "entry" });

    const startup = beginParallelClientStartup(
      () => {
        started.push("styles");
        return styles;
      },
      () => {
        started.push("entry");
        return entry;
      },
    );

    expect(started).toEqual(["styles", "entry"]);
    expect(startup.entryReady).toBe(entry);
    expect(startup.stylesReady).toBeInstanceOf(Promise);
  });

  it("publishes map readiness only after both the map and full styles are ready", () => {
    expect(isStyledMapSurfaceReady(true, true)).toBe(true);
    expect(isStyledMapSurfaceReady(true, false)).toBe(false);
    expect(isStyledMapSurfaceReady(false, true)).toBe(false);
  });

  it("allows renderer setup to wait for the already-running full stylesheet import", async () => {
    const events = new EventTarget();
    const dataset = {} as DOMStringMap;
    const target = {
      documentElement: { dataset },
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    };
    let resolved = false;
    const readiness = waitForClientFullStylesReady(target).then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);
    dataset.arcFullStylesReady = "true";
    events.dispatchEvent(new Event("arc:full-styles-ready"));
    await readiness;
    expect(resolved).toBe(true);
  });

  it("keeps optional web fonts outside render-blocking styles", () => {
    expect(CLIENT_OPTIONAL_FONT_STYLESHEET).toEqual({
      href: expect.stringContaining("fonts.googleapis.com"),
      media: "print",
      rel: "stylesheet",
    });
  });
});
