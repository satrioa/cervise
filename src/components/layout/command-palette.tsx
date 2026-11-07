"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  Banknote,
  Building2,
  Check,
  Filter,
  Keyboard,
  LogOut,
  Monitor,
  Moon,
  PackagePlus,
  Plus,
  Search,
  ShoppingCart,
  Sun,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  GROUP_LABEL_KEY,
  canAccess,
  canWrite,
  navFor,
  normalizeAppRole,
} from "@/lib/nav/manifest";
import {
  commandSearchTerm,
  matchCustomers,
  matchProducts,
  matchQuickActions,
  normalizeCommandQuery,
  wantsProductSuggestions,
} from "@/lib/nav/command-actions";
import { useBranch } from "@/lib/branch-context";
import { NewServisDialog } from "@/components/servis/new-servis-dialog";
import { getServisList } from "@/app/app/servis/actions";
import { getProductQuickList, type QuickProductRow } from "@/app/app/inventori/actions";
import { getCustomerQuickList, type QuickCustomerRow } from "@/app/app/customer/actions";
import { servisLabel, type ServisListRow } from "@/lib/operational/servis-list";
import { createClient } from "@/lib/supabase/client";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  role: string;
};

type PaletteAction = {
  id: string;
  label: string;
  keywords: string;
  icon: LucideIcon;
  run: () => void;
};

/** Saran per grup selalu maksimal 3; ini pencarian cepat, bukan daftar. */
const GROUP_LIMIT = 3;

const SHORTCUTS: [string, string][] = [
  ["⌘K", "Buka / tutup palet"],
  ["↑ ↓", "Pindah item"],
  ["Enter", "Jalankan item"],
  ["Esc", "Tutup palet"],
];

/**
 * Palet⌘K: satu pintu untuk aksi, pencarian, filter, dan navigasi.
 *
 * Item navigasi diambil dari manifest (bukan ditulis ulang) supaya role yang
 * tidak boleh membuka halaman tidak pernah melihat aksinya. Daftar servis,
 * produk, dan customer dimuat sekali saat palet pertama dibuka lalu disaring
 * di klien — satu round-trip per sesi, bukan satu query per ketikan.
 */
