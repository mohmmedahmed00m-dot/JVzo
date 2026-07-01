import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Transactional email service (Section 6.2). Used for system emails only
 * (license delivery, password reset, export-ready) — NOT for the Email
 * Sequence Generator output, which is a content deliverable.
 *
 * When no real EMAIL_PROVIDER_API_KEY is configured (dev), emails are logged
 * to the console instead of being sent. A real provider SDK call would replace
 * the `send()` body in production.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  constructor(private readonly config: ConfigService) {}

  private get hasRealKey(): boolean {
    const key = this.config.get<string>('EMAIL_PROVIDER_API_KEY') ?? '';
    return !!key && !key.includes('fake') && !key.includes('placeholder');
  }

  async send(to: string, subject: string, body: string): Promise<void> {
    if (!this.hasRealKey) {
      this.logger.log(
        `[MOCK EMAIL] to=${to} | subject="${subject}"\n${'─'.repeat(40)}\n${body}\n${'─'.repeat(40)}`,
      );
      return;
    }
    // Production: integrate provider REST API/SDK here (e.g. SendGrid/Mailgun).
    // Kept as a clearly-marked integration point per Section 6.2.
    this.logger.log(`[EMAIL SEND] to=${to} subject="${subject}"`);
  }

  async sendLicenseKey(to: string, licenseKey: string): Promise<void> {
    const baseUrl = this.config.get<string>('FRONTEND_BASE_URL');
    const body = [
      `Welcome! Your Affiliate Launch Kit license key is:`,
      ``,
      `   ${licenseKey}`,
      ``,
      `Activate it here: ${baseUrl}/login`,
    ].join('\n');
    await this.send(to, 'Your Affiliate Launch Kit License Key', body);
  }
}
