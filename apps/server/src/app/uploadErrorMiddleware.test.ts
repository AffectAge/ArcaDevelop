import express from "express";
import multer from "multer";
import { describe, expect, it } from "vitest";
import { ONLY_IMAGES_UPLOAD_ERROR } from "../uploads/uploadMiddleware";
import { uploadErrorMiddleware } from "./uploadErrorMiddleware";

describe("uploadErrorMiddleware", () => {
  it("maps upload file size errors to FILE_TOO_LARGE", async () => {
    const app = createThrowingApp(new multer.MulterError("LIMIT_FILE_SIZE"));

    const response = await request(app, "/boom");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "FILE_TOO_LARGE" });
  });

  it("maps non-image uploads to ONLY_IMAGES", async () => {
    const app = createThrowingApp(new Error(ONLY_IMAGES_UPLOAD_ERROR));

    const response = await request(app, "/boom");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: ONLY_IMAGES_UPLOAD_ERROR });
  });

  it("passes unrelated errors to later error handlers", async () => {
    const app = createThrowingApp(new Error("OTHER"));
    app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
      void next;
      res.status(599).json({ error: err instanceof Error ? err.message : "UNKNOWN" });
    });

    const response = await request(app, "/boom");

    expect(response.status).toBe(599);
    expect(await response.json()).toEqual({ error: "OTHER" });
  });
});

function createThrowingApp(error: unknown): express.Express {
  const app = express();
  app.get("/boom", (_req, _res, next) => next(error));
  app.use(uploadErrorMiddleware);
  return app;
}

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
