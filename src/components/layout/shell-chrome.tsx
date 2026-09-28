"use client";

import { createContext, useContext } from "react";

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
 * `true` kalau shell sudah merender search dan tema sendiri.
 *
 * Dipakai `PageHeader` untuk melewati baris search + tema. Default `false`
 * menjaga perilaku legacy untuk pemakaian di luar provider.
 */
export function useShellChrome() {
  return useContext(ShellChromeContext);
}
