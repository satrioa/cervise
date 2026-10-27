"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type StepStatus = "default" | "active" | "completed";

interface StepperProps extends Omit<React.ComponentProps<"div">, "children"> {
  children: React.ReactNode;
  orientation?: "vertical" | "horizontal";
}

interface StepperItemProps extends Omit<React.ComponentProps<"div">, "title" | "children"> {
  title: string;
  description?: string;
  step?: number;
  status?: StepStatus;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-3.5", className)}
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * Warna pakai token tema (`primary`, `muted-foreground`), bukan varian
 * `dark:`. Halaman Lacak memakai kelas `.lacak-dark`, bukan `.dark`, jadi
 * `dark:` tidak pernah aktif di sana; token otomatis mengikuti mode Lacak.
 */
function StepperItem({
  title,
  description,
  step,
  status = "default",
  icon,
  children,
  className,
  ...props
}: StepperItemProps) {
  const stepNumber = step ?? 1;
  return (
    <div
      data-slot="stepper-item"
      data-status={status}
      className={cn("group/step relative", className)}
      {...props}
    >
      <div className="flex gap-3">
        <div className="flex shrink-0 flex-col items-center self-stretch">
          <div
            className={cn(
              "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
              status === "completed" && "border-primary bg-primary text-primary-foreground",
              status === "active" && "border-primary bg-primary/10 text-primary",
              status === "default" && "border-border bg-background text-muted-foreground"
            )}
          >
            {icon ? icon : status === "completed" ? <CheckIcon /> : <span className="text-xs">{stepNumber}</span>}
          </div>
          <div
            className={cn(
              "w-px min-h-4 grow",
              status === "completed" ? "bg-primary" : "bg-border",
              "group-last/step:hidden"
            )}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1 pb-6 pt-1 group-last/step:pb-0">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-semibold leading-tight text-foreground">{title}</h3>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {children && <div className="mt-2">{children}</div>}
        </div>
      </div>
    </div>
  );
}

function VerticalStepper({ children, className }: { children: React.ReactNode; className?: string }) {
  const items = React.Children.toArray(children).filter(React.isValidElement);
  return (
    <div data-slot="stepper" data-orientation="vertical" className={cn("flex flex-col", className)}>
      {items.map((child, index) => {
        if (!React.isValidElement<StepperItemProps>(child)) return child;
        return React.cloneElement(child, {
          step: child.props.step ?? index + 1,
          key: child.key ?? index,
        });
      })}
    </div>
  );
}

function HorizontalStepper({ children, className }: { children: React.ReactNode; className?: string }) {
  const items = React.Children.toArray(children).filter(React.isValidElement);
  return (
    <div data-slot="stepper" data-orientation="horizontal" className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center">
        {items.map((child, index) => {
          if (!React.isValidElement<StepperItemProps>(child)) return null;
          const { status = "default", icon, step: stepProp } = child.props;
          const stepNumber = stepProp ?? index + 1;
          const isLast = index === items.length - 1;
          return (
            <React.Fragment key={child.key ?? index}>
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                    status === "completed" && "border-primary bg-primary text-primary-foreground",
                    status === "active" && "border-primary bg-primary/10 text-primary",
                    status === "default" && "border-border bg-background text-muted-foreground"
                  )}
                >
                  {icon ? icon : status === "completed" ? <CheckIcon /> : <span className="text-xs">{stepNumber}</span>}
                </div>
                <span
                  className={cn(
                    "max-w-[8rem] text-center text-xs font-medium",
                    status === "default" ? "text-muted-foreground" : "text-foreground"
                  )}
                >
                  {child.props.title}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "mb-5 h-px flex-1",
                    status === "completed" ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
      {items.map((child, index) => {
        if (!React.isValidElement<StepperItemProps>(child)) return null;
        const { status = "default", description, children: stepChildren } = child.props;
        if (status !== "active") return null;
        return (
          <div key={child.key ?? index} className="flex flex-col gap-1.5">
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
            {stepChildren && <div>{stepChildren}</div>}
          </div>
        );
      })}
    </div>
  );
}

function Stepper({ children, orientation = "vertical", className }: StepperProps) {
  if (orientation === "horizontal") {
    return <HorizontalStepper className={className}>{children}</HorizontalStepper>;
  }
  return <VerticalStepper className={className}>{children}</VerticalStepper>;
}

export { Stepper, StepperItem, type StepperProps, type StepperItemProps, type StepStatus };
