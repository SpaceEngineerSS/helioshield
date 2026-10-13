/**
 * The HelioShield mark: a solar disc on the left and the bow of the
 * magnetopause on the right, the two ends of everything this app measures.
 * Same geometry as public/icon.svg.
 */
export function Logo({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <circle cx="9" cy="16" r="6" fill="var(--sun-disc)" />
      <path
        d="M24.5 5.5c-4.2 2.4-6.5 6.2-6.5 10.5s2.3 8.1 6.5 10.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M27 9.5c-2.2 1.7-3.3 3.9-3.3 6.5s1.1 4.8 3.3 6.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
      <circle cx="27.5" cy="16" r="1.6" fill="currentColor" />
    </svg>
  );
}
