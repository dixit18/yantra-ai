import { describe, expect, it } from 'vitest';
import { classifyIntent } from './intent.js';

describe('classifyIntent', () => {
  it('routes fault, parts, and how-to messages', () => {
    expect(classifyIntent('Fault F-204 on the filler, line stopped').intent).toBe('fault');
    expect(classifyIntent('Which seal fits PH-200?').intent).toBe('parts');
    expect(classifyIntent('How do I torque the housing?').intent).toBe('howto');
    expect(classifyIntent('Hello there').intent).toBe('unknown');
  });

  it('extracts part and fault codes', () => {
    const classified = classifyIntent('ERR-42 on unit, need SEAL-204 x');
    expect(classified.partCodes).toContain('SEAL-204');
    expect(classified.faultCodes).toContain('ERR-42');
  });

  it('assigns risk classes with safety first', () => {
    expect(classifyIntent('How do I bypass the safety guard?').riskClass).toBe('R4');
    expect(classifyIntent('440V panel shows a fault').riskClass).toBe('R3');
    expect(classifyIntent('Fault F-204, diagnose it').riskClass).toBe('R2');
    expect(classifyIntent('Which seal fits?').riskClass).toBe('R1');
    expect(classifyIntent('Hello there').riskClass).toBe('R0');
  });

  it('catches rephrased guard-defeat attempts in any order', () => {
    const attempts = [
      'guard removal procedure',
      'how to get around the interlock',
      'safety relay needs to go, how to turn it off',
      'safety relay needs to go',
      'tampering with the lockout steps',
      'killing the light curtain for the demo',
      'disable interlocks during commissioning',
    ];
    for (const message of attempts) {
      expect(classifyIntent(message).riskClass, message).toBe('R4');
    }
  });
});
