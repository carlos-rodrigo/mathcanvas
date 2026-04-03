import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PlaybackState, TTSProvider, TTSVoiceOptions } from "../TTSProvider";
import { SPANISH_TUTOR_DEFAULTS } from "../TTSProvider";
import { OpenAITTSProvider } from "../OpenAITTSProvider";
import { ElevenLabsProvider } from "../ElevenLabsProvider";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Collect every state emitted by a provider. */
function trackStates(provider: TTSProvider): PlaybackState[] {
  const states: PlaybackState[] = [];
  provider.onStateChange((s) => states.push(s));
  return states;
}

// ─── TTSProvider interface & defaults ─────────────────────────────────────────

describe("TTSProvider interface", () => {
  it("SPANISH_TUTOR_DEFAULTS provides sensible classroom values", () => {
    expect(SPANISH_TUTOR_DEFAULTS.language).toBe("es");
    expect(SPANISH_TUTOR_DEFAULTS.speed).toBeLessThan(1);
    expect(SPANISH_TUTOR_DEFAULTS.speed).toBeGreaterThan(0.5);
    expect(typeof SPANISH_TUTOR_DEFAULTS.voice).toBe("string");
  });
});

// ─── ElevenLabsProvider (stub) ────────────────────────────────────────────────

describe("ElevenLabsProvider (stub)", () => {
  let provider: ElevenLabsProvider;

  beforeEach(() => {
    provider = new ElevenLabsProvider({ apiKey: "test-key" });
  });

  afterEach(() => {
    provider.stop();
  });

  it("exposes the expected name", () => {
    expect(provider.name).toBe("ElevenLabs (stub)");
  });

  it("starts in idle state", () => {
    expect(provider.state).toBe("idle");
  });

  it("transitions through loading → speaking → idle on speak()", async () => {
    const states = trackStates(provider);
    await provider.speak("Hola");
    expect(states).toEqual(["loading", "speaking", "idle"]);
    expect(provider.state).toBe("idle");
  });

  it("stop() resets to idle immediately", async () => {
    const speakPromise = provider.speak("Hola mundo");
    // Give it a tick to enter loading
    await new Promise((r) => setTimeout(r, 10));
    provider.stop();
    expect(provider.state).toBe("idle");
    await speakPromise; // should not reject
  });

  it("onStateChange returns a working unsubscribe function", async () => {
    const states: PlaybackState[] = [];
    const unsub = provider.onStateChange((s) => states.push(s));
    unsub();
    await provider.speak("Hola");
    expect(states).toEqual([]); // listener was removed
  });

  it("rapid consecutive speak() calls cancel the previous one", async () => {
    const states = trackStates(provider);
    // Fire two speaks without awaiting the first.
    const first = provider.speak("Primero");
    const second = provider.speak("Segundo");
    await Promise.all([first, second]);
    // The final state should always be idle.
    expect(provider.state).toBe("idle");
    // There should be no "error" states.
    expect(states).not.toContain("error");
  });
});

// ─── OpenAITTSProvider ────────────────────────────────────────────────────────

