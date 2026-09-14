const assert = require('assert/strict');
const fs = require('fs/promises'), os = require('os'), path = require('path');
const { initializeProductDatabase, ProductDatabase } = require('../db/database');
const { runScheduledBackup } = require('../runtime/scheduled-backup');
const { fileHash, pruneAutomaticBackups, retentionCutoff } = require('../runtime/backup-retention');
(async () => {
 const root = await fs.mkdtemp(path.join(os.tmpdir(), 'backup-retention-'));
 const db = await initializeProductDatabase(path.join(root, 'live.db'));
 const backupsDir = path.join(root, 'backups'), mirror = path.join(root, 'mirror');
 await fs.mkdir(backupsDir); await fs.mkdir(mirror);
 try {
  assert.equal(retentionCutoff('2026-09-09',7),'2026-09-03');
  assert.equal(retentionCutoff('2026-03-01',7),'2026-02-23');
  assert.throws(()=>retentionCutoff('2026-02-30',7));
  await assert.rejects(db.updateSettings({'backup.retention_days':0}));
  await assert.rejects(db.updateSettings({'backup.mirror_dir':'relative/path'}));
  const configuration=await db.getConfiguration({});assert.equal(configuration.backup.retentionDays,7);assert.equal(configuration.backup.mirrorDir,'');
  await db.createMemory({title:'Retained data',body:'Restore this representative memory'});
  let n=0;
  const createBackup=async()=>{const b=await db.createDatabaseBackup(path.join(backupsDir,`snapshot-${++n}.db`));const manifestPath=b.path.slice(0,-3)+'.json';await fs.writeFile(manifestPath,JSON.stringify({id:b.id}));return db.updateBackup(b.id,'verified',{manifestPath});};
  const manual=await createBackup();
  await db.updateSettings({'backup.schedule':'daily','backup.mirror_dir':mirror});
  const results=[];
  for(let day=1;day<=9;day++)results.push(await runScheduledBackup({database:db,createBackup,backupsDir,today:`2026-09-0${day}`}));
  assert.equal((await db.listBackups(100)).length,8,'Seven automatic days plus one manual backup');
  assert(await db.getBackup(manual.id));await fs.access(manual.path);
  for(const r of results.slice(0,2)){assert.equal(await db.getBackup(r.backupId),null);await assert.rejects(fs.access(r.path));await assert.rejects(fs.access(r.mirrorPath));await assert.rejects(fs.access(r.path.slice(0,-3)+'.json'));}
  for(const r of results.slice(2)){await fs.access(r.path);await fs.access(r.mirrorPath);assert.equal(await fileHash(r.path),await fileHash(r.mirrorPath));}
  const newest=results.at(-1);
  const restoredPath=path.join(root,'restored.db'); await fs.copyFile(newest.path,restoredPath);
  const restore=new ProductDatabase(restoredPath);
  try { assert.equal((await restore.query("SELECT body FROM memories WHERE title='Retained data'"))[0].body,'Restore this representative memory'); } finally {restore.close();}
  await db.updateSettings({'backup.retention_days':1,'backup.mirror_dir':''});
  await fs.rename(mirror,mirror+'-offline');
  const partial=await runScheduledBackup({database:db,createBackup,backupsDir,today:'2026-09-10'});
  assert.equal(partial.retention.pending.length,7,'Missing old mirror must remain visibly pending');
  assert(await db.getBackup(newest.backupId));
  await fs.rename(mirror+'-offline',mirror);
  const next=await runScheduledBackup({database:db,createBackup,backupsDir,today:'2026-09-11'});
  assert.equal(next.retention.deleted.length,8);
  assert.equal((await db.listBackups(100)).length,2);
  // A tampered managed backup or a path outside the managed root cannot be deleted.
  const prior=await db.getBackup(next.backupId);
  await db.updateBackup(prior.id,'verified',{automatic:{...prior.metadata.automatic,day:'2026-01-01'}});
  const manifestBytes=await fs.readFile(prior.metadata.manifestPath);await fs.appendFile(prior.metadata.manifestPath,'changed');
  await assert.rejects(pruneAutomaticBackups({database:db,backupsDir,keepId:'keep-other',today:'2026-09-12',retentionDays:7}),/manifest changed/);
  await fs.writeFile(prior.metadata.manifestPath,manifestBytes);
  await db.updateBackup(prior.id,'verified',{automatic:{...prior.metadata.automatic,day:'2026-01-01',localRoot:path.dirname(root)}});
  await assert.rejects(pruneAutomaticBackups({database:db,backupsDir,keepId:'keep-other',today:'2026-09-12',retentionDays:7}),/outside/);
  await fs.access(prior.path);
  console.log('7 calendar days, mirror cleanup, manual protection, local-only default, offline pending/recovery and path safety passed');
 } finally { db.close(); await fs.rm(root,{recursive:true,force:true}); }
})().catch(error=>{console.error(error);process.exitCode=1});
