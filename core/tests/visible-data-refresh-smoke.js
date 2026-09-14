const assert = require('assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { createClaraCoreResourceRefreshLoop } = require('../../app/resource-refresh');

async function main() {
  const source = fs.readFileSync(path.join(__dirname,'../../app.js'),'utf8');
  const events = new Map();
  let scheduled, editing=false, sourceRevision=1, reads=0, memoryRenders=0, lineRenders=0, fail=false;
  const document = {hidden:false, activeElement:{matches:()=>editing}, querySelector:()=>null,
    addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:(name)=>events.delete(name)};
  const context = vm.createContext({console, document, memorySearchInput:{value:''},
    window:{ClaraCoreDesktop:{
      getRuntimeSnapshot:async()=>{reads++;if(fail)throw new Error('fixture read failure');return {revision:sourceRevision,sharedLine:{revision:sourceRevision}}},
      getDataRootPreference:async()=>({})}},
    renderTopbarStatus:()=>{},renderMemoryOverview:()=>memoryRenders++,renderHomeDashboard:()=>{},
    renderSnapshot:()=>{throw new Error('Background refresh must not redraw settings/editors')},
    rendererState:{},sharedLineActions:{syncSelectedLineCatalog:()=>{}},
    memoriaView:{resetLoadedTabs:()=>{}},
    invalidatedViewsForRuntimeScopes:()=>new Set(['memory','shared-line']),
    mergeHydratedViewState:(next)=>next,
    hydrateView:async(view)=>{if(view==='shared-line')lineRenders++},refreshLogsSnapshot:async()=>{}});
  vm.runInContext("var snapshot={revision:0}, activeView='memory', snapshotGeneration=0, runtimeRefreshRevision=0, runtimeRefreshCompletedRevision=0; var hydratedViews=new Set(['memory','shared-line']);",context);
  for(const [start,end] of [
    ['async function refreshRuntimeSnapshotOnly','async function refreshLogsSnapshot'],
    ['async function refreshForRuntimeScopes','function syncLogRefreshTimer'],
    ['function canRefreshVisibleData','const dataRefreshLoop']
  ])vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end)),context);
  const errors=[];
  const loop=createClaraCoreResourceRefreshLoop({documentRef:document,windowRef:document,refreshOnResume:true,
    canRefresh:()=>vm.runInContext('canRefreshVisibleData()',context),
    fetchSnapshot:()=>vm.runInContext('refreshForRuntimeScopes(["memory","shared-line"],{visibleOnly:true})',context),
    renderSnapshot:()=>{},handleError:e=>errors.push(e.message),setTimer:fn=>{scheduled=fn;return 1},clearTimer:()=>{scheduled=null}});
  const flush=async()=>{for(let i=0;i<35;i++)await Promise.resolve()};
  await loop.start();assert.equal(memoryRenders,1);assert.equal(vm.runInContext('snapshot.revision',context),1);
  sourceRevision=2;scheduled();await flush();assert.equal(vm.runInContext('snapshot.revision',context),2,'Visible cadence observes external writes');
  document.hidden=true;events.get('visibilitychange')();assert.equal(scheduled,null);
  sourceRevision=3;document.hidden=false;events.get('visibilitychange')();await flush();assert.equal(vm.runInContext('snapshot.revision',context),3,'Returning after days reads fresh state');
  editing=true;sourceRevision=4;const previous=reads;events.get('focus')();await flush();assert.equal(reads,previous,'Focused input postpones refresh');
  editing=false;events.get('focus')();await flush();assert.equal(vm.runInContext('snapshot.revision',context),4);
  vm.runInContext("activeView='shared-line'",context);await loop.refreshNow();assert(lineRenders>0);
  fail=true;sourceRevision=5;await loop.refreshNow();assert.equal(errors.length,1);assert.equal(vm.runInContext('snapshot.revision',context),4);
  fail=false;await loop.refreshNow();assert.equal(vm.runInContext('snapshot.revision',context),5);
  vm.runInContext("activeView='memory';memorySearchInput.value='user query'",context);const beforeSearch=reads;await loop.refreshNow();assert.equal(reads,beforeSearch,'Submitted searches are not replaced by recent lists');
  vm.runInContext("activeView='settings'",context);const beforeSettings=reads;await loop.refreshNow();assert(reads>beforeSettings,'Settings status refreshes without full editor redraw');
  loop.stop();assert.equal(events.size,0);assert.equal(scheduled,null);
  console.log(JSON.stringify({suite:'visible-data-refresh',externalUpdates:true,resume:true,editProtection:true,searchProtection:true,retry:true,passed:true}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
