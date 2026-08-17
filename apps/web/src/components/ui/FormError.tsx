type FormErrorProps = {
  message: string | null | undefined;
};

/**
 * Shared inline form/submission error. Nine call sites across auth, account
 * and clinician forms hand-duplicated this exact markup before this
 * component existed; keeping it in one place means a future style change
 * (or an a11y fix) only has to happen once.
 */
export function FormError({ message }: FormErrorProps) {
  if (!message) {
    return null;
  }

  return (
    <p className="text-sm font-semibold text-red-700" role="alert">
      {message}
    </p>
  );
}
