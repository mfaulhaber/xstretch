import { once } from "node:events";
import { unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import {
  inspectResultSchema,
  nativeEventSchema,
  nativeRenderRequestSchema,
  type InspectResult,
  type NativeEvent,
  type NativeRenderRequest,
} from "@xstretch/shared";

export async function inspectAudioFile(nativeBinaryPath: string, inputPath: string): Promise<InspectResult> {
  const child = spawn(nativeBinaryPath, ["inspect", "--input", inputPath, "--json"], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });

  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const [exitCode] = (await once(child, "close")) as [number | null];

  const payload = stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .at(-1);

  if (!payload) {
    throw new Error(stderr || "Native inspect produced no output");
  }

  const parsed = inspectResultSchema.parse(JSON.parse(payload));

  if (exitCode !== 0 || !parsed.ok) {
    throw new Error(parsed.error ?? (stderr || "Native inspect failed"));
  }

  return parsed;
}

export async function runNativeRender(options: {
  nativeBinaryPath: string;
  tempDir: string;
  request: NativeRenderRequest;
  onEvent: (event: NativeEvent) => void;
}) {
  const request = nativeRenderRequestSchema.parse(options.request);
  const requestPath = join(options.tempDir, `${randomUUID()}.json`);

  await writeFile(requestPath, JSON.stringify(request, null, 2), "utf8");

  const child = spawn(options.nativeBinaryPath, ["render", "--request", requestPath], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  const reader = createInterface({ input: child.stdout });
  let stderr = "";
  let completedPath: string | null = null;
  let errorMessage: string | null = null;

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  reader.on("line", (line) => {
    if (!line.trim()) {
      return;
    }

    const event = nativeEventSchema.parse(JSON.parse(line));
    options.onEvent(event);

    if (event.type === "complete") {
      completedPath = event.outputPath;
    }

    if (event.type === "error") {
      errorMessage = event.error;
    }
  });

  const [exitCode] = (await once(child, "close")) as [number | null];
  await unlink(requestPath).catch(() => undefined);

  if (exitCode !== 0 || !completedPath) {
    throw new Error(errorMessage ?? (stderr || "Native render failed"));
  }

  return { outputPath: completedPath };
}
