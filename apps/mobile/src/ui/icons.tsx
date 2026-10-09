import type { ClimateVariable, EquipmentKind, Season } from '@voltiris/content';
import type { ReactNode } from 'react';

// Bold placeholder icons in the toon style; they take the text colour.

interface IconProps {
  readonly size?: number | undefined;
}

function Icon({
  size = 22,
  children,
}: {
  size?: number | undefined;
  children: ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const CLIMATE_PATHS: Record<ClimateVariable, ReactNode> = {
  temperature: (
    <>
      <path d="M10 4.5a2 2 0 0 1 4 0v9a4.2 4.2 0 1 1-4 0z" />
      <circle cx="12" cy="17" r="1.8" fill="currentColor" />
      <path d="M12 9v6" />
    </>
  ),
  humidity: (
    <path
      d="M12 3.2c3.4 4.3 6 7.4 6 10.4a6 6 0 0 1-12 0c0-3 2.6-6.1 6-10.4z"
      fill="currentColor"
      stroke="none"
    />
  ),
  co2: (
    <>
      <path
        d="M7 18.5a4.2 4.2 0 0 1-.6-8.4 5.7 5.7 0 0 1 10.9-1.4 4.9 4.9 0 0 1-.3 9.8z"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
  light: (
    <>
      <circle cx="12" cy="12" r="4.2" fill="currentColor" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
    </>
  ),
  water: (
    <>
      <path d="M4 9h11l3-3M15 9v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M4 12c-1.5 0-2-1-2-2.5S3 7 4 7" />
      <path d="M20 13.5l.6 1.5M21 10.5l1 .5" />
    </>
  ),
  nutrients: (
    <>
      <path d="M9.5 3h5M10.5 3v6l-5 8.6A2.3 2.3 0 0 0 7.5 21h9a2.3 2.3 0 0 0 2-3.4l-5-8.6V3" />
      <path
        d="M7.6 15h8.8l1.4 2.6a1 1 0 0 1-.9 1.4H7.1a1 1 0 0 1-.9-1.4z"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
};

export function ClimateIcon({
  variable,
  size,
}: {
  variable: ClimateVariable;
  size?: number | undefined;
}) {
  return <Icon size={size}>{CLIMATE_PATHS[variable]}</Icon>;
}

const EQUIPMENT_PATHS: Record<EquipmentKind, ReactNode> = {
  heater: (
    <path
      d="M12 2.8c1 3.4 5.6 5.6 5.6 10.6a5.6 5.6 0 0 1-11.2 0c0-2.6 1.4-4.3 2.6-5.4.2 1.8 1 2.9 2.1 3.4-.3-3 .2-6 .9-8.6z"
      fill="currentColor"
      stroke="none"
    />
  ),
  vents: (
    <>
      <path d="M3 9l9-5 9 5" />
      <path d="M6 13h12M6 16.5h12M6 20h12" />
    </>
  ),
  fogger: (
    <>
      <path d="M4 6h16M8 6v2.5M12 6v2.5M16 6v2.5" />
      <circle cx="8" cy="13" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="16" cy="13" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="10" cy="19.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="20" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  co2: (
    <>
      <path d="M9 3h6M10 3v3M14 3v3" />
      <rect x="7" y="6" width="10" height="15.5" rx="4" />
      <path d="M7 12h10" />
    </>
  ),
  lights: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 2.8a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1 2.1V16h5.2v-.3c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 2.8z" />
    </>
  ),
  fertigation: (
    <>
      <path d="M3 6h9a3 3 0 0 1 3 3v2" />
      <path d="M13 11h4" />
      <path
        d="M15 14.5c1.4 1.8 2.5 3 2.5 4.2a2.5 2.5 0 0 1-5 0c0-1.2 1.1-2.4 2.5-4.2z"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
};

export function EquipmentIcon({
  kind,
  size,
}: {
  kind: EquipmentKind;
  size?: number | undefined;
}) {
  return <Icon size={size}>{EQUIPMENT_PATHS[kind]}</Icon>;
}

/** Window panes: the greenhouse glass. */
export function GlassIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <rect x="4" y="3.5" width="16" height="17" rx="1.5" />
      <path d="M12 3.5v17M4 12h16M7 9.5l2.5-2.5M15 17.5l2.5-2.5" />
    </Icon>
  );
}

/** Arrows out: a bigger greenhouse. */
export function SizeIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      <path d="M4 4l5.5 5.5M20 4l-5.5 5.5M4 20l5.5-5.5M20 20l-5.5-5.5" />
    </Icon>
  );
}

/** A chip: the climate computer. */
export function ComputerIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="9.5" y="9.5" width="5" height="5" fill="currentColor" />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
    </Icon>
  );
}

const SEASON_PATHS: Record<Season, ReactNode> = {
  spring: (
    <>
      <path d="M12 21v-8" />
      <path
        d="M12 13c0-4 2.5-6.5 7-6.5 0 4-2.5 6.5-7 6.5z"
        fill="currentColor"
      />
      <path
        d="M12 15c0-3.2-2-5.2-6-5.2 0 3.2 2 5.2 6 5.2z"
        fill="currentColor"
      />
    </>
  ),
  summer: CLIMATE_PATHS.light,
  autumn: (
    <>
      <path d="M5 19C5 10 10 4.5 20 4c-.5 10-6 15-15 15z" fill="currentColor" />
      <path d="M4 20l9-9" stroke="#fff" strokeWidth={1.6} />
    </>
  ),
  winter: (
    <path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9.5 4l2.5 2 2.5-2M9.5 20l2.5-2 2.5 2" />
  ),
};

export function SeasonIcon({
  season,
  size,
}: {
  season: Season;
  size?: number | undefined;
}) {
  return <Icon size={size}>{SEASON_PATHS[season]}</Icon>;
}

/** Cog outline, with teeth computed once. */
const GEAR_PATH = (() => {
  const teeth = 8;
  const points: string[] = [];
  for (let k = 0; k < teeth * 4; k++) {
    const angle = (k / (teeth * 4)) * Math.PI * 2;
    const r = k % 4 === 1 || k % 4 === 2 ? 10 : 7.6;
    points.push(
      `${(12 + r * Math.cos(angle)).toFixed(2)} ${(12 + r * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return `M${points.join('L')}z`;
})();

export function GearIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d={GEAR_PATH} fill="currentColor" strokeWidth={1.5} />
      <circle cx="12" cy="12" r="3" fill="#fff" stroke="none" />
    </Icon>
  );
}

export function ClockIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  );
}

export function ConeIcon({ size }: IconProps) {
  return (
    <svg
      width={size ?? 22}
      height={size ?? 22}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M3 21h18"
        stroke="#6b4423"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M9.6 3h4.8L19 20H5z"
        fill="#ff8a2a"
        stroke="#6b4423"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8.2 9h7.6l1.2 4.5H7z" fill="#fff" />
    </svg>
  );
}

export function SaveIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M12 3v11M7.5 9.5L12 14l4.5-4.5M4 17v2.5h16V17" />
    </Icon>
  );
}

export function OpenIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M12 14V3M7.5 7.5L12 3l4.5 4.5M4 17v2.5h16V17" />
    </Icon>
  );
}

export function RestartIcon({ size }: IconProps) {
  return (
    <Icon size={size}>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4 3.5v4h4" />
    </Icon>
  );
}
