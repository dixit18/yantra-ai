// P2-AGENT-017 — run trace persistence (master spec §9.6, §20). Every graph
// node appends its input/output; experts inspect runs, evals regress on them.
// Step payloads pass through secret scrubbing: user messages can contain
// anything, and traces are permanent.
import { createHash } from 'node:crypto';
import { scrubSecrets } from '@yantra/contracts';
import type { QueryFn } from '@yantra/db';

export type RunStatus = 'running' | 'answered' | 'abstained' | 'escalated' | 'failed';

export function hashInput(message: string): string {
  return createHash('sha256').update(message, 'utf8').digest('hex');
}

export async function startRun(
  query: QueryFn,
  args: { tenantId: string; workflow: string; workflowVersion?: string; inputHash: string },
): Promise<string> {
  const rows = (
    await query(
      `insert into agent_run (tenant_id, workflow, workflow_version, input_hash, status)
       values ($1, $2, $3, $4, 'running')
       returning id`,
      [args.tenantId, args.workflow, args.workflowVersion ?? '1', args.inputHash],
    )
  ).rows;
  const id = rows[0]?.['id'];
  if (typeof id !== 'string' || !id) {
    throw new Error('agent run insert did not return an id');
  }
  return id;
}

export async function recordStep(
  query: QueryFn,
  args: { runId: string; seq: number; node: string; input: unknown; output: unknown },
): Promise<void> {
  await query(
    `insert into agent_step (run_id, seq, node, input_json, output_json)
     values ($1, $2, $3, $4, $5)`,
    [
      args.runId,
      args.seq,
      args.node,
      JSON.stringify(scrubSecrets(args.input ?? {})),
      JSON.stringify(scrubSecrets(args.output ?? {})),
    ],
  );
}

export async function finishRun(
  query: QueryFn,
  args: { runId: string; status: Exclude<RunStatus, 'running'>; confidence: number },
): Promise<void> {
  await query('update agent_run set status = $1, confidence = $2, ended_at = now() where id = $3', [
    args.status,
    args.confidence,
    args.runId,
  ]);
}
