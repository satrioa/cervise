"use client";

import "./hero-02.css";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smartphone, LogOutIcon, StoreIcon, UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const A = "/originkit/hero-02";

const NAV_LINKS = [
  { label: "Fitur", href: "#fitur" },
  { label: "Harga", href: "#harga" },
  { label: "FAQ", href: "#faq" },
] as const;

const BRAND_LOGOS = [
  { name: "Lumina", src: `${A}/brand-lumina.svg` },
  { name: "Vortex", src: `${A}/brand-vortex.svg` },
  { name: "Velocity", src: `${A}/brand-velocity.svg` },
  { name: "Synergy", src: `${A}/brand-synergy.svg` },
  { name: "Enigma", src: `${A}/brand-enigma.svg` },
  { name: "Spectrum", src: `${A}/brand-spectrum.svg` },
] as const;

const EASE_OUT = [0.215, 0.61, 0.355, 1] as const;

const SHARED_TWEEN = {
  type: "tween" as const,
  duration: 0.4,
  ease: EASE_OUT,
};

const PHONE_STAGGER = 0.09;
const CARD_STAGGER = 0.07;

const CARD_DELAY_BASE = PHONE_STAGGER * 3 + 0.04;

const CARD_REVEAL_ORDER = ["stats", "actions", "liked", "comment"] as const;

