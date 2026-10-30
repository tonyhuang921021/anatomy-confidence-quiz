'use strict';
// These non-ledger paid actions remain stopped until they are integrated with the same atomic budget.
module.exports = { shouldPauseNonLedgerPaidAction: () => true };
