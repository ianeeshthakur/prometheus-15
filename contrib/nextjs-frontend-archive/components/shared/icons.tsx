// Minimal inline icon set -- avoids pulling in an icon library for a handful of glyphs.
// All stroke-based, currentColor, 20x20 viewBox unless noted. Every icon is paired with
// a text label wherever it's used (docs/frontend.md §1 -- status/nav is never icon-only).
import type { SVGProps } from "react";

function base(props: SVGProps<SVGSVGElement>) {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export const IconDashboard = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="2.5" y="2.5" width="6" height="6" rx="1" />
    <rect x="11.5" y="2.5" width="6" height="6" rx="1" />
    <rect x="2.5" y="11.5" width="6" height="6" rx="1" />
    <rect x="11.5" y="11.5" width="6" height="6" rx="1" />
  </svg>
);

export const IconCamera = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="2.5" y="5.5" width="11" height="9" rx="1.5" />
    <path d="M13.5 8.5 17.5 6v8l-4-2.5" />
  </svg>
);

export const IconAlert = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M10 2.5 2.5 16h15L10 2.5Z" />
    <line x1="10" y1="8" x2="10" y2="11.5" />
    <circle cx="10" cy="13.8" r="0.6" fill="currentColor" stroke="none" />
  </svg>
);

export const IconWatchlist = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M2.5 10s2.8-5 7.5-5 7.5 5 7.5 5-2.8 5-7.5 5-7.5-5-7.5-5Z" />
    <circle cx="10" cy="10" r="2" />
  </svg>
);

export const IconInvestigation = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="8.3" cy="8.3" r="5" />
    <line x1="12.2" y1="12.2" x2="17.5" y2="17.5" />
  </svg>
);

export const IconAnalytics = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <line x1="3" y1="17" x2="17" y2="17" />
    <rect x="4.5" y="10" width="2.6" height="5.5" />
    <rect x="8.7" y="6" width="2.6" height="9.5" />
    <rect x="12.9" y="3" width="2.6" height="12.5" />
  </svg>
);

export const IconSystem = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="2.5" y="4" width="15" height="9" rx="1.2" />
    <line x1="7" y1="16.5" x2="13" y2="16.5" />
    <line x1="10" y1="13" x2="10" y2="16.5" />
  </svg>
);

export const IconAdmin = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="10" cy="6.5" r="3" />
    <path d="M3.5 17c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
  </svg>
);

export const IconMenu = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <line x1="3" y1="6" x2="17" y2="6" />
    <line x1="3" y1="10" x2="17" y2="10" />
    <line x1="3" y1="14" x2="17" y2="14" />
  </svg>
);

export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="8.5" cy="8.5" r="5.5" />
    <line x1="12.5" y1="12.5" x2="17.5" y2="17.5" />
  </svg>
);

export const IconBell = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 8a5 5 0 0 1 10 0c0 4 1.5 5 1.5 5h-13S5 12 5 8Z" />
    <path d="M8.3 16a1.8 1.8 0 0 0 3.4 0" />
  </svg>
);

export const IconSun = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="10" cy="10" r="3.2" />
    <g strokeLinecap="round">
      <line x1="10" y1="2" x2="10" y2="3.6" />
      <line x1="10" y1="16.4" x2="10" y2="18" />
      <line x1="2" y1="10" x2="3.6" y2="10" />
      <line x1="16.4" y1="10" x2="18" y2="10" />
      <line x1="4.5" y1="4.5" x2="5.6" y2="5.6" />
      <line x1="14.4" y1="14.4" x2="15.5" y2="15.5" />
      <line x1="4.5" y1="15.5" x2="5.6" y2="14.4" />
      <line x1="14.4" y1="5.6" x2="15.5" y2="4.5" />
    </g>
  </svg>
);

export const IconMoon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M16.5 12.3A7 7 0 0 1 7.7 3.5a7 7 0 1 0 8.8 8.8Z" />
  </svg>
);

export const IconContrast = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="10" cy="10" r="7" />
    <path d="M10 3a7 7 0 0 1 0 14Z" fill="currentColor" stroke="none" />
  </svg>
);

export const IconGlobe = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="10" cy="10" r="7" />
    <ellipse cx="10" cy="10" rx="3" ry="7" />
    <line x1="3" y1="10" x2="17" y2="10" />
  </svg>
);

export const IconUser = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="10" cy="7" r="3" />
    <path d="M4 17c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
  </svg>
);

export const IconList = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <line x1="7" y1="5" x2="17" y2="5" />
    <line x1="7" y1="10" x2="17" y2="10" />
    <line x1="7" y1="15" x2="17" y2="15" />
    <circle cx="3.2" cy="5" r="1" fill="currentColor" stroke="none" />
    <circle cx="3.2" cy="10" r="1" fill="currentColor" stroke="none" />
    <circle cx="3.2" cy="15" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconVehicle = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 12.5 4.5 7.5A2 2 0 0 1 6.4 6h7.2a2 2 0 0 1 1.9 1.5L17 12.5" />
    <rect x="2.2" y="12.5" width="15.6" height="3.6" rx="1" />
    <circle cx="6" cy="16.6" r="1.3" />
    <circle cx="14" cy="16.6" r="1.3" />
  </svg>
);

export const IconPlate = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="2.5" y="6" width="15" height="8" rx="1.2" />
    <line x1="5" y1="10" x2="15" y2="10" />
  </svg>
);

export const IconNoSignal = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="2.5" y="5.5" width="11" height="9" rx="1.5" />
    <path d="M13.5 8.5 17.5 6v8l-4-2.5" />
    <line x1="2" y1="17" x2="18" y2="3" />
  </svg>
);

export const IconMap = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <polygon points="7,3.5 13,5.5 17,3.5 17,15 13,17 7,15 3,17 3,5.5" />
    <line x1="7" y1="3.5" x2="7" y2="15" />
    <line x1="13" y1="5.5" x2="13" y2="17" />
  </svg>
);
