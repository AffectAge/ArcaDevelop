import type express from "express";
import { z } from "zod";
import type { RouteAuth } from "../security/routeAuth";

export type CivilopediaEntryInput = z.infer<typeof civilopediaEntrySchema>;
export type CivilopediaUpdateInput = z.infer<typeof civilopediaUpdateSchema>;

export type SettingsGuideRoutesDependencies = {
  routeAuth: RouteAuth;
  getPublicGameSettings: () => unknown;
  getCivilopedia: () => unknown;
  updateCivilopedia: (input: CivilopediaUpdateInput, actorCountryId: string) => void;
};

const civilopediaEntrySchema = z.object({
  id: z.string().min(1).max(120),
  category: z.string().min(1).max(60),
  title: z.string().min(1).max(200),
  summary: z.string().max(5000).default(""),
  keywords: z.array(z.string().min(1).max(80)).max(30).default([]),
  imageUrl: z.string().max(400).nullable().default(null),
  relatedEntryIds: z.array(z.string().min(1).max(120)).max(20).default([]),
  sections: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        paragraphs: z.array(z.string().min(1).max(8000)).max(40),
      }),
    )
    .max(40),
});

export const civilopediaUpdateSchema = z.object({
  categories: z.array(z.string().min(1).max(60)).max(200).optional(),
  entries: z.array(civilopediaEntrySchema).max(500),
});

export function registerSettingsGuideRoutes(app: express.Express, deps: SettingsGuideRoutesDependencies): void {
  app.get("/game-settings/public", (_req, res) => {
    return res.json(deps.getPublicGameSettings());
  });

  app.get("/civilopedia", (_req, res) => {
    return res.json({ civilopedia: deps.getCivilopedia() });
  });

  app.get("/admin/civilopedia", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;
    return res.json({ civilopedia: deps.getCivilopedia() });
  });

  app.patch("/admin/civilopedia", async (req, res) => {
    const auth = await deps.routeAuth.requireAdmin(req, res);
    if (!auth) return;
    const parsed = civilopediaUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }
    deps.updateCivilopedia(parsed.data, auth.countryId);
    return res.json({ civilopedia: deps.getCivilopedia() });
  });
}
