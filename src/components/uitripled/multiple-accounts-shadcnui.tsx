"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, Settings2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type AccountOption = {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  plan?: string;
};

type MultipleAccountsProps = {
  accounts: AccountOption[];
  value: string | null;
  onValueChange: (id: string) => void;
  onManage?: () => void;
  className?: string;
  manageLabel?: string;
  children?: ReactNode;
  bare?: boolean;
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function AccountAvatar({
  account,
  compact = false,
}: {
  account: AccountOption;
  compact?: boolean;
}) {
  const className = cn(
    "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted font-semibold text-foreground",
    compact ? "size-9 text-xs" : "size-10 text-sm",
  );

  return (
    <Avatar className={className} aria-hidden="true">
      {account.avatarUrl ? <AvatarImage src={account.avatarUrl} alt="" /> : null}
      <AvatarFallback>{initials(account.name)}</AvatarFallback>
    </Avatar>
  );
}

export function MultipleAccounts({
  accounts,
  value,
  onValueChange,
  onManage,
  className,
  manageLabel = "Kelola tenant",
  children,
  bare = false,
}: MultipleAccountsProps) {
  const shouldReduceMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const listboxId = useId();
  const activeAccount = accounts.find((account) => account.id === value) ?? accounts[0];
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (sectionRef.current && !sectionRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  if (!activeAccount) return null;

  const statusMessage = `${activeAccount.name} dipilih. Paket ${activeAccount.plan ?? "tenant"}.`;

  const content = (
    <>
      <div className="relative">
      <button
        type="button"
        className="group flex w-full items-center gap-3 rounded-xl border border-transparent bg-white px-2 py-1.5 text-left text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-muted/50"
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((previous) => !previous)}
      >
        <AccountAvatar account={activeAccount} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{activeAccount.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {activeAccount.description ?? activeAccount.plan ?? "Organization"}
          </span>
        </div>
        <motion.span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground"
          animate={shouldReduceMotion ? undefined : { rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <ChevronDown className="size-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            id={listboxId}
            role="listbox"
            aria-activedescendant={`${listboxId}-${activeAccount.id}`}
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -4, scale: shouldReduceMotion ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -6, scale: shouldReduceMotion ? 1 : 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 flex flex-col gap-1 rounded-2xl border border-border/70 bg-popover/95 p-2 shadow-lg backdrop-blur-xl"
          >
            {accounts.map((account, index) => {
              const isActive = account.id === activeAccount.id;
              return (
                <motion.button
                  key={account.id}
                  id={`${listboxId}-${account.id}`}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-transparent px-2 py-2 text-left transition-colors hover:border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                  onClick={() => {
                    onValueChange(account.id);
                    setIsOpen(false);
                  }}
                  initial={{ opacity: shouldReduceMotion ? 1 : 0, x: shouldReduceMotion ? 0 : -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { delay: index * 0.03, duration: 0.2, ease: "easeOut" }}
                >
                  <AccountAvatar account={account} compact />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{account.name}</div>
                  </div>
                  {account.plan ? <span className="text-[10px] font-medium uppercase tracking-wide text-primary">{account.plan}</span> : null}
                  {isActive ? (
                    <motion.span
                      layoutId="multiple-accounts-active-indicator"
                      className="flex size-6 items-center justify-center rounded-full border border-primary/60 bg-primary/15 text-primary"
                      transition={{ type: "spring", stiffness: 260, damping: 22 }}
                    >
                      <Check className="size-3.5" aria-hidden="true" />
                    </motion.span>
                  ) : null}
                </motion.button>
              );
            })}

            {onManage ? (
              <div className="mt-1 flex items-center justify-between border-t border-border/60 px-2 pt-2 text-xs text-muted-foreground">
                <span>{manageLabel}</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                  onClick={onManage}
                >
                  <Settings2 className="size-3.5" aria-hidden="true" />
                  Buka
                </button>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
      </div>

      {children ? <div className="mt-2">{children}</div> : null}

      <span className="sr-only" role="status" aria-live="polite">{statusMessage}</span>
    </>
  );

  if (bare) {
    return (
      <div ref={(node) => { sectionRef.current = node; }} className={cn("relative w-full", className)}>
        {content}
      </div>
    );
  }

  return (
    <motion.section
      ref={sectionRef}
      initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.35, ease: "easeOut" }}
      className={cn(
        "relative w-full rounded-2xl border border-border/60 bg-card/80 p-3 backdrop-blur-xl",
        isOpen ? "z-[60]" : "z-0",
        className,
      )}
    >
      {content}
    </motion.section>
  );
}
