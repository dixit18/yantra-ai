// P1-REPO-001 seed for P1-OBS-005 — correlation IDs span web/API/agent/tools.
// Structured logging and the audit writer arrive in P1-OBS-005.
export function createCorrelationId(): string {
  return crypto.randomUUID();
}
