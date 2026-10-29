const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const base=path.resolve(__dirname,'../..');
const {parseHTML}=require(path.join(base,'node_modules/linkedom'));
const read=p=>fs.readFileSync(path.join(base,p),'utf8');
const results=[];
function dom(){const {window,document}=parseHTML(read('index.html'));const context=vm.createContext({window,document,console:{error(){}},setTimeout,clearTimeout});vm.runInContext(read('app/dom.js'),context);vm.runInContext(read('app/i18n/en.js'),context);const en=window.ClaraCoreTranslationsEn;const t=(k,v={})=>(en[k]||k).replace(/\{(\w+)\}/g,(_,n)=>v[n]??'');return {window,document,context,d:window.ClaraCoreDom,t};}
(async()=>{
 const f=fs.mkdtempSync(path.join(os.tmpdir(),'claracore-review-catalog-'));
 try{fs.mkdirSync(path.join(f,'notes'));fs.writeFileSync(path.join(f,'notes/a-large.md'),'# large\n'+'x'.repeat(512*1024));fs.writeFileSync(path.join(f,'notes/z-normal.md'),'# normal\nreadable');const lib=require(path.join(base,'core/knowledge/library'));assert.equal(lib.readKnowledgeDocument(f,'notes/z-normal.md').title,'normal');const page=lib.listKnowledgeDocuments(f);assert.equal(page.status,'partial');assert.equal(page.items.length,2);assert(page.items.some(x=>x.error?.code==='document_too_large'));assert(page.items.some(x=>x.title==='normal'&&!x.error));const links=lib.getKnowledgeLinks(f,'notes/z-normal.md');assert.equal(links.status,'partial');assert.equal(links.issueCount,1);results.push({probe:'catalog-one-oversized-file',result:'partial catalog and backlinks retain normal records and report per-file errors'});}finally{fs.rmSync(f,{recursive:true,force:true});}
 {
 const {window,context,d,t}=dom();window.confirm=()=>true;let restored=0,imported=0;
 window.ClaraCoreDesktop={previewRestore:async()=>({}),restoreBackup:async()=>{restored++;return {restored:true};},importProductJson:async()=>{imported++;return {imported:true};}};
 vm.runInContext(read('app/views/data.js'),context);const view=context.createClaraCoreDataView({dom:d,t,escapeHtml:String,formatBytes:String,formatLocalDateTime:String,getSnapshot:()=>({}),refresh:async()=>{throw Error('synthetic refresh failure');},showCopyNotice(message,target){if(target)target.textContent=message;}});
 view.bindEvents();const button=window.document.createElement('button');button.dataset.backupAction='restore';button.dataset.backupId='fixture';d.backupList.appendChild(button);button.dispatchEvent(new window.Event('click',{bubbles:true}));await new Promise(r=>setImmediate(r));d.restoreConfirmInput.value='RESTORE';d.confirmRestoreBackup.click();await new Promise(r=>setImmediate(r));assert.equal(restored,1);assert(d.backupNotice.textContent.includes(t('data.restoreDone')));assert(d.backupNotice.textContent.includes(t('review.refreshFailed')));
 d.importProductJson.click();await new Promise(r=>setImmediate(r));assert.equal(imported,1);assert(d.productJsonNotice.textContent.includes(t('data.productJsonImportDone')));assert(d.productJsonNotice.textContent.includes(t('review.refreshFailed')));
 window.ClaraCoreDesktop.createBackup=async()=>({path:'/synthetic/backup'});
 window.ClaraCoreDesktop.exportProductJson=async()=>({path:'/synthetic/export'});
 window.ClaraCoreDesktop.deleteBackup=async()=>({deleted:true});
 d.exportBackup.click();await new Promise(r=>setImmediate(r));assert(d.backupNotice.textContent.includes(t('data.backupCreated')));assert(d.backupNotice.textContent.includes(t('review.refreshFailed')));
 d.exportProductJson.click();await new Promise(r=>setImmediate(r));assert(d.productJsonNotice.textContent.includes(t('data.productJsonExported')));assert(d.productJsonNotice.textContent.includes(t('review.refreshFailed')));
 button.dataset.backupAction='delete';button.click();await new Promise(r=>setImmediate(r));assert(d.backupNotice.textContent.includes(t('data.backupDeleted')));assert(d.backupNotice.textContent.includes(t('review.refreshFailed')));
 window.ClaraCoreDesktop.createBackup=async()=>{throw Error('write failed');};d.exportBackup.click();await new Promise(r=>setImmediate(r));assert.equal(d.backupNotice.textContent,t('data.backupFailed'));
 results.push({probe:'successful-write-failed-refresh',restored,imported,allFiveOperations:true,writeFailureDistinguished:true});
 }
 {
 const {window,context,d,t}=dom();const lib=require(path.join(base,'core/knowledge/library'));const markdown=require(path.join(base,'app/knowledge-markdown'));
 vm.runInContext(read('app/knowledge-reading-state.js'),context);
 const view=require(path.join(base,'app/views/knowledge')).createClaraCoreKnowledgeView({dom:d,t,markdown,formatLocalDateTime:String,readingState:{get:()=>null,remember(){},flush(){}},api:{getKnowledgeRootPreference:async()=>({root:'/synthetic',status:'ok'}),listKnowledgeDocuments:async()=>({items:[],total:0}),listKnowledgeActivity:async()=>({items:[],total:0}),getKnowledgeIndexStatus:async()=>({status:'current',semantic:'current'}),searchKnowledge:async()=>({status:'failed',code:'model_changed'})}});
 await view.setActive(true);d.knowledgeSearchQuery.value='fixture';d.knowledgeSearchMode.value='semantic';d.knowledgeSearchForm.dispatchEvent(new window.Event('submit',{cancelable:true}));await new Promise(r=>setImmediate(r));assert.equal(d.knowledgeSemanticHeading.textContent,t('knowledge.search.state.model_changed'));results.push({probe:'model-changed-state',heading:d.knowledgeSemanticHeading.textContent,hint:d.knowledgeSemanticHint.textContent});view.setActive(false);
 }
 {
 const {registerIpcHandlers}=require(path.join(base,'electron/ipc-handlers'));const handlers=new Map();const shell={openPath:async()=> 'Synthetic OS failure'};registerIpcHandlers({ipcMain:{handle:(k,v)=>handlers.set(k,v)},shell});await assert.rejects(handlers.get('claracore:openPath')({},'/synthetic/nonexistent'),/Synthetic OS failure/);shell.openPath=async()=>'';assert.equal(await handlers.get('claracore:openPath')({},'/synthetic/valid'),true);shell.openPath=async()=> 'Access denied';await assert.rejects(handlers.get('claracore:openPath')({},'/synthetic/denied'),/Access denied/);results.push({probe:'openPath-os-result',success:true,missingAndDeniedRejected:true});
 }
 {
 const {initializeProductDatabase}=require(path.join(base,'core/db/database'));
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'claracore-review-shares-'));
 const db=await initializeProductDatabase(path.join(fixture,'fixture.db'));
 try{
 await db.updateInnerLifeProfile({agentId:'fixture-review',displayName:'Fixture'});
 const body='START '+ 'x'.repeat(1000)+' END-MARKER';
 await db.exec(`INSERT INTO innerlife_events (id,agent_id,kind,body,status) VALUES ('review-event','fixture-review','synthetic','fixture','processed'); INSERT INTO innerlife_thoughts (id,event_id,body,review_status) VALUES ('review-thought','review-event','fixture','reviewed'); INSERT INTO innerlife_shares (id,agent_id,thought_id,status,body) VALUES ('review-share','fixture-review','review-thought','pending','${body}');`);
 const raw=(await db.listInnerLifeShares('all',20,'fixture-review'))[0];const snap=await db.getInnerLifeSnapshot('fixture-review');const share=snap.unsharedShares.find(x=>x.id==='review-share');assert(raw.body.endsWith('END-MARKER'));assert.equal(share.body.length,800);assert(!share.body.endsWith('END-MARKER'));assert.equal(share.truncated,true);const readers=require(path.join(base,'core/desktop-readers'));const detail=await readers.getInnerLifeText(db,{agentId:'fixture-review',id:'review-share'});assert.equal(detail.body,body);assert.equal(detail.hasMore,false);await assert.rejects(readers.getInnerLifeText(db,{agentId:'wrong-agent',id:'review-share'}));results.push({probe:'innerlife-full-reader-payload',originalLength:raw.body.length,readerLength:share.body.length,truncationFlag:true});
 }finally{db.close();fs.rmSync(fixture,{recursive:true,force:true});}
 }
 {
 let scheduled;const context=vm.createContext({window:{setTimeout:fn=>{scheduled=fn;return 1;},clearTimeout(){}}});
 const source=read('app.js');vm.runInContext(source.slice(source.indexOf('const noticeTimers ='),source.indexOf('function randomAgentGatewayToken(')),context);
 const notice={textContent:''};context.showCopyNotice('copied',notice);notice.textContent='NEW FAILURE';scheduled();assert.equal(notice.textContent,'NEW FAILURE');context.showCopyNotice('copied',notice);const old=scheduled;context.showCopyNotice('persistent failure',notice,{persistent:true});old();assert.equal(notice.textContent,'persistent failure');results.push({probe:'success-timer-erases-later-failure',finalNotice:notice.textContent});
 }
 {
 const {window,context,d,t}=dom();
 for(const node of window.document.querySelectorAll('select'))Object.defineProperty(node,'value',{writable:true,value:''});
 vm.runInContext(read('app/views/shared-innerlife.js'),context);
 const state={activeInnerLifeAgentFilter:'agent-b'};
 const snapshot={innerLife:{profiles:[{agentId:'agent-a',state:{}},{agentId:'agent-b',state:{recent_focus:'B focus'}}],daemon:{agentId:'agent-a',status:'error',lastError:'A FAILURE',metadata:{}},doctor:{status:'error',issues:[{code:'afterthought_terminal_failure',level:'error'}]}},configuration:{innerlife:{}}};
 const view=context.createClaraCoreSharedInnerLifeView({dom:d,t,getSnapshot:()=>snapshot,state,escapeHtml:String,formatLocalDateTime:String,filterByAgent:(rows,id)=>rows.filter(x=>(x.agent_id||x.agentId)===id),formatSharedLineMetaValue:String,renderReadableText:String,itemAgentId:x=>x.agent_id||x.agentId});
 view.renderInnerLife();assert.equal(state.activeInnerLifeAgentFilter,'agent-b');assert.notEqual(d.innerLifeLastResult.textContent,'A FAILURE');snapshot.innerLife.agentId='agent-b';snapshot.innerLife.daemon={agentId:'agent-b',status:'enabled',metadata:{failureCount:0}};view.renderInnerLife();
 const trigger=window.document.querySelector('[data-innerlife-open="status"]');d.innerLifeDetailDialog.showModal=()=>{};trigger.click();
 assert(d.innerLifeDetailBody.textContent.includes(t('review.recoveryNeeded')));assert(!d.innerLifeDetailBody.querySelector('.is-ok'));
 results.push({probe:'innerlife-agent-status-and-recovery',selectedAgent:state.activeInnerLifeAgentFilter,displayedResult:d.innerLifeLastResult.textContent,terminalFailureNeedsRecovery:true});
 }
 {
 const {window,context,d,t}=dom();vm.runInContext(read('app/memoria-actions.js'),context);let release;const blocked=new Promise(r=>release=r);let calls=[],rendered=null;Object.defineProperty(d.memoryAgentFilter,'value',{writable:true,value:'agent-a'});d.memorySearchInput.value='fixture';
 const state={};const view=context.createClaraCoreMemoriaActions({dom:d,t,state,desktop:{searchMemories:async input=>{calls.push(input.agentId);if(input.agentId==='agent-a')await blocked;return [{id:input.agentId+'-memory',agentId:input.agentId}];}},memoriaView:{setActiveAgentFilter(){},setSearchActive(){}},showCopyNotice(){},renderMemoryResults:rows=>rendered=rows});view.bindEvents();const pending=view.search();await new Promise(r=>setImmediate(r));d.memoryAgentFilter.value='agent-b';d.memoryAgentFilter.dispatchEvent(new window.Event('change'));await new Promise(r=>setImmediate(r));assert.equal(rendered[0].agentId,'agent-b');release();await pending;await new Promise(r=>setImmediate(r));assert.deepEqual(calls,['agent-a','agent-b']);assert.equal(rendered[0].agentId,'agent-b');results.push({probe:'memory-search-agent-race',visibleSelectedAgent:d.memoryAgentFilter.value,requestedAgents:calls,renderedAgent:rendered[0].agentId});
 }
 await checkPagedReaders();
 await checkRendererPaging();
 await checkRecallAndTranslations();
 console.log(JSON.stringify({suite:'full-review-regression',results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});

async function checkPagedReaders() {
  const {initializeProductDatabase}=require('../db/database');
  const readers=require('../desktop-readers');
  const {sqlString}=require('../db/helpers');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'claracore-review-pages-'));
  const db=await initializeProductDatabase(path.join(root,'test.db'));
  try {
    await db.updateInnerLifeProfile({agentId:'reader-a'});
    await db.updateInnerLifeProfile({agentId:'reader-b'});
    const longBody='start\n\n'+ '段落🙂\n'.repeat(7000)+'END-MARKER';
    await db.exec(`INSERT INTO innerlife_events (id,agent_id,kind,body,status) VALUES ('event-b','reader-b','synthetic','fixture','processed');
      INSERT INTO innerlife_thoughts (id,event_id,body,review_status) VALUES ('thought-b','event-b','fixture','reviewed');
      INSERT INTO innerlife_shares (id,agent_id,thought_id,status,body,updated_at) VALUES ('long-body','reader-b','thought-b','pending',${sqlString(longBody)},'2000-01-01');`);
    for(let i=0;i<123;i++) await db.exec(`INSERT INTO continuity_lines (id,agent_id,title,status) VALUES ('line-${i}',${sqlString(i===122?'reader-b':'reader-a')},'fixture','active');
      INSERT INTO innerlife_shares (id,agent_id,thought_id,status,body) VALUES ('share-${i}','reader-a','thought-b','used','fixture');`);
    for(let i=0;i<9;i++) await db.exec(`INSERT INTO innerlife_shares (id,agent_id,thought_id,status,body,updated_at) VALUES ('pending-${i}','reader-b','thought-b','deferred','pending fixture','2001-01-01');`);
    for(let i=0;i<23;i++) await db.exec(`INSERT INTO innerlife_shares (id,agent_id,thought_id,status,body) VALUES ('b-used-${i}','reader-b','thought-b','used','shared fixture');`);
    for(let i=0;i<13;i++) await db.startInnerLifeSession({agentId:'reader-b',externalSessionId:`session-${i}`,host:'synthetic'});
    await db.exec("DELETE FROM innerlife_daemon_state WHERE agent_id='reader-b';");
    const exec=db.exec.bind(db);db.exec=async()=>{throw Error('Read attempted a write');};
    const scoped=await readers.getInnerLife(db,{agentId:'reader-b'});
    assert.equal(scoped.agentId,'reader-b');assert.equal(scoped.daemon.agentId,'reader-b');
    assert.equal(scoped.unsharedSharesPage.total,10);assert.equal(scoped.unsharedShares.length,10);assert.equal(scoped.sessionsPage.total,13);
    assert(scoped.unsharedShares.every(x=>x.agent_id==='reader-b'));
    const collected=[];for(let offset=0;offset<23;offset+=10){const page=await readers.getInnerLifeShares(db,{agentId:'reader-b',status:'used',offset});collected.push(...page.items);}
    assert.equal(new Set(collected.map(x=>x.id)).size,23);assert(scoped.unsharedShares.some(x=>x.id==='long-body'));
    const all=[];let page;
    do {page=await readers.getSharedLines(db,{status:'active',offset:all.length});all.push(...page.items);} while(page.hasMore);
    assert(all.length>=123);assert(all.some(x=>x.id==='line-122'));
    const selectedPage=await readers.getSharedLines(db,{status:'active',selectedLineId:'line-122'});assert.equal(selectedPage.selectedLine.id,'line-122');
    const onlyB=await readers.getSharedLines(db,{agentId:'reader-b',status:'active'});assert.equal(onlyB.total,1);assert.equal(onlyB.items[0].id,'line-122');
    let text='',offset=0;
    do {page=await readers.getInnerLifeText(db,{id:'long-body',agentId:'reader-b',offset});assert(Array.from(page.body).length<=16000);text+=page.body;offset=page.nextOffset;} while(page.hasMore);
    assert.equal(text,longBody);assert(text.endsWith('END-MARKER'));
    await assert.rejects(readers.getInnerLifeText(db,{id:'long-body',agentId:'reader-a'}));
    assert.equal((await db.query("SELECT count(*) n FROM innerlife_daemon_state WHERE agent_id='reader-b';"))[0].n,0);
    db.exec=exec;
    results.push({probe:'bounded-scoped-readers',sharedLines:all.length,unshared:10,sharedHistory:23,fullUnicodeText:true,noWrites:true});
  } finally {db.close();fs.rmSync(root,{recursive:true,force:true});}
}

