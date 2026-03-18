import { useEffect, useMemo, useState } from "react";

import {
  createRenderJobSchema,
  defaultRenderSettings,
  type CreateRenderJobInput,
  type RenderSettings,
  type RenderStatus,
  type UploadResponse,
} from "@xstretch/shared";

import { createRenderJob, fileUrl, getRenderJob, uploadAudio } from "./api.js";
import { WaveformRangeEditor } from "./WaveformRangeEditor.js";

function formatDuration(seconds: number) {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder.toFixed(0)}s`;
}

function renderActionLabel(mode: "preview" | "export") {
  return mode === "preview" ? "Preview" : "Export";
}

interface ControlProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}

function ControlField({ label, min, max, step, value, onChange }: ControlProps) {
  return (
    <label className="control-field">
      <span>{label}</span>
      <div className="control-inputs">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
        <input type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      </div>
    </label>
  );
}

export default function App() {
  const [upload, setUpload] = useState<UploadResponse | null>(null);
  const [settings, setSettings] = useState<RenderSettings>(defaultRenderSettings);
  const [currentJob, setCurrentJob] = useState<RenderStatus | null>(null);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [exportFileId, setExportFileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const sourceUrl = fileUrl(upload?.fileId ?? null);
  const previewUrl = fileUrl(previewFileId);
  const exportUrl = fileUrl(exportFileId);
  const isBusy = currentJob ? currentJob.status === "queued" || currentJob.status === "running" : false;

  useEffect(() => {
    if (!currentJob || (currentJob.status !== "queued" && currentJob.status !== "running")) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const next = await getRenderJob(currentJob.jobId);

        if (cancelled) {
          return;
        }

        setCurrentJob(next);

        if (next.status === "succeeded" && next.outputFileId) {
          if (next.mode === "preview") {
            setPreviewFileId(next.outputFileId);
          } else {
            setExportFileId(next.outputFileId);
          }
        }

        if (next.status === "failed") {
          setError(next.error ?? "Render failed.");
        }
      } catch (pollError) {
        if (!cancelled) {
          setError(pollError instanceof Error ? pollError.message : "Could not poll render status.");
        }
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [currentJob]);

  const currentStatus = useMemo(() => {
    if (!currentJob) {
      return "Idle";
    }

    if (currentJob.status === "queued") {
      return `${renderActionLabel(currentJob.mode)} queued...`;
    }

    if (currentJob.status === "running") {
      return `${renderActionLabel(currentJob.mode)} running: ${Math.round(currentJob.progressPercent)}%`;
    }

    if (currentJob.status === "succeeded") {
      return `${renderActionLabel(currentJob.mode)} ready`;
    }

    return currentJob.error ?? `${renderActionLabel(currentJob.mode)} failed`;
  }, [currentJob]);

  async function handleUpload(file: File) {
    setIsUploading(true);
    setError(null);
    setUpload(null);
    setCurrentJob(null);
    setPreviewFileId(null);
    setExportFileId(null);
    setSettings(defaultRenderSettings);

    try {
      const response = await uploadAudio(file);
      setUpload(response);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleRender(mode: "preview" | "export") {
    if (!upload) {
      return;
    }

    setError(null);

    try {
      const payload: CreateRenderJobInput = createRenderJobSchema.parse({
        ...settings,
        inputId: upload.inputId,
        mode,
      });

      const response = await createRenderJob(payload);
      setCurrentJob(response);
    } catch (renderError) {
      setError(renderError instanceof Error ? renderError.message : "Render failed.");
    }
  }

  return (
    <main className="app-shell">
      <section className="hero panel">
        <div className="hero-copy">
          <p className="eyebrow">Local PaulXStretch MVP</p>
          <h1>XStretch</h1>
          <p className="hero-text">
            Feed a source sound into the native PaulXStretch engine, sculpt a focused set of controls, and audition explicit preview renders before exporting the full pass.
          </p>
        </div>
        <div className="hero-status">
          <span className="status-pill">{currentStatus}</span>
          <p>Frontend on Vite. Audio rendering stays local on your Mac.</p>
        </div>
      </section>

      <section className="grid">
        <section className="panel upload-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Input</p>
              <h2>Source Audio</h2>
            </div>
          </div>
          <label className="upload-zone">
            <input
              aria-label="Upload audio file"
              type="file"
              accept="audio/*,.wav,.aiff,.aif,.flac,.ogg,.mp3"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleUpload(file);
                }
              }}
            />
            <span>{isUploading ? "Uploading and inspecting..." : "Drop audio here or choose a file"}</span>
          </label>

          {upload ? (
            <div className="metadata-card">
              <div className="metadata-grid">
                <div>
                  <span>File</span>
                  <strong>{upload.fileName}</strong>
                </div>
                <div>
                  <span>Duration</span>
                  <strong>{formatDuration(upload.metadata.durationSec)}</strong>
                </div>
                <div>
                  <span>Sample rate</span>
                  <strong>{upload.metadata.sampleRate} Hz</strong>
                </div>
                <div>
                  <span>Channels</span>
                  <strong>{upload.metadata.channels}</strong>
                </div>
              </div>
              {sourceUrl ? <audio controls src={sourceUrl} className="audio-player" /> : null}
            </div>
          ) : (
            <p className="muted">The upload route returns metadata and an opaque file ID; the browser never sees a raw filesystem path.</p>
          )}
        </section>

        <section className="panel controls-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Controls</p>
              <h2>Stretch Settings</h2>
            </div>
          </div>

          <ControlField
            label="Stretch Amount"
            min={0.1}
            max={1024}
            step={0.1}
            value={settings.stretchAmount}
            onChange={(stretchAmount) => setSettings((current) => ({ ...current, stretchAmount }))}
          />
          <ControlField
            label="Texture / FFT"
            min={0}
            max={1}
            step={0.01}
            value={settings.fftSizeNormalized}
            onChange={(fftSizeNormalized) => setSettings((current) => ({ ...current, fftSizeNormalized }))}
          />
          <ControlField
            label="Pitch Shift"
            min={-24}
            max={24}
            step={0.1}
            value={settings.pitchShiftSemitones}
            onChange={(pitchShiftSemitones) => setSettings((current) => ({ ...current, pitchShiftSemitones }))}
          />
          <ControlField
            label="Frequency Spread"
            min={0}
            max={1}
            step={0.01}
            value={settings.frequencySpread}
            onChange={(frequencySpread) => setSettings((current) => ({ ...current, frequencySpread }))}
          />
          <ControlField
            label="Max Output Duration"
            min={5}
            max={600}
            step={1}
            value={settings.maxOutputDurationSec}
            onChange={(maxOutputDurationSec) => setSettings((current) => ({ ...current, maxOutputDurationSec }))}
          />

          <label className="select-field">
            <span>Output Sample Rate</span>
            <select
              value={String(settings.outputSampleRate)}
              onChange={(event) => {
                const nextValue = event.target.value === "source" ? "source" : Number(event.target.value);
                setSettings((current) => ({ ...current, outputSampleRate: nextValue as RenderSettings["outputSampleRate"] }));
              }}
            >
              <option value="source">Source</option>
              <option value="44100">44.1 kHz</option>
              <option value="48000">48 kHz</option>
            </select>
          </label>
        </section>
      </section>

      <WaveformRangeEditor
        sourceUrl={sourceUrl}
        durationSec={upload?.metadata.durationSec ?? 0}
        start={settings.playRangeStart}
        end={settings.playRangeEnd}
        onChange={({ start, end }) =>
          setSettings((current) => ({
            ...current,
            playRangeStart: start,
            playRangeEnd: end,
          }))
        }
      />

      <section className="grid">
        <section className="panel preview-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Preview</p>
              <h2>Explicit Preview Render</h2>
            </div>
          </div>
          <p className="muted">Preview renders use the current play range, one pass only, and cap output to 15 seconds.</p>
          <button className="action-button" disabled={!upload || isBusy || isUploading} onClick={() => void handleRender("preview")}>
            Render Preview
          </button>
          {previewUrl ? <audio controls src={previewUrl} className="audio-player" /> : <p className="muted">No preview rendered yet.</p>}
        </section>

        <section className="panel export-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Export</p>
              <h2>Full Output</h2>
            </div>
          </div>
          <p className="muted">Exports render as 24-bit WAV and respect the selected max output duration.</p>
          <button className="action-button secondary" disabled={!upload || isBusy || isUploading} onClick={() => void handleRender("export")}>
            Render Export
          </button>
          {exportUrl ? (
            <a className="download-link" href={exportUrl} download>
              Download Export
            </a>
          ) : (
            <p className="muted">No export rendered yet.</p>
          )}
        </section>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}
    </main>
  );
}
