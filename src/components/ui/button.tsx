import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "link";
export type ButtonSize = "md" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold select-none " +
  "transition-[background-color,color,border-color] duration-fast ease-standard " +
  "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary: "border border-input bg-secondary text-secondary-foreground hover:bg-accent",
  ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
  link: "text-link underline underline-offset-4 hover:text-link-hover",
};

// Every size keeps a 44px minimum touch target (min-h-11 = 2.75rem).
const sizes: Record<ButtonSize, string> = {
  md: "min-h-11 min-w-11 px-5 py-2",
  icon: "size-11",
};

/** Class string for anything that should look like a button (links included). */
export function buttonStyles({
  variant = "primary",
  size = "md",
}: { variant?: ButtonVariant; size?: ButtonSize } = {}) {
  return `${base} ${variants[variant]} ${sizes[size]}`;
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant, size, className, type = "button", ...props }: Props) {
  return (
    <button
      type={type}
      className={`${buttonStyles({ variant, size })} ${className ?? ""}`}
      {...props}
    />
  );
}
