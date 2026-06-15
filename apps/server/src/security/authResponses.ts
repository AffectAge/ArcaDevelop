import type express from "express";

export function sendUnauthorized(res: express.Response): express.Response {
  return res.status(401).json({ error: "UNAUTHORIZED" });
}

export function sendForbidden(res: express.Response): express.Response {
  return res.status(403).json({ error: "FORBIDDEN" });
}
