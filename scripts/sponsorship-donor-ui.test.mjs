import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseSandboxAmount } from '../lib/sponsorship/sandbox-ui.mjs';
const require = createRequire(import.meta.url);
const { createElement } = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const helpers = require('../lib/sponsorship/donor-projection.mjs');
function loadTsx(relativePath, overrides = {}) {
  const filename = fileURLToPath(new URL(relativePath, import.meta.url));
  const ts = require('typescript');
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const compiled = new Module(filename); compiled.paths = Module._nodeModulePaths(fileURLToPath(new URL('..', import.meta.url)));
  const originalRequire = compiled.require.bind(compiled);
  compiled.require = (name) => Object.hasOwn(overrides, name) ? overrides[name] : originalRequire(name);
  compiled._compile(source, filename); return compiled.exports;
}
const donorModule = (overrides = {}) => loadTsx('../components/SponsorshipDonorPreferences.tsx', { '@/lib/sponsorship/donor-projection.mjs': helpers, ...overrides });
function harness(props = { amount: 321 }) {
  const state = []; let cursor = 0; let tree;
  const hooks = { useId: () => ':test:', useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], (value) => { state[i] = value; }]; } };
  const { SponsorshipDonorPreferences, SponsorshipDonorDraft } = donorModule({ react: hooks });
  const render = () => { cursor = 0; tree = SponsorshipDonorPreferences(props); return tree; };
  const find = (predicate, node = tree) => {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap((child) => find(predicate, child));
    return [...(predicate(node) ? [node] : []), ...(node.props?.children == null ? [] : find(predicate, node.props.children))];
  };
  render();
  return { render, find, draft: () => find((node) => node.type === SponsorshipDonorDraft)[0].props,
    radios: () => find((node) => node.type === 'input' && node.props.type === 'radio'),
    checkboxes: () => find((node) => node.type === 'input' && node.props.type === 'checkbox'),
    name: () => find((node) => node.type === 'input' && node.props.type === 'text')[0],
  };
}

test('donor draft defaults to anonymous with two independent unchecked publication consents', () => {
  const ui = harness();
  assert.equal(ui.radios()[0].props.checked, true); assert.equal(ui.radios()[1].props.checked, false);
  assert.equal(ui.name(), undefined);
  assert.deepEqual(ui.checkboxes().map((checkbox) => checkbox.props.checked), [false, false]);
  assert.equal(ui.checkboxes()[0].props.disabled, true);
  assert.deepEqual(ui.draft().preferences, { displayName: null, publishDisplayName: false, publishAmount: false });
  const { SponsorshipDonorPreferences } = donorModule();
  const html = renderToStaticMarkup(createElement(SponsorshipDonorPreferences, { amount: 321 }));
  assert.match(html, /不列入公開名單/); assert.match(html, /公開設定/); assert.doesNotMatch(html, /預覽|尚未送出|重新整理頁面後會恢復預設/);
  assert.doesNotMatch(html, /NT\$ 321/);
});

test('typing a display name never grants name or amount publication consent', () => {
  const ui = harness();
  ui.radios()[1].props.onChange(); ui.render();
  ui.name().props.onChange({ target: { value: '  國考　夥伴  ' } }); ui.render();
  assert.deepEqual(ui.checkboxes().map((checkbox) => checkbox.props.checked), [false, false]);
  assert.deepEqual(ui.draft().preferences, { displayName: null, publishDisplayName: false, publishAmount: false });
  ui.checkboxes()[1].props.onChange({ target: { checked: true } }); ui.render();
  assert.deepEqual(ui.draft().preferences, { displayName: null, publishDisplayName: false, publishAmount: true });
  ui.checkboxes()[0].props.onChange({ target: { checked: true } }); ui.render();
  assert.deepEqual(ui.draft().preferences, { displayName: '國考 夥伴', publishDisplayName: true, publishAmount: true });
  ui.checkboxes()[1].props.onChange({ target: { checked: false } }); ui.render();
  assert.equal(ui.draft().preferences.publishDisplayName, true); assert.equal(ui.draft().preferences.publishAmount, false);
});

test('returning to anonymous clears the name and its consent without silently changing amount consent', () => {
  const ui = harness();
  ui.radios()[1].props.onChange(); ui.render(); ui.name().props.onChange({ target: { value: '測試暱稱' } }); ui.render();
  ui.checkboxes()[0].props.onChange({ target: { checked: true } }); ui.checkboxes()[1].props.onChange({ target: { checked: true } }); ui.render();
  ui.radios()[0].props.onChange(); ui.render();
  assert.deepEqual(ui.draft().preferences, { displayName: null, publishDisplayName: false, publishAmount: true });
  assert.equal(ui.name(), undefined);
  ui.radios()[1].props.onChange(); ui.render();
  assert.equal(ui.name().props.value, ''); assert.equal(ui.checkboxes()[0].props.checked, false);
});

