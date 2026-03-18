import { existsSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = new URL("../", import.meta.url).pathname;
const sourceDir = join(rootDir, "vendor/paulxstretch");
const buildDir = join(sourceDir, "build");
const config = "Release";

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    encoding: "utf8",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function commandExists(command: string) {
  const result = spawnSync(command, ["--version"], { stdio: "pipe", encoding: "utf8" });
  return result.status === 0;
}

if (!commandExists("cmake")) {
  console.error("CMake is required before building the native CLI.");
  console.error("Install it with: brew install cmake");
  process.exit(1);
}

run("cmake", ["-S", sourceDir, "-B", buildDir, `-DCMAKE_BUILD_TYPE=${config}`]);
run("cmake", [
  "--build",
  buildDir,
  "--config",
  config,
  "--target",
  "PaulXStretchCli",
  "-j",
  String(availableParallelism()),
]);

const binaryPath = join(buildDir, "PaulXStretchCli_artefacts", config, "PaulXStretchCli");

if (!existsSync(binaryPath)) {
  console.error(`Native CLI build completed, but ${binaryPath} was not found.`);
  process.exit(1);
}

console.log(`Native CLI ready at ${binaryPath}`);
