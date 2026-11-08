"use strict";
// Human authorization duration only. Credit validity, budget, capture and
// target checks are independent and must still run at their existing gates.
function authorizationWindow(value, now = Date.now()) {
  if (value === 'unlimited') return 'open';
  if (typeof value !== 'string' || !value.trim()) return 'missing';
  const end = Date.parse(value);
  if (!Number.isFinite(end)) return 'missing';
  return now < end ? 'open' : 'expired';
}
module.exports = { authorizationWindow };
