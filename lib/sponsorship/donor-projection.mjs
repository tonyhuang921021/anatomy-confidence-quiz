/** Pure proposal helpers. No network, credentials, storage or publication side effects.
 * Projection input MUST come from the trusted server ledger and authenticated OEN GET,
 * never request JSON. A field called verificationSource is not proof of authentication.
 */
export const MAX_DISPLAY_NAME_CODEPOINTS = 40;
export const MIN_SPONSORSHIP_AMOUNT = 1;
export const MAX_SPONSORSHIP_AMOUNT = 100000;
const UNSAFE_TEXT = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u;
const PUBLIC_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateSponsorshipAmount(value) {
  if (!Number.isSafeInteger(value) || value < MIN_SPONSORSHIP_AMOUNT || value > MAX_SPONSORSHIP_AMOUNT) throw Error('INVALID_AMOUNT');
  return value;
}
export function normalizeDonorDisplayName(value = '') {
  if (typeof value !== 'string' || value.length > 2048 || UNSAFE_TEXT.test(value)) throw Error('INVALID_DISPLAY_NAME');
  const normalized = value.normalize('NFC').replace(/\p{Zs}+/gu, ' ').trim();
  if ([...normalized].length > MAX_DISPLAY_NAME_CODEPOINTS) throw Error('DISPLAY_NAME_TOO_LONG');
  // Plain text, not sanitized HTML. Render using React text/textContent, never innerHTML.
  return normalized;
}
export function normalizeDonorPreferences(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !['displayName', 'publishDisplayName', 'publishAmount'].includes(k))) throw Error('INVALID_DONOR_PREFERENCES');
  const { displayName = '', publishDisplayName = false, publishAmount = false } = value;
  if (typeof publishDisplayName !== 'boolean' || typeof publishAmount !== 'boolean') throw Error('INVALID_DONOR_PREFERENCES');
  const name = normalizeDonorDisplayName(displayName);
  if (publishDisplayName && !name) throw Error('DISPLAY_NAME_REQUIRED');
  return Object.freeze({ displayName: publishDisplayName ? name : null, publishDisplayName, publishAmount });
}
/** Proposed real-money projection only. Keep last trusted snapshot through transient sync failures. */
export function projectPublicDonor(record, { now = Date.now() } = {}) {
  try {
    if (!Number.isSafeInteger(now)) return null;
    if (!record || record.environment !== 'production' || record.currency !== 'TWD' || record.state !== 'verified_paid' || record.publicationState !== 'eligible' || record.requiresReview !== false || record.suppressionReason != null) return null;
    if (typeof record.orderId !== 'string' || !record.orderId || record.orderId.length > 100 || !PUBLIC_ID.test(record.publicId || '') || !/^[A-Za-z0-9]{27}$/.test(record.checkoutId || '')) return null;
    if (!Number.isSafeInteger(record.verifiedPaidAt) || record.verifiedPaidAt > now || !Number.isSafeInteger(record.consentRevision) || record.consentRevision < 1) return null;
    const amount = validateSponsorshipAmount(record.amount);
    const proof = record.financialSnapshot;
    if (!proof || proof.verificationSource !== 'authenticated_oen_get' || proof.transactionId !== record.checkoutId || proof.orderId !== record.orderId || proof.amount !== amount || !['charged', 'claimed'].includes(proof.status) || proof.refundAmount !== 0) return null;
    if (!Number.isSafeInteger(proof.checkedAt) || proof.checkedAt < record.verifiedPaidAt || proof.checkedAt > now) return null;
    const consent = normalizeDonorPreferences({ ...record.preferences, displayName: record.preferences?.displayName ?? '' });
    if (!consent.publishDisplayName && !consent.publishAmount) return null;
    return Object.freeze({ id: record.publicId, displayName: consent.publishDisplayName ? consent.displayName : '匿名贊助者', amount: consent.publishAmount ? amount : null, currency: 'TWD' });
  } catch { return null; }
}
/** Duplicate conflicting snapshots suppress that order, so an old paid row cannot beat a refund. */
export function buildPublicDonorList(records, options) {
  if (!Array.isArray(records) || records.length > 1000) throw Error('INVALID_DONOR_RECORDS');
  const candidates = new Map();
  for (const record of records) {
    if (typeof record?.orderId !== 'string') continue;
    const projected = projectPublicDonor(record, options);
    if (!candidates.has(record.orderId)) candidates.set(record.orderId, projected);
    else if (JSON.stringify(candidates.get(record.orderId)) !== JSON.stringify(projected)) candidates.set(record.orderId, null);
  }
  // Public IDs must be opaque and unique; suppress all collisions rather than leak duplicate IDs.
  const counts = new Map();
  for (const entry of candidates.values()) if (entry) counts.set(entry.id, (counts.get(entry.id) || 0) + 1);
  const donors = [...candidates.values()].filter(entry => entry && counts.get(entry.id) === 1);
  return Object.freeze({ donors, publicAmountTotal: donors.reduce((sum, entry) => sum + (entry.amount ?? 0), 0), currency: 'TWD' });
}
