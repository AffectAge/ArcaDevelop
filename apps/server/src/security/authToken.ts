import jwt from "jsonwebtoken";
import type { AuthHeaderPayload } from "./authHeader";

export const SESSION_TOKEN_EXPIRES_IN = "8h";
export const REMEMBER_ME_TOKEN_EXPIRES_IN = "30d";

export function createAuthToken(payload: AuthHeaderPayload, rememberMe: boolean, jwtSecret: string): string {
  return jwt.sign(payload, jwtSecret, {
    expiresIn: rememberMe ? REMEMBER_ME_TOKEN_EXPIRES_IN : SESSION_TOKEN_EXPIRES_IN,
  });
}
