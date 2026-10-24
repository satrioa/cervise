"use client";

/**
 * Sound UI: nada pendek yang disintesis lewat Web Audio, bukan file audio.
 *
 * Alasannya bukan malas menambah aset: satu `AudioContext` + `OscillatorNode`
 * memberi volume yang bisa diatur langsung dari slider (gain node), tanpa
 * latensi decode, tanpa request jaringan, dan tanpa biner di repo. Kalau nanti
 * mau suara asli, cukup ganti isi `playCue()`; semua call site tetap memanggil
 * `playCue("success")` dan seterusnya.
 *
 * Preferensi disimpan di `localStorage["cervise-sound"]` dan dibagikan lewat
 * store kecil di bawah (`getSoundSnapshot` + `subscribeSoundStore`) supaya
 * semua komponen yang menampilkannya membaca angka yang sama, termasuk tab
 * lain lewat event `storage`.
 */

export type CueName = "tap" | "success" | "error" | "notify";

export type SoundSettings = {
  muted: boolean;
  /** 0..100, mengikuti satuan yang ditampilkan di slider. */
  volume: number;
};

const STORAGE_KEY = "cervise-sound";

export const DEFAULT_SOUND: SoundSettings = { muted: false, volume: 50 };

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SOUND.volume;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function readSoundSettings(): SoundSettings {
  if (typeof window === "undefined") return DEFAULT_SOUND;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SOUND;
    const parsed = JSON.parse(raw) as Partial<SoundSettings> | null;
    return {
      muted: typeof parsed?.muted === "boolean" ? parsed.muted : DEFAULT_SOUND.muted,
      volume: clampVolume(parsed?.volume ?? DEFAULT_SOUND.volume),
    };
  } catch {
    return DEFAULT_SOUND;
  }
}

/**
 * Cache identitas. `useSyncExternalStore` membandingkan snapshot dengan `===`,
 * jadi objek baru tiap panggilan akan membuat render berputar tanpa henti.
 */
let cached: SoundSettings | null = null;
const listeners = new Set<() => void>();

function publish(next: SoundSettings): void {
  const changed = !cached || cached.muted !== next.muted || cached.volume !== next.volume;
  cached = next;
  if (!changed) return;
  for (const listener of listeners) listener();
}

function handleStorage(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY) return;
  publish(readSoundSettings());
}

export function getSoundSnapshot(): SoundSettings {
  if (!cached) cached = readSoundSettings();
  return cached;
}

export function subscribeSoundStore(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined" && listeners.size === 1) {
    window.addEventListener("storage", handleStorage);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined" && listeners.size === 0) {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

export function writeSoundSettings(next: SoundSettings): SoundSettings {
  const normalized: SoundSettings = { muted: next.muted, volume: clampVolume(next.volume) };
  if (typeof window === "undefined") return normalized;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Mode privat / storage penuh: preferensi tetap berlaku di sesi ini,
    // hanya tidak bertahan setelah reload.
  }
  publish(normalized);
  return normalized;
}

/**
 * Satu context untuk seluruh aplikasi. Membuat context per panggilan akan
 * menabrak batas jumlah `AudioContext` di Chrome setelah beberapa puluh cue.
 */
let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!context) {
    try {
      context = new Ctor();
    } catch {
      return null;
    }
  }
  // Chrome menangguhkan context sampai ada gesture user. Resume tidak
  // menghasilkan bunyi untuk cue ini (masih dalam gesture yang sama), tapi
  // cue berikutnya jalan.
  if (context.state === "suspended") {
    void context.resume().catch(() => {});
  }
  return context;
}

type Cue = {
  /** Frekuensi tiap nada, Hz. */
  notes: number[];
  type: OscillatorType;
  /** Jarak antar nada, detik. */
  spacing: number;
  /** Waktu luruh tiap nada, detik. */
  decay: number;
  /** Puncak gain sebelum dikalikan volume user. */
  gain: number;
};

const CUES: Record<CueName, Cue> = {
  tap: { notes: [660], type: "triangle", spacing: 0, decay: 0.07, gain: 0.5 },
  notify: { notes: [784, 1046], type: "sine", spacing: 0.09, decay: 0.2, gain: 0.5 },
  success: { notes: [659, 880, 1175], type: "sine", spacing: 0.075, decay: 0.16, gain: 0.55 },
  error: { notes: [392, 294], type: "sawtooth", spacing: 0.11, decay: 0.18, gain: 0.32 },
};

/**
 * Bunyikan cue. Aman dipanggil dari event handler mana pun: kalau preferensi
 * mute, volume 0, atau browser tidak punya Web Audio, fungsi ini tidak
 * melakukan apa-apa dan tidak melempar error.
 */
export function playCue(name: CueName): void {
  const settings = getSoundSnapshot();
  if (settings.muted || settings.volume <= 0) return;

  const ctx = audioContext();
  if (!ctx) return;

  const cue = CUES[name];
  const volume = settings.volume / 100;
  // 0.2 adalah plafon: nada UI harus terdengar, bukan menutupi media user.
  const peak = cue.gain * volume * 0.2;
  const start = ctx.currentTime + 0.01;

  cue.notes.forEach((frequency, index) => {
    const at = start + index * cue.spacing;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = cue.type;
    oscillator.frequency.setValueAtTime(frequency, at);
    // Attack singkat, lalu luruh eksponensial. Tanpa attack, speaker kecil
    // menghasilkan klik di awal nada.
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(peak, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.012 + cue.decay);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.012 + cue.decay + 0.02);
  });
}