export function CerviseCommandPalette({ open, onOpenChange, role }: Props) {
  const router = useRouter();
  const { branch, branches, setBranch } = useBranch();
  const { setTheme } = useTheme();

  const [query, setQuery] = useState("");
  const [view, setView] = useState<"main" | "branch">("main");
  const [helpOpen, setHelpOpen] = useState(false);
  const [newServisOpen, setNewServisOpen] = useState(false);
  const [services, setServices] = useState<ServisListRow[] | null>(null);
  const [products, setProducts] = useState<QuickProductRow[] | null>(null);
  const [customers, setCustomers] = useState<QuickCustomerRow[] | null>(null);

  const appRole = normalizeAppRole(role);
  const canReadServis = canAccess(role, "/app/servis");
  const canReadProducts = canAccess(role, "/app/inventori");
  const canReadCustomers = canAccess(role, "/app/customer");

  // Palet ditutup = kembali ke keadaan bersih.
  if (!open) {
    if (query !== "") setQuery("");
    if (view !== "main") setView("main");
    if (helpOpen) setHelpOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    if (canReadServis && services === null) {
      getServisList()
        .then((rows) => {
          if (!cancelled) setServices(rows);
        })
        .catch(() => {
          if (!cancelled) setServices([]);
        });
    }
    if (canReadProducts && products === null) {
      getProductQuickList()
        .then((rows) => {
          if (!cancelled) setProducts(rows);
        })
        .catch(() => {
          if (!cancelled) setProducts([]);
        });
    }
    if (canReadCustomers && customers === null) {
      getCustomerQuickList()
        .then((rows) => {
          if (!cancelled) setCustomers(rows);
        })
        .catch(() => {
          if (!cancelled) setCustomers([]);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [
    open,
    canReadServis,
    canReadProducts,
    canReadCustomers,
    services,
    products,
    customers,
  ]);

  const term = commandSearchTerm(query);
  const normalized = normalizeCommandQuery(query);
  const hasQuery = normalized.length > 0;

  const close = () => onOpenChange(false);

  const navigate = (href: string) => {
    close();
    router.push(href);
  };

  const handleNewServis = () => {
    close();
    // Beri waktu dialog palet menutup dulu; dua dialog bertumpuk membuat
    // fokus keyboard berakhir di dialog yang salah.
    setTimeout(() => setNewServisOpen(true), 150);
  };

  const handleLogout = async () => {
    close();
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  // ---- Aksi cepat -----------------------------------------------------------
  const quickActions = useMemo<PaletteAction[]>(() => {
    const list: PaletteAction[] = [];
    if (canWrite(role, "/app/servis")) {
      list.push({
        id: "tambah-servis",
        label: "Tambah data servis",
        keywords: "tambah buat baru data servis",
        icon: Plus,
        run: handleNewServis,
      });
    }
    if (canWrite(role, "/app/inventori")) {
      list.push({
        id: "tambah-stok",
        label: "Tambah stok produk",
        keywords: "tambah stok produk inventori",
        icon: PackagePlus,
        run: () => navigate("/app/inventori"),
      });
    }
    if (canWrite(role, "/app/karyawan")) {
      list.push({
        id: "tambah-karyawan",
        label: "Tambah data karyawan",
        keywords: "tambah buat baru data karyawan",
        icon: UserPlus,
        run: () => navigate("/app/karyawan?new=1"),
      });
    }
    if (canWrite(role, "/app/customer")) {
      list.push({
        id: "tambah-customer",
        label: "Tambah customer",
        keywords: "tambah buat baru data customer pelanggan",
        icon: Users,
        run: () => navigate("/app/customer?new=1"),
      });
    }
    if (canWrite(role, "/app/inventori")) {
      list.push({
        id: "tambah-produk",
        label: "Tambah produk / varian",
        keywords: "tambah buat baru produk varian inventori",
        icon: PackagePlus,
        run: () => navigate("/app/inventori?new=1"),
      });
    }
    if (canAccess(role, "/app/penjualan")) {
      list.push({
        id: "buka-kasir",
        label: "Buka kasir",
        keywords: "buka kasir penjualan jual transaksi",
        icon: ShoppingCart,
        run: () => navigate("/app/penjualan"),
      });
    }
    // Kas hanya ada di dashboard frontliner dan butuh shift terbuka; karena
    // itu deep-link, bukan formulir baru di palet.
    if (appRole === "FRONTLINER") {
      list.push({
        id: "catat-kas",
        label: "Catat kas",
        keywords: "catat kas masuk keluar adjustment",
        icon: Banknote,
        run: () => navigate("/app?action=catat-kas"),
      });
      list.push({
        id: "tutup-kas",
        label: "Tutup kas",
        keywords: "tutup kas toko closing shift",
        icon: Wallet,
        run: () => navigate("/app?action=tutup-kas"),
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, appRole]);

  // ---- Cari & lompat --------------------------------------------------------
  const searchActions = useMemo<PaletteAction[]>(() => {
    const suffix = term ? ` "${term}"` : "";
    const q = term ? `?q=${encodeURIComponent(term)}` : "";
    const list: PaletteAction[] = [];
    if (canReadServis) {
      list.push({
        id: "cari-servis",
        label: `Cari servis${suffix}`,
        keywords: "cari servis nomor nota",
        icon: Search,
        run: () => navigate(`/app/servis${q}`),
      });
    }
    if (canReadCustomers) {
      list.push({
        id: "cari-customer",
        label: `Cari customer${suffix}`,
        keywords: "cari customer pelanggan",
        icon: Search,
        run: () => navigate(`/app/customer${q}`),
      });
    }
    if (canReadProducts) {
      list.push({
        id: "cari-produk",
        label: `Cari produk${suffix}`,
        keywords: "cari produk stok inventori sku",
        icon: Search,
        run: () => navigate(`/app/inventori${q}`),
      });
    }
    if (canAccess(role, "/app/karyawan")) {
      list.push({
        id: "cari-karyawan",
        label: `Cari karyawan${suffix}`,
        keywords: "cari karyawan staf",
        icon: Search,
        run: () => navigate(`/app/karyawan${q}`),
      });
    }
    if (canAccess(role, "/app/garansi")) {
      list.push({
        id: "cari-garansi",
        label: `Cari garansi${suffix}`,
        keywords: "cari garansi klaim",
        icon: Search,
        run: () => navigate(`/app/garansi${q}`),
      });
    }
    if (canAccess(role, "/app/keuangan/transaksi")) {
      list.push({
        id: "cari-transaksi",
        label: `Cari transaksi${suffix}`,
        keywords: "cari transaksi pembayaran",
        icon: Search,
        run: () => navigate(`/app/keuangan/transaksi${q}`),
      });
    }
    if (canAccess(role, "/app/keuangan/arus-kas")) {
      list.push({
        id: "cari-arus-kas",
        label: `Cari arus kas${suffix}`,
        keywords: "cari arus kas mutasi",
        icon: Search,
        run: () => navigate(`/app/keuangan/arus-kas${q}`),
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, term, canReadServis, canReadCustomers, canReadProducts]);

  // ---- Filter pintar --------------------------------------------------------
  const filters = useMemo<PaletteAction[]>(() => {
    const list: PaletteAction[] = [];
    if (canAccess(role, "/app/inventori")) {
      list.push(
        {
          id: "stok-menipis",
          label: "Stok menipis",
          keywords: "stok menipis inventori",
          icon: Filter,
          run: () => navigate("/app/inventori?stok=menipis"),
        },
        {
          id: "stok-habis",
          label: "Stok habis",
          keywords: "stok habis inventori",
          icon: Filter,
          run: () => navigate("/app/inventori?stok=habis"),
        },
        {
          id: "produk-bekas",
          label: "Produk bekas",
          keywords: "produk bekas second inventori",
          icon: Filter,
          run: () => navigate("/app/inventori?tipe=BEKAS"),
        },
      );
    }
    if (canAccess(role, "/app/servis")) {
      list.push(
        {
          id: "servis-belum-bayar",
          label: "Servis belum dibayar",
          keywords: "servis belum dibayar unpaid",
          icon: Filter,
          run: () => navigate("/app/servis?bayar=belum"),
        },
        {
          id: "servis-hari-ini",
          label: "Servis hari ini",
          keywords: "servis hari ini today",
          icon: Filter,
          run: () => navigate("/app/servis?periode=hari-ini"),
        },
      );
    }
    if (canAccess(role, "/app/garansi")) {
      list.push(
        {
          id: "garansi-aktif",
          label: "Garansi aktif",
          keywords: "garansi aktif",
          icon: Filter,
          run: () => navigate("/app/garansi?status=Aktif"),
        },
        {
          id: "garansi-expired",
          label: "Garansi kedaluwarsa",
          keywords: "garansi kedaluwarsa expired",
          icon: Filter,
          run: () => navigate("/app/garansi?status=Expired"),
        },
      );
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // ---- Kendali --------------------------------------------------------------
  const controlActions = useMemo<PaletteAction[]>(() => {
    const list: PaletteAction[] = [
      {
        id: "ganti-cabang",
        label: "Ganti cabang",
        keywords: "ganti cabang branch pindah",
        icon: Building2,
        run: () => {
          setQuery("");
          setView("branch");
        },
      },
    ];
    list.push(
      {
        id: "tema-terang",
        label: "Tema terang",
        keywords: "tema terang light mode",
        icon: Sun,
        run: () => {
          setTheme("light");
          close();
        },
      },
      {
        id: "tema-gelap",
        label: "Tema gelap",
        keywords: "tema gelap dark mode",
        icon: Moon,
        run: () => {
          setTheme("dark");
          close();
        },
      },
      {
        id: "tema-sistem",
        label: "Tema sistem",
        keywords: "tema sistem system mode",
        icon: Monitor,
        run: () => {
          setTheme("system");
          close();
        },
      },
    );
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const systemActions = useMemo<PaletteAction[]>(
    () => [
      {
        id: "bantuan",
        label: "Bantuan shortcut",
        keywords: "bantuan shortcut keyboard help",
        icon: Keyboard,
        run: () => setHelpOpen(true),
      },
      {
        id: "keluar",
        label: "Keluar",
        keywords: "keluar logout sign out",
        icon: LogOut,
        run: handleLogout,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ---- Hasil live -----------------------------------------------------------
  const serviceMatches = useMemo(() => {
    if (term.length < 2 || !services) return [];
    return services
      .filter((row) =>
        `${row.serviceNumber ?? ""} ${row.device} ${row.customer} ${servisLabel(row)}`
          .toLowerCase()
          .includes(term),
      )
      .slice(0, GROUP_LIMIT);
  }, [term, services]);

  const productMatches = useMemo(() => {
    if (!products || !wantsProductSuggestions(query)) return [];
    return matchProducts(products, query, GROUP_LIMIT);
  }, [products, query]);

  const customerMatches = useMemo(() => {
    if (!customers || term.length < 2) return [];
    if (wantsProductSuggestions(query)) return [];
    const customerIntent =
      /\b(customer|pelanggan|hp|telepon|telp)\b/.test(normalized) ||
      /^\d{4,}$/.test(term);
    if (!customerIntent) return [];
    return matchCustomers(customers, query, GROUP_LIMIT);
  }, [customers, query, term, normalized]);

  // ---- Menu -----------------------------------------------------------------
  const menuBlocks = useMemo(() => {
    const blocks = navFor(role, "legacy", { includeHidden: true });
    if (!hasQuery) return blocks;
    return blocks
      .map((block) => ({
        ...block,
        entries: block.entries.filter((entry) =>
          `${entry.label} ${entry.key} ${entry.href}`.toLowerCase().includes(normalized),
        ),
      }))
      .filter((block) => block.entries.length > 0);
  }, [role, hasQuery, normalized]);

  const branchOptions = useMemo(() => {
    if (!hasQuery) return branches;
    return branches.filter((b) =>
      `${b.label} ${b.meta}`.toLowerCase().includes(normalized),
    );
  }, [branches, hasQuery, normalized]);

  const visibleQuick = hasQuery
    ? matchQuickActions(quickActions, query, GROUP_LIMIT)
    : quickActions.slice(0, GROUP_LIMIT);
  const visibleSearch = hasQuery
    ? matchQuickActions(searchActions, query, GROUP_LIMIT)
    : [];
  const visibleFilters = hasQuery
    ? matchQuickActions(filters, query, GROUP_LIMIT)
    : [];
  const visibleControls = hasQuery
    ? matchQuickActions(controlActions, query, GROUP_LIMIT)
    : controlActions.slice(0, GROUP_LIMIT);

  const actionItem = (action: PaletteAction) => {
    const Icon = action.icon;
    return (
      <CommandItem key={action.id} value={`${action.id} ${action.label}`} onClick={action.run}>
        <Icon className="size-4" />
        {action.label}
      </CommandItem>
    );
  };

  return (
    <>
      <CommandDialog open={open} onOpenChange={onOpenChange}>
        <CommandDialogPopup>
          <Command mode="none" value={query} onValueChange={setQuery}>
            <CommandInput placeholder="Cari menu, servis, atau ketik aksi..." />
            <CommandList>
              {helpOpen ? (
                <CommandGroup>
                  <CommandGroupLabel>Bantuan shortcut</CommandGroupLabel>
                  {SHORTCUTS.map(([keys, description]) => (
                    <CommandItem key={keys} value={`shortcut ${keys} ${description}`} disabled>
                      <Keyboard className="size-4 opacity-60" />
                      <span className="min-w-0 flex-1 truncate">{description}</span>
                      <CommandShortcut>{keys}</CommandShortcut>
                    </CommandItem>
                  ))}
                  <CommandItem value="kembali tutup bantuan" onClick={() => setHelpOpen(false)}>
                    <ArrowLeft className="size-4" /> Kembali
                  </CommandItem>
                </CommandGroup>
              ) : view === "branch" ? (
                <CommandGroup>
                  <CommandGroupLabel>Ganti cabang</CommandGroupLabel>
                  <CommandItem value="kembali" onClick={() => setView("main")}>
                    <ArrowLeft className="size-4" /> Kembali
                  </CommandItem>
                  {branchOptions.map((b) => (
                    <CommandItem
                      key={b.id}
                      value={`cabang ${b.label} ${b.meta}`}
                      onClick={() => {
                        setBranch(b);
                        close();
                      }}
                    >
                      <Building2 className="size-4" />
                      <span className="min-w-0 flex-1 truncate">{b.label}</span>
                      <span className="truncate text-xs text-muted-foreground">{b.meta}</span>
                      {b.id === branch.id ? <Check className="size-4" /> : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : (
                <>
                  {visibleQuick.length > 0 ? (
                    <CommandGroup>
                      <CommandGroupLabel>Aksi cepat</CommandGroupLabel>
                      {visibleQuick.map(actionItem)}
                    </CommandGroup>
                  ) : null}

                  {visibleSearch.length > 0 ? (
                    <CommandGroup>
                      <CommandGroupLabel>Cari</CommandGroupLabel>
                      {visibleSearch.map(actionItem)}
                    </CommandGroup>
                  ) : null}

                  {serviceMatches.length > 0 ? (
                    <CommandGroup>
                      <CommandGroupLabel>Servis</CommandGroupLabel>
                      {serviceMatches.map((row) => (
                        <CommandItem
                          key={row.id}
                          value={`servis ${servisLabel(row)} ${row.device} ${row.customer}`}
                          onClick={() =>
                            navigate(`/app/servis?q=${encodeURIComponent(servisLabel(row))}`)
                          }
                        >
                          <Search className="size-4 opacity-60" />
                          <span className="min-w-0 flex-1 truncate">
                            {servisLabel(row)} · {row.device}
                            <span className="ml-1 opacity-60">{row.customer}</span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}

                  {productMatches.length > 0 ? (
                    <CommandGroup>
                      <CommandGroupLabel>Tambah stok produk</CommandGroupLabel>
                      {productMatches.map((product) => (
                        <CommandItem
                          key={product.id}
                          value={`stok ${product.name} ${product.sku}`}
                          onClick={() =>
                            navigate(`/app/inventori?edit=${encodeURIComponent(product.id)}`)
                          }
                        >
                          <PackagePlus className="size-4" />
                          <span className="min-w-0 flex-1 truncate">{product.name}</span>
                          <span className="text-xs text-muted-foreground">{product.sku}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}

                  {customerMatches.length > 0 ? (
                    <CommandGroup>
                      <CommandGroupLabel>Customer</CommandGroupLabel>
                      {customerMatches.map((customer) => (
                        <CommandItem
                          key={customer.id}
                          value={`customer ${customer.name} ${customer.phone}`}
                          onClick={() =>
                            navigate(`/app/customer?q=${encodeURIComponent(customer.phoneDisplay)}`)
                          }
                        >
                          <Users className="size-4 opacity-60" />
                          <span className="min-w-0 flex-1 truncate">{customer.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {customer.phoneDisplay}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}

                  {visibleFilters.length > 0 ? (
                    <CommandGroup>
                      <CommandGroupLabel>Filter pintar</CommandGroupLabel>
                      {visibleFilters.map(actionItem)}
                    </CommandGroup>
                  ) : null}

                  {visibleControls.length > 0 ? (
                    <CommandGroup>
                      <CommandGroupLabel>Kendali</CommandGroupLabel>
                      {visibleControls.map(actionItem)}
                    </CommandGroup>
                  ) : null}

                  {menuBlocks.length > 0 ? <CommandSeparator /> : null}
                  {menuBlocks.map((block) => (
                    <CommandGroup key={block.group}>
                      <CommandGroupLabel>
                        {GROUP_LABEL_KEY[block.group] ?? "Menu"}
                      </CommandGroupLabel>
                      {block.entries.map((entry) => {
                        const Icon = entry.icon;
                        return (
                          <CommandItem
                            key={entry.href}
                            value={`${entry.key} ${entry.href} ${entry.label}`}
                            onClick={() => navigate(entry.href)}
                          >
                            <Icon className="size-4" />
                            {entry.label}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  ))}

                  <CommandSeparator />
                  <CommandGroup>
                    <CommandGroupLabel>Sistem</CommandGroupLabel>
                    {systemActions.map(actionItem)}
                  </CommandGroup>

                  <CommandEmpty>
                    {hasQuery ? `Tidak ada hasil untuk "${query.trim()}".` : "Tidak ada hasil."}
                  </CommandEmpty>
                </>
              )}
            </CommandList>
          </Command>
        </CommandDialogPopup>
      </CommandDialog>

      <NewServisDialog
        open={newServisOpen}
        onOpenChange={setNewServisOpen}
        onCreated={() => router.refresh()}
      />
    </>
  );
}
