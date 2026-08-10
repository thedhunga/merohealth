import { describe, expect, it } from 'vitest';
import { classifyCompanionCapture } from './companion-capture';

describe('classifyCompanionCapture', () => {
  it('treats an ordinary first question as a USER_MESSAGE', () => {
    const capture = classifyCompanionCapture({
      message: 'दुई दिनदेखि टाउको दुखिरहेको छ',
      isRephrase: false,
      precedingAssistantText: null,
    });
    expect(capture).toEqual({
      kind: 'USER_MESSAGE',
      rawText: 'दुई दिनदेखि टाउको दुखिरहेको छ',
      precedingAssistantText: null,
    });
  });

  it('treats a flagged rephrase with a prior answer as a CORRECTION, paired with that answer', () => {
    const capture = classifyCompanionCapture({
      message: 'होइन, टाउको होइन पेट दुखेको हो',
      isRephrase: true,
      precedingAssistantText: 'Symptoms can have many causes.',
    });
    expect(capture).toEqual({
      kind: 'CORRECTION',
      rawText: 'होइन, टाउको होइन पेट दुखेको हो',
      precedingAssistantText: 'Symptoms can have many causes.',
    });
  });

  it('falls back to USER_MESSAGE when flagged as a rephrase but there is nothing preceding it', () => {
    const capture = classifyCompanionCapture({
      message: 'फेरि सोध्दैछु',
      isRephrase: true,
      precedingAssistantText: null,
    });
    expect(capture.kind).toBe('USER_MESSAGE');
    expect(capture.precedingAssistantText).toBeNull();
  });

  it('does not treat a plain follow-up question (not flagged as a rephrase) as a CORRECTION', () => {
    const capture = classifyCompanionCapture({
      message: 'यसको उपचार के हो?',
      isRephrase: false,
      precedingAssistantText: 'Some prior answer.',
    });
    expect(capture.kind).toBe('USER_MESSAGE');
    expect(capture.precedingAssistantText).toBeNull();
  });
});
