/** Confirmed public-page rules. This module never creates a payment or changes TEST limits. */
export const MIN_SUPPORT_AMOUNT = 100;
export function parseSupportAmount(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= MIN_SUPPORT_AMOUNT ? amount : null;
}