const MenuIcon = () => (
  <svg
    aria-hidden="true"
    width="20"
    height="14"
    viewBox="0 0 20 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="size-[20px]"
  >
    <path
      d="M1 1.5h18M1 7h18M1 12.5h11"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const Navbar = ({ isLoggedIn, user }: { isLoggedIn?: boolean; user?: { name: string; email: string; avatarUrl?: string | null } | null }) => {
  const router = useRouter();
  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };
  const initials = (user?.name ?? "U").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "U";
  const avatarSrc = user?.avatarUrl ?? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.name ?? "User")}`;
  return (
  <nav
    aria-label="Primary"
    className="relative z-30 h-[81px] lg:h-[85px] mx-auto flex w-full max-w-[995px] items-center justify-between overflow-clip rounded-full border border-solid border-[#dee5ed] bg-white py-3.5 pr-3.5 pl-5 lg:max-w-[800px]"
  >
    <Link
      aria-label="Cervise home"
      href="/"
      className="relative flex items-center gap-2 shrink-0 touch-manipulation focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">C</span>
      <span className="font-bold text-lg text-[#1d1d1d]">Cervise</span>
      <Badge variant="secondary" className="hidden sm:inline-flex ml-1 text-[10px]">Multibranch</Badge>
    </Link>

    <ul
      className="absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-[18px] ipad-landscape:flex"
      aria-label="Navigation links"
    >
      {NAV_LINKS.map((link) => (
        <li key={link.label}>
          <Link
            href={link.href}
            className="inline-flex items-center text-[17px] font-medium leading-normal whitespace-nowrap text-[#333] transition-colors duration-200 ease focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1d1d1d]"
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>

    <div className="hidden shrink-0 items-center gap-2 ipad-landscape:flex">
      {isLoggedIn ? (
        <>
          <Button variant="candy" color="blue" size="sm" render={<Link href="/app">Dashboard</Link>}>
            Dashboard
          </Button>
          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label="Akun"
                  className="flex size-9 items-center justify-center overflow-hidden rounded-full border bg-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"
                />
              }
            >
              <Avatar className="size-9">
                <AvatarImage src={avatarSrc} alt={user?.name ?? "User"} className="object-cover" />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="w-64 p-2">
              <div className="px-2 py-2">
                <div className="truncate text-sm font-medium">{user?.name ?? "Akun"}</div>
                <div className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</div>
              </div>
              <div className="my-1 h-px bg-border" />
              <Link
                href="/owner"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                onClick={(e) => e.currentTarget.blur()}
              >
                <StoreIcon className="size-4 opacity-70" /> Tenant saya
              </Link>
              <Link
                href="/app/pengaturan/profil"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <UserIcon className="size-4 opacity-70" /> Profil
              </Link>
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOutIcon className="size-4" /> Keluar
              </button>
            </PopoverContent>
          </Popover>
        </>
      ) : (
        <>
          <Button variant="ghost" color="neutral" size="sm" render={<Link href="/login">Login</Link>}>
            Login
          </Button>
          <Button variant="candy" color="blue" size="sm" render={<Link href="/signup">Coba Gratis</Link>}>
            Coba Gratis
          </Button>
        </>
      )}
    </div>

    <button
      type="button"
      aria-label="Open menu"
      className="inline-flex h-[53px] w-[64px] shrink-0 touch-manipulation items-center justify-center overflow-clip rounded-full bg-[#2563eb] transition-[background-color,transform] duration-200 ease focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] motion-reduce:transition-none ipad-landscape:hidden [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#1d4ed8] [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.02]"
    >
      <MenuIcon />
    </button>
  </nav>
  );
};

const AnnouncementBadge = () => (
  <Link
    href="#fitur"
    className="inline-flex touch-manipulation items-center gap-1 overflow-clip rounded-full border border-solid border-[#dee5ed] bg-[#f1f4f8] py-1.5 pr-3 pl-1.5 shadow-[0_0_0_3px_white,0_4px_2px_rgba(140,150,169,0.25),0_8px_17.2px_rgba(140,150,169,0.1)] transition-[background-color,border-color,transform] duration-200 ease focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:hover:border-[#c9d3e0] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#e8edf4] [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.02]"
  >
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex items-center justify-center overflow-clip rounded-full bg-[#2563eb] px-3 py-[5px] text-[16px] font-semibold leading-normal text-white">
        Baru
      </span>
      <span className="text-center text-[17px] font-medium leading-normal whitespace-nowrap text-[#262626]">
        PWA Ringan untuk Teknisi di HP
      </span>
    </span>
    <span className="relative size-[18px] shrink-0 overflow-clip">
      <Image
        src={`${A}/arrow-right.svg`}
        alt=""
        width={18}
        height={18}
        className="size-full"
        aria-hidden="true"
      />
    </span>
  </Link>
);

const BrandLogoItem = ({
  brand,
  duplicate = false,
}: {
  brand: (typeof BRAND_LOGOS)[number];
  duplicate?: boolean;
}) => (
  <li
    className="relative h-[42px] w-[126px] shrink-0 overflow-clip"
    aria-hidden={duplicate || undefined}
  >
    <Image
      src={brand.src}
      alt={duplicate ? "" : brand.name}
      width={126}
      height={42}
      className="size-full object-contain"
      aria-hidden={duplicate}
    />
  </li>
);

const TrustedBy = () => (
  <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-7.5 px-0 md:px-5">
    <p className="text-center text-[16px] lg:text-[18px] font-medium leading-normal text-[#1d1d1d]">
      Trusted by 1000+ businesses across the world
    </p>

    <div
      className="relative w-full max-w-[820px] overflow-hidden mask-[linear-gradient(to_right,transparent,black_12%,black_88%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
      aria-label="Trusted brands"
      role="region"
    >
      <ul className="flex w-max items-center gap-x-2 iphone:gap-x-3.5 animate-trusted-marquee motion-reduce:animate-none will-change-transform">
        {BRAND_LOGOS.map((brand) => (
          <BrandLogoItem key={brand.name} brand={brand} />
        ))}
        {BRAND_LOGOS.map((brand) => (
          <BrandLogoItem
            key={`${brand.name}-duplicate`}
            brand={brand}
            duplicate
          />
        ))}
      </ul>
    </div>
  </div>
);

type PhoneMockupProps = {
  screen: string;
  screenWidth: number;
  screenHeight: number;
  className?: string;
  style?: CSSProperties;
};

const PhoneScreenPlaceholder = () => (
  <div className="flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-muted/40 to-muted/20 p-3 text-center">
    <span className="flex size-10 items-center justify-center rounded-xl bg-background border shadow-sm">
      <Smartphone className="size-5 text-muted-foreground/70" />
    </span>
    <p className="text-[11px] font-semibold text-foreground">Mockup HP — coming soon</p>
    <p className="max-w-[140px] text-[9px] leading-snug text-muted-foreground">Placeholder untuk screenshot Cervise. Ganti dengan image real di future.</p>
    <Badge variant="secondary" className="mt-1 text-[8px]">Multibranch • PWA</Badge>
  </div>
);

const PhoneMockup = ({
  screen,
  screenWidth,
  screenHeight,
  className = "",
  style,
}: PhoneMockupProps) => (
  <div className={`relative overflow-clip ${className}`} style={style}>
    <Image
      src={`${A}/Mobile.svg`}
      alt=""
      aria-hidden="true"
      width={235}
      height={476}
      priority
      className="pointer-events-none absolute inset-0 size-full object-fill"
    />
    <div
      aria-hidden="true"
      className="absolute inset-[2.1%_4.9%_2.1%_4.9%] z-[1] overflow-clip rounded-[6%] bg-[#1d1d1b]"
    >
      {screen === "placeholder" ? (
        <PhoneScreenPlaceholder />
      ) : (
        <Image
          src={screen}
          alt=""
          width={screenWidth}
          height={screenHeight}
          priority
          className="pointer-events-none size-full max-w-none object-cover object-top"
        />
      )}
    </div>
    <Image
      src={`${A}/dynamic-island.svg`}
      alt=""
      aria-hidden="true"
      width={52}
      height={16}
      priority
      className="pointer-events-none absolute top-[3%] left-1/2 z-[2] w-[22.1%] -translate-x-1/2"
    />
  </div>
);

const LikedCard = ({ className = "" }: { className?: string }) => (
  <div
    className={`flex items-center gap-2.5 overflow-clip rounded-full border border-solid border-[#dee5ed] bg-white py-2 pr-3 pl-2 shadow-[0_0_0_2px_white,0_15px_28.6px_rgba(0,0,0,0.12)] ${className}`}
  >
    <div className="flex items-center">
      {(
        [
          `${A}/avatar-1.png`,
          `${A}/avatar-2.png`,
          `${A}/avatar-3.png`,
        ] as const
      ).map((src, index) => (
        <span
          key={src}
          className={`relative size-7 shrink-0 overflow-clip rounded-full ${index < 2 ? "mr-[-11px]" : ""}`}
        >
          <Image
            src={src}
            alt=""
            width={28}
            height={28}
            className="size-full object-cover"
            aria-hidden="true"
          />
        </span>
      ))}
    </div>
    <span className="flex items-center gap-0.5">
      <Image
        src={`${A}/heart.svg`}
        alt=""
        width={24}
        height={24}
        className="size-6"
        aria-hidden="true"
      />
      <span className="text-[15px] font-medium leading-normal whitespace-nowrap text-[#1d1d1d]">
        Liked
      </span>
    </span>
  </div>
);

