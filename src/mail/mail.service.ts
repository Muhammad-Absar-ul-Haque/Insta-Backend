import { Injectable, Logger } from '@nestjs/common';

/**
 * Stand-in for a real transactional email provider (SES, SendGrid, Postmark...).
 * Swap the body of these methods for a provider SDK call when one is wired up;
 * the call sites elsewhere in the app don't need to change.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    this.logger.log(
      `[stub email] password reset for ${to} — token: ${resetToken}`,
    );
  }
}
