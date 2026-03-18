import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = new URL("../", import.meta.url);

function checkCommand(command: string, args: string[] = ["--version"]) {
  const result = spawnSync(command, args, { stdio: "pipe", encoding: "utf8" });
  return {
    ok: result.status === 0,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function ensureDir(relativePath: string) {
  mkdirSync(join(rootDir.pathname, relativePath), { recursive: true });
}

const xcode = checkCommand("xcodebuild", ["-version"]);
const cmake = checkCommand("cmake", ["--version"]);
const node = checkCommand("node", ["--version"]);
const pnpm = checkCommand("pnpm", ["--version"]);

ensureDir("runtime/uploads");
ensureDir("runtime/outputs");
ensureDir("runtime/tmp");

console.log("Environment check");
console.log(`- Xcode: ${xcode.ok ? xcode.stdout.split("\n")[0] : "missing"}`);
console.log(`- Node: ${node.ok ? node.stdout : "missing"}`);
console.log(`- pnpm: ${pnpm.ok ? pnpm.stdout : "missing"}`);

if (!xcode.ok) {
  console.error("Xcode is required. Install it from the App Store and run `xcode-select --install` if needed.");
  process.exit(1);
}

if (!cmake.ok) {
  console.error("CMake is required to build the native PaulXStretch CLI.");
  console.error("Install it with: brew install cmake");
  process.exit(1);
}

console.log(`- CMake: ${cmake.stdout.split("\n")[0]}`);
console.log("Runtime folders are ready.");
