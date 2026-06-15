import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { REMEMBER_ME_TOKEN_EXPIRES_IN, SESSION_TOKEN_EXPIRES_IN, createAuthToken } from "./authToken";

const secret = "token-secret";
const payload = { id: "player-1", countryId: "country-1", isAdmin: true };

describe("authToken", () => {
  it("creates session tokens with the normal expiry", () => {
    const token = createAuthToken(payload, false, secret);
    const decoded = jwt.verify(token, secret) as typeof payload & { exp: number; iat: number };

    expect(decoded.id).toBe(payload.id);
    expect(decoded.countryId).toBe(payload.countryId);
    expect(decoded.isAdmin).toBe(true);
    expect(decoded.exp - decoded.iat).toBe(8 * 60 * 60);
    expect(SESSION_TOKEN_EXPIRES_IN).toBe("8h");
  });

  it("creates remember-me tokens with the extended expiry", () => {
    const token = createAuthToken(payload, true, secret);
    const decoded = jwt.verify(token, secret) as typeof payload & { exp: number; iat: number };

    expect(decoded.exp - decoded.iat).toBe(30 * 24 * 60 * 60);
    expect(REMEMBER_ME_TOKEN_EXPIRES_IN).toBe("30d");
  });
});
