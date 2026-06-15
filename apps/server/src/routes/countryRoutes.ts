import type express from "express";

export type CountryRoutesDependencies = {
  getTurnId: () => number;
  cleanupExpiredPunishments: (turnId: number, now: Date) => Promise<void>;
  listCountries: () => Promise<unknown[]>;
};

export function registerCountryRoutes(app: express.Express, deps: CountryRoutesDependencies): void {
  app.get("/countries", async (_req, res) => {
    await deps.cleanupExpiredPunishments(deps.getTurnId(), new Date());
    return res.json(await deps.listCountries());
  });
}
