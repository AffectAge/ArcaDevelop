import type express from "express";
import { z } from "zod";
import type { RouteAuth } from "../security/routeAuth";

export const clientSettingsSchema = z.object({
  eventLogRetentionTurns: z.coerce.number().int().min(1).max(100).optional(),
});

export type CountryClientSettingsRoutesDependencies = {
  routeAuth: RouteAuth;
};

export function registerCountryClientSettingsRoutes(
  app: express.Express,
  deps: CountryClientSettingsRoutesDependencies,
): void {
  app.patch("/country/client-settings", (req, res) => {
    if (!deps.routeAuth.requireAuth(req, res)) return;

    const parsed = clientSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }

    return res.status(400).json({ error: "CLIENT_SETTING_MOVED_TO_ADMIN_GAME_SETTINGS" });
  });
}
