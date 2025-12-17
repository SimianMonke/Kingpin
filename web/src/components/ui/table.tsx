import * as React from "react"
import { cn } from "@/lib/utils"

// =============================================================================
// TABLE COMPONENT
// Bento grid structure with kinetic numbers
// =============================================================================

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn(
        "w-full caption-bottom text-sm",
        "font-mono",
        className
      )}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      "[&_tr]:border-b-2 [&_tr]:border-[var(--color-primary)]/30",
      className
    )}
    {...props}
  />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t-2 border-[var(--color-primary)]/30",
      "bg-[var(--color-surface)]/50",
      "font-display text-xs uppercase tracking-wider",
      "[&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-[rgba(0,255,241,0.1)]",
      "transition-colors",
      "hover:bg-[var(--color-primary)]/5",
      "data-[state=selected]:bg-[var(--color-primary)]/10",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle",
      "font-display text-xs uppercase tracking-widest",
      "text-[var(--color-primary)]",
      "[&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "p-4 align-middle",
      "text-[var(--color-foreground)]",
      "[&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn(
      "mt-4 text-sm",
      "text-[var(--color-muted)]",
      className
    )}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

// =============================================================================
// DATA TABLE WRAPPER
// Glass panel container for tables
// =============================================================================

const DataTable = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // Glass panel
      "bg-[rgba(18,18,18,0.65)] backdrop-blur-lg backdrop-saturate-[180%]",
      "border-2 border-[rgba(0,255,241,0.2)]",
      // Overflow handling
      "overflow-hidden",
      className
    )}
    {...props}
  >
    {children}
  </div>
))
DataTable.displayName = "DataTable"

// =============================================================================
// KINETIC NUMBER CELL
// Animated number display for stats
// =============================================================================

interface KineticCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  value: number
  prefix?: string
  suffix?: string
  trend?: "up" | "down" | "neutral"
}

const KineticCell = React.forwardRef<HTMLTableCellElement, KineticCellProps>(
  ({ className, value, prefix = "", suffix = "", trend, ...props }, ref) => {
    const trendColors = {
      up: "text-[var(--color-success)]",
      down: "text-[var(--color-destructive)]",
      neutral: "text-[var(--color-foreground)]",
    }

    const trendIcons = {
      up: "▲",
      down: "▼",
      neutral: "",
    }

    return (
      <td
        ref={ref}
        className={cn(
          "p-4 align-middle",
          "font-mono tabular-nums",
          trend && trendColors[trend],
          className
        )}
        {...props}
      >
        <span className="inline-flex items-center gap-1">
          {trend && trend !== "neutral" && (
            <span className="text-xs">{trendIcons[trend]}</span>
          )}
          <span className="kinetic-number">
            {prefix}{value.toLocaleString()}{suffix}
          </span>
        </span>
      </td>
    )
  }
)
KineticCell.displayName = "KineticCell"

// =============================================================================
// RANK CELL
// For leaderboard rank display
// =============================================================================

interface RankCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  rank: number
  previousRank?: number
}

const RankCell = React.forwardRef<HTMLTableCellElement, RankCellProps>(
  ({ className, rank, previousRank, ...props }, ref) => {
    const rankChange = previousRank ? previousRank - rank : 0
    const isTop3 = rank <= 3

    const rankColors: Record<number, string> = {
      1: "text-[var(--tier-legendary)]",
      2: "text-[var(--color-muted)]",
      3: "text-[#CD7F32]", // Bronze
    }

    return (
      <td
        ref={ref}
        className={cn(
          "p-4 align-middle w-20",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-2">
          <span className={cn(
            "font-display text-lg",
            isTop3 ? rankColors[rank] : "text-[var(--color-foreground)]"
          )}>
            #{rank}
          </span>
          {rankChange !== 0 && (
            <span className={cn(
              "text-xs",
              rankChange > 0 ? "text-[var(--color-success)]" : "text-[var(--color-destructive)]"
            )}>
              {rankChange > 0 ? `▲${rankChange}` : `▼${Math.abs(rankChange)}`}
            </span>
          )}
        </div>
      </td>
    )
  }
)
RankCell.displayName = "RankCell"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  DataTable,
  KineticCell,
  RankCell,
}
