/** Placeholder Volticoin: a gold coin with a lightning bolt. */
export function VolticoinIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="11"
        fill="#f5b82e"
        stroke="#b9801a"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="7.5" fill="#ffd25e" />
      <path d="M13.2 5.5 8 13h3.4l-1 5.5L16 11h-3.5z" fill="#2f6d3a" />
    </svg>
  );
}
