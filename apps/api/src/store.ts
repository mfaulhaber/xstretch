import type { RenderStatus } from "@xstretch/shared";

export interface StoredFile {
  fileId: string;
  kind: "input" | "preview" | "export";
  path: string;
  fileName: string;
  mimeType: string;
}

export interface JobRecord extends RenderStatus {
  outputPath: string | null;
}

export class RuntimeStore {
  private readonly files = new Map<string, StoredFile>();
  private readonly jobs = new Map<string, JobRecord>();

  putFile(file: StoredFile) {
    this.files.set(file.fileId, file);
    return file;
  }

  getFile(fileId: string) {
    return this.files.get(fileId);
  }

  putJob(job: JobRecord) {
    this.jobs.set(job.jobId, job);
    return job;
  }

  getJob(jobId: string) {
    return this.jobs.get(jobId);
  }

  updateJob(jobId: string, updater: (job: JobRecord) => JobRecord) {
    const current = this.jobs.get(jobId);

    if (!current) {
      return undefined;
    }

    const next = updater(current);
    this.jobs.set(jobId, next);
    return next;
  }
}
