import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadHexIndexFromFile } from "./hexIndex";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("loadHexIndexFromFile", () => {
  it("normalizes generated hex index entries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "arcanorum-province-index-"));
    tempDirs.push(dir);
    const path = join(dir, "hexes.json");
    await writeFile(
      path,
      JSON.stringify([
        {
          id: "2",
          name: "Beta",
          regionId: "region:world",
          hexColor: "#8fb9a8",
          regionColor: "#22d3ee",
          areaKm2: 25.7,
          hex_type: "land",
          center_x: 10,
          center_y: 20,
          neighbors: ["1", "3"],
          climate: "temperate",
          fertility: 50,
        },
        {
          id: "1",
          name: "Alpha",
          area_km2: 10.2,
          neighbors: "2 3",
        },
      ]),
      "utf8",
    );

    const result = loadHexIndexFromFile(path);

    expect(result.map((province) => province.id)).toEqual(["1", "2"]);
    expect(result[0].neighbors).toEqual(["2", "3"]);
    expect(result[1].areaKm2).toBe(26);
    expect(result[1].hexType).toBe("land");
    expect(result[1].regionId).toBe("region:world");
    expect(result[1].hexColor).toBe("#8fb9a8");
    expect(result[1].regionColor).toBe("#22d3ee");
  });
});
