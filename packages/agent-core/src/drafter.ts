// P2-AGENT-017 — answer drafting. The MVP drafts EXTRACTIVELY: quoted spans
// come verbatim from retrieved segments, so every claim already carries its
// citation and the hallucination surface is zero. A model gateway plugs the
// same seam later (same input, same cited-ids contract) when MODEL_API_KEY
// arrives — the validator cannot tell the difference, by design.
import { formatCitation, resolveCitation, type Citation } from '@yantra/knowledge';
import type { QueryFn } from '@yantra/db';
import type { HybridHit } from '@yantra/knowledge';
import type { RiskClass } from './index.js';

export interface DraftInput {
  tenantId: string;
  query: QueryFn;
  queryText: string;
  riskClass: RiskClass;
  hits: HybridHit[];
}

export type Draft =
  | { kind: 'answer'; answerText: string; citedSegmentIds: string[]; citations: Citation[] }
  | { kind: 'insufficient' };

export interface AnswerDrafter {
  draft(input: DraftInput): Promise<Draft>;
}

const MAX_QUOTED = 3;

export class ExtractiveDrafter implements AnswerDrafter {
  async draft(input: DraftInput): Promise<Draft> {
    if (input.hits.length === 0) {
      return { kind: 'insufficient' };
    }
    const top = input.hits.slice(0, MAX_QUOTED);
    const citations: Citation[] = [];
    for (const hit of top) {
      citations.push(
        await resolveCitation(input.query, { tenantId: input.tenantId, segmentId: hit.id }),
      );
    }
    const distinctDocs = new Set(citations.map((c) => c.documentId)).size;
    const lines = top.map((hit, i) => `${hit.text} [${i + 1}]`);
    const answerText = [
      `Based on ${distinctDocs} approved source${distinctDocs === 1 ? '' : 's'}:`,
      '',
      ...lines,
      '',
      'Sources:',
      ...citations.map((citation, i) => `[${i + 1}] ${formatCitation(citation)}`),
    ].join('\n');
    return { kind: 'answer', answerText, citedSegmentIds: top.map((h) => h.id), citations };
  }
}
