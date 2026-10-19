import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "./tests/mobile",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3191",
    viewport: { width: 393, height: 852 },
    trace: "retain-on-failure",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
        (process.platform === "linux" && existsSync("/usr/bin/chromium")
          ? "/usr/bin/chromium"
          : undefined),
    },
  },
  webServer: {
    command: "node mobile/scripts/serve-preview.mjs",
    url: "http://127.0.0.1:3191",
    reuseExistingServer: false,
    timeout: 20000,
  },
});
