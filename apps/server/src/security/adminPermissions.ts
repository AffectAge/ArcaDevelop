export type CountryAdminState = {
  isAdmin: boolean;
} | null;

export type CountryAdminStateReader = {
  findCountryAdminState: (countryId: string) => Promise<CountryAdminState>;
};

export function createAdminCountryChecker(reader: CountryAdminStateReader): (countryId: string) => Promise<boolean> {
  return async (countryId) => {
    const country = await reader.findCountryAdminState(countryId);
    return Boolean(country?.isAdmin);
  };
}
