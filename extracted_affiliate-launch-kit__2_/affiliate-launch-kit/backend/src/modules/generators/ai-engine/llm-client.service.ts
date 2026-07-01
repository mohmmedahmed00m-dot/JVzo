import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Thin wrapper around the Anthropic Claude Messages API (Section 5).
 * Only used when AI_USE_REAL_LLM is true (a real, non-placeholder key in prod).
 * Returns the model's text content. Throws on any failure so the caller can
 * fall back to the deterministic mock generator.
 */
@Injectable()
export class LlmClientService {
  private readonly logger = new Logger('LlmClient');
  private client: Anthropic | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({ apiKey: this.config.get<string>('ANTHROPIC_API_KEY')! });
    }
    return this.client;
  }

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    const model = 'claude-3-5-sonnet-20241022';
    this.logger.log(`Calling Claude (${model}) — user prompt ${userPrompt.length} chars`);
    const response = await this.getClient().messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    // Concatenate text blocks
    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as any).text)
      .join('\n');
    return text;
  }
}
