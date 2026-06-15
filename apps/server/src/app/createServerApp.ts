import cors from "cors";
import express from "express";
import { resolve } from "node:path";

export function createServerApp(options: { dataRoot: string }): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/scenario-assets/:scenarioId/assets/uploads", (req, res, next) => {
    const scenarioId = String(req.params.scenarioId ?? "");
    if (!/^[a-zA-Z0-9_-]+$/.test(scenarioId)) {
      res.status(404).end();
      return;
    }
    express.static(resolve(options.dataRoot, "scenarios", scenarioId, "assets", "uploads"))(req, res, next);
  });
  return app;
}
