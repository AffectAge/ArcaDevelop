import cors from "cors";
import express from "express";
import { resolve } from "node:path";

export function createServerApp(options: { dataRoot: string }): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());
  const serveScenarioAssets = (assetFolder: "uploads" | "buildings" | "cities" | "features" | "identity" | "units" | "utils") => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const scenarioId = String(req.params.scenarioId ?? "");
    if (!/^[a-zA-Z0-9_-]+$/.test(scenarioId)) {
      res.status(404).end();
      return;
    }
    express.static(resolve(options.dataRoot, "scenarios", scenarioId, "assets", assetFolder))(req, res, next);
  };
  app.use("/scenario-assets/:scenarioId/assets/uploads", serveScenarioAssets("uploads"));
  app.use("/scenario-assets/:scenarioId/assets/buildings", serveScenarioAssets("buildings"));
  app.use("/scenario-assets/:scenarioId/assets/cities", serveScenarioAssets("cities"));
  app.use("/scenario-assets/:scenarioId/assets/features", serveScenarioAssets("features"));
  app.use("/scenario-assets/:scenarioId/assets/identity", serveScenarioAssets("identity"));
  app.use("/scenario-assets/:scenarioId/assets/units", serveScenarioAssets("units"));
  app.use("/scenario-assets/:scenarioId/assets/utils", serveScenarioAssets("utils"));
  return app;
}
