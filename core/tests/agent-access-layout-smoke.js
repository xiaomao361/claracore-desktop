const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseHTML } = require('linkedom');
const CSSOM = require('cssom');
const root = path.resolve(__dirname, '../..');
const { document } = parseHTML(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
const sheet = CSSOM.parse(fs.readFileSync(path.join(root, 'styles/views/agent-setup.css'), 'utf8'));
// Resolve the page's authored layout rules without launching a browser. This
// checks the grid contract; it does not measure rendered geometry.
function styles(node, width) {
  const result = {};
  function visit(rules) {
    for (const rule of rules) {
      if (rule.media) {
        const limit = /max-width:\s*(\d+)px/.exec(rule.media.mediaText);
        if (!limit || width <= Number(limit[1])) visit(rule.cssRules);
      } else if (rule.selectorText && !/::|:focus-visible|:hover/.test(rule.selectorText) && node.matches(rule.selectorText)) {
        for (let i = 0; i < rule.style.length; i++) {
          const key = rule.style[i]; result[key] = rule.style.getPropertyValue(key);
        }
      }
    }
  }
  visit(sheet.cssRules); return result;
}
const page = document.querySelector('.agent-access-page');
for (const width of [600, 900, 1400]) {
  assert.equal(styles(page, width)['grid-template-columns'], 'minmax(0, 1fr)');
  assert.equal(styles(page, width)['grid-template-areas'], 'none');
  for (const child of page.children) assert.equal(styles(child, width)['grid-area'], 'auto', 'An old named area must never create implicit columns in the access page');
  const observations = document.querySelector('.agent-observation-grid');
  assert.equal(styles(observations, width)['grid-template-columns'], 'minmax(0, 1fr)', 'Calls must retain their own full-width row');
}
assert(!/grid-area:\s*(activity|invite)/.test(fs.readFileSync(path.join(root, 'styles/views/agent-setup.css'), 'utf8')));
console.log('Access layout CSS parsed: one outer track, no legacy named placement, full-width observations at narrow/medium/wide rule sets. Rendered geometry unverified.');
