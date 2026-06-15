import { describe, expect, it, vi } from "vitest";
import { createAdminCountryChecker } from "./adminPermissions";

describe("adminPermissions", () => {
  it("returns true only for admin countries", async () => {
    const isAdminCountry = createAdminCountryChecker({
      findCountryAdminState: async (countryId) => ({ isAdmin: countryId === "admin" }),
    });

    await expect(isAdminCountry("admin")).resolves.toBe(true);
    await expect(isAdminCountry("player")).resolves.toBe(false);
  });

  it("returns false for missing countries", async () => {
    const isAdminCountry = createAdminCountryChecker({
      findCountryAdminState: async () => null,
    });

    await expect(isAdminCountry("missing")).resolves.toBe(false);
  });

  it("passes the requested country id to the reader", async () => {
    const findCountryAdminState = vi.fn(async () => ({ isAdmin: true }));
    const isAdminCountry = createAdminCountryChecker({ findCountryAdminState });

    await isAdminCountry("country-1");

    expect(findCountryAdminState).toHaveBeenCalledWith("country-1");
  });
});
