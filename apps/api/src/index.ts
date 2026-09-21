// P1-REPO-001 seed — health payload built on @yantra/contracts.
// The NestJS application shell arrives with P1-ENV-002 / P1-DB-003.
import { createHealthStatus, type HealthStatus } from '@yantra/contracts';

export const API_VERSION = '0.1.0';

export function createHealthResponse(): HealthStatus {
  return createHealthStatus(API_VERSION);
}

export * from './bootstrap.js';