test('name limits use shared Unicode normalizer and invalid names cannot opt into publication', () => {
  const ui = harness(); ui.radios()[1].props.onChange(); ui.render();
  for (const value of ['x'.repeat(41), 'a\nb', 'a\u202eb', 'a\u200bb', '\ud800']) {
    ui.name().props.onChange({ target: { value } }); ui.render();
    assert.equal(ui.name().props['aria-invalid'], true); assert.equal(ui.checkboxes()[0].props.disabled, true);
  }
  ui.name().props.onChange({ target: { value: '🫶'.repeat(40) } }); ui.render();
  assert.equal(ui.name().props['aria-invalid'], false); assert.equal(ui.name().props.maxLength, 80);
  ui.checkboxes()[0].props.onChange({ target: { checked: true } }); ui.render();
  assert.equal([...ui.draft().preferences.displayName].length, 40);
  // A now-invalid name must never trap a previously checked consent in the on position.
  ui.name().props.onChange({ target: { value: '' } }); ui.render();
  assert.equal(ui.checkboxes()[0].props.disabled, false);
  ui.checkboxes()[0].props.onChange({ target: { checked: false } }); ui.render();
  assert.equal(ui.draft().preferences.publishDisplayName, false);
});

test('personal preview renders HTML-looking names as escaped text and hides nonconsented amount', () => {
  const { SponsorshipDonorDraft } = donorModule();
  const name = '<img src=x onerror=alert(1)>';
  const html = renderToStaticMarkup(createElement(SponsorshipDonorDraft, { preferences: { displayName: name, publishDisplayName: true, publishAmount: false }, amount: 321, invalid: false }));
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/); assert.doesNotMatch(html, /<img|<script|NT\$ 321/);
  assert.match(html, /金額不公開/); assert.match(html, /名稱與金額僅依你勾選的項目公開/);
  const anonymous = renderToStaticMarkup(createElement(SponsorshipDonorDraft, { preferences: { displayName: null, publishDisplayName: false, publishAmount: true }, amount: 321, invalid: false }));
  assert.match(anonymous, /匿名支持者/); assert.match(anonymous, /NT\$ 321/);
});

test('invalid custom amount does not produce a public-amount preview and TEST is explicitly excluded', () => {
  const ui = harness({ amount: null, testOnly: true });
  ui.checkboxes()[1].props.onChange({ target: { checked: true } }); ui.render(); assert.equal(ui.draft().invalid, true);
  const { SponsorshipDonorPreferences } = donorModule();
  const html = renderToStaticMarkup(createElement(SponsorshipDonorPreferences, { amount: 1, testOnly: true }));
  assert.match(html, /非正式付款不會列入公開贊助名單或收入/);
  for (const value of ['1', '100000']) assert.equal(helpers.validateSponsorshipAmount(parseSandboxAmount(value)), Number(value));
  for (const value of ['0', '100001', '1.2', '1e2', '+1', '', 'Infinity']) assert.equal(parseSandboxAmount(value), null);
});

test('landing-page list is genuinely empty, with no donor input, TEST linkage or invented aggregate', () => {
  const { SponsorshipDonorListPreview } = loadTsx('../components/SponsorshipDonorListPreview.tsx');
  const html = renderToStaticMarkup(createElement(SponsorshipDonorListPreview));
  assert.match(html, /目前沒有公開的贊助紀錄/);
  assert.doesNotMatch(html, /donor-list-caption|未來只顯示已核實的正式付款/);
  assert.doesNotMatch(html, /<li|<tr|NT\$|US\$|preview_|<input/);
  const main = fs.readFileSync(new URL('../components/SponsorshipPage.tsx', import.meta.url), 'utf8');
  assert.match(main, /<SponsorshipDonorListPreview/);
  const form = fs.readFileSync(new URL('../components/SponsorshipSupportForm.tsx', import.meta.url), 'utf8');
  assert.match(form, /<SponsorshipDonorPreferences amount=\{parsedAmount\}/);
  assert.match(form, /parseSupportAmount\(previewAmount\)/);
  assert.match(form, /每筆至少 NT\$ 100/);
  assert.match(form, /className="checkout" disabled/);
});

