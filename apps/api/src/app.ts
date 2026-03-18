import { createWriteStream, createReadStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { extname } from "node:path";
import { randomUUID } from "node:crypto";

import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";

import {
  createRenderJobSchema,
  previewDurationLimit,
  renderStatusSchema,
  type CreateRenderJobInput,
  type RenderStatus,
} from "@xstretch/shared";

import { inspectAudioFile, runNativeRender } from "./native.js";
import { resolveRuntimePaths } from "./paths.js";
import { RuntimeStore, type JobRecord } from "./store.js";

export interface AppOptions {
  runtimeDir?: string;
  nativeBinaryPath?: string;
}

function makeJobResponse(job: JobRecord): RenderStatus {
  return renderStatusSchema.parse({
    jobId: job.jobId,
    status: job.status,
    mode: job.mode,
    inputId: job.inputId,
    progressPercent: job.progressPercent,
    outputFileId: job.outputFileId,
    error: job.error,
  });
}

function fileMimeType(fileName: string) {
  return extname(fileName).toLowerCase() === ".wav" ? "audio/wav" : "application/octet-stream";
}

export async function createApp(options: AppOptions = {}) {
  const app = Fastify({ logger: false });
  const paths = resolveRuntimePaths(options.runtimeDir, options.nativeBinaryPath);
  const store = new RuntimeStore();

  await app.register(cors, { origin: true });
  await app.register(multipart);

  app.get("/api/health", async () => ({ ok: true }));

  app.post("/api/uploads", async (request, reply) => {
    const upload = await request.file();

    if (!upload) {
      return reply.code(400).send({ error: "Expected a multipart file upload." });
    }

    const extension = extname(upload.filename) || ".bin";
    const fileId = `input_${randomUUID()}`;
    const targetPath = `${paths.uploadsDir}/${fileId}${extension}`;

    await pipeline(upload.file, createWriteStream(targetPath));

    try {
      const metadata = await inspectAudioFile(paths.nativeBinaryPath, targetPath);

      store.putFile({
        fileId,
        kind: "input",
        path: targetPath,
        fileName: upload.filename,
        mimeType: upload.mimetype || fileMimeType(upload.filename),
      });

      return reply.send({
        inputId: fileId,
        fileId,
        fileName: upload.filename,
        metadata,
      });
    } catch (error) {
      await unlink(targetPath).catch(() => undefined);
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Could not inspect uploaded audio",
      });
    }
  });

  app.post("/api/renders", async (request, reply) => {
    const parsed = createRenderJobSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: parsed.error.flatten(),
      });
    }

    const body = parsed.data;
    const inputFile = store.getFile(body.inputId);

    if (!inputFile || inputFile.kind !== "input") {
      return reply.code(404).send({ error: "Input file not found." });
    }

    const jobId = `job_${randomUUID()}`;
    const outputExtension = ".wav";
    const requestedOutputPath = `${paths.outputsDir}/${jobId}${outputExtension}`;

    const initialJob: JobRecord = {
      jobId,
      status: "queued",
      mode: body.mode,
      inputId: body.inputId,
      progressPercent: 0,
      outputFileId: null,
      error: null,
      outputPath: null,
    };

    store.putJob(initialJob);

    void startRenderJob({
      store,
      nativeBinaryPath: paths.nativeBinaryPath,
      tempDir: paths.tempDir,
      body,
      jobId,
      inputPath: inputFile.path,
      outputPath: requestedOutputPath,
    });

    return reply.code(202).send(makeJobResponse(initialJob));
  });

  app.get("/api/renders/:jobId", async (request, reply) => {
    const job = store.getJob((request.params as { jobId: string }).jobId);

    if (!job) {
      return reply.code(404).send({ error: "Render job not found." });
    }

    return reply.send(makeJobResponse(job));
  });

  app.get("/api/files/:fileId", async (request, reply) => {
    const file = store.getFile((request.params as { fileId: string }).fileId);

    if (!file) {
      return reply.code(404).send({ error: "File not found." });
    }

    reply.type(file.mimeType);
    reply.header("Content-Disposition", `inline; filename="${file.fileName}"`);
    return reply.send(createReadStream(file.path));
  });

  return app;
}

async function startRenderJob(options: {
  store: RuntimeStore;
  nativeBinaryPath: string;
  tempDir: string;
  body: CreateRenderJobInput;
  jobId: string;
  inputPath: string;
  outputPath: string;
}) {
  options.store.updateJob(options.jobId, (job) => ({
    ...job,
    status: "running",
    error: null,
  }));

  try {
    let finalOutputPath = options.outputPath;

    await runNativeRender({
      nativeBinaryPath: options.nativeBinaryPath,
      tempDir: options.tempDir,
      request: {
        ...options.body,
        inputPath: options.inputPath,
        outputPath: options.outputPath,
        maxOutputDurationSec:
          options.body.mode === "preview"
            ? previewDurationLimit(options.body)
            : options.body.maxOutputDurationSec,
      },
      onEvent: (event) => {
        if (event.type === "progress") {
          options.store.updateJob(options.jobId, (job) => ({
            ...job,
            status: "running",
            progressPercent: event.percent,
          }));
        }

        if (event.type === "complete") {
          finalOutputPath = event.outputPath;
        }

        if (event.type === "error") {
          options.store.updateJob(options.jobId, (job) => ({
            ...job,
            status: "failed",
            error: event.error,
          }));
        }
      },
    });

    const outputFileId = `${options.body.mode}_${randomUUID()}`;
    const outputFileName = `${options.jobId}.wav`;

    options.store.putFile({
      fileId: outputFileId,
      kind: options.body.mode,
      path: finalOutputPath,
      fileName: outputFileName,
      mimeType: "audio/wav",
    });

    options.store.updateJob(options.jobId, (job) => ({
      ...job,
      status: "succeeded",
      progressPercent: 100,
      outputFileId,
      outputPath: finalOutputPath,
      error: null,
    }));
  } catch (error) {
    options.store.updateJob(options.jobId, (job) => ({
      ...job,
      status: "failed",
      error: error instanceof Error ? error.message : "Render failed",
    }));
  }
}
