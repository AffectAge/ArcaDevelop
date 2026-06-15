import type express from "express";
import jwt from "jsonwebtoken";

export type AuthHeaderPayload = {
  id: string;
  countryId: string;
  isAdmin: boolean;
};

export function parseAuthTokenWithSecret(token: string, jwtSecret: string): AuthHeaderPayload | null {
  try {
    const payload = jwt.verify(token, jwtSecret) as Partial<AuthHeaderPayload>;
    if (typeof payload.id !== "string" || typeof payload.countryId !== "string") {
      return null;
    }
    return {
      id: payload.id,
      countryId: payload.countryId,
      isAdmin: Boolean(payload.isAdmin),
    };
  } catch {
    return null;
  }
}

export function parseAuthHeaderWithSecret(req: express.Request, jwtSecret: string): AuthHeaderPayload | null {
  const header = req.header("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }

  return parseAuthTokenWithSecret(header.slice("Bearer ".length), jwtSecret);
}

export function createAuthHeaderParser(jwtSecret: string): (req: express.Request) => AuthHeaderPayload | null {
  return (req) => parseAuthHeaderWithSecret(req, jwtSecret);
}

export function createAuthTokenParser(jwtSecret: string): (token: string) => AuthHeaderPayload | null {
  return (token) => parseAuthTokenWithSecret(token, jwtSecret);
}
