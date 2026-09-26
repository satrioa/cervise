"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, MenuIcon, Settings2Icon, ShieldCheckIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  isOwnerNavActive,
  OWNER_BOTTOM_TABS,
  OWNER_NAV_GROUPS,
  type OwnerNavItem,
} from "./owner-navigation";

function initials(value: string) {
  return value.trim().slice(0, 2).toUpperCase() || "PO";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 px-2 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground/70">{children}</div>;
}

function OwnerNavLink({ item, pathname, onNavigate }: { item: OwnerNavItem; pathname: string; onNavigate?: () => void }) {
  const active = isOwnerNavActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
        active ? "bg-foreground/[0.06] font-medium text-foreground" : "text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground",
      )}
    >
      <Icon className="size-4 opacity-70" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function OwnerSidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <div className="border-b border-border/60 px-3.5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-foreground text-sm font-semibold text-background">C</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">Cervise</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">Platform owner</div>
          </div>
        </div>
      </div>

      <div className="border-b border-border/60 p-3">
        <div className="rounded-lg border border-border/60 bg-foreground/[0.03] p-3">
          <div className="flex items-center gap-2 text-xs font-medium"><ShieldCheckIcon className="size-3.5 text-emerald-600" /> Renewal engine</div>
          <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">H-7 · WhatsApp approval</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2 scrollbar-none" aria-label="Owner navigation">
        {OWNER_NAV_GROUPS.map((group) => (
          <div key={group.label} className="mt-3 first:mt-1">
            <SectionLabel>{group.label}</SectionLabel>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => <OwnerNavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />)}
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}

function OwnerAccountFooter({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2 border-t border-border/60 px-3 py-2.5">
      <div className="flex size-8 items-center justify-center rounded-full bg-foreground text-xs font-medium text-background">{initials(email)}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">Platform Owner</div>
        <div className="flex items-center gap-1.5 truncate text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-emerald-500" />{email || "Active session"}</div>
      </div>
      <button type="button" onClick={signOut} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground" aria-label="Logout"><LogOut className="size-4" /></button>
      <Link href="/owner/settings" aria-label="Owner settings" className={cn("rounded-md p-1.5 transition-colors", pathname.startsWith("/owner/settings") ? "bg-foreground/[0.06] text-foreground" : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground")}><Settings2Icon className="size-4" /></Link>
    </div>
  );
}

function OwnerBottomNav({ pathname }: { pathname: string }) {
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <>
      <nav className="relative z-30 flex h-[72px] shrink-0 items-stretch justify-around border-t border-border/60 bg-background lg:hidden" aria-label="Owner mobile navigation">
        {OWNER_BOTTOM_TABS.map((tab) => {
          const active = isOwnerNavActive(pathname, tab.href);
          const Icon = tab.icon;
          if (tab.more) {
            return <button key={tab.label} type="button" onClick={() => setMoreOpen(true)} aria-label={tab.label} className="relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 py-2 text-muted-foreground transition-colors hover:text-foreground"><Icon className="size-5" /><span className="text-[10px]">{tab.label}</span></button>;
          }
          return <Link key={tab.label} href={tab.href} aria-label={tab.label} aria-current={active ? "page" : undefined} className={cn("relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 py-2", active ? "text-foreground" : "text-muted-foreground")}>
            {active ? <span className="absolute left-1/2 top-0 h-0.5 w-6 -translate-x-1/2 rounded-full bg-foreground" /> : null}
            <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
            <span className="text-[10px]">{tab.label}</span>
          </Link>;
        })}
      </nav>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh] overflow-y-auto">
          <SheetHeader className="sr-only"><SheetTitle>Owner navigation</SheetTitle></SheetHeader>
          <div className="grid grid-cols-2 gap-2 px-1 pb-6 sm:grid-cols-3">
            {OWNER_NAV_GROUPS.flatMap((group) => group.items).map((item) => <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className="flex items-center gap-2 rounded-lg border p-3 text-sm"><item.icon className="size-4" />{item.label}</Link>)}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function OwnerShellInner({ children, email }: { children: React.ReactNode; email: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);

  const updateFade = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const canScroll = element.scrollHeight > element.clientHeight + 4;
    setShowTopFade(canScroll && element.scrollTop > 6);
    setShowBottomFade(canScroll && element.scrollTop + element.clientHeight < element.scrollHeight - 6);
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    updateFade();
    const observer = new ResizeObserver(updateFade);
    observer.observe(element);
    const content = element.querySelector("[data-main-content]");
    if (content) observer.observe(content);
    const mutationObserver = new MutationObserver(updateFade);
    mutationObserver.observe(element, { childList: true, subtree: true });
    window.addEventListener("resize", updateFade);
    const frame = requestAnimationFrame(updateFade);
    const timer = window.setTimeout(updateFade, 150);
    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", updateFade);
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [pathname, updateFade]);

  return (
    <div className="flex h-svh w-full overflow-hidden bg-background text-foreground lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-svh shrink-0 flex-col overflow-hidden border-r border-border/60 bg-foreground/[0.02] lg:flex">
        <OwnerSidebarContent />
        <OwnerAccountFooter email={email} />
      </aside>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:col-start-2">
        <div className="sticky top-0 z-40 flex shrink-0 items-center justify-between border-b border-border/60 bg-background px-3 py-2 lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="size-8" aria-label="Open owner navigation" />}><MenuIcon className="size-5" /></SheetTrigger>
            <SheetContent side="left" className="flex w-[280px] flex-col p-0">
              <SheetHeader className="sr-only"><SheetTitle>Owner navigation</SheetTitle></SheetHeader>
              <OwnerSidebarContent onNavigate={() => setMobileOpen(false)} />
              <OwnerAccountFooter email={email} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 text-sm font-semibold"><span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">C</span>Cervise Owner</div>
          <div className="size-8" />
        </div>

        <div ref={scrollRef} onScroll={updateFade} className="relative flex-1 overflow-y-auto overflow-x-hidden scrollbar-none scroll-smooth">
          <div aria-hidden className="pointer-events-none sticky top-0 z-10 -mb-8 h-8 bg-gradient-to-b from-background via-background/60 to-transparent backdrop-blur-[6px] [mask-image:linear-gradient(to_bottom,black_0%,black_35%,transparent_100%)] transition-opacity duration-300" style={{ opacity: showTopFade ? 1 : 0 }} />
          <div data-main-content className="min-h-full p-4 lg:p-8">{children}</div>
          <div aria-hidden className="pointer-events-none sticky bottom-0 z-10 -mt-8 h-8 bg-gradient-to-t from-background via-background/60 to-transparent backdrop-blur-[6px] [mask-image:linear-gradient(to_top,black_0%,black_35%,transparent_100%)] transition-opacity duration-300" style={{ opacity: showBottomFade ? 1 : 0 }} />
        </div>

        <OwnerBottomNav pathname={pathname} />
      </div>
    </div>
  );
}

export function OwnerShell({ children, email }: { children: React.ReactNode; email: string }) {
  return <OwnerShellInner email={email}>{children}</OwnerShellInner>;
}
