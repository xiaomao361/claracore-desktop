const assert=require('assert/strict');
const {createSchedulers}=require('../../electron/schedulers');
(async()=>{
 const calls=[];
 const db={getSettings:async()=>({'backup.schedule':'daily'}),cleanupMemoryControlLedger:async()=>{calls.push('cleanup');throw new Error('Must not run after backup failure');}};
 const scheduler=createSchedulers({app:{},ensureProductCore:async()=>({database:db}),isQuitting:()=>false,notifyRuntimeChanged:()=>{},runProductScheduledBackup:async()=>{calls.push('backup');throw new Error('Mirror offline');},runProductMemoryMaintenance:async()=>{calls.push('maintenance');},saveProductSettings:async()=>{calls.push('saved');}});
 const saved=console.error;console.error=()=>{};
 try{const result=await scheduler.runMemoryMaintenanceScheduledTick();assert.equal(result.ok,false);assert.equal(result.error,'Mirror offline');assert.deepEqual(calls,['backup']);}finally{console.error=saved;}
 console.log('Backup failure blocks destructive maintenance and completion marker');
})().catch(e=>{console.error(e);process.exitCode=1});
