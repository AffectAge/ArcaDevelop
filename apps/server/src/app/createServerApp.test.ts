import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createServerApp } from "./createServerApp";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("createServerApp", () => {
  it("serves scenario-owned uploads from the configured data root", async () => {
    const dataRoot = await makeTempDir();
    await mkdir(join(dataRoot, "scenarios", "demo", "assets", "uploads"), { recursive: true });
    await writeFile(join(dataRoot, "scenarios", "demo", "assets", "uploads", "asset.txt"), "asset-body");
    const app = createServerApp({ dataRoot });

    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("server did not bind to a port");
      const response = await fetch(`http://127.0.0.1:${address.port}/scenario-assets/demo/assets/uploads/asset.txt`);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("asset-body");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("serves scenario-owned building atlases from the configured data root", async () => {
    const dataRoot = await makeTempDir();
    await mkdir(join(dataRoot, "scenarios", "demo", "assets", "buildings"), { recursive: true });
    await writeFile(join(dataRoot, "scenarios", "demo", "assets", "buildings", "building_farm.png"), "atlas-body");
    const app = createServerApp({ dataRoot });

    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("server did not bind to a port");
      const response = await fetch(`http://127.0.0.1:${address.port}/scenario-assets/demo/assets/buildings/building_farm.png`);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("atlas-body");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("serves scenario-owned city atlases from the configured data root", async () => {
    const dataRoot = await makeTempDir();
    await mkdir(join(dataRoot, "scenarios", "demo", "assets", "cities"), { recursive: true });
    await writeFile(join(dataRoot, "scenarios", "demo", "assets", "cities", "culture_a.png"), "city-atlas-body");
    const app = createServerApp({ dataRoot });

    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("server did not bind to a port");
      const response = await fetch(`http://127.0.0.1:${address.port}/scenario-assets/demo/assets/cities/culture_a.png`);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("city-atlas-body");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("serves scenario-owned feature atlases from the configured data root", async () => {
    const dataRoot = await makeTempDir();
    await mkdir(join(dataRoot, "scenarios", "demo", "assets", "features"), { recursive: true });
    await writeFile(join(dataRoot, "scenarios", "demo", "assets", "features", "feature-atlas.png"), "feature-atlas-body");
    const app = createServerApp({ dataRoot });

    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("server did not bind to a port");
      const response = await fetch(`http://127.0.0.1:${address.port}/scenario-assets/demo/assets/features/feature-atlas.png`);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("feature-atlas-body");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("serves scenario-owned utility assets from the configured data root", async () => {
    const dataRoot = await makeTempDir();
    await mkdir(join(dataRoot, "scenarios", "demo", "assets", "utils"), { recursive: true });
    await writeFile(join(dataRoot, "scenarios", "demo", "assets", "utils", "auth-background.png"), "auth-background-body");
    const app = createServerApp({ dataRoot });

    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("server did not bind to a port");
      const response = await fetch(`http://127.0.0.1:${address.port}/scenario-assets/demo/assets/utils/auth-background.png`);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("auth-background-body");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("returns 404 for unsafe scenario asset paths", async () => {
    const app = createServerApp({ dataRoot: await makeTempDir() });

    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("server did not bind to a port");
      const response = await fetch(`http://127.0.0.1:${address.port}/scenario-assets/../demo/assets/buildings/building_farm.png`);

      expect(response.status).toBe(404);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("parses JSON request bodies for later route handlers", async () => {
    const app = createServerApp({ dataRoot: await makeTempDir() });
    app.post("/echo", (req, res) => res.json({ body: req.body }));
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("server did not bind to a port");
      const response = await fetch(`http://127.0.0.1:${address.port}/echo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok: true }),
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ body: { ok: true } });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "arc-server-app-"));
  tempDirs.push(dir);
  return dir;
}
