import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap px-4 font-display text-base font-semibold tracking-wide transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-ink hover:bg-[#ff6674]",
        secondary: "border border-line-strong bg-raised text-text hover:border-muted",
        ghost: "text-muted hover:bg-raised hover:text-text",
        danger: "border border-loss/60 text-loss hover:bg-loss/10",
      },
      size: {
        md: "",
        sm: "px-3 text-sm",
        icon: "min-h-11 w-11 px-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
