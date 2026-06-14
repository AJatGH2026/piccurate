/** Email adapter interface */
export interface EmailAdapter {
  send(options: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void>;
}

export async function getEmailAdapter(): Promise<EmailAdapter> {
  const provider = process.env.EMAIL_PROVIDER || 'mock';

  if (provider === 'resend') {
    const { ResendEmail } = await import('./resend');
    return new ResendEmail();
  }

  const { MockEmail } = await import('./mock');
  return new MockEmail();
}
