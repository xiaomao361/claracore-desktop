const assert=require('assert/strict');
const fs=require('fs/promises'),os=require('os'),path=require('path');
const {initializeProductDatabase}=require('../db/database');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'innerlife-candidates-'));
 const db=await initializeProductDatabase(path.join(root,'db.sqlite'));
 try {
  await db.updateSettings({'innerlife.provider':'disabled'});
  await db.ensureInnerLifeProfile('quiet-agent');await db.ensureInnerLifeProfile('busy-agent');
  await db.exec("INSERT INTO innerlife_shares(id,agent_id,status,body,created_at,updated_at) VALUES('own-share','quiet-agent','pending','Distinct own candidate','2026-01-01','2026-01-01');");
  for(let i=0;i<30;i++)await db.exec(`INSERT INTO innerlife_shares(id,agent_id,status,body) VALUES('busy-${i}','busy-agent','pending','Other agent candidate');`);
  const briefing=await db.getInnerLifeBriefing({agentId:'quiet-agent'});
  assert(JSON.stringify(briefing).includes('own-share'));
  assert(!JSON.stringify(briefing).includes('busy-0'));
  const result=await db.startInnerLifeSession({agentId:'quiet-agent',externalSessionId:'candidate-scope'});
  assert.equal(result.share_plan.share.id,'own-share');
  let prompt='';db.innerLifeGenerate=async input=>{if(input.system===require('../innerlife/grounding').REVIEW_SYSTEM)return JSON.stringify({decision:'allow',reason:'new general thought',personalClaims:[]});prompt=input.prompt;return 'Consolidated own thought';};
  await db.convergeInnerLife({agentId:'quiet-agent'});
  assert(prompt.includes('Distinct own candidate'));
  assert(!prompt.includes('Other agent candidate'));
  console.log('InnerLife own candidates survive 30 newer foreign shares: briefing, start and convergence passed');
 } finally{db.close();await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
