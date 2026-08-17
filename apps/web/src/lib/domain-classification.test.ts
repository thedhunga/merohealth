import { describe, expect, it } from 'vitest';

import { classifyMessageDomain } from './domain-classification';

describe('classifyMessageDomain', () => {
  it('returns the real classifier result for an ordinary health question', () => {
    expect(classifyMessageDomain('I have had a fever for two days', 'en')).toBe('HEALTH');
  });

  it('returns the real classifier result for a clearly off-topic question', () => {
    expect(classifyMessageDomain('who won the match yesterday', 'en')).toBe('OFF_TOPIC');
  });

  it('fails open to HEALTH, never to OFF_TOPIC, when the classifier throws', () => {
    const throwingClassifier = () => {
      throw new Error('classifier unavailable');
    };
    expect(classifyMessageDomain('anything at all', 'en', throwingClassifier)).toBe('HEALTH');
  });
});
