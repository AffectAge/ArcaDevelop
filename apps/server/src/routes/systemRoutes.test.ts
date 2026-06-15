import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import { registerSystemRoutes } from "./systemRoutes";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("systemRoutes", () => {
  it("serves health with current status and turn", async () => {
    const app = express();
    registerSystemRoutes(app, {
      getServerStatus: () => "online",
      getTurnId: () => 7,
      getAdm1TileRoot: () => "",
      getRasterTileRoot: () => "",
    });

    const response = await request(app, "/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "online", turnId: 7 });
  });

  it("serves existing adm1 tiles and misses unknown tiles without cache", async () => {
    const root = await makeTempDir();
    await mkdir(join(root, "0", "0"), { recursive: true });
    await writeFile(join(root, "0", "0", "0.mvt"), "tile");
    const app = express();
    registerSystemRoutes(app, {
      getServerStatus: () => "online",
      getTurnId: () => 1,
      getAdm1TileRoot: () => root,
      getRasterTileRoot: () => "",
    });

    const found = await request(app, "/tiles/adm1/0/0/0.mvt");
    const missing = await request(app, "/tiles/adm1/0/0/1.mvt");

    expect(found.status).toBe(200);
    expect(found.headers.get("content-type")).toBe("application/x-protobuf");
    expect(found.headers.get("cache-control")).toBe("no-store");
    expect(await found.text()).toBe("tile");
    expect(missing.status).toBe(204);
  });

  it("serves existing raster tiles", async () => {
    const root = await makeTempDir();
    await mkdir(join(root, "0", "1"), { recursive: true });
    await writeFile(join(root, "0", "1", "2.webp"), "raster");
    const app = express();
    registerSystemRoutes(app, {
      getServerStatus: () => "online",
      getTurnId: () => 1,
      getAdm1TileRoot: () => "",
      getRasterTileRoot: () => root,
    });

    const response = await request(app, "/tiles/raster/0/1/2.webp");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(await response.text()).toBe("raster");
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

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "arc-system-routes-"));
  tempDirs.push(dir);
  return dir;
}
