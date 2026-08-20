import type { SVGProps } from "react";

export function Check(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      focusable="false"
      aria-hidden="true"
      role="img"
      width={24}
      height={24}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M5.75 12.5L10 16.75L18.25 7.25"
      />
    </svg>
  );
}
