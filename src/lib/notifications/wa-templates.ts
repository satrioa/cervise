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

/**
 * Nama template dari env global; tiga env lama tetap jadi fallback supaya
 * deploy lama tidak langsung berhenti mengirim sebelum env baru diset.
 */
const REGISTRY: Record<WaTemplateKey, WaTemplate> = {
  servis_created_customer: {
    name: process.env.META_WA_TEMPLATE_SERVIS_MASUK ?? process.env.META_WA_TEMPLATE_INVOICE ?? "",
    language: "id",
    build: (input) => buildServisMasukParameters(input),
  },
  servis_status_customer: {
    name: process.env.META_WA_TEMPLATE_SERVIS_SIAP ?? process.env.META_WA_TEMPLATE_STATUS ?? "",
    language: "id",
    build: (input) => buildServisStatusParameters(input),
  },
  servis_created_technician: {
    name: process.env.META_WA_TEMPLATE_TEKNISI ?? process.env.META_WA_TEMPLATE_TECHNICIAN ?? "",
    language: "en",
    build: (input) => buildTechnicianParameters(input),
  },
  shift_open: {
    name: process.env.META_WA_TEMPLATE_SHIFT_OPEN ?? "",
    language: "id",
    build: (input) => buildShiftOpenParameters(input as ShiftMessageInput),
  },
  shift_closed: {
    name: process.env.META_WA_TEMPLATE_SHIFT_CLOSE ?? "",
    language: "en",
    build: (input) => buildShiftClosedParameters(input as ShiftMessageInput),
  },
};

export function getWaTemplate(key: WaTemplateKey): WaTemplate {
  return REGISTRY[key];
}
