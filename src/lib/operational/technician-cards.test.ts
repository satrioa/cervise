import { describe, expect, it } from "vitest";
import {
  insentifEstimate,
  targetProgress,
  technicianCardFlags,
} from "./technician-cards";

describe("technicianCardFlags", () => {
  const base = {
    insentifEnabled: true,
    intensifMode: "percent",
    showTarget: true,
    showIntensif: true,
  };

  it("hides both cards when branch insentif is off", () => {
    expect(technicianCardFlags({ ...base, insentifEnabled: false })).toEqual({
      showTarget: false,
      showIntensif: false,
    });
  });

  it("hides Intensif Saya in flat mode", () => {
    expect(technicianCardFlags({ ...base, intensifMode: "flat" })).toEqual({
      showTarget: true,
      showIntensif: false,
    });
  });

  it("honors each admin toggle independently", () => {
    expect(technicianCardFlags({ ...base, showTarget: false })).toEqual({
      showTarget: false,
      showIntensif: true,
    });
    expect(technicianCardFlags({ ...base, showIntensif: false })).toEqual({
      showTarget: true,
      showIntensif: false,
    });
  });
});

describe("targetProgress", () => {
  it("counts completed services for jumlah_servis", () => {
    expect(targetProgress({ type: "jumlah_servis", value: 10, selesai: 4, penghasilan: 999 })).toEqual({
      current: 4, target: 10, percent: 40,
    });
  });

  it("uses revenue for penghasilan", () => {
    expect(targetProgress({ type: "penghasilan", value: 1_000_000, selesai: 3, penghasilan: 250_000 })).toEqual({
      current: 250_000, target: 1_000_000, percent: 25,
    });
  });

  it("returns 0% without a target", () => {
    expect(targetProgress({ type: "penghasilan", value: null, selesai: 3, penghasilan: 250_000 }).percent).toBe(0);
    expect(targetProgress({ type: "jumlah_servis", value: 0, selesai: 3, penghasilan: 0 }).percent).toBe(0);
  });
});

describe("insentifEstimate", () => {
  it("computes percent of revenue and fixed per service", () => {
    expect(insentifEstimate({ mode: "percent", value: 5, selesai: 2, penghasilan: 1_000_000 })).toBe(50_000);
    expect(insentifEstimate({ mode: "fixed", value: 25_000, selesai: 3, penghasilan: 0 })).toBe(75_000);
    expect(insentifEstimate({ mode: "flat", value: 300_000, selesai: 10, penghasilan: 0 })).toBe(0);
  });
});
