import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("cron GitHub Actions menuju production", () => {
  const workflows = [
    ".github/workflows/service-notifications-cron.yml",
    ".github/workflows/auto-close-shifts-cron.yml",
  ];

  for (const file of workflows) {
    it(`${file} memanggil kaggo.app, bukan vercel.app`, () => {
      const source = read(file);
      expect(source).toContain("https://kaggo.app/api/cron/");
      expect(source).not.toContain("vercel.app/api/cron/");
    });
  }
});
