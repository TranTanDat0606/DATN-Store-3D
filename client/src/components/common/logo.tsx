import { cn } from '@/lib/utils'

/**
 * L.01 "Layer 3" brand mark (Gate B1 — approved logo direction).
 *
 * A geometric numeral 3 constructed from four calibrated horizontal
 * extrusion bars with precision micro-gaps, a sharp print-nozzle tip
 * touching the top bar's entry edge, and a dotted build-plate baseline.
 *
 * Brand constants are FIXED in both themes (per the approved logo sheet):
 * bars violet #8B5CF6, nozzle cyan #22D3EE. The wordmark flips per theme:
 * "STORE" follows the foreground token (near-white on Obsidian, #1A1A22 on
 * Graphite) while "3D" stays the brand accent via the `link` token
 * (violet #8B5CF6 on dark, #6D28D9 on light).
 */
const BAR = '#8b5cf6'
const NOZZLE = '#22d3ee'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
    >
      <g fill={BAR}>
        {/* four extrusion bars (staggered left entry edges) */}
        <rect x="10" y="9" width="44" height="7" rx="1.5" />
        <rect x="13" y="19" width="41" height="7" rx="1.5" />
        <rect x="17" y="33" width="37" height="7" rx="1.5" />
        <rect x="10" y="46" width="44" height="7" rx="1.5" />
        {/* right spine: fills the gaps between bars on the entry side */}
        <rect x="46" y="16" width="8" height="3" />
        <rect x="46" y="26" width="8" height="7" />
        <rect x="46" y="40" width="8" height="6" />
      </g>
      {/* print-nozzle tip touching the top bar's entry edge */}
      <polygon points="10,1 18,1 13.5,9" fill={NOZZLE} />
      {/* dotted build-plate baseline */}
      <g fill={BAR} opacity="0.45">
        <circle cx="11" cy="57.5" r="1" />
        <circle cx="16" cy="57.5" r="1" />
        <circle cx="21" cy="57.5" r="1" />
        <circle cx="26" cy="57.5" r="1" />
        <circle cx="31" cy="57.5" r="1" />
        <circle cx="36" cy="57.5" r="1" />
        <circle cx="41" cy="57.5" r="1" />
        <circle cx="46" cy="57.5" r="1" />
        <circle cx="51" cy="57.5" r="1" />
      </g>
    </svg>
  )
}

/** Horizontal lockup: L.01 mark + "STORE 3D" wordmark ("3D" in the brand accent). */
export function Logo({ className, withWordmark = true }: { className?: string; withWordmark?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <LogoMark className="size-8" />
      {withWordmark && (
        <span className="text-lg font-extrabold tracking-tight whitespace-nowrap">
          <span className="text-foreground">STORE </span>
          <span className="text-link">3D</span>
        </span>
      )}
    </span>
  )
}
