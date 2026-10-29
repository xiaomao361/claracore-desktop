const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {parseHTML} = require('linkedom');
const CSSOM = require('cssom');
const root = path.resolve(__dirname, '../..');
const {document} = parseHTML(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
const sheet = CSSOM.parse(fs.readFileSync(path.join(root, 'styles/views/module-shell.css'), 'utf8'));
const roots = ['memoryView', 'sharedLineView', 'innerlifeView', 'agentSetupView'].map(id => document.querySelector('#'+id+' > .module-content-shell'));
assert(roots.every(Boolean));
const sharedRootRule = [...sheet.cssRules].find(rule => rule.selectorText && roots.every(node => node.matches(rule.selectorText)) && rule.style.getPropertyValue('padding') === 'var(--module-content-padding)');
assert(sharedRootRule, 'All four page shells use the same explicit padding contract');
assert.equal(sharedRootRule.style.getPropertyValue('grid-template-columns'), 'minmax(0, 1fr)');
const ids = [...document.querySelectorAll('[id]')].map(node => node.id);assert.equal(new Set(ids).size, ids.length);
for(const shell of roots.slice(0,3)) {
  assert.equal(shell.firstElementChild.classList.contains('module-agent-bar'), true, 'Filters start at the content origin without an empty header row');
  assert.equal(shell.querySelector(':scope > .module-page-heading'), null);
  assert(shell.firstElementChild.querySelector('.module-readonly-badge'), 'Read-only information survives the structural consolidation');
  assert(shell.firstElementChild.querySelector('select'));
}
assert(document.querySelector('#memoryOverviewCount'));
assert.equal(document.querySelector('#memoryOverviewTitle').querySelectorAll('.memory-kicker').length,0);
for(const selector of ['.memory-overview','.shared-line-overview','.agent-access-overview']) assert(document.querySelector(selector).classList.contains('module-content-overview'));
console.log('Shared module structure: one common shell contract, controls first, no spacer headers, compact overviews and preserved IDs/read-only controls. Browser geometry unverified.');
