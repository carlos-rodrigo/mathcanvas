import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SpeechRecognitionService,
  type RecognitionStatus,
  type RecognitionErrorCode,
  type RecognitionResult,
} from "../SpeechRecognitionService";

// ─── Mock SpeechRecognition ───────────────────────────────────────────────────

/** Minimal mock that gives tests full control over event callbacks. */
function createMockRecognition() {
  const mock = {
    lang: "",
    interimResults: false,
    continuous: false,

    onstart: null as (() => void) | null,
    onresult: null as ((event: unknown) => void) | null,
    onerror: null as ((event: unknown) => void) | null,
    onend: null as (() => void) | null,

    start: vi.fn(() => {
      // Simulate async browser start – fires onstart on next tick
      queueMicrotask(() => mock.onstart?.());
    }),
    stop: vi.fn(() => {
      queueMicrotask(() => mock.onend?.());
    }),
    abort: vi.fn(() => {
      queueMicrotask(() => mock.onend?.());
    }),

    // ── Test helpers (not part of the real API) ──────────────────────────
    /** Simulate the browser delivering results. */
    emitResult(finals: string[], interims: string[] = [], resultIndex = 0) {
      const results: SpeechRecognitionResult[] = [
        ...finals.map((t) => mockResult(t, true)),
        ...interims.map((t) => mockResult(t, false)),
      ];
      // Make the results array look like SpeechRecognitionResultList
      const resultList = Object.assign(results, {
        item: (i: number) => results[i],
        length: results.length,
      });
      mock.onresult?.({ results: resultList, resultIndex } as unknown as SpeechRecognitionEvent);
    },

    /** Simulate an error event from the browser. */
    emitError(error: string, message = "") {
      mock.onerror?.({ error, message } as unknown as SpeechRecognitionErrorEvent);
    },
  };
  return mock;
}

function mockResult(transcript: string, isFinal: boolean): SpeechRecognitionResult {
  return {
    isFinal,
    length: 1,
    item: () => ({ transcript, confidence: 0.95 }) as SpeechRecognitionAlternative,
    0: { transcript, confidence: 0.95 } as SpeechRecognitionAlternative,
  } as SpeechRecognitionResult;
}

// ─── Tests: SpeechRecognitionService ──────────────────────────────────────────

