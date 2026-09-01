import googleLogoUrl from "../../assets/google.png";

type IntegrationBrand = {
  logoUrl: string;
  buttonColor: `#${string}`;
  buttonForeground: `#${string}`;
};

export const integrationBrands = {
  google: {
    logoUrl: googleLogoUrl,
    buttonColor: "#1A73E8",
    buttonForeground: "#FFFFFF",
  },
} satisfies Record<string, IntegrationBrand>;
