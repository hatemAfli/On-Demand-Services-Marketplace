import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

type VerificationOutcome = 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@Injectable()
export class ResendMailService {
  private readonly logger = new Logger(ResendMailService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Notifies provider when a verification document review step completes.
   * No-ops when RESEND_API_KEY is unset (local dev).
   */
  async sendVerificationOutcome(params: {
    to: string;
    recipientName: string;
    status: VerificationOutcome;
    detail?: string;
  }): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey?.trim()) {
      this.logger.warn(
        'RESEND_API_KEY not set — skipping verification outcome email',
      );
      return;
    }

    const from =
      this.config.get<string>('MAIL_FROM')?.trim() ||
      'ServeMe <onboarding@resend.dev>';

    const { subject, html } = this.buildTemplate(params);

    try {
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from,
        to: params.to,
        subject,
        html,
      });
      if (error) {
        this.logger.error(`Resend error: ${JSON.stringify(error)}`);
      }
    } catch (e) {
      this.logger.error(
        `Failed to send verification email: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  private buildTemplate(params: {
    recipientName: string;
    status: VerificationOutcome;
    detail?: string;
  }): { subject: string; html: string } {
    const name = escapeHtml(params.recipientName || 'there');
    const detailBlock = params.detail
      ? `<p style="margin:16px 0 0;color:#444;"><strong>Message from the team:</strong><br/>${escapeHtml(params.detail)}</p>`
      : '';

    switch (params.status) {
      case 'UNDER_REVIEW':
        return {
          subject: 'Your verification is under review',
          html: `<p>Hello ${name},</p>
<p>We are reviewing your submitted documents. You will receive another email when a decision is recorded.</p>
${detailBlock}
<p style="margin-top:24px;color:#666;font-size:14px;">— The platform team</p>`,
        };
      case 'APPROVED':
        return {
          subject: 'Verification update: approved',
          html: `<p>Hello ${name},</p>
<p>Your document verification has been <strong>approved</strong>. Open the app to see your account status.</p>
${detailBlock}
<p style="margin-top:24px;color:#666;font-size:14px;">— The platform team</p>`,
        };
      case 'REJECTED':
        return {
          subject: 'Verification update: action required',
          html: `<p>Hello ${name},</p>
<p>Your document verification could not be approved at this time. Please review the note below and submit updated documents in the app if applicable.</p>
${detailBlock || `<p style="margin:16px 0 0;color:#444;">Please check your account for details.</p>`}
<p style="margin-top:24px;color:#666;font-size:14px;">— The platform team</p>`,
        };
    }
  }
}
