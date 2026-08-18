export const GET_CARE_QUESTION_KEY = 'mero-health:get-care-question';
export const GET_CARE_LISTEN_KEY = 'mero-health:get-care-listen';

export function storeCareQuestion(question: string): boolean {
  try {
    window.sessionStorage.setItem(GET_CARE_QUESTION_KEY, question);
    return true;
  } catch {
    return false;
  }
}

export function consumeCareQuestion(): string {
  try {
    const question = window.sessionStorage.getItem(GET_CARE_QUESTION_KEY) ?? '';
    window.sessionStorage.removeItem(GET_CARE_QUESTION_KEY);
    return question;
  } catch {
    return '';
  }
}

/**
 * Round seven, task O: the home screen's mic-as-hero sets this right before
 * navigating to `/get-care`, so tapping it starts conversation mode
 * directly there instead of landing on an idle text field. A one-shot flag
 * rather than a query param — consistent with `GET_CARE_QUESTION_KEY` above,
 * and it keeps the URL free of anything about why the visitor arrived.
 */
export function storeCareListenIntent(): boolean {
  try {
    window.sessionStorage.setItem(GET_CARE_LISTEN_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

export function consumeCareListenIntent(): boolean {
  try {
    const intent = window.sessionStorage.getItem(GET_CARE_LISTEN_KEY) === '1';
    window.sessionStorage.removeItem(GET_CARE_LISTEN_KEY);
    return intent;
  } catch {
    return false;
  }
}
