import Anthropic from "@anthropic-ai/sdk";
import {
  buildSystemPrompt,
  buildMessages,
  type ConversationMessage,
} from "./prompt";
import { parseAssistantResponse } from "./responseParser";
import type { AssistantPayload } from "@/lib/commands/canvasTypes";
import type { ParseResult } from "@/lib/commands/validateCommandPayload";

// ── Configuration ────────────────────────────────────────────────────

export interface ClaudeClientOptions {
  /** Anthropic API key. Falls back to ANTHROPIC_API_KEY env var. */
  apiKey?: string;
  /** Model identifier. Defaults to "claude-sonnet-4-20250514". */
  model?: string;
  /** Max tokens for the response. */
  maxTokens?: number;
  /** Temperature (0-1). Lower = more deterministic. */
  temperature?: number;
  /** Optional lesson topic, e.g. "fracciones". */
  topic?: string;
  /**
   * Inject a pre-built Anthropic client (useful for testing).
   * When provided, `apiKey` is not required.
   */
  anthropicClient?: Anthropic;
}

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.3;

// ── Client class ─────────────────────────────────────────────────────

export class ClaudeClient {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private systemPrompt: string;

  constructor(options: ClaudeClientOptions = {}) {
    if (options.anthropicClient) {
      this.client = options.anthropicClient;
    } else {
      const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error(
          "Missing Anthropic API key. Provide it via options.apiKey or the ANTHROPIC_API_KEY environment variable.",
        );
      }
      this.client = new Anthropic({ apiKey });
    }

    this.model = options.model ?? DEFAULT_MODEL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.temperature = options.temperature ?? DEFAULT_TEMPERATURE;
    this.systemPrompt = buildSystemPrompt(options.topic);
  }

  // ── Public API ───────────────────────────────────────────────────

  /**
   * Send a user message (plus conversation history) to Claude and return
   * a validated `AssistantPayload`.
   *
   * Throws on network/API errors.  Returns a `ParseResult` so callers
   * can distinguish between a valid payload and a malformed model response
   * without needing try/catch for parse failures.
   */
  async sendMessage(
    userMessage: string,
    history: ConversationMessage[] = [],
  ): Promise<ParseResult<AssistantPayload>> {
    const messages = buildMessages(history, userMessage);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      system: this.systemPrompt,
      messages,
    });

    const rawText = this.extractText(response);
    return parseAssistantResponse(rawText);
  }

  // ── Internals ────────────────────────────────────────────────────

  /**
   * Pull the text content out of a Claude Message response.
   * If the response contains no text blocks we return an empty string,
   * which will gracefully fail validation downstream.
   */
  private extractText(response: Anthropic.Message): string {
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );
    return textBlocks.map((b) => b.text).join("");
  }
}

// ── Factory helper ───────────────────────────────────────────────────

/**
 * Convenience factory – creates a `ClaudeClient` using env-based
 * credentials. Useful in server actions / API routes.
 */
export function createClaudeClient(
  options: Omit<ClaudeClientOptions, "apiKey"> = {},
): ClaudeClient {
  return new ClaudeClient(options);
}
