import { cn } from "@/lib/utils"

/** LoHop wordmark — emphasized H for Human-in-the-loop. */
export function LohopMark({
  size = "md",
  showTagline = false,
  className,
}: {
  size?: "sm" | "md" | "lg"
  showTagline?: boolean
  className?: string
}) {
  const text =
    size === "sm" ? "text-sm" : size === "lg" ? "text-xl" : "text-base"

  return (
    <div className={cn("min-w-0", className)}>
      <span className={cn("font-semibold tracking-tight text-foreground", text)}>
        Lo<span className="text-primary">H</span>op
      </span>
      {showTagline && (
        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          Human in the loop
        </p>
      )}
    </div>
  )
}
