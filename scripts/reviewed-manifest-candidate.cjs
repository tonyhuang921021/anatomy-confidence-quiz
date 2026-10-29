// Offline only. Input must be the exact committed reviewedExplanationIndex.json;
// verify git commit independently. This does not connect to or change a database.
const fs=require('node:fs');const crypto=require('node:crypto');
const file=process.argv[2];if(!file) throw new Error('usage: node scripts/reviewed-manifest-candidate.cjs path/to/reviewedExplanationIndex.json');
const obj=JSON.parse(fs.readFileSync(file,'utf8'));if(!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('invalid manifest');
const ids=Object.keys(obj).sort();const canonical=JSON.stringify(ids);const sha256=crypto.createHash('sha256').update(canonical,'utf8').digest('hex');
console.log(JSON.stringify({algorithm:'sha256(JSON.stringify(sorted question IDs), UTF-8)',count:ids.length,sha256,ids}));