async function checkRendererPaging() {
  const {window,document,context,d,t}=dom();
  for(const node of document.querySelectorAll('select'))Object.defineProperty(node,'value',{writable:true,value:''});
  for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};}
  vm.runInContext(read('app/views/shared-innerlife.js'),context);
  vm.runInContext(read('app/innerlife-actions.js'),context);
  vm.runInContext(read('app/shared-line-actions.js'),context);
  const state={activeInnerLifeAgentFilter:'a',activeSharedLineAgentFilter:''};
  const snapshot={innerLife:{profiles:[{agentId:'a'},{agentId:'b'}]}};
  const fixture=id=>({agentId:id,profiles:[{agentId:'a'},{agentId:'b'}],daemon:{agentId:id,status:'enabled'},doctor:{status:'ok',issues:[]},
    unsharedShares:[{id:`${id}-share`,agent_id:id,status:'pending',body:'PREVIEW'}],unsharedSharesPage:{offset:0,limit:10,total:12,hasMore:true},
    sessions:[],sessionsPage:{offset:0,limit:10,total:11,hasMore:true}});
  let releaseA;const waitA=new Promise(r=>releaseA=r);let failText=true;let failPage=false;let calls=0;
  window.ClaraCoreDesktop={getInnerLife:async({agentId})=>{if(agentId==='a')await waitA;return fixture(agentId);},
    getInnerLifeShares:async input=>{calls++;if(failPage)throw Error('page failure');return {agentId:input.agentId,items:[{id:'b-next',agent_id:'b',status:'pending',body:'next'}],offset:10,limit:10,total:12,hasMore:false};},
    getInnerLifeSessions:async()=>({items:[{id:'session-more',agentId:'b',body:'session'}],agentId:'b',offset:10,limit:10,total:11,hasMore:false}),
    getInnerLifeText:async input=>{if(failText)throw Error('text failure');return {id:input.id,agentId:input.agentId,body:input.offset?'END-MARKER':'FULL ORIGINAL\n\nPARAGRAPH',offset:input.offset,nextOffset:input.offset?16010:16000,total:16010,hasMore:!input.offset};}};
  const view=context.createClaraCoreSharedInnerLifeView({dom:d,t,getSnapshot:()=>snapshot,state,escapeHtml:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),formatLocalDateTime:x=>x||'',filterByAgent:(rows,id)=>rows.filter(x=>(x.agent_id||x.agentId)===id),formatSharedLineMetaValue:String,renderReadableText:String,itemAgentId:x=>x.agent_id||x.agentId});
  const actions=context.createClaraCoreInnerLifeActions({desktop:window.ClaraCoreDesktop,dom:d,state,getSnapshot:()=>snapshot,renderInnerLife:view.renderInnerLife});actions.bindEvents();
  const first=actions.loadSnapshot();d.innerLifeAgentFilter.value='b';await actions.changeAgentFilter();releaseA();await first;
  assert.equal(state.innerLifeSnapshot.agentId,'b');assert(d.innerLifeUnsharedList.textContent.includes('PREVIEW'));assert(!d.innerLifeUnsharedList.innerHTML.includes('a-share'));
  d.innerLifeAllUnsharedAction.click();assert(d.innerLifeDetailBody.querySelector('[data-innerlife-more="unsharedShares"]'));
  failPage=true;d.innerLifeDetailBody.querySelector('[data-innerlife-more]').click();await new Promise(r=>setImmediate(r));assert(d.innerLifeDetailBody.textContent.includes(t('review.pageFailed')));
  failPage=false;d.innerLifeDetailBody.querySelector('[data-innerlife-more]').click();await new Promise(r=>setImmediate(r));assert.equal(calls,2);assert(state.innerLifeSnapshot.unsharedShares.some(x=>x.id==='b-next'));
  d.innerLifeDetailBody.querySelector('[data-innerlife-open="thought"]').click();await new Promise(r=>setImmediate(r));assert(d.innerLifeDetailBody.textContent.includes(t('review.pageFailed')));assert(!d.innerLifeDetailBody.textContent.includes('PREVIEW'));
  failText=false;d.innerLifeDetailBody.querySelector('[data-innerlife-text-offset]').click();await new Promise(r=>setImmediate(r));assert(d.innerLifeDetailBody.textContent.includes('FULL ORIGINAL\n\nPARAGRAPH'));
  d.innerLifeDetailBody.querySelector('[data-innerlife-text-offset="16000"]').click();await new Promise(r=>setImmediate(r));assert(d.innerLifeDetailBody.textContent.includes('END-MARKER'));
  state.activeInnerLifeAgentFilter='a';view.renderInnerLife();assert(!d.innerLifeDetailBody.textContent.includes('END-MARKER'));state.activeInnerLifeAgentFilter='b';view.renderInnerLife();
  document.querySelector('[data-innerlife-open="technical"]').click();d.innerLifeDetailBody.querySelector('[data-innerlife-more="sessions"]').click();await new Promise(r=>setImmediate(r));assert(d.innerLifeDetailBody.textContent.includes('session'));
  let linesCalls=0;
  const lines=context.createClaraCoreSharedLineActions({desktop:{getSharedLines:async input=>{linesCalls++;return {items:[{id:input.offset?'later':'first',agentId:'b',title:'fixture',status:input.status}],agents:['a','b'],offset:input.offset,limit:10,total:11,hasMore:!input.offset};}},dom:d,state,t,copyValue:async()=>true,renderSharedLine:()=>{}});
  await lines.loadCatalog();await lines.loadMoreCatalog('active');assert.equal(state.sharedLineCatalog.lines.length,2);assert.equal(linesCalls,3);
  results.push({probe:'renderer-boundaries',agentRace:true,pageRetry:true,textRetry:true,textPages:true,technicalMore:true,linePages:true});
}

