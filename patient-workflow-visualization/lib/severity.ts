import type { Severity } from "./types"

export const severityLabel: Record<Severity, string> = {
  critical: "Critical",
  warning: "Needs attention",
  routine: "Routine",
}

/** dot color */
export const severityDot: Record<Severity, string> = {
  critical: "bg-critical",
  warning: "bg-warning",
  routine: "bg-muted-foreground/60",
}

/** text color — use sparingly; prefer neutral titles + accent bar */
export const severityText: Record<Severity, string> = {
  critical: "text-critical-foreground",
  warning: "text-warning-foreground",
  routine: "text-foreground",
}

/** left accent for flat list rows */
export const severityAccent: Record<Severity, string> = {
  critical: "border-l-critical",
  warning: "border-l-warning",
  routine: "border-l-transparent",
}

/** card surface tint — full ClinicOS patient list only */
export const severitySurface: Record<Severity, string> = {
  critical: "bg-critical-surface/25 hover:bg-critical-surface/35 border-critical-surface/40",
  warning: "bg-warning-surface/20 hover:bg-warning-surface/30 border-warning-surface/40",
  routine: "bg-muted/40 hover:bg-muted/60 border-border",
}

/** healthy (no issues) styling */
export const healthySurface =
  "bg-healthy-surface/15 hover:bg-healthy-surface/25 border-healthy-surface/30"

export function formatAgeDays(days: number): string {
  if (days >= 365) return `${Math.round(days / 365)} yr`
  if (days >= 28) return `${Math.round(days / 7)} wk`
  if (days >= 1) return `${days} d`
  return "today"
}