test('draft is memory-only, has no external effects, and never creates an interrupted diagnostic feature', () => {
  for (const path of ['../components/SponsorshipDonorPreferences.tsx', '../components/SponsorshipDonorListPreview.tsx']) {
    const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /dangerouslySetInnerHTML|innerHTML|ReactMarkdown|localStorage|sessionStorage|fetch\(|\.rpc\(/);
  }
  assert.equal(fs.existsSync(new URL('../app/api/sponsorship/diagnose', import.meta.url)), false);
  const panel = fs.readFileSync(new URL('../components/SponsorshipTestPanel.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(panel, /\/diagnose|驗證 OEN 測試連線/);
  assert.match(panel, /attempt \?\? \{ requestKey: .*amount: value, donorPreferences: \{ \.\.\.donorDraft \} \}/);
});

test('enabled form reports normalized draft changes, remains unsaved before submission and locks captured attempts', () => {
  const changes = []; const ui = harness({ amount: 321, saveWithCheckout: true, onChange: (next) => changes.push(next) });
  ui.radios()[1].props.onChange(); ui.render(); ui.name().props.onChange({ target: { value: '  測試　暱稱  ' } }); ui.render();
  assert.deepEqual(changes.at(-1), { displayName: '', publishDisplayName: false, publishAmount: false });
  ui.checkboxes()[0].props.onChange({ target: { checked: true } }); ui.render();
  assert.deepEqual(changes.at(-1), { displayName: '測試 暱稱', publishDisplayName: true, publishAmount: false });
  ui.name().props.onChange({ target: { value: 'a\nb' } }); ui.render(); assert.equal(changes.at(-1), null);
  const { SponsorshipDonorPreferences } = donorModule();
  const initial = renderToStaticMarkup(createElement(SponsorshipDonorPreferences, { amount: 321, saveWithCheckout: true }));
  assert.match(initial, /目前尚未儲存/); assert.doesNotMatch(initial, /伺服器已確認儲存/);
  const submitted = renderToStaticMarkup(createElement(SponsorshipDonorPreferences, { amount: 321, saveWithCheckout: true, submitted: true, disabled: true }));
  assert.match(submitted, /是否已儲存以伺服器回覆為準/); assert.doesNotMatch(submitted, /尚未送出|目前尚未儲存/);
  const locked = harness({ amount: 321, disabled: true, onChange: () => assert.fail('locked draft must not change') });
  locked.radios()[1].props.onChange(); locked.render(); assert.equal(locked.name(), undefined);
});

test('saved consent section renders only confirmed data, distinct withdrawal controls and no public or payment claim', () => {
  const { SponsorshipDonorConsentStatus } = loadTsx('../components/SponsorshipDonorConsentStatus.tsx');
  const render = (preferences, props = {}) => renderToStaticMarkup(createElement(SponsorshipDonorConsentStatus, { preferences, ...props }));
  const missing = render(null, { onWithdraw() {} });
  assert.doesNotMatch(missing, /<button|伺服器已確認儲存/); assert.match(missing, /未取得設定不代表已同意公開/);
  const saved = render({ displayName: '<script>test</script>', publishDisplayName: true, publishAmount: true, revision: 1 }, { enabled: true, onWithdraw() {} });
  assert.match(saved, /&lt;script&gt;test&lt;\/script&gt;/); assert.doesNotMatch(saved, /<script|已核實測試付款/);
  assert.match(saved, /撤回名稱公開同意/); assert.match(saved, /撤回金額公開同意/);
  assert.match(saved, /不會變更付款狀態或退款/); assert.match(saved, /TEST 訂單不會出現在正式公開名單/);
  const off = render({ displayName: null, publishDisplayName: false, publishAmount: false, revision: 3 }, { enabled: true, onWithdraw() {} });
  assert.doesNotMatch(off, /<button/); assert.match(off, /兩項均未同意，不列入公開名單/);
});

test('unshared invalid nickname stays private and cannot block an anonymous preference payload', () => {
  const changes = []; const ui = harness({ amount: 321, onChange: (next) => changes.push(next) });
  ui.radios()[1].props.onChange(); ui.render(); ui.name().props.onChange({ target: { value: 'private\ninvalid' } }); ui.render();
  assert.equal(ui.name().props['aria-invalid'], true);
  assert.equal(ui.draft().invalid, false);
  assert.deepEqual(changes.at(-1), { displayName: '', publishDisplayName: false, publishAmount: false });
  ui.checkboxes()[1].props.onChange({ target: { checked: true } }); ui.render();
  assert.deepEqual(changes.at(-1), { displayName: '', publishDisplayName: false, publishAmount: true });
});

test('mobile consent labels keep a 44px click target with wrapped plain text', () => {
  const css = fs.readFileSync(new URL('../app/sponsorship/donor-preview.css', import.meta.url), 'utf8');
  assert.match(css, /\.donor-preferences \.donor-identity label,\.donor-preferences \.donor-consents label\{min-height:44px;align-items:center\}/);
  assert.match(css, /\.donor-preferences \.donor-consents label>span\{min-width:0;overflow-wrap:anywhere\}/);
});
