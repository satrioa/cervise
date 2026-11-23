import type { TemplateParameter } from "@/lib/meta-wa";
import {
  buildServisMasukParameters,
  buildServisStatusParameters,
  buildShiftClosedParameters,
  buildShiftOpenParameters,
  buildTechnicianParameters,
  type ServiceMessageInput,
  type ShiftMessageInput,
} from "./service-message";

export type WaTemplateKey =
  | "servis_created_customer"
  | "servis_status_customer"
  | "servis_created_technician"
  | "shift_open"
  | "shift_closed";

type TemplateInput = ServiceMessageInput & Partial<ShiftMessageInput>;

export type WaTemplate = {
  name: string;
  language: "id" | "en";
  build: (input: TemplateInput) => TemplateParameter[];
};

type RegistryEntry = {
  envKey: string;
  fallbackKey?: string;
  language: "id" | "en";
  build: (input: TemplateInput) => TemplateParameter[];
};

/**
 * Nama template dibaca SAAT PAKAI, bukan saat modul dimuat, supaya test dan
 * proses yang mengubah env setelah import tetap memakai nilai terbaru.
 */
const REGISTRY: Record<WaTemplateKey, RegistryEntry> = {
  servis_created_customer: {
    envKey: "META_WA_TEMPLATE_SERVIS_MASUK",
    fallbackKey: "META_WA_TEMPLATE_INVOICE",
    language: "id",
    build: (input) => buildServisMasukParameters(input),
  },
  servis_status_customer: {
    envKey: "META_WA_TEMPLATE_STATUS",
    language: "id",
    build: (input) => buildServisStatusParameters(input),
  },
  servis_created_technician: {
    envKey: "META_WA_TEMPLATE_TECHNICIAN",
    language: "en",
    build: (input) => buildTechnicianParameters(input),
  },
  shift_open: {
    envKey: "META_WA_TEMPLATE_SHIFT_OPEN",
    language: "id",
    build: (input) => buildShiftOpenParameters(input as ShiftMessageInput),
  },
  shift_closed: {
    envKey: "META_WA_TEMPLATE_SHIFT_CLOSE",
    language: "en",
    build: (input) => buildShiftClosedParameters(input as ShiftMessageInput),
  },
};

export function getWaTemplate(key: WaTemplateKey): WaTemplate {
  const entry = REGISTRY[key];
  return {
    name: process.env[entry.envKey] ?? (entry.fallbackKey ? process.env[entry.fallbackKey] ?? "" : ""),
    language: entry.language,
    build: entry.build,
  };
}
