import { mkdtemp, chmod, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "./app.js";

const apps: Array<Awaited<ReturnType<typeof createApp>>> = [];

function makeMultipartBody(fieldName: string, fileName: string, contentType: string, content: Buffer) {
  const boundary = "----xstretchtestboundary";
  const head =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;

  return {
    boundary,
    payload: Buffer.concat([Buffer.from(head), content, Buffer.from(tail)]),
  };
}

function makeTinyWav() {
  const sampleRate = 44100;
  const channelCount = 1;
  const bitDepth = 16;
  const sampleCount = 64;
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

afterEach(async () => {
  while (apps.length > 0) {
    await apps.pop()?.close();
  }
});

describe("API integration", () => {
  it("supports upload -> render -> poll -> download", async () => {
    const runtimeDir = await mkdtemp(join(tmpdir(), "xstretch-api-"));
    const nativeCli = join(process.cwd(), "test-fixtures/mock-native-cli.mjs");
    await chmod(nativeCli, 0o755);

    const app = await createApp({
      runtimeDir,
      nativeBinaryPath: nativeCli,
    });
    apps.push(app);

    const wav = makeTinyWav();
    const multipart = makeMultipartBody("file", "input.wav", "audio/wav", wav);

    const uploadResponse = await app.inject({
      method: "POST",
      url: "/api/uploads",
      payload: multipart.payload,
      headers: {
        "content-type": `multipart/form-data; boundary=${multipart.boundary}`,
      },
    });

    expect(uploadResponse.statusCode).toBe(200);
    const uploadPayload = uploadResponse.json();
    expect(uploadPayload.inputId).toMatch(/^input_/);
    expect(uploadPayload.metadata.ok).toBe(true);

    const renderResponse = await app.inject({
      method: "POST",
      url: "/api/renders",
      payload: {
        inputId: uploadPayload.inputId,
        mode: "preview",
        stretchAmount: 2,
        fftSizeNormalized: 0.7,
        pitchShiftSemitones: 0,
        frequencySpread: 0.1,
        playRangeStart: 0,
        playRangeEnd: 1,
        maxOutputDurationSec: 30,
        outputSampleRate: "source",
      },
    });

    expect(renderResponse.statusCode).toBe(202);
    const renderPayload = renderResponse.json();

    let finalStatus = renderPayload;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const pollResponse = await app.inject({
        method: "GET",
        url: `/api/renders/${renderPayload.jobId}`,
      });

      finalStatus = pollResponse.json();

      if (finalStatus.status === "succeeded") {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    expect(finalStatus.status).toBe("succeeded");
    expect(finalStatus.outputFileId).toBeTruthy();

    const downloadResponse = await app.inject({
      method: "GET",
      url: `/api/files/${finalStatus.outputFileId}`,
    });

    expect(downloadResponse.statusCode).toBe(200);
    expect(downloadResponse.headers["content-type"]).toContain("audio/wav");
    expect(downloadResponse.rawPayload.length).toBeGreaterThan(44);
  });

  it("returns a clear validation error for unreadable uploads", async () => {
    const runtimeDir = await mkdtemp(join(tmpdir(), "xstretch-api-"));
    const nativeCli = join(process.cwd(), "test-fixtures/mock-native-cli.mjs");
    await chmod(nativeCli, 0o755);

    const app = await createApp({
      runtimeDir,
      nativeBinaryPath: nativeCli,
    });
    apps.push(app);

    const badFile = Buffer.from("not audio");
    const multipart = makeMultipartBody("file", "broken.bad", "application/octet-stream", badFile);

    const response = await app.inject({
      method: "POST",
      url: "/api/uploads",
      payload: multipart.payload,
      headers: {
        "content-type": `multipart/form-data; boundary=${multipart.boundary}`,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain("Could not open audio file");
  });
});
