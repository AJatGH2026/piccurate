import type { EmailAdapter } from './interface';

/** Mock email adapter — logs to console in development */
export class MockEmail implements EmailAdapter {
  async send(options: { to: string; subject: string; html: string }): Promise<void> {
    console.log(`[Email Mock] To: ${options.to}`);
    console.log(`[Email Mock] Subject: ${options.subject}`);
    console.log(`[Email Mock] Body: ${options.html.slice(0, 200)}...`);
  }
}
