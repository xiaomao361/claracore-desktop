const assert = require('assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { initializeProductDatabase } = require('../db/database');
const { runScheduledBackup } = require('../runtime/scheduled-backup');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'scheduled-backup-'));
 const db=await initializeProductDatabase(path.join(root,'source.db'));
 try{
  await db.createMemory({title:'Restore example',body:'Keep this unique memory'});
  let count=0;
  const createBackup=async()=>{count++; const b=await db.createDatabaseBackup(path.join(root,'backup-'+count+'.db'));return db.updateBackup(b.id,'verified');};
  assert.equal((await runScheduledBackup({database:db,createBackup,today:'2026-09-09'})).skipped,'manual_or_disabled');
  const mirror=path.join(root,'mirror');
  await db.updateSettings({'backup.schedule':'daily','backup.mirror_dir':mirror});
  await assert.rejects(runScheduledBackup({database:db,createBackup,today:'2026-09-09'}),/ENOENT/);
  assert.equal(count,1);
  const failure = (await db.listRuntimeEvents({source:'backup',limit:1}))[0];
  assert.equal(failure.level,'error');assert.equal(failure.metadata.stage,'mirror');
  assert.notEqual((await db.getSettings())['backup.last_run_date'],'2026-09-09');
  await fs.mkdir(mirror);
  const result=await runScheduledBackup({database:db,createBackup,today:'2026-09-09'});
  assert.equal(count,1,'Retry must reuse the same local snapshot');
  assert.deepEqual(await fs.readFile(result.path),await fs.readFile(result.mirrorPath));
  assert.equal((await runScheduledBackup({database:db,createBackup,today:'2026-09-09'})).skipped,'already_completed');
  await assert.rejects(runScheduledBackup({database:db,createBackup:async()=>({status:'failed'}),today:'2026-09-10'}),/not verified/);
  assert.equal((await db.getSettings())['backup.last_run_date'],'2026-09-09');
  const empty=path.join(root,'empty.db');await fs.writeFile(empty,'');
  await assert.rejects(runScheduledBackup({database:db,createBackup:async()=>({id:'invalid-empty',path:empty,status:'verified'}),today:'2026-09-11'}),/no such table/);
  assert.equal((await db.getSettings())['backup.last_run_date'],'2026-09-09');
  console.log('scheduled backup: disabled/manual, restored snapshot mirror, offline retry reuse and failed verification passed');
 }finally{db.close();await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
