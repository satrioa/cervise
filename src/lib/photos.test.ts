import { describe, expect, it } from "vitest";
import {
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  PHOTO_BUCKET,
  accountPhotoPath,
  formatBytes,
  initialsOf,
  isSafeObjectPath,
  publicPhotoUrl,
  tenantLogoPath,
  validatePhotoFile,
} from "./photos";

describe("validatePhotoFile", () => {
  const jpeg = { name: "foto.jpg", type: "image/jpeg", size: 120_000 };

  it("accepts the three allowed image types", () => {
    for (const type of ALLOWED_PHOTO_TYPES) {
      const result = validatePhotoFile({ name: "x", type, size: 1000 });
      expect(result.ok).toBe(true);
    }
  });

  it("maps each mime type to the matching extension", () => {
    expect(validatePhotoFile({ ...jpeg, type: "image/jpeg" })).toEqual({ ok: true, extension: "jpg" });
    expect(validatePhotoFile({ ...jpeg, type: "image/png" })).toEqual({ ok: true, extension: "png" });
    expect(validatePhotoFile({ ...jpeg, type: "image/webp" })).toEqual({ ok: true, extension: "webp" });
  });

  it("tolerates mime types with odd casing or padding", () => {
    expect(validatePhotoFile({ ...jpeg, type: "  IMAGE/PNG " })).toEqual({ ok: true, extension: "png" });
  });

  it("rejects types the bucket would also reject", () => {
    // SVG is rejected deliberately: it can carry script, and it renders inline.
    // A .jpg extension on a PDF must not slip through either.
    for (const type of ["image/svg+xml", "application/pdf", "text/html", "image/gif", ""]) {
      const result = validatePhotoFile({ ...jpeg, type });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("Format tidak didukung");
    }
  });

  it("rejects an empty file", () => {
    const result = validatePhotoFile({ ...jpeg, size: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("kosong");
  });

  it("accepts a file exactly at the limit and rejects one byte over", () => {
    expect(validatePhotoFile({ ...jpeg, size: MAX_PHOTO_BYTES }).ok).toBe(true);

    const over = validatePhotoFile({ ...jpeg, size: MAX_PHOTO_BYTES + 1 });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toContain("2.0 MB");
  });

  it("does not depend on the original filename", () => {
    // The name is never used for the stored path, so a hostile name is fine.
    const result = validatePhotoFile({ name: "../../etc/passwd.exe", type: "image/png", size: 10 });
    expect(result).toEqual({ ok: true, extension: "png" });
  });
});

describe("object paths", () => {
  it("nests account photos under the user id", () => {
    const path = accountPhotoPath("user-123", "png");
    expect(path).toMatch(/^avatars\/user-123\/[a-f0-9]{24}\.png$/);
  });

  it("nests tenant logos under the org id", () => {
    const path = tenantLogoPath("org-456", "jpg");
    expect(path).toMatch(/^tenant-logos\/org-456\/[a-f0-9]{24}\.jpg$/);
  });

  it("never reuses a filename, so old links stop resolving after a change", () => {
    const seen = new Set(Array.from({ length: 200 }, () => accountPhotoPath("user-1", "png")));
    expect(seen.size).toBe(200);
  });

  it("never leaks the original filename into the path", () => {
    const path = accountPhotoPath("user-123", "png");
    // Only the extension separator survives; the stem is the random segment.
    expect(path.split(".")).toHaveLength(2);
    expect(path.endsWith(".png")).toBe(true);
    expect(path).toBe(`avatars/user-123/${path.split("/")[2].replace(".png", "")}.png`);
  });
});

describe("isSafeObjectPath", () => {
  it("accepts paths this module generates", () => {
    expect(isSafeObjectPath(accountPhotoPath("u-1", "png"))).toBe(true);
    expect(isSafeObjectPath(tenantLogoPath("o-1", "webp"))).toBe(true);
  });

  it("rejects traversal, absolute paths, and foreign hosts", () => {
    const hostile = [
      "../../etc/passwd",
      "avatars/u-1/../../../secret.png",
      "/etc/passwd.png",
      "avatars\\u-1\\x.png",
      "http://evil.example.com/x.png",
      "avatars/u-1/",
      "avatars/u-1/x.png/../../y.png",
      "uploads/other.png",
      "",
      null,
      undefined,
    ];
    for (const value of hostile) {
      expect(isSafeObjectPath(value as string | null)).toBe(false);
    }
  });

  it("rejects a path whose owner segment contains unexpected characters", () => {
    expect(isSafeObjectPath("avatars/u 1/x.png")).toBe(false);
    expect(isSafeObjectPath("avatars/u-1/x.png?a=1")).toBe(false);
    expect(isSafeObjectPath("avatars/u-1/x.png#f")).toBe(false);
  });
});

describe("publicPhotoUrl", () => {
  const url = "https://yvekuahqzeqxggdyjecc.supabase.co";

  it("builds a public URL for a stored path", () => {
    const path = accountPhotoPath("u-1", "png");
    expect(publicPhotoUrl(url, path)).toBe(
      `${url}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`,
    );
  });

  it("tolerates a trailing slash on the project url", () => {
    const path = accountPhotoPath("u-1", "png");
    expect(publicPhotoUrl(`${url}//`, path)).toBe(
      `${url}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`,
    );
  });

  it("returns null for missing or unsafe paths instead of building a link", () => {
    expect(publicPhotoUrl(url, null)).toBeNull();
    expect(publicPhotoUrl(url, undefined)).toBeNull();
    expect(publicPhotoUrl(url, "../../etc/passwd")).toBeNull();
    expect(publicPhotoUrl(url, "https://evil.example.com/x.png")).toBeNull();
  });
});

describe("initialsOf", () => {
  it("uses the first and last word", () => {
    expect(initialsOf("Budi Santoso")).toBe("BS");
    expect(initialsOf("Sari Wijaya")).toBe("SW");
  });

  it("uses the first two letters of a single word", () => {
    expect(initialsOf("Andi")).toBe("AN");
  });

  it("ignores extra whitespace", () => {
    expect(initialsOf("  Budi   Santoso  ")).toBe("BS");
  });

  it("falls back to a question mark rather than an empty avatar", () => {
    expect(initialsOf("")).toBe("?");
    expect(initialsOf("   ")).toBe("?");
    expect(initialsOf(null)).toBe("?");
    expect(initialsOf(undefined)).toBe("?");
  });
});

describe("formatBytes", () => {
  it("scales the unit to the size", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(120_000)).toBe("117 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});
