"use client";

import { createContext, useContext } from "react";

import { cn } from "@/lib/utils";
import { CommandSearchTrigger } from "./command-palette-provider";
import { PrinterStatusButton } from "./printer-status-button";
import { ThemeToggle } from "./theme-toggle";

/**
 * Apakah shell sudah menyediakan search dan tombol tema di header-nya.
 *
 * Shell compact (TEKNICIAN, FRONTLINER) merender header sendiri, sementara
 * `AppShell` legacy tidak. `PageHeader` selalu merender `ThemeToggle` dan
 * `CommandSearchTrigger` di dalam `<header>`-nya -- di shell compact itu
 * jadi header kedua yang bertumpuk di atas header shell.
 *
 * Di legacy, `PageHeader` adalah satu-satunya header, jadi keduanya wajib
 * ada. Di compact, keduanya harus dilewati.
 *
 * Default `false` supaya komponen yang dirender di luar provider apa pun
 * tetap seperti sebelumnya: search dan tema tampil.
 */
const ShellChromeContext = createContext(false);

export const ShellChromeProvider = ShellChromeContext.Provider;

/**
 * Role aktif, supaya `ShellChrome` bisa menampilkan tombol printer hanya untuk
 * admin tanpa mengubah 21 pemanggil `PageHeader`.
 */
const ShellRoleContext = createContext<string | null>(null);

export const ShellRoleProvider = ShellRoleContext.Provider;

/**
 * `true` kalau shell sudah merender search dan tema sendiri.
 *
 * Dipakai `PageHeader` untuk melewati baris search + tema. Default `false`
 * menjaga perilaku legacy untuk pemakaian di luar provider.
 */
export function useShellChrome() {
  return useContext(ShellChromeContext);
}

export function useShellRole() {
  return useContext(ShellRoleContext);
}

/**
 * Search + tombol tema, atau apa pun jika shell sudah menyediakannya.
 *
 * Dipisah ke komponen client sendiri supaya `PageHeader` bisa tetap server
 * component. Sebelumnya `PageHeader` memanggil `useShellChrome()` langsung,
 * padahal hook itu client - jadi setiap route yang merender `PageHeader`
 * sebagai server component (`/app/inventori`, `/app/servis/baru`,
 * `/app/customer`, dan lainnya) gagal dengan "Attempted to call
 * useShellChrome() from the server".
 *
 * `PageHeader` tidak boleh diberi `"use client"`: isinya `title` dan
 * `description` datang dari server sebagai `ReactNode`, dan ikut jadi client
 * berarti ikut kehilangan Boundary async yang biasa dipakai route tersebut.
 * Batas client cukup di komponen kecil ini saja.
 */
export function ShellChrome({ className }: { className?: string }) {
  const shellHasChrome = useShellChrome();
  const role = useShellRole();
  if (shellHasChrome) return null;
  const showPrinter = role === "MASTER_ADMIN" || role === "ADMIN";
  return (
    <div className={cn("flex shrink-0 items-center gap-1.5", className)}>
      <ThemeToggle />
      <CommandSearchTrigger />
      {showPrinter ? <PrinterStatusButton /> : null}
    </div>
  );
}
