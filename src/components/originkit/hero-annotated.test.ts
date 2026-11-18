import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/originkit/hero-02.tsx"),
  "utf8",
);

describe("annotations hero", () => {
  it("memakai AnnotatedText underline biru pada kata multi-cabang", () => {
    expect(source).toContain('import { AnnotatedText } from "@/components/ui/annotated-text"');
    expect(source).toMatch(
      /<AnnotatedText\s+variant="underline"\s+color="text-\[#2563eb\]"[\s\S]*?>\s*multi-cabang\s*<\/AnnotatedText>/,
    );
  });
});
