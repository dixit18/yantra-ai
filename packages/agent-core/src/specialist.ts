// P2-AGENT-017 — bounded specialist graph (master spec §11.2):
// classify → resolve_asset(deferred to P3) → retrieve → draft → validate →
// answer | abstain | escalate. Explicit nodes, structured state, persisted
// trace, no unconstrained loops. The asset node records its deferral in the
// trace instead of pretending.
import type { QueryFn } from '@yantra/db';
import { hybridSearch, type Embedder, type HybridHit } from '@yantra/knowledge';
import { classifyIntent, type IntentKind } from './intent.js';
import { computeConfidence, type ConfidenceSignals } from './confidence.js';
import { ExtractiveDrafter, type AnswerDrafter, type Draft } from './drafter.js';
import { riskOutranks, type RiskClass } from './index.js';
import { finishRun, hashInput, recordStep, startRun } from './trace.js';
export interface SpecialistInput {
  tenantId: string;
  userId?: string;
  message: string;
  topK?: number;
}

export type SpecialistOutcome = 'answered' | 'abstained' | 'escalated';

export interface SpecialistAnswer {
  answerText: string;
  citations: string[];
  confidence: number;
  retrievalTraceId: string;
}

export interface EscalationPacket {
  tenantId: string;
  userId?: string;
  message: string;
  intent: IntentKind;
  riskClass: RiskClass;
  evidenceIds: string[];
  attemptedSummary: string;
}

export interface Abstention {
  reason: string;
  discriminatingQuestions: string[];
  escalation?: EscalationPacket;
}

export interface SpecialistResult {
  outcome: SpecialistOutcome;
  answer?: SpecialistAnswer;
  abstention?: Abstention;
  confidence: number;
  runId: string;
}

export interface SpecialistDeps {
  query: QueryFn;
  embedder: Embedder;
  drafter?: AnswerDrafter;
}

export const ANSWER_CONFIDENCE_FLOOR = 0.35;
export const HIGH_RISK_CONFIDENCE_FLOOR = 0.6;

function discriminatingQuestions(intent: IntentKind): string[] {
  if (intent === 'parts') {
    return ['Which model and serial number is this for?'];
  }
  if (intent === 'fault') {
    return ['What is the exact fault code and machine revision?'];
  }
  return ['Which machine model is this about, and what do you see?'];
}

export async function runSpecialist(
  deps: SpecialistDeps,
  input: SpecialistInput,
): Promise<SpecialistResult> {
  if (!input.message.trim()) {
    throw new Error('specialist requires a non-empty message');
  }
  const runId = await startRun(deps.query, {
    tenantId: input.tenantId,
    workflow: 'specialist',
    workflowVersion: '1',
    inputHash: hashInput(input.message),
  });
  let seq = 0;
  const step = async (node: string, nodeInput: unknown, output: unknown): Promise<void> => {
    seq += 1;
    await recordStep(deps.query, { runId, seq, node, input: nodeInput, output });
  };
  const finish = async (
    outcome: SpecialistOutcome,
    confidence: number,
    result: Omit<SpecialistResult, 'confidence' | 'runId'>,
  ): Promise<SpecialistResult> => {
    await finishRun(deps.query, { runId, status: outcome, confidence });
    return { ...result, outcome, confidence, runId };
  };

  try {
    const classified = classifyIntent(input.message);
    await step('classify_intent', { message: input.message }, classified);

    await step('resolve_asset', { assetId: null }, { status: 'deferred', reason: 'P3-ASSET-021' });

    let retrieval: Awaited<ReturnType<typeof hybridSearch>>;
    try {
      retrieval = await hybridSearch(deps.query, {
        tenantId: input.tenantId,
        queryText: input.message,
        embedder: deps.embedder,
        topK: input.topK ?? 8,
      });
    } catch (error: unknown) {
      throw new Error(`retrieval failed: ${(error as Error).message}`);
    }
    await step(
      'retrieve',
      { queryText: input.message },
      { hitIds: retrieval.hits.map((h) => h.id), traceId: retrieval.traceId },
    );

    const drafter = deps.drafter ?? new ExtractiveDrafter();
    const draft: Draft = await drafter.draft({
      tenantId: input.tenantId,
      query: deps.query,
      queryText: input.message,
      riskClass: classified.riskClass,
      hits: retrieval.hits,
    });
    await step('draft', { hitCount: retrieval.hits.length }, draftSummary(draft));

    return await validateAndFinish(
      deps,
      step,
      finish,
      input,
      classified,
      retrieval.hits,
      draft,
      retrieval.traceId,
    );
  } catch (error) {
    // Unexpected failures end the run loudly: fabricated answers or
    // abstentions would corrupt the trace and evals.
    await step('error', {}, { message: (error as Error).message });
    await finishRun(deps.query, { runId, status: 'failed', confidence: 0 });
    throw error;
  }
}

