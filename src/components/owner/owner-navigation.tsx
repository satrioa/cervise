import {
  Building2Icon,
  CreditCardIcon,
  LayoutDashboardIcon,
  PackageIcon,
  Settings2Icon,
  UsersIcon,
} from "lucide-react";

export type OwnerNavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

export type OwnerNavGroup = {
  label: string;
  items: OwnerNavItem[];
};

export const OWNER_NAV_GROUPS: OwnerNavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/owner", icon: LayoutDashboardIcon }],
  },
  {
    label: "Portfolio",
    items: [
      { label: "Tenants", href: "/owner/tenants", icon: Building2Icon },
      { label: "Packages", href: "/owner/packages", icon: PackageIcon },
      { label: "Accounts", href: "/owner/accounts", icon: UsersIcon },
    ],
  },
  {
    label: "Revenue",
    items: [{ label: "Billing", href: "/owner/billing", icon: CreditCardIcon }],
  },
  {
    label: "System",
    items: [{ label: "Settings", href: "/owner/settings", icon: Settings2Icon }],
  },
];

export type OwnerBottomTab = OwnerNavItem & { more?: boolean };

export const OWNER_BOTTOM_TABS: OwnerBottomTab[] = [
  { label: "Dashboard", href: "/owner", icon: LayoutDashboardIcon },
  { label: "Tenants", href: "/owner/tenants", icon: Building2Icon },
  { label: "Billing", href: "/owner/billing", icon: CreditCardIcon },
  { label: "Packages", href: "/owner/packages", icon: PackageIcon },
  { label: "More", href: "/owner/settings", icon: Settings2Icon, more: true },
];

export function isOwnerNavActive(pathname: string, href: string) {
  return pathname === href || (href !== "/owner" && pathname.startsWith(`${href}/`));
}
