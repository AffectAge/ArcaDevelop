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
