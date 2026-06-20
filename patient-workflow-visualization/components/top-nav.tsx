"use client"

import { Bell } from "lucide-react"
import { cn } from "@/lib/utils"
import { LohopMark } from "./lohop-mark"

const NAV = ["Dashboard", "Patients", "Schedule", "Billing"] as const

export function TopNav({
  active,
  openCount,
  onLoopClick,
}: {
  active: string
  openCount: number
  onLoopClick: () => void
}) {
  return (
    <header className="flex items-center justify-between gap-6 border-b border-border px-5 py-3.5">
      <div className="flex items-center gap-7">
        <LohopMark size="md" className="hidden sm:block" />
        <span className="text-lg font-semibold tracking-tight text-foreground sm:hidden">ClinicOS</span>
        <nav className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => (
            <button
              key={item}
              className={cn(
                "text-[15px] transition-colors",
                item === active
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </nav>
      </div>

      <button
        onClick={onLoopClick}
        className="flex items-center gap-2.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm transition-colors hover:bg-accent"
      >
        <Bell className="size-4 text-muted-foreground" />
        <span className="font-medium text-foreground">LoHop</span>
        <span className="flex size-5 items-center justify-center rounded-full bg-critical text-xs font-semibold text-white">
          {openCount}
        </span>
      </button>
    </header>
  )
}
