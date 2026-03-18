import { useEffect, useMemo, useRef, useState } from "react";

interface WaveformRangeEditorProps {
  sourceUrl: string | null;
  durationSec: number;
  start: number;
  end: number;
  onChange: (next: { start: number; end: number }) => void;
}

function formatSeconds(value: number) {
  return `${value.toFixed(2)}s`;
}

function buildPeaks(data: Float32Array, bucketCount = 240) {
  const peaks = new Array<number>(bucketCount).fill(0);
  const bucketSize = Math.max(1, Math.floor(data.length / bucketCount));

  for (let index = 0; index < bucketCount; index += 1) {
    const bucketStart = index * bucketSize;
    const bucketEnd = Math.min(data.length, bucketStart + bucketSize);
    let max = 0;

    for (let offset = bucketStart; offset < bucketEnd; offset += 1) {
      max = Math.max(max, Math.abs(data[offset] ?? 0));
    }

    peaks[index] = max;
  }

  return peaks;
}

export function WaveformRangeEditor({
  sourceUrl,
  durationSec,
  start,
  end,
  onChange,
}: WaveformRangeEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [message, setMessage] = useState("Upload audio to generate a waveform.");

  useEffect(() => {
    if (!sourceUrl) {
      setPeaks([]);
      setMessage("Upload audio to generate a waveform.");
      return;
    }

    const AudioContextCtor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) {
      setPeaks([]);
      setMessage("Waveform analysis is unavailable in this browser.");
      return;
    }

    let cancelled = false;
    const audioContext = new AudioContextCtor();

    void (async () => {
      try {
        setMessage("Analyzing source waveform...");
        const response = await fetch(sourceUrl);
        const bytes = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(bytes.slice(0));

        if (!cancelled) {
          setPeaks(buildPeaks(audioBuffer.getChannelData(0)));
          setMessage("");
        }
      } catch {
        if (!cancelled) {
          setPeaks([]);
          setMessage("Waveform analysis failed, but range selection is still available.");
        }
      } finally {
        void audioContext.close().catch(() => undefined);
      }
    })();

    return () => {
      cancelled = true;
      void audioContext.close().catch(() => undefined);
    };
  }, [sourceUrl]);

  const selection = useMemo(
    () => ({
      startLabel: formatSeconds(durationSec * start),
      endLabel: formatSeconds(durationSec * end),
    }),
    [durationSec, end, start],
  );

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    let context: CanvasRenderingContext2D | null = null;

    try {
      context = canvas.getContext("2d");
    } catch {
      return;
    }

    if (!context) {
      return;
    }

    const width = canvas.clientWidth || 640;
    const height = canvas.clientHeight || 220;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#08141c";
    context.fillRect(0, 0, width, height);

    const startX = width * start;
    const endX = width * end;

    context.fillStyle = "rgba(15, 213, 188, 0.18)";
    context.fillRect(startX, 0, Math.max(2, endX - startX), height);

    context.strokeStyle = "rgba(15, 213, 188, 0.85)";
    context.lineWidth = 2;
    context.beginPath();

    peaks.forEach((peak, index) => {
      const x = (index / Math.max(peaks.length - 1, 1)) * width;
      const barHeight = Math.max(2, peak * (height * 0.82));
      context.moveTo(x, (height - barHeight) / 2);
      context.lineTo(x, height - (height - barHeight) / 2);
    });

    context.stroke();

    context.strokeStyle = "#f5b75a";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(startX, 0);
    context.lineTo(startX, height);
    context.moveTo(endX, 0);
    context.lineTo(endX, height);
    context.stroke();
  }, [end, peaks, start]);

  return (
    <section className="panel waveform-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Selection</p>
          <h2>Waveform Range</h2>
        </div>
        <div className="range-summary">
          <span>{selection.startLabel}</span>
          <span>{selection.endLabel}</span>
        </div>
      </div>
      <canvas className="waveform-canvas" ref={canvasRef} />
      {message ? <p className="waveform-message">{message}</p> : null}
      <div className="slider-grid">
        <label className="slider-field">
          <span>Start</span>
          <input
            aria-label="Start range"
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={start}
            onChange={(event) => {
              const nextStart = Math.min(Number(event.target.value), end - 0.001);
              onChange({ start: nextStart, end });
            }}
          />
        </label>
        <label className="slider-field">
          <span>End</span>
          <input
            aria-label="End range"
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={end}
            onChange={(event) => {
              const nextEnd = Math.max(Number(event.target.value), start + 0.001);
              onChange({ start, end: nextEnd });
            }}
          />
        </label>
      </div>
    </section>
  );
}
