import { existsSync } from "node:fs";
import { join } from "node:path";

const rootDir = new URL("../", import.meta.url).pathname;
const binaryPath = join(rootDir, "vendor/paulxstretch/build/PaulXStretchCli_artefacts/Release/PaulXStretchCli");

if (!existsSync(binaryPath)) {
  console.error("Native CLI is missing.");
  console.error("Run `pnpm native:build` after installing CMake.");
  process.exit(1);
}

console.log(`Verified native CLI at ${binaryPath}`);
