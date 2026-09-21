// P2-AGENT-017 — rule-based intent + risk classification. Deterministic by
// design: the graph never asks a model what the user meant. A model gateway
// may later propose intents, but the rule verdict stays authoritative for
// risk (P3-RISK-024 builds the full policy engine on these classes).
import { extractTokens } from '@yantra/knowledge';
import { type RiskClass } from './index.js';

export type IntentKind = 'fault' | 'parts' | 'howto' | 'unknown';

export interface ClassifiedIntent {
  intent: IntentKind;
  riskClass: RiskClass;
  partCodes: string[];
  faultCodes: string[];
}

const FAULT_RE =
  /\b(?:fault|error|err|alarm|failure|tripped|tripping|overload|blocked|jammed|diagnos\w*|troubleshoot)\b|\bF-?\d{2,5}\b|\bE(?:RR?)?-?\d{2,5}\b/i;
const FAULT_CODE_RE = /\bF-?\d{3,4}\b|\bERR?-?\d{2,5}\b/gi;
const PARTS_RE =
  /\b(?:part|spare|seal|bearing|filter|belt|sensor|fit|fits|compatible|replacement|replace\w*|order|price|quote|supersed\w*|stock|lead.?time)\b/i;
const HOWTO_RE =
  /\b(?:how|procedure|steps?|install\w*|maintain|maintenance|service|manual|guide|torque|calibrat\w*|commission\w*)\b/i;
const R4_RE =
  /\b(?:bypass|bypassing|disable|disabled|disabling|override|overriding|defeat|defeating|remove|removal|removing|disconnect|disconnecting|circumvent|circumventing|tamper|tampering|kill|killing|deactivat\w*|(?:turn|turning|shut|take|taking|pull|pulling)(?:\s+\w+){0,2}\s+off|get\s+around|get\s+rid\s+of|needs?\s+to\s+go|gotta\s+go)\b/i;
const R4_NOUN_RE =
  /\b(?:guard|guards|interlock|interlocks|safety|lockout|tagout|light.?curtain|relay|relays)\b/i;
const R3_RE =
  /\b(?:high.?voltage|440\s?v|electrical panel|arc.?flash|pressure.?vessel|hydraulic.?pressure|chemical|explosive|lockout|tagout)\b/i;
const R2_RE = /\b(?:voltage|current|temperature|pressure|measurement|reading|multimeter|megger)\b/i;

export function classifyIntent(message: string): ClassifiedIntent {
  const text = message.trim();
  const partCodes = extractTokens(text);
  const faultCodes = [...new Set([...text.matchAll(FAULT_CODE_RE)].map((m) => m[0].toUpperCase()))];

  let intent: IntentKind = 'unknown';
  if (FAULT_RE.test(text)) {
    intent = 'fault';
  } else if (PARTS_RE.test(text) || partCodes.length > 0) {
    intent = 'parts';
  } else if (HOWTO_RE.test(text)) {
    intent = 'howto';
  }

  let riskClass: RiskClass = 'R0';
  // Order-independent co-occurrence: defeating a guard reads the same from
  // either direction, and synonyms must not slip through by rephrasing.
  if (R4_RE.test(text) && R4_NOUN_RE.test(text)) {
    riskClass = 'R4';
  } else if (R3_RE.test(text)) {
    riskClass = 'R3';
  } else if (R2_RE.test(text) || intent === 'fault') {
    riskClass = 'R2';
  } else if (intent === 'parts' || intent === 'howto' || partCodes.length > 0) {
    riskClass = 'R1';
  }
  return { intent, riskClass, partCodes, faultCodes };
}
