import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#111111] text-white shadow-none",
        secondary:
          "border-transparent bg-[#F0EEE9] text-neutral-800",
        outline:
          "border border-black/10 text-neutral-800 bg-white",
        free:
          "bg-[#E8F5E9] text-[#1B5E20] border border-[#C8E6C9] font-bold",
        sand:
          "bg-[#E8E0D6] text-neutral-900 border border-black/5",
        sage:
          "bg-[#DDE8E2] text-neutral-900 border border-black/5",
        lavender:
          "bg-[#E2DFEB] text-neutral-900 border border-black/5",
        peach:
          "bg-[#FDE9D9] text-neutral-900 border border-black/5",
        sky:
          "bg-[#DBE7FD] text-neutral-900 border border-black/5",
        destructive:
          "border-transparent bg-red-100 text-red-800 border border-red-200",
        success:
          "bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
