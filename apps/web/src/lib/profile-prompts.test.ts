import { describe, expect, it } from 'vitest';

import type { AnonymousProfile } from './anonymous-history';
import { nextProfilePrompt } from './profile-prompts';

const fresh = (): AnonymousProfile => ({ askedPrompts: [] });

describe('nextProfilePrompt', () => {
  it('never asks anything on the very first answer', () => {
    // She came for an answer, not a form — even a strong trigger waits.
    expect(nextProfilePrompt('मेरो आमालाई सुगर छ', 0, fresh())).toBeNull();
  });

  it('asks who the question is for when it is asked on behalf of someone', () => {
    expect(nextProfilePrompt('मेरो आमालाई ज्वरो छ', 1, fresh())?.key).toBe('askingFor');
    expect(nextProfilePrompt('my mother has a cough', 1, fresh())?.key).toBe('askingFor');
    expect(nextProfilePrompt('mero buwa lai bp chha', 1, fresh())?.key).toBe('askingFor');
  });

  it('asks about chronic conditions when one is mentioned', () => {
    expect(nextProfilePrompt('sugar dherai chha', 1, fresh())?.key).toBe('chronicCondition');
    expect(nextProfilePrompt('मलाई मधुमेह छ', 1, fresh())?.key).toBe('chronicCondition');
    expect(nextProfilePrompt('my BP is high', 1, fresh())?.key).toBe('chronicCondition');
  });

  it('prefers "who is this for" over the condition when both apply', () => {
    // Knowing it is the mother's sugar matters more than the asker's own age.
    expect(nextProfilePrompt('मेरो आमालाई सुगर छ', 1, fresh())?.key).toBe('askingFor');
  });

  it('asks age only from the second real answer, and only when nothing else fits', () => {
    expect(nextProfilePrompt('ज्वरो छ', 1, fresh())).toBeNull();
    expect(nextProfilePrompt('ज्वरो छ', 2, fresh())?.key).toBe('ageBand');
  });

  it('never repeats a prompt that was asked or skipped', () => {
    const skipped: AnonymousProfile = { askedPrompts: ['askingFor', 'chronicCondition'] };
    // Both triggers fire but both were already asked, so it falls through to age.
    expect(nextProfilePrompt('मेरो आमालाई सुगर छ', 2, skipped)?.key).toBe('ageBand');
  });

  it('never asks for something the profile already holds', () => {
    const known: AnonymousProfile = { askedPrompts: [], askingFor: 'parent', ageBand: '40to60' };
    expect(nextProfilePrompt('मेरो आमालाई ज्वरो छ', 3, known)).toBeNull();
  });

  it('does not match "bp" inside another word', () => {
    // \bbp\b — "webpage" must not trigger a blood-pressure prompt.
    expect(nextProfilePrompt('webpage khulena', 1, fresh())).toBeNull();
  });
});
