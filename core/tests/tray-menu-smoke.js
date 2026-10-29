const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {buildTrayTemplate, createTrayNavigation} = require('../../electron/tray-menu');
async function main() {
  const shown=[], sent=[];
  const navigation=createTrayNavigation({show:async()=>shown.push(true),send:view=>sent.push(view)});
  await navigation.open('memory');await navigation.open('knowledge');
  assert.deepEqual(sent,[]);navigation.ready();assert.deepEqual(sent,['knowledge']);
  await navigation.open('settings');assert.deepEqual(sent,['knowledge','settings']);
  navigation.loading();await navigation.open('logs');assert.equal(sent.length,2);navigation.ready();assert.equal(sent.at(-1),'logs');
  await navigation.open('__proto__');assert.equal(shown.length,4);
  for (const language of ['zh','en','unknown']) {
    const actions=[], errors=[];
    const menu=buildTrayTemplate({language,version:'1.0.6',show:()=>actions.push('show'),hide:()=>actions.push('hide'),navigate:view=>actions.push(view),
      openData:()=>actions.push('data'),openKnowledge:()=>Promise.reject(Error('permission denied')),quit:()=>actions.push('quit'),onError:(title,error)=>errors.push([title,error.message])});
    assert.equal(menu[0].enabled,false);assert(menu[0].label.includes('1.0.6'));
    const pages=menu.find(item=>item.submenu).submenu;
    assert.equal(pages.length,6);
    for(const item of pages)await item.click();
    for(const item of menu.filter(item=>item.click))await item.click();
    assert.deepEqual(actions,['home','memory','knowledge','shared-line','innerlife','logs','show','hide','agent-setup','settings','data','quit']);
    assert.equal(errors.length,1);assert.equal(errors[0][1],'permission denied');
  }
  // Exercise the sandboxed preload boundary without launching Electron or a window.
  let api;const listeners=new Map();const trace=[];
  const ipcRenderer={on:(key,fn)=>{listeners.set(key,fn);trace.push('listen');},send:key=>trace.push(key),removeListener:(key,fn)=>{assert.equal(listeners.get(key),fn);listeners.delete(key);}};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../../electron/preload.js'),'utf8'),{require:()=>({contextBridge:{exposeInMainWorld:(_name,value)=>api=value},ipcRenderer})});
  const destinations=[];const unsubscribe=api.onTrayNavigate(view=>destinations.push(view));
  assert.deepEqual(trace,['listen','claracore:trayReady']);listeners.get('claracore:trayNavigate')({sender:'private'},'memory');
  assert.deepEqual(destinations,['memory']);unsubscribe();assert.equal(listeners.size,0);
  console.log('Tray menu passed: bilingual destinations/actions, startup/reload latest selection, failed actions and sandboxed subscription; no host UI.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
