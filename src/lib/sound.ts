"use client";

import { useSyncExternalStore } from "react";
import { toast } from "sonner";

/**
 * UI sound system (Cervise).
 *
 * Seluruh suara UI lewat modul ini. Analoginya seperti `cn()` untuk styling:
 * komponen cukup memanggil `sfx.semantik()`, dan pemetaan nama semantik → file
 * wav hidup di SATU tempat. Kalau mau ganti "notch.wav" untuk tombol, cukup
 * ubah di sini tanpa menyentuh puluhan komponen.
 *
 * Design rules (detail di docs/sound-design.md):
 * - Suara HANYA dimainkan saat interaksi pengguna — tidak ada suara on-load
 *   (kebijakan autoplay browser).
 * - Kalau dua trigger sama-sama menyalakan suara (mis. klik tombol X yang juga
 *   menutup dialog), yang lebih spesifik menang: tombol X diberi
 *   `sound={null}` supaya yang kedengaran hanya Close1.
 * - Volume per sound dikendalikan di dalam playSound supaya variasi dB file
 *   sumber tidak perlu dipikirkan pemanggil.
 */

/** Peta nama semantik → URL file di public/sounds (file aslinya di docs/Music). */
export const SOUND_SRC = {
  close1: "/sounds/Close1.wav",
  close2: "/sounds/Close2.wav",
  dew: "/sounds/dew.wav",
  boop: "/sounds/boop.wav",
  dot: "/sounds/dot.wav",
  undo: "/sounds/undo.wav",
  arrive: "/sounds/arrive.wav",
  notch: "/sounds/notch.wav",
  clasp: "/sounds/clasp.wav",
  unclasp: "/sounds/unclasp.wav",
  shake: "/sounds/shake.wav",
  chime: "/sounds/chime.wav",
  spring: "/sounds/spring.wav",
} as const;

export type SoundName = keyof typeof SOUND_SRC;

/** Volume default per sound (0..1). Di-tune manual dari dB file sumbernya. */
export const SOUND_VOLUME: Record<SoundName, number> = {
  close1: 0.5,
  close2: 0.55,
  dew: 0.4,
  boop: 0.4,
  dot: 0.5,
  undo: 0.5,
  arrive: 0.7,
  notch: 0.45,
  clasp: 0.6,
  unclasp: 0.6,
  shake: 0.7,
  chime: 0.7,
  spring: 0.5,
};

const STORAGE_KEY = "cervise_sound";

// ---------------------------------------------------------------------------
// Preferensi mute (persist di localStorage, dibaca semua komponen lewat hook)
// ---------------------------------------------------------------------------

const settingsListeners = new Set<() => void>();
let cachedEnabled: boolean | null = null;

function readEnabled(): boolean {
  if (typeof window === "undefined") return true;
  if (cachedEnabled === null) {
    try {
      cachedEnabled = window.localStorage.getItem(STORAGE_KEY) !== "off";
    } catch {
      // localStorage bisa diblokir (mode private/iframe ketat) — suara tetap
      // aktif, hanya preferensinya tidak tersimpan.
      cachedEnabled = true;
    }
  }
  return cachedEnabled;
}

export function isSoundEnabled(): boolean {
  return readEnabled();
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  cachedEnabled = enabled;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // abaikan: preferensi berlaku untuk sesi ini saja
  }
  for (const listener of settingsListeners) listener();
}

function subscribeSettings(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  settingsListeners.add(listener);
  return () => {
    settingsListeners.delete(listener);
  };
}

/** Hook React untuk komponen yang menampilkan toggle mute suara. */
export function useSoundEnabled(): boolean {
  // Nilai server selalu "aktif" supaya render SSR dan hidrasi konsisten;
  // pembacaan localStorage terjadi setelah mount.
  return useSyncExternalStore(subscribeSettings, readEnabled, () => true);
}

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------

/**
 * Throttle: suara yang sama beruntun dalam < 60ms dianggap satu klik
 * (double-fire dari dua layer listener pada event yang sama).
 */
const LAST_PLAYED = new Map<SoundName, number>();

