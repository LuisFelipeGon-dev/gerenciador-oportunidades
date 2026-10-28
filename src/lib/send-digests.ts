// Sends the weekly e-mails one by one. A failure for one person is reported and does not stop
// the others; the caller decides what to record for each list.

export type Recipient = { userId: string; email: string; subject: string; html: string; text: string };
export type OutgoingMail = { to: string; subject: string; html: string; text: string };

export async function sendDigests(
  recipients: Recipient[],
  send: (msg: OutgoingMail) => Promise<void>,
  opts: { delayMs: number },
): Promise<{ sent: string[]; failed: string[] }> {
  const sent: string[] = [];
  const failed: string[] = [];
  for (const [i, r] of recipients.entries()) {
    if (i > 0 && opts.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, opts.delayMs));
    try {
      await send({ to: r.email, subject: r.subject, html: r.html, text: r.text });
      sent.push(r.userId);
    } catch (err) {
      failed.push(r.userId);
      console.error(`alerts: failed to send to ${r.userId}: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { sent, failed };
}