describe("SpeechRecognitionService", () => {
  let mock: ReturnType<typeof createMockRecognition>;
  let service: SpeechRecognitionService;

  beforeEach(() => {
    mock = createMockRecognition();
    service = new SpeechRecognitionService(
      { lang: "es-AR" },
      () => mock as unknown as SpeechRecognition,
    );
  });

  // -- Construction ---------------------------------------------------------

  it("starts in idle status", () => {
    expect(service.status).toBe("idle");
    expect(service.isListening).toBe(false);
  });

  it("reports unsupported when no factory is provided and window API is absent", () => {
    const svc = new SpeechRecognitionService(
      undefined,
      undefined, // no factory → falls through to getGlobalSpeechRecognition()
    );
    // In a Node/vitest environment there is no SpeechRecognition global
    expect(svc.status).toBe("unsupported");
  });

  // -- Configuration --------------------------------------------------------

  it("passes lang, interimResults and continuous to the recognition instance", () => {
    service = new SpeechRecognitionService(
      { lang: "es-AR", interimResults: true, continuous: true },
      () => mock as unknown as SpeechRecognition,
    );
    service.start();
    expect(mock.lang).toBe("es-AR");
    expect(mock.interimResults).toBe(true);
    expect(mock.continuous).toBe(true);
  });

  it("uses defaults (es-AR, interimResults true, continuous true) when no options given", () => {
    const svc = new SpeechRecognitionService(
      undefined,
      () => mock as unknown as SpeechRecognition,
    );
    svc.start();
    expect(mock.lang).toBe("es-AR");
    expect(mock.interimResults).toBe(true);
    expect(mock.continuous).toBe(true);
  });

  // -- Start / status transitions -------------------------------------------

  it("transitions idle → starting → listening on start()", async () => {
    const statuses: RecognitionStatus[] = [];
    service.onStatusChange((s) => statuses.push(s));

    service.start();
    expect(service.status).toBe("starting");

    // Wait for the microtask that fires onstart
    await vi.waitFor(() => expect(service.status).toBe("listening"));

    expect(statuses).toEqual(["starting", "listening"]);
    expect(service.isListening).toBe(true);
  });

  it("is a no-op if start() is called while already listening", async () => {
    service.start();
    await vi.waitFor(() => expect(service.status).toBe("listening"));

    // Second start should not throw or restart
    service.start();
    expect(mock.start).toHaveBeenCalledTimes(1);
  });

  it("is a no-op if start() is called while starting", () => {
    service.start();
    expect(service.status).toBe("starting");
    service.start();
    expect(mock.start).toHaveBeenCalledTimes(1);
  });

  // -- Results ──────────────────────────────────────────────────────────────

  it("emits final transcript via onResult", async () => {
    const results: RecognitionResult[] = [];
    service.onResult((r) => results.push({ ...r }));

    service.start();
    await vi.waitFor(() => expect(service.status).toBe("listening"));

    mock.emitResult(["hola mundo"]);

    expect(results).toHaveLength(1);
    expect(results[0].finalTranscript).toBe("hola mundo");
    expect(results[0].interimTranscript).toBe("");
  });

  it("emits interim transcript via onResult", async () => {
    const results: RecognitionResult[] = [];
    service.onResult((r) => results.push({ ...r }));

    service.start();
    await vi.waitFor(() => expect(service.status).toBe("listening"));

    mock.emitResult([], ["hol"]);

    expect(results).toHaveLength(1);
    expect(results[0].interimTranscript).toBe("hol");
    expect(results[0].finalTranscript).toBe("");
  });

  it("accumulates multiple final results", async () => {
    const results: RecognitionResult[] = [];
    service.onResult((r) => results.push({ ...r }));

    service.start();
    await vi.waitFor(() => expect(service.status).toBe("listening"));

    mock.emitResult(["uno "]);
    mock.emitResult(["dos "]);

    expect(results).toHaveLength(2);
    expect(results[1].finalTranscript).toBe("uno dos ");
  });

  // -- Stop -----------------------------------------------------------------

  it("stop() transitions to idle and calls recognition.stop()", async () => {
    service.start();
    await vi.waitFor(() => expect(service.status).toBe("listening"));

    service.stop();
    expect(mock.stop).toHaveBeenCalledOnce();

    await vi.waitFor(() => expect(service.status).toBe("idle"));
  });

  it("stop() is a no-op when not active", () => {
    service.stop();
    expect(mock.stop).not.toHaveBeenCalled();
  });

  // -- Cancel ---------------------------------------------------------------

  it("cancel() aborts and resets to idle immediately", async () => {
    service.start();
    await vi.waitFor(() => expect(service.status).toBe("listening"));

    service.cancel();
    expect(mock.abort).toHaveBeenCalledOnce();
    expect(service.status).toBe("idle");
  });

  // -- Errors ---------------------------------------------------------------

  it("emits not-allowed error code on permission denial", async () => {
    const errors: { code: RecognitionErrorCode; message: string }[] = [];
    service.onError((code, message) => errors.push({ code, message }));

    service.start();
    await vi.waitFor(() => expect(service.status).toBe("listening"));

    mock.emitError("not-allowed", "Permission denied");

    expect(service.status).toBe("error");
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("not-allowed");
    expect(errors[0].message).toBe("Permission denied");
  });

  it("emits no-speech error code on silence timeout", async () => {
    const errors: { code: RecognitionErrorCode; message: string }[] = [];
    service.onError((code, message) => errors.push({ code, message }));

    service.start();
    await vi.waitFor(() => expect(service.status).toBe("listening"));

    mock.emitError("no-speech");

    expect(service.status).toBe("error");
    expect(errors[0].code).toBe("no-speech");
  });

  it("emits network error code on network failure", async () => {
    const errors: { code: RecognitionErrorCode; message: string }[] = [];
    service.onError((code, message) => errors.push({ code, message }));

    service.start();
    await vi.waitFor(() => expect(service.status).toBe("listening"));

    mock.emitError("network", "Network error");

    expect(service.status).toBe("error");
    expect(errors[0].code).toBe("network");
  });

  it("maps unknown error strings to 'unknown'", async () => {
    const errors: RecognitionErrorCode[] = [];
    service.onError((code) => errors.push(code));

    service.start();
    await vi.waitFor(() => expect(service.status).toBe("listening"));

    mock.emitError("something-weird");

    expect(errors[0]).toBe("unknown");
  });

  it("does not surface aborted errors (expected on cancel())", async () => {
    const errors: RecognitionErrorCode[] = [];
    service.onError((code) => errors.push(code));
    const statuses: RecognitionStatus[] = [];
    service.onStatusChange((s) => statuses.push(s));

    service.start();
    await vi.waitFor(() => expect(service.status).toBe("listening"));

    mock.emitError("aborted");

    // Status should NOT have moved to error
    expect(errors).toHaveLength(0);
    expect(statuses).not.toContain("error");
  });

  it("start() on unsupported service emits error but does not throw", () => {
    const svc = new SpeechRecognitionService(undefined, undefined);
    // status is already "unsupported" (no global API in test env)
    const errors: { code: RecognitionErrorCode; message: string }[] = [];
    svc.onError((code, message) => errors.push({ code, message }));

    svc.start(); // should not throw
    expect(errors).toHaveLength(1);
    expect(svc.status).toBe("unsupported");
  });

  // -- Subscriptions --------------------------------------------------------

  it("onStatusChange unsubscribe stops notifications", async () => {
    const statuses: RecognitionStatus[] = [];
    const unsub = service.onStatusChange((s) => statuses.push(s));
    unsub();

    service.start();
    await new Promise((r) => setTimeout(r, 20));

    expect(statuses).toEqual([]);
  });

  it("onResult unsubscribe stops notifications", async () => {
    const results: RecognitionResult[] = [];
    const unsub = service.onResult((r) => results.push(r));
    unsub();

    service.start();
    await vi.waitFor(() => expect(service.status).toBe("listening"));
    mock.emitResult(["hola"]);

    expect(results).toEqual([]);
  });

  it("onError unsubscribe stops notifications", async () => {
    const errors: RecognitionErrorCode[] = [];
    const unsub = service.onError((c) => errors.push(c));
    unsub();

    service.start();
    await vi.waitFor(() => expect(service.status).toBe("listening"));
    mock.emitError("not-allowed");

    expect(errors).toEqual([]);
  });

  // -- Edge: onend after error stays in error state ─────────────────────────

  it("onend after an error does not reset status to idle", async () => {
    service.start();
    await vi.waitFor(() => expect(service.status).toBe("listening"));

    mock.emitError("not-allowed", "denied");
    expect(service.status).toBe("error");

    // Browser fires onend after onerror
    mock.onend?.();
    expect(service.status).toBe("error");
  });
});