const ActionsCard = ({ className = "" }: { className?: string }) => (
  <div
    className={`flex items-start gap-[5.931px] overflow-clip rounded-full bg-white p-[5.931px] shadow-[0_0_0_2px_white,0_15px_28.6px_rgba(0,0,0,0.12)] ${className}`}
  >
    {(
      [
        { label: "Edit Profile", active: false },
        { label: "Ads", active: false },
        { label: "Insight", active: true },
      ] as const
    ).map((item) => (
      <span
        key={item.label}
        className={
          item.active
            ? "inline-flex items-center rounded-full bg-[#2563eb] px-[14.826px] py-[8.896px] text-[11.861px] font-medium leading-normal whitespace-nowrap text-white"
            : "inline-flex items-center rounded-full border-[0.741px] border-solid border-[#dee5ed] bg-white px-[14.826px] py-[8.896px] text-[11.861px] font-medium leading-normal whitespace-nowrap text-[#262626]"
        }
      >
        {item.label}
      </span>
    ))}
  </div>
);

const StatsCard = ({ className = "" }: { className?: string }) => (
  <div
    className={`flex w-[216px] items-start justify-between overflow-clip rounded-[10.205px] border-[0.85px] border-solid border-[#dee5ed] bg-white p-[13.606px] shadow-[0_0_0_1.701px_white,0_8.504px_32.315px_rgba(0,0,0,0.12)] ${className}`}
  >
    {(
      [
        { value: "58", label: "Posts" },
        { value: "486", label: "Follower" },
        { value: "397", label: "Following" },
      ] as const
    ).map((stat) => (
      <div
        key={stat.label}
        className="flex flex-col items-center gap-[3.402px]"
      >
        <span className="text-[15.307px] font-bold tracking-[0.1531px] text-[#1d1d1d]">
          {stat.value}
        </span>
        <span className="text-[11.906px] font-medium tracking-[0.1191px] text-[#333]">
          {stat.label}
        </span>
      </div>
    ))}
  </div>
);

