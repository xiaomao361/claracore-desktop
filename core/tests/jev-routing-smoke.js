const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { chooseRecallRoute, collectWithJev, recallReceipt } = require('../jev/recall-route');
const { saveJevSettings, getJevSettings } = require('../jev/service');
const { createTurnContextService } = require('../gateway/turn-context');
const { searchKnowledge } = require('../knowledge/search');
const { saveKnowledgeRootPreference } = require('../knowledge/preferences');
const { createKnowledgeContext } = require('../gateway/knowledge-context');
const { arbitrateAutomaticContext } = require('../gateway/auto-context');
async function main() {
 const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jev-routing-')); const app = {getPath:()=>tmp};
 const input = {prompt:'tomatoes', deliveryContract:'memory-knowledge-v1'};
 const advice = {mode:'apply', status:'ok', suggestedDomain:'knowledge', knowledgeMode:{status:'ok',suggestedMode:'exact'}};
 try {
  // Old enabled configs retain observation; saving adopt is explicit.
  fs.writeFileSync(path.join(tmp,'jev-settings.json'), JSON.stringify({enabled:true,model:'jev-latest',timeoutMs:1200}));
  assert.equal(getJevSettings(app).mode,'shadow');
  saveJevSettings(app,{mode:'apply',model:'jev-latest',timeoutMs:1200});
  assert.equal(getJevSettings(app).mode,'apply');
  assert.throws(()=>saveJevSettings(app,{mode:'invalid',model:'jev-latest',timeoutMs:1200}),{code:'jev_invalid_settings'});
  for (const domain of ['none','memory','knowledge','both']) {
   const route=chooseRecallRoute(input,{...advice,suggestedDomain:domain});
   assert.equal(route.effective.domain,domain); assert(route.jev.domainApplied);
   assert.equal(route.jev.knowledgeMode.applied,['knowledge','both'].includes(domain));
  }
  const explicit=chooseRecallRoute({...input,domain:'both',mode:'hybrid'},advice);
  assert(!explicit.jev.applied); assert.equal(explicit.effective.mode,'hybrid');
  assert.equal(explicit.jev.route.reasons.domain,'explicit_choice');
  const legacy=chooseRecallRoute({...input,deliveryContract:undefined},advice);
  assert(!legacy.jev.applied); assert.equal(legacy.jev.route.reasons.domain,'host_contract_required');
  assert(!chooseRecallRoute(input,{...advice,mode:'shadow'}).jev.applied);
  for (const status of ['low_confidence','timeout','auth_failed','rate_limited','malformed_response','unavailable','jev_config_corrupt']) {
   const route=chooseRecallRoute(input,{...advice,status,knowledgeMode:{status}});
   assert(!route.jev.applied); assert.equal(route.jev.route.effective.domain,'both');
   assert.equal(route.jev.route.reasons.domain,status);
  }
  const independent=chooseRecallRoute(input,{...advice,status:'low_confidence'});
  assert(!independent.jev.domainApplied); assert(independent.jev.knowledgeMode.applied);
  const modeFailure=chooseRecallRoute(input,{...advice,knowledgeMode:{status:'malformed_response'}});
  assert(modeFailure.jev.domainApplied); assert(!modeFailure.jev.knowledgeMode.applied);
  // Real local retrieval -> bounded projection -> host adapter consuming body.
  const root=path.join(tmp,'corpus'); fs.mkdirSync(path.join(root,'notes'),{recursive:true});
  fs.writeFileSync(path.join(root,'notes/tomatoes.md'),'# Gardening\n## Tomatoes\nWater tomatoes at the roots.\n');
  await saveKnowledgeRootPreference(app,root);
  let memoryCalls=0; const queries=[];
  const service=createTurnContextService({runMemoryController:async()=>{memoryCalls++;return {action:'NOOP',context:''};},searchKnowledge:async(_,q)=>{queries.push(q);return searchKnowledge(app,q);}});
  const collect=(core,q)=>service.collect(core,q);
  const collected=await collectWithJev(app,{},input,collect,{evaluate:async()=>advice});
  assert.equal(memoryCalls,0); assert.equal(queries[0].mode,'exact'); assert(collected.jev.applied);
  const packet=await createKnowledgeContext(app,arbitrateAutomaticContext({domainStatus:collected.domainStatus}),collected.knowledgeSearch);
  assert.equal(packet.decision,'deliver_context'); assert.equal(packet.blocks[0].domain,'knowledge');
  assert(packet.blocks[0].detailRef); assert(packet.budget.serializedBlocksBytes<=2400);
  const injected=packet.decision==='deliver_context'?packet.blocks.map(b=>b.body).join('\n'):'';
  assert(injected.includes('Water tomatoes at the roots.'));
  const receipt=recallReceipt(packet,collected); assert.equal(receipt.hostDelivery,'unknown'); assert.equal(receipt.used,'unknown');
  assert(receipt.selected.length); assert(receipt.preparedBytes>0);
  const fallback=await collectWithJev(app,{}, {...input,mode:'exact'},collect,{evaluate:async()=>({...advice,status:'timeout',knowledgeMode:{status:'timeout'}})});
  assert.equal(memoryCalls,1); assert.equal(fallback.domainStatus.knowledge,'ok'); assert(!fallback.jev.applied);
  const none=await collectWithJev(app,{},input,collect,{evaluate:async()=>({...advice,suggestedDomain:'none'})});
  assert.equal(memoryCalls,1); assert.equal(none.domainStatus.knowledge,'skipped');
  // Old host cannot lose Memory through a Knowledge-only recommendation.
  await collectWithJev(app,{}, {...input,deliveryContract:undefined,mode:'exact'},collect,{evaluate:async()=>advice});
  assert.equal(memoryCalls,2);
  // Exercise the production handler with a stubbed external model boundary.
  const jevService=require('../jev/service'); const originalEvaluate=jevService.evaluateDecisionModel;
  const routeModule=require.resolve('../jev/recall-route'); const systemModule=require.resolve('../gateway/tool-handlers/system');
  try {
   jevService.evaluateDecisionModel=async()=>advice;
   delete require.cache[routeModule]; delete require.cache[systemModule];
   const {handleSystemTool}=require('../gateway/tool-handlers/system');
   const context={core:{database:{getSettings:async()=>({})}},currentMcpAgentId:()=> 'a',runtimeAppForGateway:()=>app,textResult:x=>x};
   const modern=await handleSystemTool('gateway_auto_context',{...input,detail:'full'},context);
   assert(modern.jev.applied); assert(modern.jev.domainApplied);
   assert.equal(modern.decision,'deliver_context'); assert(modern.blocks[0].body.includes('Water tomatoes'));
   assert.equal(modern.recallReceipt.used,'unknown'); assert(modern.recallReceipt.selected.length);
   const old=await handleSystemTool('gateway_auto_context',{prompt:'tomatoes',domain:'knowledge',mode:'exact'},context);
   assert(!old.jev.applied); assert.equal(old.block,null); assert.equal(old.recallReceipt.hostDelivery,'unknown');
   const goal=await handleSystemTool('gateway_auto_context',{...input,turnKind:'goal_continuation'},context);
   assert(goal.collectionSkipped); assert.deepEqual(goal.blocks,[]);
  } finally {
   jevService.evaluateDecisionModel=originalEvaluate; delete require.cache[routeModule]; delete require.cache[systemModule];
  }
  const stale={...collected.knowledgeSearch}; fs.appendFileSync(path.join(root,'notes/tomatoes.md'),'changed');
  const rejected=await createKnowledgeContext(app,arbitrateAutomaticContext({domainStatus:collected.domainStatus}),stale);
  assert.equal(rejected.domainStatus.knowledge,'index_stale'); assert.equal(rejected.decision,'abstain');
  console.log('Jev routing: four domains, explicit precedence, independent fallback, legacy migration/host gate, actual local retrieval -> bounded blocks -> simulated host injection passed. Actual host use and model benefit not measured.');
 } finally {fs.rmSync(tmp,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
