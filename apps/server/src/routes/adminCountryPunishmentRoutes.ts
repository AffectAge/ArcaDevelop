import type express from "express";
import type { Country, EventLogEntry, WsOutMessage } from "@arcanorum/shared";
import { z } from "zod";
import type { RouteAuth } from "../security/routeAuth";
import type { AdminCountryDbRecord } from "./adminCountryRoutes";

export type AdminCountryPunishmentUpdateData = {
  isLocked?: boolean;
  blockedUntilTurn?: number | null;
  blockedUntilAt?: Date | null;
  lockReason?: string | null;
};

export const punishSchema = z
  .object({
    action: z.enum(["unlock", "permanent", "turns", "time"]),
    turns: z.coerce.number().int().min(1).max(5000).optional(),
    blockedUntilAt: z.string().datetime().optional(),
    reasonText: z.string().trim().max(300).optional(),
  })
  .superRefine((value, context) => {
    if (value.action === "turns" && !value.turns) {
      context.addIssue({ code: "custom", path: ["turns"], message: "turns_required" });
    }
    if (value.action === "time" && !value.blockedUntilAt) {
      context.addIssue({ code: "custom", path: ["blockedUntilAt"], message: "time_required" });
    }
  });

export type AdminCountryPunishmentRoutesDependencies = {
  routeAuth: RouteAuth;
  getTurnId: () => number;
  findCountry: (countryId: string) => Promise<AdminCountryDbRecord | null>;
  updateCountryPunishment: (
    countryId: string,
    data: AdminCountryPunishmentUpdateData,
  ) => Promise<AdminCountryDbRecord>;
  countryFromDb: (row: AdminCountryDbRecord) => Country;
  invalidateCountryQueryCache: () => void;
  makeOfficialNews: (input: {
    turn: number;
    category: "politics";
    title: string;
    message: string;
    countryId: string;
    priority: "medium" | "high";
    visibility: "public";
  }) => EventLogEntry;
  broadcast: (message: WsOutMessage) => void;
};

export function registerAdminCountryPunishmentRoutes(
  app: express.Express,
  deps: AdminCountryPunishmentRoutesDependencies,
): void {
  app.patch("/admin/countries/:countryId/punishments", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;

    const countryIdParam = String(req.params.countryId);
    const target = await deps.findCountry(countryIdParam);
    if (!target) {
      return res.status(404).json({ error: "COUNTRY_NOT_FOUND" });
    }

    const parsed = punishSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }

    const input = parsed.data;
    const reasonText = input.reasonText?.trim() ? input.reasonText.trim() : null;
    const turnId = deps.getTurnId();
    const data = buildPunishmentUpdateData(input, reasonText, turnId);
    if (input.action === "time" && data.blockedUntilAt && data.blockedUntilAt <= new Date()) {
      return res.status(400).json({ error: "INVALID_TIME" });
    }

    const updated = await deps.updateCountryPunishment(countryIdParam, data);
    deps.invalidateCountryQueryCache();
    const punishmentNewsMessage = buildPunishmentNewsMessage(input.action, updated.name, data, turnId, reasonText);
    deps.broadcast({
      type: "NEWS_EVENT",
      event: deps.makeOfficialNews({
        turn: turnId,
        category: "politics",
        title: "Изменение ограничений страны",
        message: punishmentNewsMessage,
        countryId: updated.id,
        priority: input.action === "unlock" ? "medium" : "high",
        visibility: "public",
      }),
    });
    return res.json(deps.countryFromDb(updated));
  });
}

function buildPunishmentUpdateData(
  input: z.infer<typeof punishSchema>,
  reasonText: string | null,
  turnId: number,
): AdminCountryPunishmentUpdateData {
  if (input.action === "unlock") {
    return { isLocked: false, blockedUntilTurn: null, blockedUntilAt: null, lockReason: null };
  }
  if (input.action === "permanent") {
    return { isLocked: true, blockedUntilTurn: null, blockedUntilAt: null, lockReason: reasonText };
  }
  if (input.action === "turns") {
    return {
      isLocked: false,
      blockedUntilTurn: turnId + (input.turns ?? 0),
      blockedUntilAt: null,
      lockReason: reasonText,
    };
  }
  const until = new Date(input.blockedUntilAt ?? "");
  return { isLocked: false, blockedUntilTurn: null, blockedUntilAt: until, lockReason: reasonText };
}

function buildPunishmentNewsMessage(
  action: z.infer<typeof punishSchema>["action"],
  countryName: string,
  data: AdminCountryPunishmentUpdateData,
  turnId: number,
  reasonText: string | null,
): string {
  const base =
    action === "unlock"
      ? `С страны ${countryName} сняты ограничения`
      : action === "permanent"
        ? `Страна ${countryName} заблокирована бессрочно`
        : action === "turns"
          ? `Страна ${countryName} заблокирована до хода #${data.blockedUntilTurn ?? turnId}`
          : `Страна ${countryName} заблокирована по времени`;
  return action !== "unlock" && reasonText ? `${base}. Причина: ${reasonText}` : base;
}
