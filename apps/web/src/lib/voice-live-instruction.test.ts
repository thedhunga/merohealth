import { describe, expect, it } from 'vitest';

import { CONTAINMENT_INSTRUCTION } from './containment-instruction';
import { buildLiveSystemInstruction } from './voice-live-instruction';

describe('buildLiveSystemInstruction', () => {
  it('shares the containment sentence verbatim with the text path', () => {
    expect(buildLiveSystemInstruction('ne')).toContain(CONTAINMENT_INSTRUCTION);
    expect(buildLiveSystemInstruction('en')).toContain(CONTAINMENT_INSTRUCTION);
  });

  it('never claims interception runs before this request — that is false for duplex voice', () => {
    expect(buildLiveSystemInstruction('ne')).not.toMatch(/before this request/i);
    expect(buildLiveSystemInstruction('en')).not.toMatch(/before this request/i);
  });

  it('tells the model to give its own emergency warning and names the watcher as backup, never as the only safeguard', () => {
    const instruction = buildLiveSystemInstruction('en');
    expect(instruction).toMatch(/emergency services|nearest hospital/i);
    expect(instruction).toMatch(/safety watcher/i);
    expect(instruction).toMatch(/backup/i);
  });

  it('asks for short spoken sentences, not written prose', () => {
    expect(buildLiveSystemInstruction('en')).toMatch(/never as written prose/i);
  });

  it('differs by language in its language instruction only', () => {
    const ne = buildLiveSystemInstruction('ne');
    const en = buildLiveSystemInstruction('en');
    expect(ne).not.toEqual(en);
    expect(en).toMatch(/Speak clear English/);
    expect(ne).toMatch(/spoken Nepali/);
  });
});
