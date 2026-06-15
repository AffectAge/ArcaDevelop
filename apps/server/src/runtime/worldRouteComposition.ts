import type express from "express";
import type { RouteAuth } from "../security/routeAuth";
import { registerWorldSnapshotRoute } from "./worldSnapshotRoute";

type WorldSnapshotDeps = Parameters<typeof registerWorldSnapshotRoute>[0];

type WorldRouteCompositionParams = {
  app: express.Express;
  routeAuth: RouteAuth;
  getWorldBase: WorldSnapshotDeps["getWorldBase"];
  getTurnId: () => number;
  getWorldStateVersion: () => number;
  countryWorldRuntime: {
    ensureCountryInWorldBase: WorldSnapshotDeps["ensureCountryInWorldBase"];
  };
};

export function registerWorldRouteComposition(params: WorldRouteCompositionParams): void {
  registerWorldSnapshotRoute({
    app: params.app,
    routeAuth: params.routeAuth,
    getWorldBase: params.getWorldBase,
    getTurnId: params.getTurnId,
    getWorldStateVersion: params.getWorldStateVersion,
    ensureCountryInWorldBase: params.countryWorldRuntime.ensureCountryInWorldBase,
  });
}
