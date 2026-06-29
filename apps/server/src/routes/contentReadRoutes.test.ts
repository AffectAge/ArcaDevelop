import express from "express";
import { describe, expect, it } from "vitest";
import { registerContentReadRoutes } from "./contentReadRoutes";

describe("contentReadRoutes", () => {
  it("serves read-only content entries with scenario asset registry", async () => {
    const app = express();
    registerContentReadRoutes(app, {
      getActiveScenarioId: () => "default",
      getAssets: () => [{ id: "asset:good.grain", type: "icon", path: "assets/goods/grain.png", width: 64, height: 64 }],
      parseContentKind: (raw) => (raw === "goods" ? { success: true, data: "goods" } : { success: false }),
      getEntriesByKind: () => [{ id: "good:grain", name: "Grain", description: "", color: "#ffffff", logoUrl: null, malePortraitUrl: null, femalePortraitUrl: null, iconAssetId: "asset:good.grain" }],
    });

    const response = await request(app, "/content/entries/goods");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      activeScenarioId: "default",
      assets: [{ id: "asset:good.grain", type: "icon", path: "assets/goods/grain.png", width: 64, height: 64 }],
      items: [{ id: "good:grain", name: "Grain", description: "", color: "#ffffff", logoUrl: null, malePortraitUrl: null, femalePortraitUrl: null, iconAssetId: "asset:good.grain" }],
    });
  });

  it("rejects unknown content kinds", async () => {
    const app = express();
    registerContentReadRoutes(app, {
      getActiveScenarioId: () => "default",
      getAssets: () => [],
      parseContentKind: () => ({ success: false }),
      getEntriesByKind: () => [],
    });

    const response = await request(app, "/content/entries/unknown");

    expect(response.status).toBe(404);
  });
});

async function request(app: express.Express, path: string): Promise<Response> {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind to a port");
    return await fetch(`http://127.0.0.1:${address.port}${path}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