describe("OpenAITTSProvider", () => {
  let provider: OpenAITTSProvider;

  // Minimal browser stubs used by the provider.
  const mockPlay = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const mockPause = vi.fn();

  /** Simulate a successful OpenAI TTS API response. */
  function mockFetchSuccess() {
    const blob = new Blob(["fake-audio"], { type: "audio/mpeg" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(blob, { status: 200 }),
      ),
    );
  }

  /** Simulate a failed OpenAI TTS API response. */
  function mockFetchFailure(status = 401, body = "Unauthorized") {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(body, { status }),
      ),
    );
  }

  beforeEach(() => {
    provider = new OpenAITTSProvider({ apiKey: "sk-test" });

    // Stub URL.createObjectURL / revokeObjectURL.
    vi.stubGlobal("URL", {
      ...globalThis.URL,
      createObjectURL: vi.fn().mockReturnValue("blob:fake-url"),
      revokeObjectURL: vi.fn(),
    });

    // Stub Audio constructor.
    vi.stubGlobal(
      "Audio",
      vi.fn().mockImplementation(() => ({
        play: mockPlay,
        pause: mockPause,
        onended: null as (() => void) | null,
        onerror: null as (() => void) | null,
      })),
    );
  });

  afterEach(() => {
    provider.stop();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("exposes the expected name", () => {
    expect(provider.name).toBe("OpenAI TTS");
  });

  it("starts in idle state", () => {
    expect(provider.state).toBe("idle");
  });

  it("sends correct request to the OpenAI endpoint", async () => {
    mockFetchSuccess();

    // Override play to trigger onended so speak() resolves.
    (Audio as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const audio = {
        play: vi.fn().mockImplementation(() => {
          setTimeout(() => audio.onended?.(), 0);
          return Promise.resolve();
        }),
        pause: vi.fn(),
        onended: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      return audio;
    });

    await provider.speak("¿Cuánto es tres cuartos?");

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/speech");
    expect(init.method).toBe("POST");

    const body = JSON.parse(init.body);
    expect(body.model).toBe("tts-1");
    expect(body.voice).toBe(SPANISH_TUTOR_DEFAULTS.voice);
    expect(body.speed).toBe(SPANISH_TUTOR_DEFAULTS.speed);
    expect(body.input).toBe("¿Cuánto es tres cuartos?");
    expect(body.response_format).toBe("mp3");
  });

  it("transitions loading → speaking → idle on successful playback", async () => {
    mockFetchSuccess();

    (Audio as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const audio = {
        play: vi.fn().mockImplementation(() => {
          setTimeout(() => audio.onended?.(), 0);
          return Promise.resolve();
        }),
        pause: vi.fn(),
        onended: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      return audio;
    });

    const states = trackStates(provider);
    await provider.speak("Hola");

    expect(states).toEqual(["loading", "speaking", "idle"]);
  });

  it("transitions to error state on fetch failure", async () => {
    mockFetchFailure(500, "Internal Server Error");

    const states = trackStates(provider);
    await expect(provider.speak("Hola")).rejects.toThrow("OpenAI TTS request failed (500)");
    expect(states).toContain("error");
    expect(provider.state).toBe("error");
  });

  it("allows custom voice options per call", async () => {
    mockFetchSuccess();

    (Audio as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const audio = {
        play: vi.fn().mockImplementation(() => {
          setTimeout(() => audio.onended?.(), 0);
          return Promise.resolve();
        }),
        pause: vi.fn(),
        onended: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      return audio;
    });

    await provider.speak("Rápido", { speed: 1.2, voice: "alloy" });

    const body = JSON.parse(
      (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
    );
    expect(body.speed).toBe(1.2);
    expect(body.voice).toBe("alloy");
  });

  it("stop() cancels an in-flight request", async () => {
    // Use a fetch that never resolves until aborted.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      ),
    );

    const speakPromise = provider.speak("Cancelame");
    // Give a tick for loading state.
    await new Promise((r) => setTimeout(r, 0));
    expect(provider.state).toBe("loading");

    provider.stop();
    expect(provider.state).toBe("idle");

    // speak() resolves without throwing on abort.
    await speakPromise;
  });

  it("stop() halts active audio playback", async () => {
    mockFetchSuccess();

    let audioInstance: Record<string, unknown> = {};
    (Audio as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      audioInstance = {
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        onended: null,
        onerror: null,
      };
      return audioInstance;
    });

    const speakPromise = provider.speak("Hablando...");
    // Wait for fetch to complete and play() to be called.
    await new Promise((r) => setTimeout(r, 10));
    expect(provider.state).toBe("speaking");

    provider.stop();
    expect(provider.state).toBe("idle");
    expect(audioInstance.pause).toHaveBeenCalled();
  });

  it("respects custom baseUrl", () => {
    const custom = new OpenAITTSProvider({
      apiKey: "sk-test",
      baseUrl: "https://my-proxy.example.com/v1/",
    });

    mockFetchSuccess();

    (Audio as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const audio = {
        play: vi.fn().mockImplementation(() => {
          setTimeout(() => audio.onended?.(), 0);
          return Promise.resolve();
        }),
        pause: vi.fn(),
        onended: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      return audio;
    });

    custom.speak("test");

    // Verify the URL doesn't get a double slash.
    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toBe("https://my-proxy.example.com/v1/audio/speech");

    custom.stop();
  });

  it("onStateChange unsubscribe prevents further notifications", async () => {
    mockFetchSuccess();

    (Audio as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const audio = {
        play: vi.fn().mockImplementation(() => {
          setTimeout(() => audio.onended?.(), 0);
          return Promise.resolve();
        }),
        pause: vi.fn(),
        onended: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      return audio;
    });

    const states: PlaybackState[] = [];
    const unsub = provider.onStateChange((s) => states.push(s));

    // Unsubscribe immediately.
    unsub();

    await provider.speak("Nothing");
    expect(states).toEqual([]);
  });
});
