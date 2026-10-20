// Export the actual runtime bank for offline source-to-question verification.
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const Module = require('module');
const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(id, ...args) {
  return resolve.call(this, id.startsWith('@/') ? path.join(root, id.slice(2)) : id, ...args);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText, filename);
const questions = require('../data/med1QuestionBank.ts').canonicalQuestionBank;
fs.mkdirSync(path.join(root, 'evidence/explanations'), { recursive: true });
fs.writeFileSync(path.join(root, 'evidence/explanations/canonical-question-bank.json'), JSON.stringify(questions));
console.log(`Exported ${questions.length} canonical questions`);
