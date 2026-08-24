export type GoogleServiceId = "gmail" | "calendar" | "drive";

type GoogleScope = {
  id: string;
  label: string;
};

export type GoogleService = {
  id: GoogleServiceId;
  label: string;
  description: string;
  apiHost: string;
  scopes: GoogleScope[];
};

const services: GoogleService[] = [
  {
    id: "gmail",
    label: "Gmail",
    description: "Search, read, draft, and manage email.",
    apiHost: "https://gmail.googleapis.com",
    scopes: [
      {
        id: "https://www.googleapis.com/auth/gmail.readonly",
        label: "Read mail",
      },
      {
        id: "https://www.googleapis.com/auth/gmail.send",
        label: "Send mail",
      },
      {
        id: "https://www.googleapis.com/auth/gmail.modify",
        label: "Read, send, and change mail",
      },
    ],
  },
  {
    id: "calendar",
    label: "Calendar",
    description: "See and change events on your calendars.",
    apiHost: "https://www.googleapis.com",
    scopes: [
      {
        id: "https://www.googleapis.com/auth/calendar.readonly",
        label: "Read calendars",
      },
      {
        id: "https://www.googleapis.com/auth/calendar.events",
        label: "Change events",
      },
      {
        id: "https://www.googleapis.com/auth/calendar",
        label: "Read, change, and share calendars",
      },
    ],
  },
  {
    id: "drive",
    label: "Drive",
    description: "Search, read, and manage files.",
    apiHost: "https://www.googleapis.com",
    scopes: [
      {
        id: "https://www.googleapis.com/auth/drive.readonly",
        label: "Read files",
      },
      {
        id: "https://www.googleapis.com/auth/drive.file",
        label: "Create and edit app files",
      },
      {
        id: "https://www.googleapis.com/auth/drive",
        label: "Read and change files",
      },
    ],
  },
];

export function googleCatalog(): GoogleService[] {
  return services;
}

export function googleService(id: string): GoogleService | undefined {
  for (const service of services) {
    if (service.id === id) return service;
  }
  return undefined;
}

export function googleScopeLabel(scopeId: string): string {
  for (const service of services) {
    for (const scope of service.scopes) {
      if (scope.id === scopeId) return scope.label;
    }
  }
  return scopeId;
}
