// TZ §8.4 — after this many failed attempts an outbox op / photo upload is
// treated as permanently 'failed' rather than retried again.
export const MAX_SYNC_ATTEMPTS = 20;
