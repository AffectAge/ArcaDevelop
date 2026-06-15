import type express from "express";
import type { WsOutMessage } from "@arcanorum/shared";
import { z } from "zod";
import type { RouteAuth } from "../security/routeAuth";

export const adminUiNotificationSchema = z.object({
  category: z.enum(["system", "politics", "economy"]),
  title: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(500),
});

export type AdminUiNotificationRoutesDependencies = {
  routeAuth: RouteAuth;
  createId: () => string;
  getNowIso: () => string;
  broadcastUiNotification: (notification: Extract<WsOutMessage, { type: "UI_NOTIFY" }>["notification"]) => void;
};

export function registerAdminUiNotificationRoutes(
  app: express.Express,
  deps: AdminUiNotificationRoutesDependencies,
): void {
  app.post("/admin/ui-notifications", async (req, res) => {
    if (!(await deps.routeAuth.requireAdmin(req, res))) return;
    const parsed = adminUiNotificationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "INVALID_PAYLOAD", issues: parsed.error.issues });
    }

    const notification: Extract<WsOutMessage, { type: "UI_NOTIFY" }>["notification"] = {
      id: deps.createId(),
      category: parsed.data.category,
      createdAt: deps.getNowIso(),
      title: parsed.data.title,
      message: parsed.data.message,
      action: { type: "message" },
    };

    deps.broadcastUiNotification(notification);
    return res.json({ ok: true, notification });
  });
}
