export const GET_CARE_QUESTION_KEY = 'mero-health:get-care-question';

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
