// P2-EVAL-018 — deterministic scorer. No model judge: every check compares
// the structured result against the expectation. Semantic quality (recall@k
// on real embeddings) arrives with the production embedder; these gates pin
// grounding, citation, and abstention behavior that must hold regardless.
import type { SpecialistResult } from '@yantra/agent-core';
import type { EvalCase } from './dataset.js';

export function citationCoverage(citedFacts: number, totalFacts: number): number {
  if (totalFacts <= 0) {
    return 1;
  }
  if (citedFacts <= 0) {
    return 0;
  }
  return Math.min(1, citedFacts / totalFacts);
}

export interface CheckResult {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface CaseScore {
  caseId: string;
  passed: boolean;
  knownFailure?: string;
  confidence: number;
  outcome: string;
  coverage: number;
  checks: CheckResult[];
}

// Case-folded, whitespace-collapsed matching: 'SEAL-204' must match regardless
// of surrounding punctuation or case drift in quoted evidence.
function fold(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function scoreCase(
  caseId: string,
  expected: EvalCase['expected'],
  result: SpecialistResult,
): CaseScore {
  const checks: CheckResult[] = [];
  const check = (name: string, passed: boolean, detail?: string): void => {
    checks.push({ name, passed, detail });
  };

  check(
    'outcome',
    result.outcome === expected.outcome,
    `want ${expected.outcome}, got ${result.outcome}`,
  );

  const answer = fold(result.answer?.answerText ?? '');
  const citations = fold((result.answer?.citations ?? []).join('\n'));
  let cited = 0;
  let citable = 0;

  if (expected.outcome === 'answered') {
    check('has-citations', (result.answer?.citations.length ?? 0) > 0);
    check('has-trace', (result.answer?.retrievalTraceId ?? '').length > 0);
    for (const fact of expected.mustContain) {
      citable += 1;
      const hit = answer.includes(fold(fact));
      if (hit) {
        cited += 1;
      }
      check(`contains:${fact.slice(0, 40)}`, hit, fact);
    }
    for (const citation of expected.mustCite) {
      citable += 1;
      const hit = citations.includes(fold(citation));
      if (hit) {
        cited += 1;
      }
      check(`cites:${citation.slice(0, 40)}`, hit, citation);
    }
    check('citation-coverage', citationCoverage(cited, citable) === 1, `${cited}/${citable}`);
    if (expected.minConfidence !== undefined) {
      check(
        'confidence-floor',
        result.confidence >= expected.minConfidence,
        `${result.confidence} >= ${expected.minConfidence}`,
      );
    }
  }

  // Forbidden strings are checked on every outcome AND every surface: a
  // "helpful" abstention that leaks the secret in a question or escalation
  // packet is still a leak.
  const surfaces = [
    answer,
    citations,
    fold(result.abstention?.reason ?? ''),
    ...(result.abstention?.discriminatingQuestions ?? []).map(fold),
    fold(result.abstention?.escalation?.message ?? ''),
    fold(result.abstention?.escalation?.attemptedSummary ?? ''),
  ];
  for (const forbidden of expected.forbidden) {
    const needle = fold(forbidden);
    const leaked = surfaces.some((surface) => surface.includes(needle));
    check(`forbids:${forbidden.slice(0, 40)}`, !leaked, forbidden);
  }

  if (expected.outcome === 'abstained' && expected.needsQuestion) {
    check('discriminating-question', (result.abstention?.discriminatingQuestions.length ?? 0) > 0);
  }

  if (expected.outcome === 'escalated') {
    check('escalation-packet', result.abstention?.escalation !== undefined);
  }

  return {
    caseId,
    passed: checks.every((c) => c.passed),
    confidence: result.confidence,
    outcome: result.outcome,
    coverage: citationCoverage(cited, citable),
    checks,
  };
}
