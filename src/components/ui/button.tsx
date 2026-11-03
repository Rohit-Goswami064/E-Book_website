import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-[#111111] text-white hover:bg-neutral-800 shadow-sm active:scale-[0.98]",
        secondary:
          "bg-[#F5F5F5] text-neutral-900 hover:bg-[#EAEAEA] active:scale-[0.98]",
        outline:
          "border border-black/15 bg-white text-neutral-900 hover:bg-[#F9F9F9] active:scale-[0.98]",
        ghost:
          "text-neutral-700 hover:bg-black/5 hover:text-black",
        link:
          "text-neutral-900 underline-offset-4 hover:underline",
        free:
          "bg-[#E8F5E9] text-[#1B5E20] border border-[#C8E6C9] hover:bg-[#C8E6C9]/40",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 shadow-sm active:scale-[0.98]",
      },
      size: {
        default: "h-11 px-5 rounded-full text-[13px]",
        sm: "h-8 px-3.5 rounded-full text-xs",
        lg: "h-13 px-7 rounded-full text-base",
        icon: "h-10 w-10 rounded-full",
        iconSm: "h-8 w-8 rounded-full",
        iconXs: "h-7 w-7 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