const CommentCard = ({ className = "" }: { className?: string }) => (
  <div
    className={`flex w-[279px] flex-col gap-[16.127px] rounded-[16.127px] bg-white p-[16.127px] shadow-[0_-1.613px_14.353px_rgba(124,124,155,0.08),0_17.74px_35.802px_rgba(0,0,0,0.12)] ${className}`}
  >
    <div className="flex w-full items-start gap-[12.095px]">
      <span className="relative size-[40.318px] shrink-0 overflow-clip rounded-full">
        <Image
          src={`${A}/avatar-comment.png`}
          alt=""
          width={40}
          height={40}
          className="size-full object-cover"
          aria-hidden="true"
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-[7.257px]">
        <p className="text-[12.902px] font-medium leading-normal text-[#1d1d1d]">
          Kurniawan
        </p>
        <p className="text-[9.676px] leading-normal tracking-[0.4838px] text-[#333]">
          I like the overall vibe! How do you create that arrow on the all
          design?
        </p>
      </div>
    </div>
    <div className="flex items-center gap-[20.159px]">
      <span className="flex items-center gap-[6.451px]">
        <Image
          src={`${A}/icon-like.svg`}
          alt=""
          width={15}
          height={15}
          className="size-[14.5px] rotate-180"
          aria-hidden="true"
        />
        <span className="text-[9.676px] text-[#808080]">Like</span>
      </span>
      <span className="flex items-center gap-[6.451px]">
        <span className="relative h-[13.7px] w-4">
          <Image
            src={`${A}/icon-comment-line.svg`}
            alt=""
            width={16}
            height={14}
            className="absolute inset-0 size-full"
            aria-hidden="true"
          />
          <Image
            src={`${A}/icon-comment-dot.svg`}
            alt=""
            width={8}
            height={2}
            className="absolute top-[4.4px] left-[2.8px] h-[1.6px] w-2"
            aria-hidden="true"
          />
        </span>
        <span className="text-[9.676px] text-[#808080]">Comment</span>
      </span>
    </div>
  </div>
);

const DESKTOP_ARTBOARD = { width: 1440, height: 342 } as const;

const TABLET_ARTBOARD = { width: 900, height: 560 } as const;
const TABLET_PHONE = {
  width: 473,
  fullHeight: (735.556 * 473) / 364,

  cropHeight: 525,
} as const;

const DESKTOP_MIN_WIDTH = 1024;

