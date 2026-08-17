import { describe, expect, it } from 'vitest';

import { VOICE_CONTRIBUTION_TASKS } from './voice-contribution';

describe('VOICE_CONTRIBUTION_TASKS', () => {
  it('has no duplicate ids', () => {
    const ids = VOICE_CONTRIBUTION_TASKS.map((task) => task.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes at least one of each task kind', () => {
    const kinds = new Set(VOICE_CONTRIBUTION_TASKS.map((task) => task.kind));
    expect(kinds.has('READ_PROMPT')).toBe(true);
    expect(kinds.has('FREE_SPEECH')).toBe(true);
  });
});
