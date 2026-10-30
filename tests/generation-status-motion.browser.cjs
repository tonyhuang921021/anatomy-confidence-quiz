const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const css = fs.readFileSync('components/ExplanationGenerationStatus.module.css', 'utf8');
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1280]) for (const reducedMotion of ['reduce', 'no-preference']) {
      const page = await browser.newPage({viewport: {width, height: 900}, reducedMotion});
      await page.setContent(`<style>${css}</style><div class="status" data-phase="loading"><svg><g class="head"></g><g class="tail"></g><g class="page"></g><g class="eyes"></g><g class="sleep"></g></svg></div>`);
      for (const name of ['head','tail','page','eyes','sleep']) {
        const animation = await page.locator(`.${name}`).evaluate(el => getComputedStyle(el).animationName);
        assert.equal(animation === 'none', reducedMotion === 'reduce', `${name} ${width} ${reducedMotion}: ${animation}`);
      }
      console.log(`PASS ${width}px ${reducedMotion}`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
