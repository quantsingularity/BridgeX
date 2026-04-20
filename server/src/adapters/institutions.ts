import { Institution, InstitutionId } from "../models/types";

export const INSTITUTIONS: Record<InstitutionId, Institution> = {
  chase: {
    id: "chase",
    name: "Chase Bank",
    country: "US",
    logo: "https://logo.clearbit.com/chase.com",
    primaryColor: "#117ACA",
    oauthSupported: true,
  },
  wells_fargo: {
    id: "wells_fargo",
    name: "Wells Fargo",
    country: "US",
    logo: "https://logo.clearbit.com/wellsfargo.com",
    primaryColor: "#CC0000",
    oauthSupported: true,
  },
  bank_of_america: {
    id: "bank_of_america",
    name: "Bank of America",
    country: "US",
    logo: "https://logo.clearbit.com/bankofamerica.com",
    primaryColor: "#E31837",
    oauthSupported: true,
  },
  barclays: {
    id: "barclays",
    name: "Barclays",
    country: "GB",
    logo: "https://logo.clearbit.com/barclays.co.uk",
    primaryColor: "#00AEEF",
    oauthSupported: true,
  },
  revolut: {
    id: "revolut",
    name: "Revolut",
    country: "GB",
    logo: "https://logo.clearbit.com/revolut.com",
    primaryColor: "#191C1F",
    oauthSupported: true,
  },
};

export function getInstitution(id: InstitutionId): Institution | null {
  return INSTITUTIONS[id] ?? null;
}

export function listInstitutions(): Institution[] {
  return Object.values(INSTITUTIONS);
}
