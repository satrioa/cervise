import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Bawaan vitest 5 detik. `admin.test.ts` memindai seluruh `src/` tiga kali
  // dan `password.test.ts` mengambil 30.000 sampel; dua-duanya hijau sendirian
  // tapi melewati batas itu kalau sebelas worker jalan bersamaan di laptop
  // lambat. Naikkan batasnya, jangan percepat test-nya.
  test: {
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
