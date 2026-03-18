import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const rootDir = new URL("../", import.meta.url).pathname;
const binaryPath = join(rootDir, "vendor/paulxstretch/build/PaulXStretchCli_artefacts/Release/PaulXStretchCli");

function makeTinyWav() {
  const sampleRate = 44100;
  const channelCount = 1;
  const bitDepth = 16;
  const sampleCount = 128;
  const blockAlign = channelCount * (bitDepth / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = sampleCount * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitDepth, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

function runCli(args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(binaryPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("native inspect returns metadata for a valid audio file", { skip: !existsSync(binaryPath) }, async () => {
  const fixtureDir = await mkdtemp(join(tmpdir(), "xstretch-native-"));
  const inputPath = join(fixtureDir, "fixture.wav");
  await writeFile(inputPath, makeTinyWav());

  const result = await runCli(["inspect", "--input", inputPath, "--json"]);
  assert.equal(result.code, 0);

  const payload = JSON.parse(result.stdout.trim().split("\n").at(-1) ?? "{}");
  assert.equal(payload.ok, true);
  assert.equal(payload.sampleRate, 44100);
  assert.equal(payload.channels, 1);
});

test("native render produces a playable wav file", { skip: !existsSync(binaryPath) }, async () => {
  const fixtureDir = await mkdtemp(join(tmpdir(), "xstretch-native-"));
  const inputPath = join(fixtureDir, "fixture.wav");
  const outputPath = join(fixtureDir, "rendered.wav");
  const requestPath = join(fixtureDir, "request.json");

  await writeFile(inputPath, makeTinyWav());
  await writeFile(
    requestPath,
    JSON.stringify({
      inputPath,
      outputPath,
      mode: "preview",
      stretchAmount: 2,
      fftSizeNormalized: 0.7,
      pitchShiftSemitones: 0,
      frequencySpread: 0.1,
      playRangeStart: 0,
      playRangeEnd: 1,
      maxOutputDurationSec: 5,
      outputSampleRate: "source",
    }),
    "utf8",
  );

  const result = await runCli(["render", "--request", requestPath]);
  assert.equal(result.code, 0);

  const lines = result.stdout.trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(lines.at(-1)?.type, "complete");

  const output = await readFile(outputPath);
  assert.ok(output.length > 44);
  assert.equal(output.subarray(0, 4).toString("ascii"), "RIFF");
});
