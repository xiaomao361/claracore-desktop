const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { createKnowledgeContext } = require('../gateway/knowledge-context');
const { searchKnowledge } = require('../knowledge/search');
const { saveKnowledgeRootPreference } = require('../knowledge/preferences');
const { arbitrateAutomaticContext } = require('../gateway/auto-context');
const { handleSystemTool } = require('../gateway/tool-handlers/system');
async function main() {
 const tmp = fs.mkdtempSync(path.join(os.tmpdir(),'knowledge-context-')); const root = path.join(tmp,'corpus');
 const app = {getPath:()=>path.join(tmp,'data')};
 try {
  fs.mkdirSync(path.join(root,'notes'),{recursive:true});
  const file=path.join(root,'notes/test.md');
  const write=body=>fs.writeFileSync(file,`# Title\n<a id="section"></a>\n## Section\n来源：https://example.com\n日期：2026-09-22\n${body}`);
  write('完整短小节 target'); await saveKnowledgeRootPreference(app,root);
  const empty=arbitrateAutomaticContext({domainStatus:{memory:'ok',innerlife:'not_collected'}});
  const memory=arbitrateAutomaticContext({agentId:'a',memoryCandidates:[{id:'m1',action:'INJECT_TOP1',policyMode:'canary',context:'记忆。'.repeat(1000),relevance:.9}]});
  let search=await searchKnowledge(app,{query:'target'});
  let result=await createKnowledgeContext(app,empty,search); assert.equal(result.decision,'deliver_context'); assert.equal(result.blocks.length,1); assert.equal(result.blocks[0].truncated,false); assert(result.blocks[0].body.includes('完整短小节'));
  result=await createKnowledgeContext(app,memory,search); assert.deepEqual(result.blocks.map(b=>b.domain),['memory','knowledge']); assert(Buffer.byteLength(JSON.stringify(result.blocks))<=2400);
  write('长段落。'.repeat(1000)+'尾部target'); search=await searchKnowledge(app,{query:'target'});
  result=await createKnowledgeContext(app,memory,search); assert(result.blocks[1].truncated); assert(result.blocks[1].body.includes('target')); assert(result.blocks[1].detailRef.arguments.reference.endsWith('#section')); assert(Buffer.byteLength(JSON.stringify(result.blocks))<=2400);
  write('modified'); result=await createKnowledgeContext(app,memory,search); assert.equal(result.domainStatus.knowledge,'index_stale'); assert.equal(result.blocks.length,1); assert.equal(result.blocks[0].domain,'memory');
  result=await createKnowledgeContext(app,empty,{status:'no_results',items:[]}); assert.equal(result.decision,'abstain');
  const timeout=await createKnowledgeContext(app,{...empty,domainStatus:{knowledge:'timeout'}},null); assert.equal(timeout.domainStatus.knowledge,'timeout');
  const context={core:{database:{getSettings:async()=>({})}},currentMcpAgentId:()=> 'a',runtimeAppForGateway:()=>app,textResult:x=>x};
  const old=await handleSystemTool('gateway_auto_context',{prompt:'modified',domain:'knowledge',mode:'exact'},context); assert.equal(old.decision,'abstain'); assert.equal(old.block,null); assert(old.knowledgeObservation.items.length);
  const modern=await handleSystemTool('gateway_auto_context',{prompt:'modified',domain:'knowledge',mode:'exact',deliveryContract:'memory-knowledge-v1'},context); assert.equal(modern.decision,'deliver_context'); assert.equal(modern.blocks[0].domain,'knowledge');
  const skipped=await handleSystemTool('gateway_auto_context',{prompt:'continue',turnKind:'goal_continuation',deliveryContract:'memory-knowledge-v1'},{currentMcpAgentId:()=> 'a',textResult:x=>x}); assert.deepEqual(skipped.blocks,[]); assert(skipped.collectionSkipped);
  console.log('Knowledge context: complete sections, shared serialized budget, matching tail excerpt, stale-source refusal, legacy compatibility, dual/empty/goal paths passed');
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
