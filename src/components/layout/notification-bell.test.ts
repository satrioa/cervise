import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("icon bell notifikasi", () => {
  it("dipasang di tiga header", () => {
    for (const file of [
      "src/components/layout/shell-chrome.tsx",
      "src/components/layout/compact-shell.tsx",
      "src/components/layout/compact-bottom-bar.tsx",
    ]) {
      expect(read(file)).toContain("<NotificationBell");
    }
  });

  it("fetch saat mount dan pakai popover", () => {
    const source = read("src/components/layout/notification-bell.tsx");
    expect(source).toContain("getNotifications()");
    expect(source).toContain("<Popover");
    expect(source).toContain("markAllNotificationsRead()");
    expect(source).toContain("window.location.assign");
  });
});
