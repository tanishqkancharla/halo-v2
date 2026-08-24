export function GoogleServiceIcon({
  serviceId,
}: {
  serviceId: string;
}) {
  if (serviceId === "gmail") return <GmailMark />;
  if (serviceId === "calendar") return <CalendarMark />;
  if (serviceId === "drive") return <DriveMark />;
  return <UnknownMark />;
}

function GmailMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M1.5 6.75v10.5A2.25 2.25 0 0 0 3.75 19.5h2.25V8.85L12 13.2l6-4.35V19.5h2.25a2.25 2.25 0 0 0 2.25-2.25V6.75L12 14.1Z"
      />
      <path fill="#EA4335" d="M20.25 4.5h-3L12 8.1 6.75 4.5h-3L12 11.1Z" />
      <path fill="#34A853" d="M3.75 4.5A2.25 2.25 0 0 0 1.5 6.75V8.1L6 11.25V4.5Z" />
      <path
        fill="#FBBC04"
        d="M20.25 4.5H18v6.75l4.5-3.15V6.75A2.25 2.25 0 0 0 20.25 4.5Z"
      />
    </svg>
  );
}

function CalendarMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="5" width="16" height="15" rx="2" fill="#1A73E8" />
      <rect x="4" y="5" width="16" height="4" rx="2" fill="#185ABC" />
      <rect x="7" y="3" width="2" height="4" rx="1" fill="#EA4335" />
      <rect x="15" y="3" width="2" height="4" rx="1" fill="#EA4335" />
      <rect x="7" y="11" width="3" height="3" rx="0.5" fill="#ffffff" />
      <rect x="10.5" y="11" width="3" height="3" rx="0.5" fill="#ffffff" />
      <rect x="14" y="11" width="3" height="3" rx="0.5" fill="#ffffff" />
    </svg>
  );
}

function DriveMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      focusable="false"
    >
      <path fill="#0F9D58" d="M3.6 14.4 8.4 6h7.2l-4.8 8.4Z" />
      <path fill="#4285F4" d="m10.8 14.4 4.8 8.4h-9.6l4.8-8.4Z" />
      <path fill="#F4B400" d="M20.4 14.4 15.6 6 10.8 14.4l4.8 8.4Z" />
    </svg>
  );
}

function UnknownMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" fill="#9AA0A6" />
    </svg>
  );
}