function draftSummary(draft: Draft): Record<string, unknown> {
  if (draft.kind === 'insufficient') {
    return { kind: 'insufficient' };
  }
  return { kind: 'answer', citedSegmentIds: draft.citedSegmentIds };
}

function packet(
  input: SpecialistInput,
  classified: { intent: IntentKind; riskClass: RiskClass },
  evidenceIds: string[],
  attemptedSummary: string,
): EscalationPacket {
  return {
    tenantId: input.tenantId,
    userId: input.userId,
    message: input.message,
    intent: classified.intent,
    riskClass: classified.riskClass,
    evidenceIds,
    attemptedSummary,
  };
}

async function validateAndFinish(
  deps: SpecialistDeps,
  step: (node: string, input: unknown, output: unknown) => Promise<void>,
  finish: (
    outcome: SpecialistOutcome,
    confidence: number,
    result: Omit<SpecialistResult, 'confidence' | 'runId'>,
  ) => Promise<SpecialistResult>,
  input: SpecialistInput,
  classified: ReturnType<typeof classifyIntent>,
  hits: HybridHit[],
  draft: Draft,
  retrievalTraceId: string,
): Promise<SpecialistResult> {
  const exactHits = hits.filter((h) => h.origin !== 'vector').length;
  const distinctDocs = new Set(hits.map((h) => h.documentId)).size;
  const signals: ConfidenceSignals = {
    exactHits,
    sources: hits.length,
    distinctDocs,
    riskClass: classified.riskClass,
  };
  const confidence = computeConfidence(signals);

  // R4 never answers: prohibited autonomous-control scope escalates by rule.
  if (classified.riskClass === 'R4') {
    const abstention: Abstention = {
      reason: 'safety: remote operation of guarded machinery is out of scope',
      discriminatingQuestions: [],
      escalation: packet(
        input,
        classified,
        hits.map((h) => h.id),
        'R4 request refused safely',
      ),
    };
    await step(
      'validate',
      { confidence, riskClass: classified.riskClass },
      { outcome: 'escalated' },
    );
    return finish('escalated', confidence, { outcome: 'escalated', abstention });
  }

  if (draft.kind === 'insufficient') {
    const abstention: Abstention = {
      reason: 'no supporting evidence in approved sources',
      discriminatingQuestions: discriminatingQuestions(classified.intent),
    };
    await step('validate', { confidence, hitCount: 0 }, { outcome: 'abstained' });
    return finish('abstained', confidence, { outcome: 'abstained', abstention });
  }

  // Citation contract: every cited segment must come from the retrieved set,
  // and a technical answer needs at least one citation.
  const retrievedIds = new Set(hits.map((h) => h.id));
  const citedOk =
    draft.citedSegmentIds.length > 0 && draft.citedSegmentIds.every((id) => retrievedIds.has(id));
  const floor = riskOutranks(classified.riskClass, 'R1')
    ? HIGH_RISK_CONFIDENCE_FLOOR
    : ANSWER_CONFIDENCE_FLOOR;
  if (!citedOk || confidence < floor) {
    const abstention: Abstention = !citedOk
      ? {
          reason: 'draft cited evidence outside the retrieved set',
          discriminatingQuestions: discriminatingQuestions(classified.intent),
        }
      : {
          reason: `confidence ${confidence} below ${floor} for ${classified.riskClass}`,
          discriminatingQuestions: discriminatingQuestions(classified.intent),
          escalation:
            classified.riskClass === 'R3'
              ? packet(
                  input,
                  classified,
                  hits.map((h) => h.id),
                  'low-confidence technical answer',
                )
              : undefined,
        };
    await step('validate', { confidence, citedOk }, { outcome: 'abstained' });
    return finish('abstained', confidence, { outcome: 'abstained', abstention });
  }

  await step('validate', { confidence, citedOk }, { outcome: 'answered' });
  return finish('answered', confidence, {
    outcome: 'answered',
    answer: {
      answerText: draft.answerText,
      citations: draft.citations.map((c) => `${c.documentTitle} ${c.versionLabel} · p.${c.page}`),
      confidence,
      retrievalTraceId,
    },
  });
}
