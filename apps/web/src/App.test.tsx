import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App.js";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

describe("App", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    user = userEvent.setup();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("keeps preview disabled until an upload succeeds", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        inputId: "input_1",
        fileId: "input_1",
        fileName: "voice.wav",
        metadata: {
          ok: true,
          inputPath: "/tmp/voice.wav",
          formatName: "WAV",
          sampleRate: 44100,
          durationSec: 8,
          channels: 1,
          bitsPerSample: 16,
        },
      }),
    );

    render(<App />);

    const previewButton = screen.getByRole("button", { name: "Render Preview" });
    expect(previewButton).toHaveProperty("disabled", true);

    const input = screen.getByLabelText("Upload audio file");
    const file = new File([new Uint8Array([82, 73, 70, 70])], "voice.wav", { type: "audio/wav" });
    await user.upload(input, file);

    await waitFor(() => expect(previewButton).toHaveProperty("disabled", false));
  });

  it("shows render status updates and a download link when export completes", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          inputId: "input_1",
          fileId: "input_1",
          fileName: "voice.wav",
          metadata: {
            ok: true,
            inputPath: "/tmp/voice.wav",
            formatName: "WAV",
            sampleRate: 44100,
            durationSec: 8,
            channels: 1,
            bitsPerSample: 16,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          jobId: "job_1",
          status: "queued",
          mode: "export",
          inputId: "input_1",
          progressPercent: 0,
          outputFileId: null,
          error: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          jobId: "job_1",
          status: "succeeded",
          mode: "export",
          inputId: "input_1",
          progressPercent: 100,
          outputFileId: "export_1",
          error: null,
        }),
      );

    render(<App />);

    const input = screen.getByLabelText("Upload audio file");
    const file = new File([new Uint8Array([82, 73, 70, 70])], "voice.wav", { type: "audio/wav" });
    await user.upload(input, file);

    const exportButton = await screen.findByRole("button", { name: "Render Export" });
    await user.click(exportButton);

    await screen.findByText("Export ready");
    await screen.findByRole("link", { name: "Download Export" });
  });
});
