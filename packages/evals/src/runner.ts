// P2-EVAL-018 — suite runner. The run function is injected: unit self-tests
// pass scripted responses (fast, CI-green), live runs pass runSpecialist
// bound to real infrastructure. knownFailure cases document tracked gaps —
// they report separately and never gate the suite, but an UNEXPECTED PASS
// fails loudly: a silently fixed gap must become a passing case, not rot.
import { createHash } from 'node:crypto';
import type { SpecialistResult } from '@yantra/agent-core';
import type { Dataset, EvalCase } from './dataset.js';
import { scoreCase, type CaseScore } from './score.js';

export type RunFn = (input: { tenantId: string; message: string }) => Promise<SpecialistResult>;

export interface SuiteReport {
  datasetVersion: string;
  total: number;
  passed: number;
  failed: string[];
  knownFailures: string[];
  caseHashes: Record<string, string>;
  results: (CaseScore & { knownFailure?: string })[];
}

export function hashCase(testCase: EvalCase): string {
  return createHash('sha256').update(canonicalJson(testCase), 'utf8').digest('hex');
}

// Canonical form: sorted keys, compact separators. Formatting-only edits
// still change the hash (content addressing), but semantically identical
// objects parsed from any key order hash the same.
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export async function runSuite(
  run: RunFn,
  dataset: Dataset,
  tenantFor: (alias: 'main' | 'empty') => string,
): Promise<SuiteReport> {
  const results: SuiteReport['results'] = [];
  const caseHashes: Record<string, string> = {};
  for (const testCase of dataset.cases) {
    caseHashes[testCase.id] = hashCase(testCase);
    const result = await run({
      tenantId: tenantFor(testCase.input.tenant),
      message: testCase.input.message,
    });
    const scored = scoreCase(testCase.id, testCase.expected, result);
    // An expected failure that starts passing is a suite failure, not a
    // celebration: either the gap closed (promote the case) or the test rotted.
    if (scored.passed && testCase.knownFailure) {
      scored.passed = false;
      scored.checks.push({
        name: 'unexpected-pass',
        passed: false,
        detail: `known failure resolved or rotted: ${testCase.knownFailure}`,
      });
    }
    results.push({ ...scored, knownFailure: testCase.knownFailure });
  }
  const failed = results.filter((r) => !r.passed && !r.knownFailure).map((r) => r.caseId);
  const unexpected = results
    .filter(
      (r) => !r.passed && r.knownFailure && r.checks.some((c) => c.name === 'unexpected-pass'),
    )
    .map((r) => r.caseId);
  return {
    datasetVersion: dataset.version,
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: [...failed, ...unexpected],
    knownFailures: results
      .filter((r) => !r.passed && r.knownFailure && !unexpected.includes(r.caseId))
      .map((r) => r.caseId),
    caseHashes,
    results,
  };
}

export function suitePassed(report: SuiteReport): boolean {
  return report.failed.length === 0;
}
