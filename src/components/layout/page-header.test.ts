import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

/**
 * Komentar dibuang sebelum diperiksa: file ini sengaja menyebut `useShellChrome`
 * di komentar penjelas, jadi tanpa filter test akan gagal karena dokumentasinya,
 * bukan karena kodenya.
 */
const readCode = (relative: string) =>
  read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !(/(?<!:)\/\//.test(line) || line.trimStart().startsWith("//")))
    .join("\n");

const pageHeader = readCode("src/components/layout/page-header.tsx");
const shellChrome = readCode("src/components/layout/shell-chrome.tsx");

/**
 * `PageHeader` dipanggil dari route server (`/app/inventori`, `/app/servis/baru`,
 * dan lainnya) DAN dari client component. Hook `useShellChrome` hanya boleh
 * dipanggil di client, jadi `PageHeader` tidak boleh memanggilnya langsung --
 * tidak dengan Pathway `PageHeader` sebagai client component, karena `title`
 * dan `description`-nya datang dari server sebagai `ReactNode`.
 */
describe("PageHeader tetap server component", () => {
  it("tidak punya 'use client'", () => {
    expect(pageHeader).not.toMatch(/^\s*["']use client["']/m);
  });

  it("tidak memanggil hook client secara langsung", () => {
    // Ini penyebab bug: "Attempted to call useShellChrome() from the server".
    expect(pageHeader).not.toMatch(/useShellChrome/);
  });

  it("memakai komponen ShellChrome sebagai gantinya", () => {
    expect(pageHeader).toMatch(/<ShellChrome\s*\/>/);
    expect(pageHeader).toMatch(/import \{ ShellChrome \} from "\.\/shell-chrome"/);
  });
});

describe("ShellChrome memegang hook client", () => {
  it("adalah client component", () => {
    expect(shellChrome).toMatch(/^\s*["']use client["']/m);
  });

  it("memanggil useShellChrome dan merender search + tema", () => {
    expect(shellChrome).toMatch(/useContext\(ShellChromeContext\)/);
    expect(shellChrome).toMatch(/<ThemeToggle\s*\/>/);
    expect(shellChrome).toMatch(/<CommandSearchTrigger\s*\/>/);
  });

  it("lewat saat shell compact sudah menyediakannya", () => {
    // Shell compact merender search + tema sendiri; kalau PageHeader juga
    // merendernya, teknisi dan frontliner melihat dua header bertumpuk.
    expect(shellChrome).toMatch(/if \(shellHasChrome\) return null/);
  });
});
