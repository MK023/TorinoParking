interface IconProps {
  size?: number;
  className?: string;
}

function Svg({
  size = 16,
  className = "",
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export function MapPin(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </Svg>
  );
}

export function CreditCard(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </Svg>
  );
}

export function Cash(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M2 10h2m16 0h2M2 14h2m16 0h2" />
    </Svg>
  );
}

export function Bus(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 6v6m8-6v6M2 12h20M6 18h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2zm1 0v2m10-2v2" />
    </Svg>
  );
}

export function Train(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4" y="3" width="16" height="16" rx="2" />
      <path d="M4 11h16M12 3v8M8 19l-2 3m10-3 2 3" />
      <circle cx="8" cy="15" r="1" fill="currentColor" />
      <circle cx="16" cy="15" r="1" fill="currentColor" />
    </Svg>
  );
}

export function Clock(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Svg>
  );
}

export function Calendar(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </Svg>
  );
}

export function Shield(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Svg>
  );
}

export function Roof(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 21h18M4 21V10l8-6 8 6v11" />
      <path d="M9 21v-6h6v6" />
    </Svg>
  );
}

export function Camera(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </Svg>
  );
}

export function Accessibility(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="4" r="2" />
      <path d="M12 8v6m-4-4h8m-7 4 3 6m1-6 3 6" />
    </Svg>
  );
}

export function Navigation(p: IconProps) {
  return (
    <Svg {...p}>
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </Svg>
  );
}

export function ChevronLeft(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m15 18-6-6 6-6" />
    </Svg>
  );
}

export function ChevronRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  );
}

export function Search(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </Svg>
  );
}

export function Crosshair(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4m0 12v4m10-10h-4M6 12H2" />
    </Svg>
  );
}

export function Refresh(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M1 4v6h6" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </Svg>
  );
}

export function CarParking(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
    </Svg>
  );
}

export function Filter(p: IconProps) {
  return (
    <Svg {...p}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </Svg>
  );
}

export function Euro(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M17 5.5C15.8 4.6 14.4 4 12.8 4 9 4 6 7.1 6 11s3 7 6.8 7c1.6 0 3-.6 4.2-1.5M4 9.5h10M4 13.5h10" />
    </Svg>
  );
}

export function Moon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </Svg>
  );
}

export function Hospital(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 3h18v18H3zM12 7v10M7 12h10" />
    </Svg>
  );
}

export function GraduationCap(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M22 10 12 5 2 10l10 5 10-5z" />
      <path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" />
      <path d="M22 10v6" />
    </Svg>
  );
}
