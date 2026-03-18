import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface RuntimePaths {
  rootDir: string;
  runtimeDir: string;
  uploadsDir: string;
  outputsDir: string;
  tempDir: string;
  nativeBinaryPath: string;
}

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "../../..");

export function resolveRuntimePaths(runtimeDir = join(repoRoot, "runtime"), nativeBinaryPath?: string): RuntimePaths {
  const uploadsDir = join(runtimeDir, "uploads");
  const outputsDir = join(runtimeDir, "outputs");
  const tempDir = join(runtimeDir, "tmp");

  mkdirSync(uploadsDir, { recursive: true });
  mkdirSync(outputsDir, { recursive: true });
  mkdirSync(tempDir, { recursive: true });

  return {
    rootDir: repoRoot,
    runtimeDir,
    uploadsDir,
    outputsDir,
    tempDir,
    nativeBinaryPath:
      nativeBinaryPath ??
      process.env.PAULXSTRETCH_CLI ??
      join(repoRoot, "vendor/paulxstretch/build/PaulXStretchCli_artefacts/Release/PaulXStretchCli"),
  };
}
