#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, basename } from "node:path";

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

const [, , command, ...rest] = process.argv;

function option(name) {
  const index = rest.indexOf(name);
  return index >= 0 ? rest[index + 1] : undefined;
}

if (command === "inspect") {
  const inputPath = option("--input");

  if (!inputPath || basename(inputPath).includes("broken") || inputPath.endsWith(".bad")) {
    console.log(
      JSON.stringify({
        ok: false,
        inputPath: inputPath ?? "",
        error: "Could not open audio file",
      }),
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify({
      ok: true,
      inputPath,
      formatName: "WAV",
      sampleRate: 44100,
      durationSec: 1,
      channels: 1,
      bitsPerSample: 16,
    }),
  );
  process.exit(0);
}

if (command === "render") {
  const requestPath = option("--request");
  const request = JSON.parse(await readFile(requestPath, "utf8"));

  console.log(JSON.stringify({ type: "started", outputPath: request.outputPath }));
  console.log(JSON.stringify({ type: "progress", percent: 12 }));
  console.log(JSON.stringify({ type: "progress", percent: 76 }));

  await mkdir(dirname(request.outputPath), { recursive: true });
  await writeFile(request.outputPath, makeTinyWav());

  console.log(JSON.stringify({ type: "complete", outputPath: request.outputPath }));
  process.exit(0);
}

console.log(JSON.stringify({ type: "error", error: "Unknown command" }));
process.exit(1);