async function checkRecallAndTranslations() {
  for(const lang of ['en','zh']) {
    const {window,context,document}=dom();vm.runInContext(read(`app/i18n/${lang}.js`),context);
    const words=window[`ClaraCoreTranslations${lang==='en'?'En':'Zh'}`];
    for(const file of ['app/views/memoria.js','app/views/shared-innerlife.js','app/views/data.js','app/views/knowledge.js'])for(const match of read(file).matchAll(/t\("(review\.[^"]+)"/g)) assert.equal(typeof words[match[1]],'string',`${lang}: ${match[1]}`);
    for(const node of document.querySelectorAll('[data-i18n],[data-i18n-aria-label]'))for(const attr of ['data-i18n','data-i18n-aria-label'])if(node.getAttribute(attr)?.startsWith('review.')) assert.equal(typeof words[node.getAttribute(attr)],'string');
    const t=(k,v={})=>(words[k]||k).replace(/\{(\w+)\}/g,(_,n)=>v[n]??'');
    const source=read('app/views/memoria.js');Object.assign(context,{t,escapeHtml:String,formatLocalDateTime:String});
    vm.runInContext(source.slice(source.indexOf('function recallReasonLabel'),source.indexOf('function setMemoryDialogPane')),context);
    const skipped=context.renderRecallEvent({stageA:{action:'NOOP'},cacheStatus:'none'});assert(skipped.includes(t('review.recallSkipped')));assert(!skipped.includes(t('review.recallRan')));
    assert(context.renderRecallEvent({stageA:{action:'RETRIEVE'},cacheStatus:'hit'}).includes(t('review.recallCached')));
    assert(context.renderRecallEvent({stageA:{action:'RETRIEVE'},error:'fixture failure'}).includes(t('review.recallFailed')));
    assert(context.renderRecallEvent({}).includes(t('review.recallUnknown')));
    if(lang==='en')assert(!/[\u4e00-\u9fff]/.test(skipped));
  }
  // Exercise the preload boundary with a serialized error rather than an Error object.
  let exposed;const preload=vm.createContext({require:name=>{assert.equal(name,'electron');return {contextBridge:{exposeInMainWorld:(_name,value)=>{exposed=value;}},ipcRenderer:{invoke:async()=>JSON.parse(JSON.stringify({knowledgeError:{code:'not_found',message:'missing'}})),on(){},removeListener(){}}};},process:{platform:'darwin'}});
  vm.runInContext(read('electron/preload.js'),preload);
  await assert.rejects(exposed.readKnowledgeDocument('notes/missing.md'),e=>e.code==='not_found');
  results.push({probe:'bilingual-recall-and-preload',noop:true,cache:true,error:true,unknown:true,serializedErrorCode:true});
}
