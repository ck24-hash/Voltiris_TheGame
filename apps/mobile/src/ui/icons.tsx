import type { ClimateVariable, Season } from '@voltiris/content';
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
