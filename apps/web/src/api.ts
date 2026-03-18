import {
  createRenderJobSchema,
  renderStatusSchema,
  uploadResponseSchema,
  type CreateRenderJobInput,
  type RenderStatus,
  type UploadResponse,
} from "@xstretch/shared";

async function readJson(response: Response) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed");
  }

  return data;
}

export async function uploadAudio(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/uploads", {
    method: "POST",
    body: formData,
  });

  return uploadResponseSchema.parse(await readJson(response));
}

export async function createRenderJob(input: CreateRenderJobInput): Promise<RenderStatus> {
  const payload = createRenderJobSchema.parse(input);
  const response = await fetch("/api/renders", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return renderStatusSchema.parse(await readJson(response));
}

export async function getRenderJob(jobId: string): Promise<RenderStatus> {
  const response = await fetch(`/api/renders/${jobId}`);
  return renderStatusSchema.parse(await readJson(response));
}

export function fileUrl(fileId: string | null) {
  return fileId ? `/api/files/${fileId}` : null;
}
