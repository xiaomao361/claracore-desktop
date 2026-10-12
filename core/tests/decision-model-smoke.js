const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { getDecisionModelSettings:get, saveDecisionModelSettings:save, listDecisionModels:list, evaluateDecisionModel:evaluate } = require('../decision-model/service');
async function main() {
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'decision-model-')); const app={getPath:()=>tmp};
 const crypto={isEncryptionAvailable:()=>true,encryptString:key=>Buffer.from(key.split('').reverse().join('')),decryptString:bytes=>bytes.toString().split('').reverse().join('')};
 let calls=0, sent, header, url, body={recall_domain:{choice:'knowledge',confidence:.95},knowledge_search_mode:{choice:'exact',confidence:.91}};
 const ports={crypto,fetch:async(endpoint,options)=>{calls++;url=endpoint;header=options.headers.Authorization;sent=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(body)}}]}));}};
 const config={provider:'openai-compatible',baseUrl:'https://example.com/v1/',model:'org/model:small',mode:'apply',timeoutMs:1200,apiKey:'generic-test-key'};
 try {
  assert.equal(get(app).provider,'openai-compatible'); assert.equal(get(app).mode,'off');
  assert.equal((await evaluate(app,'secret',{ },ports)).status,'disabled'); assert.equal(calls,0);
  // Migrate legacy TypeSafe settings without modifying the real user's file.
  fs.writeFileSync(path.join(tmp,'jev-settings.json'),JSON.stringify({enabled:true,model:'jev-latest',timeoutMs:1200,encryptedKey:crypto.encryptString('typesafe-test-key').toString('base64')}));
  assert.equal(get(app).provider,'typesafe'); assert.equal(get(app).mode,'shadow');
  save(app,{...config,apiKey:''},ports); assert(!get(app).keyConfigured);
  assert.equal((await evaluate(app,'query',{},ports)).status,'not_configured');assert.equal(calls,0);
  save(app,config,ports);
  const r=await evaluate(app,'用户查询',{},ports);
  assert.equal(url,'https://example.com/v1/chat/completions');assert.equal(header,'Bearer generic-test-key');
  assert.equal(r.status,'ok');assert.equal(r.provider,'openai-compatible');assert.equal(r.confidenceSource,'model_self_reported');
  assert(!Object.hasOwn(r,'probabilities'));assert.equal(r.knowledgeMode.suggestedMode,'exact');assert(!r.applied);
  assert.equal(sent.response_format.type,'json_object');assert.equal(sent.stream,false);
  assert.equal(sent.messages[1].content,JSON.stringify({query:'用户查询'}));assert(!JSON.stringify(sent).includes(tmp));
  const disk=fs.readFileSync(path.join(tmp,'jev-settings.json'),'utf8');assert(!disk.includes('generic-test-key'));assert(!disk.includes('typesafe-test-key'));
  assert(!JSON.stringify(get(app)).includes('encryptedKey'));
  await evaluate(app,'PRIVATE_DO_NOT_SEND',{test:true},ports);assert(!JSON.stringify(sent).includes('PRIVATE_DO_NOT_SEND'));
  const models=await list(app,{crypto,fetch:async(endpoint,options)=>{assert.equal(endpoint,'https://example.com/v1/models');assert.equal(options.method,'GET');assert.equal(options.headers.Authorization,'Bearer generic-test-key');return new Response(JSON.stringify({data:[{id:'org/model:small'},{id:'custom-other'}]}));}});
  assert.deepEqual(models.models.map(m=>m.name),['org/model:small','custom-other']);
  for (const [http,status] of [[401,'auth_failed'],[429,'rate_limited'],[503,'service_error'],[400,'service_error']]) {
   const result=await evaluate(app,'query',{}, {crypto,fetch:async()=>new Response('',{status:http})});assert.equal(result.status,status);assert.equal(result.httpStatus,http);
  }
  body={...body,knowledge_search_mode:{choice:'semantic',confidence:.4}};
  const low=await evaluate(app,'query',{},ports);assert.equal(low.status,'ok');assert.equal(low.knowledgeMode.status,'low_confidence');
  body={recall_domain:{choice:'unknown',confidence:.99},knowledge_search_mode:{choice:'exact',confidence:1}};
  assert.equal((await evaluate(app,'query',{},ports)).status,'malformed_response');
  for (const value of [{finish_reason:'length',message:{content:'{}'}},{finish_reason:'stop',message:{refusal:'no',content:'{}'}},{finish_reason:'stop',message:{content:'not-json'}}]) {
   assert.equal((await evaluate(app,'query',{}, {crypto,fetch:async()=>new Response(JSON.stringify({choices:[value]}))})).status,'malformed_response');
  }
  const timeout=await evaluate(app,'query',{}, {crypto,fetch:async(_,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('abort')),{once:true}))});assert.equal(timeout.status,'timeout');
  save(app,{...config,mode:'off',apiKey:''},ports);const before=calls;await evaluate(app,'query',{},ports);assert.equal(calls,before);assert(get(app).keyConfigured);
  // Key bindings survive round-trips, and never cross providers or hosts/paths.
  save(app,{provider:'typesafe',mode:'off',model:'jev-latest',timeoutMs:1200,apiKey:''},ports);assert(get(app).keyConfigured);
  let auth;
  await list(app,{crypto,fetch:async(_,options)=>{auth=options.headers.Authorization;return new Response(JSON.stringify({models:[]}));}});assert.equal(auth,'Bearer typesafe-test-key');
  save(app,{...config,baseUrl:'https://example.com/other',apiKey:''},ports);assert(!get(app).keyConfigured);
  save(app,{...config,apiKey:''},ports);assert(get(app).keyConfigured);
  save(app,{...config,mode:'off',apiKey:'',clearKey:true},ports);assert(!get(app).keyConfigured);
  save(app,{...config,mode:'off',apiKey:''},ports);assert(!get(app).keyConfigured,'Deleted current key must not return from history');
  for (const baseUrl of ['http://remote.example/v1','https://user:pass@example.com/v1','https://example.com/v1?key=x','file:///tmp/x']) assert.throws(()=>save(app,{...config,baseUrl},ports),{code:'jev_invalid_settings'});
  save(app,{...config,baseUrl:'http://127.0.0.1:1234/v1',mode:'off',apiKey:''},ports);assert.equal(get(app).baseUrl,'http://127.0.0.1:1234/v1');
  // Settings DOM: manual model names survive failed list fetches and a
  // provider switch clears draft credentials rather than sending them onward.
  const {parseHTML}=require('linkedom'); const vm=require('node:vm');
  const {createJevSettings}=require('../../app/views/jev-settings');
  const {document,window}=parseHTML(fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8'));
  const context=vm.createContext({document,window});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../../app/dom.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../../app/i18n/zh.js'),'utf8'),context);
  const dom=window.ClaraCoreDom;const t=key=>window.ClaraCoreTranslationsZh[key];
  const ui=createJevSettings({dom,t,api:{getJevSettings:async()=>get(app),saveJevSettings:async input=>save(app,input,ports),listJevModels:async()=>({status:'service_error',models:[]}),testJevConnection:async()=>({status:'ok',latencyMs:0})}});
  await ui.load();assert.equal(dom.jevProviderSummary.textContent,'OpenAI 兼容接口');
  dom.jevModel.value='manual-model';dom.jevModel.dispatchEvent(new window.Event('input',{bubbles:true}));
  dom.jevSave.click();await new Promise(resolve=>setImmediate(resolve));assert.equal(get(app).model,'manual-model');
  dom.jevRefreshModels.click();await new Promise(resolve=>setImmediate(resolve));assert.equal(dom.jevModel.value,'manual-model');
  dom.jevKey.value='DRAFT_KEY_MUST_CLEAR';
  for(const option of dom.jevProvider.querySelectorAll('option'))option.toggleAttribute('selected',option.getAttribute('value')==='typesafe');
  dom.jevProvider.dispatchEvent(new window.Event('change',{bubbles:true}));
  assert.equal(dom.jevKey.value,'');assert.equal(dom.jevBaseUrl.value,'https://api.typesafe.ai/v1');assert(dom.jevBaseUrl.disabled);
  assert.equal(dom.jevModel.value,'jev-latest');dom.jevSave.click();await new Promise(resolve=>setImmediate(resolve));assert.equal(get(app).provider,'typesafe');
  console.log('Decision models: OpenAI-compatible JSON routing/model list, legacy TypeSafe migration, provider/endpoint key isolation, off zero calls, HTTP status, malformed/refusal/truncation/timeout fallback passed. No live service or user data touched.');
 } finally {fs.rmSync(tmp,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
