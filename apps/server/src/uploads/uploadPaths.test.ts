import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  defaultScenarioUploadDataRoot,
  getActiveScenarioUploadsRoot,
  normalizeContentLogoUrl,
  resolveContentUploadDir,
  resolveContentUploadUrlSegment,
  setActiveUploadScenario,
} from "./uploadPaths";

afterEach(() => {
  setActiveUploadScenario({ dataRoot: defaultScenarioUploadDataRoot, scenarioId: "active" });
});

describe("uploadPaths", () => {
  it("resolves known content upload kinds to their directories", () => {
    expect(resolveContentUploadDir("resourceCategories")).toBe(join(getActiveScenarioUploadsRoot(), "resource-categories"));
    expect(resolveContentUploadDir("shipTypes")).toBe(join(getActiveScenarioUploadsRoot(), "ship-types"));
    expect(resolveContentUploadDir("aircraftTypes")).toBe(join(getActiveScenarioUploadsRoot(), "aircraft-types"));
  });

  it("falls back to cultures for missing content upload kinds", () => {
    expect(resolveContentUploadDir()).toBe(join(getActiveScenarioUploadsRoot(), "cultures"));
    expect(resolveContentUploadDir("unknown")).toBe(join(getActiveScenarioUploadsRoot(), "unknown"));
  });

  it("resolves public URL segments for camel-case content kinds", () => {
    expect(resolveContentUploadUrlSegment()).toBe("cultures");
    expect(resolveContentUploadUrlSegment("resourceCategories")).toBe("resource-categories");
    expect(resolveContentUploadUrlSegment("hexStrategicRegions")).toBe("province-strategic-regions");
    expect(resolveContentUploadUrlSegment("shipTypes")).toBe("ship-types");
  });

  it("keeps simple public URL segments unchanged", () => {
    expect(resolveContentUploadUrlSegment("cultures")).toBe("cultures");
    expect(resolveContentUploadUrlSegment("religions")).toBe("religions");
  });

  it("normalizes resource category upload URLs", () => {
    expect(
      normalizeContentLogoUrl("resourceCategories", "/scenario-assets/demo/assets/uploads/resourceCategories/icon.png"),
    ).toBe(
      "/scenario-assets/demo/assets/uploads/resource-categories/icon.png",
    );
    expect(normalizeContentLogoUrl("cultures", "/scenario-assets/demo/assets/uploads/cultures/icon.png")).toBe(
      "/scenario-assets/demo/assets/uploads/cultures/icon.png",
    );
    expect(normalizeContentLogoUrl("resourceCategories", null)).toBeNull();
  });

  it("updates upload directories when the active scenario changes", () => {
    setActiveUploadScenario({ scenarioId: "demo" });

    expect(resolveContentUploadDir("cultures")).toBe(join(getActiveScenarioUploadsRoot(), "cultures"));
  });

});
