// P2-EVAL-018 — versioned golden dataset schema. Cases are plain JSON under
// datasets/<version>/ so any harness (or human) can read them; the directory
// name IS the dataset version. Validation fails loudly on unknown fields.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

export const EvalCaseSchema = z
  .object({
    id: z.string().min(1),
    description: z.string().min(1),
    input: z.object({
      message: z.string().min(1),
      tenant: z.enum(['main', 'empty']).default('main'),
    }),
    expected: z.object({
      outcome: z.enum(['answered', 'abstained', 'escalated']),
      mustContain: z.array(z.string()).default([]),
      // Citation anchors must be specific: a 2-letter anchor matches noise.
      mustCite: z
        .array(z.string().min(4, 'citation anchors need at least 4 characters'))
        .default([]),
      forbidden: z.array(z.string()).default([]),
      needsQuestion: z.boolean().default(false),
      minConfidence: z.number().min(0).max(1).optional(),
    }),
    knownFailure: z.string().optional(),
  })
  .strict();

export type EvalCase = z.infer<typeof EvalCaseSchema>;

export interface Dataset {
  version: string;
  cases: EvalCase[];
}

export async function loadDataset(dir: string): Promise<Dataset> {
  const version = dir.split(/[\\/]/).filter(Boolean).pop() ?? 'unknown';
  let names: string[];
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith('.json')).sort();
  } catch (error) {
    throw new Error(`cannot read dataset dir ${dir}: ${(error as Error).message}`);
  }
  if (names.length === 0) {
    throw new Error(`dataset dir ${dir} contains no cases`);
  }
  const cases: EvalCase[] = [];
  for (const name of names) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(join(dir, name), 'utf8'));
    } catch (error) {
      throw new Error(`dataset case ${name} is not valid JSON: ${(error as Error).message}`);
    }
    const result = EvalCaseSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`dataset case ${name} is invalid: ${result.error.message}`);
    }
    cases.push(result.data);
  }
  const ids = cases.map((c) => c.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error(`dataset ${version} has duplicate case ids`);
  }
  return { version, cases };
}