/**
 * Pool elemen audio per sound.
 *
 * Catatan penting dari debugging: `cloneNode(true)` pada elemen media bisa
 * menghasilkan clone yang tidak pernah memuat resource di sebagian browser
 * (clone mewarisi atribut `src` tetapi bukan status load-nya), sehingga
 * `play()` reject dan terdengar hening. Karena itu tiap sound punya beberapa
 * elemen nyata yang dipakai bergiliran: klik cepat tetap bisa tumpang tindih,
 * tetapi elemennya selalu elemen yang benar-benar pernah `play()`.
 */
const POOL_SIZE = 3;
const AUDIO_POOL = new Map<SoundName, HTMLAudioElement[]>();
const POOL_CURSOR = new Map<SoundName, number>();
let audioWarmedUp = false;

function getPool(name: SoundName): HTMLAudioElement[] {
  let pool = AUDIO_POOL.get(name);
  if (!pool) {
    pool = [];
    AUDIO_POOL.set(name, pool);
  }
  return pool;
}

function acquireAudio(name: SoundName): HTMLAudioElement {
  const pool = getPool(name);
  if (pool.length < POOL_SIZE) {
    const el = new window.Audio(SOUND_SRC[name]);
    el.preload = "auto";
    pool.push(el);
    return el;
  }
  const cursor = POOL_CURSOR.get(name) ?? 0;
  POOL_CURSOR.set(name, (cursor + 1) % pool.length);
  const el = pool[cursor];
  try {
    el.pause();
    el.currentTime = 0;
  } catch {
    // elemen belum siap — play() di bawah akan memuat ulang
  }
  return el;
}

/**
 * Preload sisa sound di waktu idle setelah interaksi pertama. Tidak dilakukan
 * saat mount supaya tidak ada 13 request audio + ~2 MB di first paint.
 */
function warmUpAudio() {
  if (typeof window === "undefined") return;
  if (audioWarmedUp) return;
  audioWarmedUp = true;
  const load = () => {
    for (const name of Object.keys(SOUND_SRC) as SoundName[]) {
      const pool = getPool(name);
      if (pool.length === 0) {
        const el = new window.Audio(SOUND_SRC[name]);
        el.preload = "auto";
        pool.push(el);
      }
    }
  };
  const idle = window.requestIdleCallback;
  if (typeof idle === "function") idle(load, { timeout: 2000 });
  else window.setTimeout(load, 1200);
}

export function playSound(name: SoundName, opts?: { volume?: number }): void {
  if (typeof window === "undefined") return;
  if (!readEnabled()) return;

  const now = Date.now();
  const last = LAST_PLAYED.get(name) ?? 0;
  if (now - last < 60) return;
  LAST_PLAYED.set(name, now);

  try {
    const el = acquireAudio(name);
    el.volume = opts?.volume ?? SOUND_VOLUME[name];
    const played = el.play();
    if (played && typeof played.catch === "function") {
      played.catch(() => {
        // Autoplay/permission error — hening, jangan ganggu interaksi.
      });
    }
    warmUpAudio();
  } catch {
    // Jangan pernah melempar dari lapisan suara.
  }
}

/**
 * API semantik — ini yang dipakai komponen. Nama fungsi menjelaskan INTENSI
 * interaksi, bukan file wav-nya. Pemetaan lengkap ada di docs/sound-design.md.
 */
