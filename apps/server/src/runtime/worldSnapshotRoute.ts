import type express from "express";
import type { WorldBase } from "@arcanorum/shared";
import type { RouteAuth } from "../security/routeAuth";

type WorldSnapshotRouteParams = {
  app: express.Express;
  routeAuth: RouteAuth;
  getWorldBase: () => WorldBase;
  getTurnId: () => number;
  getWorldStateVersion: () => number;
  ensureCountryInWorldBase: (countryId: string) => void;
};

export function registerWorldSnapshotRoute(params: WorldSnapshotRouteParams): void {
  params.app.get("/world/snapshot", async (req, res) => {
    const auth = params.routeAuth.requireAuth(req, res);
    if (!auth) return;
    params.ensureCountryInWorldBase(auth.countryId);
    const turnId = params.getTurnId();
    return res.json({
      worldBase: {
        ...params.getWorldBase(),
        turnId,
      },
      turnId,
      worldStateVersion: params.getWorldStateVersion(),
    });
  });
}
