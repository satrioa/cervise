"use client";

import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import SmoothButton, { smoothButtonVariants } from "@/components/smoothui/smooth-button";
import type { VariantProps } from "class-variance-authority";
import type * as React from "react";

// Re-export variants for compatibility — globally SmoothUI (with legacy mapping, primary → candy blue)
export const buttonVariants: typeof smoothButtonVariants = ((props: any) => {
  if (!props) return (smoothButtonVariants as any)({ variant: "candy", color: "blue", ...props });
  const mapped = props.variant ? (variantMap as any)[props.variant] : undefined;
  let v = mapped?.variant ?? props.variant;
  let c = props.color ?? (mapped as any)?.color ?? props.color;
  if (!v) { v = "candy"; c = c ?? "blue"; }
  else if (v === "default" && !c) { v = "candy"; c = "blue"; }
  const s = props.size ? ((sizeMap as any)[props.size] ?? props.size) : props.size;
  return (smoothButtonVariants as any)({ ...props, variant: v, color: c, size: s });
}) as any;

type LegacySize = "default" | "xs" | "sm" | "lg" | "xl" | "icon" | "icon-sm" | "icon-lg" | "icon-xl" | "icon-xs" | "filter" | "icon-filter";
type LegacyVariant = "default" | "destructive" | "destructive-outline" | "ghost" | "link" | "outline" | "secondary";

const sizeMap: Record<string, VariantProps<typeof smoothButtonVariants>["size"]> = {
  default: "sm",
  xs: "xs",
  sm: "sm",
  lg: "lg",
  xl: "lg",
  icon: "icon-sm",
  "icon-sm": "icon-sm",
  "icon-lg": "icon-lg",
  "icon-xl": "icon-lg",
  "icon-xs": "icon-sm",
  filter: "filter",
  "icon-filter": "icon-filter",
};

const variantMap: Record<string, { variant: VariantProps<typeof smoothButtonVariants>["variant"]; color?: VariantProps<typeof smoothButtonVariants>["color"] }> = {
  default: { variant: "candy", color: "blue" },
  destructive: { variant: "destructive" },
  "destructive-outline": { variant: "outline", color: "destructive" },
  ghost: { variant: "ghost" },
  link: { variant: "link" },
  outline: { variant: "outline" },
  secondary: { variant: "secondary" },
};

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "prefix" | "color"> {
  variant?: any;
  size?: any;
  color?: any;
  shape?: any;
  loading?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  forcePress?: boolean;
  asChild?: boolean;
  render?: React.ReactElement;
}

export function Button({
  className,
  variant,
  size,
  color,
  shape,
  loading = false,
  prefix,
  suffix,
  forcePress,
  asChild,
  render,
  children,
  disabled,
  ...props
}: ButtonProps): React.ReactElement {
  const mapped = variant ? (variantMap as any)[variant as string] : undefined;
  let resolvedVariant = (mapped?.variant as any) ?? (variant as any);
  let resolvedColor = (color as any) ?? (mapped as any)?.color;
  if (!resolvedVariant) { resolvedVariant = "candy"; resolvedColor = resolvedColor ?? "blue"; }
  else if (resolvedVariant === "default" && !resolvedColor) { resolvedVariant = "candy"; resolvedColor = "blue"; }
  const rawSize = size as string | undefined;
  const resolvedSize = (rawSize ? ((sizeMap as any)[rawSize] as any) : undefined) ?? (size as any) ?? "sm";

  // base-ui render prop (Slot-like) — support both APIs
  if (render) {
    // render is a ReactElement to use as Slot
    const renderClass = cn(smoothButtonVariants({ variant: resolvedVariant, size: resolvedSize, color: resolvedColor, shape, className }));
    return (
      <Slot className={renderClass} {...(props as any)}>
        {render}
      </Slot>
    );
  }

  return (
    <SmoothButton
      className={className}
      variant={resolvedVariant}
      size={resolvedSize}
      color={resolvedColor}
      shape={shape}
      loading={loading}
      prefix={prefix}
      suffix={suffix}
      forcePress={forcePress}
      asChild={asChild}
      disabled={disabled}
      {...props}
    >
      {children}
    </SmoothButton>
  );
}
