const REDACTED = "[REDACTED]";

function sanitize(message: string): string {
  return message
    .replace(/\d{10}:[A-Za-z0-9_-]{35}/g, REDACTED)
    .replace(/sk-[A-Za-z0-9]{48}/g, REDACTED)
    .replace(/\b\d{2,3}\.\d{1,2}\s*(kg|кг)?\b/gi, REDACTED);
}

export function logInfo(message: string): void {
  console.log(`[INFO] ${sanitize(message)}`);
}

export function logError(message: string, err?: unknown): void {
  const sanitized = sanitize(message);
  if (err instanceof Error) {
    console.error(`[ERROR] ${sanitized}:`, sanitize(err.message));
  } else if (err) {
    console.error(`[ERROR] ${sanitized}:`, String(err));
  } else {
    console.error(`[ERROR] ${sanitized}`);
  }
}

export function logJobStart(jobName: string): void {
  logInfo(`Job started: ${jobName}`);
}

export function logJobFinish(jobName: string, stats?: { sent?: number; skipped?: number; errors?: number }): void {
  if (stats) {
    logInfo(`Job finished: ${jobName} (sent=${stats.sent ?? 0}, skipped=${stats.skipped ?? 0}, errors=${stats.errors ?? 0})`);
  } else {
    logInfo(`Job finished: ${jobName}`);
  }
}
