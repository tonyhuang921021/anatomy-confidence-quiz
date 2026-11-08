'use strict';
// Only a policy read from the service-only SQL RPC may reach this boundary.
// Cash authorization is separate from factual credit eligibility; it never
// fabricates noCash or creditVerified. Unknown/legacy modes remain fail closed.
function fundingAllowed(policy){
 if(!policy)return false;
 if(policy.fundingMode==='cash_authorized')return policy.cashAuthorized===true&&/^[a-f0-9]{64}$/.test(policy.fundingEvidenceSha||'');
 if(policy.fundingMode!==undefined&&policy.fundingMode!=='verified_credit')return false;
 return policy.creditVerified===true&&policy.noCash===true;
}
module.exports={fundingAllowed};
