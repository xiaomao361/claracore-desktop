const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {parseHTML} = require('linkedom');
const {createClaraCoreKnowledgeView} = require('../../app/views/knowledge');
const {createKnowledgeReadingState} = require('../../app/knowledge-reading-state');
const markdown = require('../../app/knowledge-markdown');
const library = require('../knowledge/library');
const base = path.resolve(__dirname, '../..');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(),'claracore-default-reading-'));
const storageData = new Map(); const storage = {getItem:key=>storageData.get(key),setItem:(key,value)=>storageData.set(key,value)};
let currentRoot, denied = false, blockedList = null;
function makeRoot(name) { const root=path.join(fixture,name); fs.mkdirSync(path.join(root,'notes'),{recursive:true}); return root; }
function write(root,name,time) { const file=path.join(root,'notes',name+'.md'); fs.writeFileSync(file,`# ${name}\n\n## Section\n\nSynthetic ${name} body.\n`); fs.utimesSync(file,new Date(time),new Date(time)); }
function create() {
 const {window,document}=parseHTML(fs.readFileSync(path.join(base,'index.html'),'utf8')); const ctx=vm.createContext({window,document});
 for(const file of ['app/dom.js','app/i18n/en.js'])vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),ctx);
 const dom=window.ClaraCoreDom;
 const t=(key,args={})=>{const text=window.ClaraCoreTranslationsEn[key];assert.equal(typeof text,'string',key);return text.replace(/\{(\w+)\}/g,(_,key)=>args[key]??'');};
 const api={getKnowledgeRootPreference:async()=>({root:currentRoot,...library.inspectKnowledgeRoot(currentRoot)}),listKnowledgeDocuments:async options=>{if(blockedList)await blockedList;return library.listKnowledgeDocuments(currentRoot,options);},
  readKnowledgeDocument:async reference=>{if(denied)throw Object.assign(Error('fixture permission denied'),{code:'permission_denied'});return library.readKnowledgeDocument(currentRoot,reference);},
  getKnowledgeLinks:async reference=>library.getKnowledgeLinks(currentRoot,reference),listKnowledgeActivity:async()=>({items:[],total:0}),getKnowledgeIndexStatus:async()=>({status:'missing',semantic:'not_built'})};
 const view=createClaraCoreKnowledgeView({dom,api,t,markdown,formatLocalDateTime:value=>value,readingState:createKnowledgeReadingState(storage)});
 return {view,dom,api};
}
async function main(){
 const a=makeRoot('A'),b=makeRoot('B'),empty=makeRoot('empty');
 write(a,'a-old','2026-01-01');write(a,'z-new','2026-02-01');write(b,'b-only','2026-03-01');currentRoot=a;
 let {view,dom}=create();
 await view.setActive(true);assert.equal(view.state().selected,'notes/z-new.md','First entry opens the most recently modified file, not the alphabetically first file');
 assert.equal(dom.knowledgeDocumentTitle.textContent,'z-new');assert.equal(dom.knowledgeReaderBody.querySelectorAll('h1,h2').length,0,'Body headings must not repeat the document title');
 assert(dom.knowledgeReaderBody.querySelector('h3'));assert(dom.knowledgeDocumentMeta.textContent.includes('2026-02-01'));
 assert.equal(dom.knowledgeDocumentTitle.parentElement.hidden,false);
 await view.openDocument('notes/a-old.md',false,false);dom.knowledgeMainPane.scrollTop=137;await view.refresh();
 assert.equal(view.state().selected,'notes/a-old.md');assert.equal(dom.knowledgeMainPane.scrollTop,137);view.setActive(false);
 ({view,dom}=create());await view.setActive(true);assert.equal(view.state().selected,'notes/a-old.md');assert.equal(dom.knowledgeMainPane.scrollTop,137,'A new view restores the persisted per-library position');
 currentRoot=b;await view.refresh();assert.equal(view.state().selected,'notes/b-only.md');assert.equal(dom.knowledgeMainPane.scrollTop,0);
 currentRoot=a;await view.refresh();assert.equal(view.state().selected,'notes/a-old.md');assert.equal(dom.knowledgeMainPane.scrollTop,137,'Another library must not overwrite this library position');
 denied=true;await view.refresh();assert.equal(dom.knowledgeReaderBody.textContent,'');assert.match(dom.knowledgeReaderStatus.textContent,/permission denied/);assert.equal(dom.knowledgeDocumentTitle.parentElement.hidden,true);denied=false;
 fs.unlinkSync(path.join(a,'notes/a-old.md'));await view.refresh();assert.equal(view.state().selected,'notes/z-new.md');assert.match(dom.knowledgeReaderStatus.textContent,/previous document is missing/i);
 let release;blockedList=new Promise(resolve=>release=resolve);const pending=view.refresh();await new Promise(resolve=>setImmediate(resolve));
 await view.openDocument('notes/z-new.md#section');release();await pending;blockedList=null;assert.equal(view.state().selected,'notes/z-new.md#section','A delayed catalog refresh must not replace a newer explicit selection');
 currentRoot=empty;await view.refresh();assert.equal(dom.knowledgeReaderBody.querySelectorAll('[data-knowledge-anchor]').length,0);assert.match(dom.knowledgeReaderStatus.textContent,/no documents|no .*documents|empty/i);
 view.setActive(false);
 const unavailable=createKnowledgeReadingState({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}});unavailable.remember(a,'notes/z-new.md',50);unavailable.flush();assert.equal(unavailable.get(a).scrollTop,50);
 console.log('Knowledge default reading passed: recent-file selection, per-library durable position, title hierarchy, empty/missing/denied states and refresh selection races; synthetic files only.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>fs.rmSync(fixture,{recursive:true,force:true}));
