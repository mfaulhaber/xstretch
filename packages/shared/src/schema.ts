import { z } from "zod";

export const renderModeSchema = z.enum(["preview", "export"]);
export const outputSampleRateSchema = z.union([
  z.literal("source"),
  z.literal(44100),
  z.literal(48000),
]);

const renderSettingsObjectSchema = z.object({
  stretchAmount: z.number().min(0.1).max(1024).default(2.0),
  fftSizeNormalized: z.number().min(0).max(1).default(0.7),
  pitchShiftSemitones: z.number().min(-24).max(24).default(0),
  frequencySpread: z.number().min(0).max(1).default(0),
  playRangeStart: z.number().min(0).max(1).default(0),
  playRangeEnd: z.number().min(0).max(1).default(1),
  maxOutputDurationSec: z.number().min(5).max(600).default(120),
  outputSampleRate: outputSampleRateSchema.default("source"),
});

function validatePlayRange(
  value: { playRangeStart: number; playRangeEnd: number },
  ctx: z.RefinementCtx,
) {
  if (value.playRangeEnd <= value.playRangeStart) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["playRangeEnd"],
      message: "Play range end must be greater than play range start.",
    });
  }
}

export const renderSettingsSchema = renderSettingsObjectSchema.superRefine(validatePlayRange);

export const createRenderJobSchema = renderSettingsObjectSchema
  .extend({
    inputId: z.string().min(1),
    mode: renderModeSchema,
  })
  .superRefine(validatePlayRange);

export const nativeRenderRequestSchema = renderSettingsObjectSchema
  .extend({
    inputPath: z.string().min(1),
    outputPath: z.string().min(1),
    mode: renderModeSchema,
  })
  .superRefine(validatePlayRange);

export const inspectResultSchema = z.object({
  ok: z.boolean(),
  inputPath: z.string(),
  formatName: z.string().optional(),
  sampleRate: z.number().optional(),
  durationSec: z.number().optional(),
  channels: z.number().optional(),
  bitsPerSample: z.number().optional(),
  error: z.string().optional(),
});

export const nativeEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("started"),
    outputPath: z.string(),
  }),
  z.object({
    type: z.literal("progress"),
    percent: z.number().min(0).max(100),
  }),
  z.object({
    type: z.literal("complete"),
    outputPath: z.string(),
  }),
  z.object({
    type: z.literal("error"),
    error: z.string(),
  }),
]);

export const uploadResponseSchema = z.object({
  inputId: z.string(),
  fileId: z.string(),
  fileName: z.string(),
  metadata: inspectResultSchema.extend({
    ok: z.literal(true),
    formatName: z.string(),
    sampleRate: z.number(),
    durationSec: z.number(),
    channels: z.number(),
    bitsPerSample: z.number(),
  }),
});

export const renderStatusSchema = z.object({
  jobId: z.string(),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  mode: renderModeSchema,
  inputId: z.string(),
  progressPercent: z.number().min(0).max(100),
  outputFileId: z.string().nullable(),
  error: z.string().nullable(),
});

export type RenderSettings = z.infer<typeof renderSettingsSchema>;
export type CreateRenderJobInput = z.infer<typeof createRenderJobSchema>;
export type NativeRenderRequest = z.infer<typeof nativeRenderRequestSchema>;
export type InspectResult = z.infer<typeof inspectResultSchema>;
export type NativeEvent = z.infer<typeof nativeEventSchema>;
export type UploadResponse = z.infer<typeof uploadResponseSchema>;
export type RenderStatus = z.infer<typeof renderStatusSchema>;

export const defaultRenderSettings: RenderSettings = renderSettingsSchema.parse({});

export function normalizeRenderSettings(input: Partial<RenderSettings>): RenderSettings {
  return renderSettingsSchema.parse({ ...defaultRenderSettings, ...input });
}

export function previewDurationLimit(settings: RenderSettings) {
  return Math.min(settings.maxOutputDurationSec, 15);
}