export const sfx = {
  /** Tutup popover, modal/dialog, sheet, dropdown, alert. */
  close: () => playSound("close1"),
  /** Aksi membatalkan: tombol "Batal", "Buang perubahan", "Discard", tutup tanpa simpan. */
  cancel: () => playSound("close2"),
  /** Klik generik non-tombol (card, baris tabel, chip, item list) — acak dew/boop. */
  click: () => {
    if (Math.random() < 0.5) playSound("dew");
    else playSound("boop");
  },
  /** Aksi memilih/pick: select dropdown, radio, pilih cabang, pilih item. */
  select: () => playSound("dot"),
  /** Berganti tab. */
  tab: () => playSound("undo"),
  /** Notifikasi masuk / toast informasi. */
  notify: () => playSound("arrive"),
  /** Menekan tombol (primary/secondary/ghost). */
  button: () => playSound("notch"),
  /** Toggle dalam keadaan ON (fitur dinyalakan). */
  toggleOn: () => playSound("clasp"),
  /** Toggle dalam keadaan OFF (fitur dimatikan). */
  toggleOff: () => playSound("unclasp"),
  /** Aksi gagal: validasi menolak, request error, rules ditolak. */
  error: () => playSound("shake"),
  /** Aksi sukses: data tersimpan, pembayaran sukses, upload selesai. */
  success: () => playSound("chime"),
  /** Cadangan: transisi buka/animasi besar (sheet besar, onboarding). Belum dipakai otomatis. */
  spring: () => playSound("spring", { volume: SOUND_VOLUME.spring }),
};

// ---------------------------------------------------------------------------
// Jembatan sonner toast → suara
// ---------------------------------------------------------------------------

/**
 * Dipasang SEKALI, otomatis dari `components/ui/sonner.tsx` (modul itu selalu
 * termuat di root layout, jadi jembatan ini pasti aktif).
 *
 * Tidak semua call site toast perlu diubah: semua `toast.success(...)` /
 * `toast.error(...)` di seluruh aplikasi otomatis bersuara. Semantik mengikuti
 * warna toast: hijau = chime, merah = shake, lainnya = arrive (notifikasi).
 */
type ToastMethod = (message: unknown, data?: unknown) => unknown;

type ToastApi = {
  (message: unknown, data?: unknown): unknown;
  success?: ToastMethod;
  error?: ToastMethod;
  warning?: ToastMethod;
  message?: ToastMethod;
  loading?: ToastMethod;
  promise?: (input: unknown, data?: unknown) => unknown;
};

type PromiseCallbacks = {
  success?: unknown;
  error?: unknown;
};

export function installToastSoundBridge(): void {
  if (typeof window === "undefined") return;
  const globalWindow = window as typeof window & { __cerviseToastSfx?: boolean };
  if (globalWindow.__cerviseToastSfx) return;
  globalWindow.__cerviseToastSfx = true;

const api = toast as unknown as ToastApi;

  if (typeof api.success === "function") {
    const original = api.success.bind(api);
    api.success = (message, data) => {
      sfx.success();
      return original(message, data);
    };
  }
  if (typeof api.error === "function") {
    const original = api.error.bind(api);
    api.error = (message, data) => {
      sfx.error();
      return original(message, data);
    };
  }
  if (typeof api.warning === "function") {
    const original = api.warning.bind(api);
    api.warning = (message, data) => {
      sfx.notify();
      return original(message, data);
    };
  }
  if (typeof api.message === "function") {
    const original = api.message.bind(api);
    api.message = (message, data) => {
      sfx.notify();
      return original(message, data);
    };
  }
  if (typeof api.loading === "function") {
    const original = api.loading.bind(api);
    api.loading = (message, data) => original(message, data); // toast loading hening
  }

  // toast.promise: bunyi mengikuti hasil (resolve → chime, reject → shake).
  // Callback asli dipanggil apa adanya setelah suara (string, object, atau
  // function diteruskan, jadi pesan kustom tidak hilang).
  if (typeof api.promise === "function") {
    const originalPromise = api.promise.bind(api);
    api.promise = (input: unknown, data?: unknown) => {
      const callbacks = (data ?? {}) as PromiseCallbacks;
      const originalSuccess = callbacks.success;
      const originalError = callbacks.error;
      callbacks.success = (value: unknown) => {
        sfx.success();
        return typeof originalSuccess === "function"
          ? (originalSuccess as (v: unknown) => unknown)(value)
          : originalSuccess;
      };
      callbacks.error = (value: unknown) => {
        sfx.error();
        return typeof originalError === "function"
          ? (originalError as (v: unknown) => unknown)(value)
          : originalError;
      };
      return originalPromise(input, callbacks);
    };
  }
}
