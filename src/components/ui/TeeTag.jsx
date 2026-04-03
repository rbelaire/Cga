/**
 * Tee category badge.
 * Desktop: full label ("Back", "Senior", "Front")
 * Mobile:  single capital letter ("B", "S", "F")
 *
 * Accepted tee values: "Back" | "Senior" | "Front"
 * Legacy "Sr" is treated as "Senior".
 */

const TEE_CONFIG = {
  Back:   { label: 'Back',   short: 'B', classes: 'bg-gray-800   text-white' },
  Senior: { label: 'Senior', short: 'S', classes: 'bg-amber-500  text-white' },
  Front:  { label: 'Front',  short: 'F', classes: 'bg-sky-600    text-white' },
  // legacy alias
  Sr:     { label: 'Senior', short: 'S', classes: 'bg-amber-500  text-white' },
}

export default function TeeTag({ tee, className = '' }) {
  if (!tee) return null
  const cfg = TEE_CONFIG[tee]
  if (!cfg) return null

  return (
    <span className={`font-sans font-semibold rounded leading-none ${cfg.classes} ${className}`}>
      {/* Mobile: single letter */}
      <span className="inline sm:hidden px-1 py-0.5 text-[10px]">{cfg.short}</span>
      {/* Desktop: full label */}
      <span className="hidden sm:inline px-1.5 py-0.5 text-xs">{cfg.label}</span>
    </span>
  )
}
