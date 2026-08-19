import { describe, expect, it } from 'vitest';
import { act, create } from 'react-test-renderer';
import { AppStateProvider, useAppState, type UtteranceCapture } from './app-state';

// react's `act` warns "not configured to support act(...)" unless this is
// set — there is no DOM/RN test environment here to set it implicitly, so it
// has to be done by hand once, before the first render.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * `useAppState` only works inside `AppStateProvider`, so exercising the
 * consent gate and the acting-subject guard needs an actual render — the
 * closures under test live inside the provider's own `useMemo`, not as
 * standalone functions. `react-test-renderer` renders to a JSON tree with no
 * DOM/RN dependency, which is enough for a value never inspected visually.
 */
function renderAppState() {
  let value!: ReturnType<typeof useAppState>;
  function Probe() {
    value = useAppState();
    return null;
  }
  act(() => {
    create(
      <AppStateProvider>
        <Probe />
      </AppStateProvider>,
    );
  });
  return { current: () => value };
}

const correction: UtteranceCapture = { kind: 'CORRECTION', rawText: 'मैले भनेको त्यो होइन' };

describe('AppStateProvider', () => {
  it('exposes exactly one SELF acting subject today, and refuses to switch to any other id', () => {
    // family-and-proxy.md §1: this is the actual safety property — throwing
    // rather than silently keeping the previous subject — not a stub.
    const state = renderAppState();
    expect(state.current().actingSubjects).toHaveLength(1);
    expect(state.current().activeSubject.relationship).toBe('SELF');
    expect(() => state.current().switchActingSubject('someone-else')).toThrow();
  });

  it('captureUtterance is a silent no-op when no consent is live for the purpose', () => {
    const state = renderAppState();
    act(() => state.current().captureUtterance(correction));
    expect(state.current().corpusUtterances).toHaveLength(0);
  });

  it('captureUtterance retains the utterance once consent for its purpose is granted', () => {
    const state = renderAppState();
    act(() => state.current().setConsent('MODEL_TRAINING_TEXT', true));
    expect(state.current().hasConsent('MODEL_TRAINING_TEXT')).toBe(true);
    act(() => state.current().captureUtterance(correction));
    expect(state.current().corpusUtterances).toHaveLength(1);
  });

  it('setConsent(purpose, false) revokes a live grant, so a later capture is a no-op again', () => {
    const state = renderAppState();
    act(() => state.current().setConsent('MODEL_TRAINING_TEXT', true));
    act(() => state.current().setConsent('MODEL_TRAINING_TEXT', false));
    expect(state.current().hasConsent('MODEL_TRAINING_TEXT')).toBe(false);
    act(() => state.current().captureUtterance(correction));
    expect(state.current().corpusUtterances).toHaveLength(0);
  });

  it('grantConsentAndCapture grants and retains in the same update, not one render behind', () => {
    // The bug its own doc comment describes: a separate setConsent then
    // captureUtterance would have the second call read this render's
    // pre-grant consentGrants from its closure and drop the very utterance
    // the person just agreed to keep. A single act() call is the only way to
    // exercise that — two act() calls would give the state a render in
    // between and hide the bug even if the fix regressed.
    const state = renderAppState();
    act(() => state.current().grantConsentAndCapture(correction));
    expect(state.current().hasConsent('MODEL_TRAINING_TEXT')).toBe(true);
    expect(state.current().corpusUtterances).toHaveLength(1);
  });

  it('useAppState throws outside a provider rather than exposing an unsafe default', () => {
    function Bare() {
      useAppState();
      return null;
    }
    expect(() => {
      act(() => {
        create(<Bare />);
      });
    }).toThrow('useAppState must be used within AppStateProvider');
  });
});