const PhoneShowcase = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [isDesktop, setIsDesktop] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const reduceMotion = prefersReducedMotion === true;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const mql = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);

    const updateLayout = () => {
      const desktop = mql.matches;
      setIsDesktop(desktop);
      const nextArtboard = desktop ? DESKTOP_ARTBOARD : TABLET_ARTBOARD;
      setScale(el.clientWidth / nextArtboard.width);
    };

    updateLayout();
    const observer = new ResizeObserver(updateLayout);
    observer.observe(el);
    mql.addEventListener("change", updateLayout);
    return () => {
      observer.disconnect();
      mql.removeEventListener("change", updateLayout);
    };
  }, []);

  const artboard = isDesktop ? DESKTOP_ARTBOARD : TABLET_ARTBOARD;

  const phoneTransition = (index: number) => ({
    ...SHARED_TWEEN,
    delay: reduceMotion ? 0 : index * PHONE_STAGGER,
  });

  const cardDelay = (cardId: (typeof CARD_REVEAL_ORDER)[number]) => {
    if (reduceMotion) return 0;
    const orderIndex = CARD_REVEAL_ORDER.indexOf(cardId);
    return CARD_DELAY_BASE + orderIndex * CARD_STAGGER;
  };

  const phoneInitial = reduceMotion ? { opacity: 0 } : { opacity: 0, x: -28 };
  const phoneAnimate = reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 };

  const cardInitial = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, y: 14, scale: 0.96 };
  const cardAnimate = reduceMotion
    ? { opacity: 1 }
    : { opacity: 1, y: 0, scale: 1 };

  return (
    <div
      ref={ref}
      className="relative w-full overflow-x-clip overflow-y-hidden"
      style={{ height: `${artboard.height * scale}px` }}
    >
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 origin-top-left will-change-transform"
        style={{
          width: artboard.width,
          height: artboard.height,
          transform: `scale(${scale})`,
        }}
      >
        {}
        {isDesktop ? (
          <motion.div
            className="absolute top-[68px] left-0 z-0 h-[274px] w-[420px] overflow-hidden will-change-transform"
            initial={phoneInitial}
            animate={phoneAnimate}
            transition={phoneTransition(0)}
          >
            <div className="absolute bottom-[-107.78px] left-[49px] flex h-[388.845px] w-[360.122px] items-center justify-center">
              <div className="flex-none rotate-[-18.77deg]">
                <div className="relative h-[318.173px] w-[272.221px] overflow-hidden">
                  <PhoneMockup
                    screen="placeholder"
                    screenWidth={362}
                    screenHeight={788}
                    className="absolute top-0 left-0 h-[551.68px] w-[272.221px]"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}

        <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2">
          <motion.div
            className="overflow-hidden will-change-transform"
            style={
              isDesktop
                ? { width: 364, height: 325 }
                : {
                    width: TABLET_PHONE.width,
                    height: TABLET_PHONE.cropHeight,
                  }
            }
            initial={phoneInitial}
            animate={phoneAnimate}
            transition={phoneTransition(1)}
          >
            <PhoneMockup
              screen="placeholder"
              screenWidth={417}
              screenHeight={906}
              className={isDesktop ? "h-[735.556px] w-[364px]" : undefined}
              style={
                isDesktop
                  ? undefined
                  : {
                      width: TABLET_PHONE.width,
                      height: TABLET_PHONE.fullHeight,
                    }
              }
            />
          </motion.div>
        </div>

        {}
        {isDesktop ? (
          <motion.div
            className="absolute top-[68px] right-[40px] z-0 h-[274px] w-[400px] overflow-hidden will-change-transform"
            initial={phoneInitial}
            animate={phoneAnimate}
            transition={phoneTransition(2)}
          >
            <div className="absolute top-[-7.07px] right-[20px] flex h-[388.845px] w-[360.122px] items-center justify-center">
              <div className="flex-none rotate-[18.77deg]">
                <div className="relative h-[318.173px] w-[272.221px] overflow-hidden">
                  <PhoneMockup
                    screen="placeholder"
                    screenWidth={362}
                    screenHeight={788}
                    className="absolute top-0 left-0 h-[551.68px] w-[272.221px]"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}

        {}
        <motion.div
          className={`absolute z-30 will-change-transform ${
            isDesktop ? "top-[89px] left-[399px]" : "top-[156px] left-[150px]"
          }`}
          initial={cardInitial}
          animate={cardAnimate}
          transition={{ ...SHARED_TWEEN, delay: cardDelay("liked") }}
        >
          <LikedCard />
        </motion.div>

        <motion.div
          className={`absolute z-30 will-change-transform ${
            isDesktop ? "top-[89px] left-[861px]" : "top-[255px] left-[550px]"
          }`}
          initial={cardInitial}
          animate={cardAnimate}
          transition={{ ...SHARED_TWEEN, delay: cardDelay("actions") }}
        >
          <ActionsCard />
        </motion.div>

        <motion.div
          className={`absolute z-30 will-change-transform ${
            isDesktop
              ? "top-[219.61px] left-[360px]"
              : "top-[400px] left-[78px]"
          }`}
          initial={cardInitial}
          animate={cardAnimate}
          transition={{ ...SHARED_TWEEN, delay: cardDelay("stats") }}
        >
          <StatsCard />
        </motion.div>

        {isDesktop ? (
          <motion.div
            className="absolute top-[188px] left-[838px] z-30 will-change-transform"
            initial={cardInitial}
            animate={cardAnimate}
            transition={{ ...SHARED_TWEEN, delay: cardDelay("comment") }}
          >
            <CommentCard />
          </motion.div>
        ) : null}
      </div>
    </div>
  );
};

const Section11 = ({ isLoggedIn, user }: { isLoggedIn?: boolean; user?: { name: string; email: string; avatarUrl?: string | null } | null }) => {
  return (
    <section
      id="top"
      aria-label="Cervise hero"
      className="relative w-full h-full overflow-hidden bg-white text-[#0d0d0d]"
    >
      <div className="relative mx-auto w-full">
        {}
        <div className="relative overflow-hidden rounded-b-[clamp(1.5rem,4vw,3.125rem)] border-b border-solid border-[#dee5ed] bg-[#f8fafc] shadow-[0_0_0_6px_white,0_7px_6px_rgba(140,150,169,0.12),0_22px_30px_rgba(140,150,169,0.1)]">
          {}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[min(52%,28rem)] rounded-b-[inherit]"
            style={{
              backgroundImage:
                "linear-gradient(to bottom, rgba(248,250,252,0) 0%, #eff6ff 38%, #dbeafe 72%, #bfdbfe 100%)",
            }}
          />
          {}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-b-[inherit] bg-size-[186px_186px] bg-top-left opacity-100"
            style={{ backgroundImage: `url(${A}/dots.png)` }}
          />
          {}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-b-[inherit]"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 100% 70% at 50% 0%, #f8fafc 15%, transparent 70%)",
            }}
          />

          <div className="relative z-10 flex flex-col items-center px-4 pt-[30px] ipad:px-10">
            <div className="w-full animate-page-reveal will-change-transform">
              <Navbar isLoggedIn={isLoggedIn} user={user} />
            </div>

            {}
            <div
              id="download"
              className="mt-[clamp(2.75rem,7vw,5.375rem)] flex w-full max-w-[1145px] scroll-mt-8 flex-col items-center gap-10"
            >
              <div className="flex w-full flex-col items-center gap-4">
                <div className="animate-page-reveal will-change-transform [animation-delay:80ms]">
                  <AnnouncementBadge />
                </div>

                <div className="flex w-full animate-page-reveal flex-col items-center justify-center gap-5 px-0 text-center will-change-transform ipad:px-[clamp(1rem,6vw,6.25rem)] [animation-delay:140ms]">
                  <h1 className="font-urbanist text-wrap md:mx-auto md:max-w-[450px] lg:max-w-[750px] xl:max-w-[945px] text-[38px] lg:text-[58px] xl:text-[68px] font-bold leading-[46px] lg:leading-[120%] text-[#0d0d0d] text-center">
                    Kelola servis gadget <span className="text-[#666]">multi-cabang</span> tanpa ribet.
                  </h1>
                  <p className="max-w-md text-[18px] xl:text-[20px] lg:max-w-[550px] mx-auto font-medium leading-normal text-[#666] text-pretty">
                    Cervise bantu Frontliner catat servis, Teknisi update status, Admin pantau keuangan & laporan — 1 user 1 cabang, aman tidak bocor antar cabang. Garansi 3 bulan otomatis.
                  </p>
                </div>
              </div>

              <div className="flex w-full max-w-[556px] animate-page-reveal flex-col items-center gap-3 will-change-transform [animation-delay:200ms]">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button variant="candy" color="blue" size="lg" render={<Link href={isLoggedIn ? "/app" : "/signup"}>Mulai Trial Gratis</Link>}>
                    Mulai Trial Gratis
                  </Button>
                  <Button variant="outline" color="neutral" size="lg" render={<Link href="#harga">Lihat Harga</Link>}>
                    Lihat Harga
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">PWA ringan di HP kentang • Isolasi per cabang</p>
              </div>
            </div>

            {}
            <div className="relative z-10 mx-auto mt-[clamp(1.5rem,4vw,2.75rem)] w-full max-w-[1440px]">
              <PhoneShowcase />
            </div>
          </div>
        </div>

        {}
        <div className="animate-page-reveal py-[clamp(2.5rem,5vw,3.75rem)] will-change-transform [animation-delay:360ms]">
          <TrustedBy />
        </div>
      </div>
    </section>
  );
};

export default Section11;