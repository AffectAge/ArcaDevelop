import { describe, expect, it } from "vitest";
import { getUiTextCatalog, tUi } from "./uiText";

describe("uiText", () => {
  it("keeps English and Russian catalogs in sync", () => {
    const catalog = getUiTextCatalog();
    expect(Object.keys(catalog.en).sort()).toEqual(Object.keys(catalog.ru).sort());
  });

  it("formats keyed text with parameters", () => {
    expect(tUi("corridorBuild.summary", { points: 2, provinces: 3 }, "en")).toContain("Route points: 2");
    expect(tUi("corridorBuild.summary", { points: 2, provinces: 3 }, "ru")).toContain("Точек маршрута: 2");
  });
});
