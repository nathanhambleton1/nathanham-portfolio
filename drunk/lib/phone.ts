// US phone numbers. Accounts store them as E.164 ("+15551234567"); inputs show
// them as "(555) 123-4567" while typing so they can't be entered wrong.

/** The (up to) 10 national digits in any typed/pasted value. Drops a leading country code 1. */
export const phoneDigits = (raw: string): string => {
  let d = (raw || "").replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("1")) d = d.slice(1);
  return d.slice(0, 10);
};

/** Progressive "(555) 123-4567" formatting for an input as the user types. */
export const formatPhoneInput = (raw: string): string => {
  const d = phoneDigits(raw);
  if (d.length === 0) return "";
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

/** True for a complete, plausible US number (area code can't start with 0/1). */
export const isValidPhone = (raw: string): boolean => /^[2-9]\d{9}$/.test(phoneDigits(raw));

/** "(555) 123-4567" -> "+15551234567" */
export const toE164 = (raw: string): string => `+1${phoneDigits(raw)}`;

/** "+15551234567" -> "(555) 123-4567" */
export const formatE164 = (e164: string | null | undefined): string => (e164 ? formatPhoneInput(e164) : "");
