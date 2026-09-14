const assert = require('assert/strict');
const { EventEmitter } = require('events');
const { createSchedulers, nextMemoryMaintenanceDelayMs } = require('../../electron/schedulers');
const { createClaraCoreResourceRefreshLoop } = require('../../app/resource-refresh');
(async () => {
  const today = '2026-09-11';
  const settings = { 'memory.maintenance.hour': 3, 'memory.maintenance.last_run_date': today,
    'backup.enabled': true, 'backup.schedule': 'daily', 'backup.last_run_date': '2026-09-10' };
  assert.equal(nextMemoryMaintenanceDelayMs(settings, new Date(2026,8,11,10)), 0);
  const powerMonitor = new EventEmitter();
  let clock = new Date(2026,8,11,10), backups = 0, cleanups = 0;
  const timers = new Map(); let id = 0;
  const scheduler = createSchedulers({ app:{}, powerMonitor, now:()=>clock, isQuitting:()=>false,
    ensureProductCore:async()=>({database:{getSettings:async()=>settings, processPendingEmbeddings:async()=>({processed:0}),
      cleanupMemoryControlLedger:async()=>{cleanups++;return {};}, cleanupGatewayTraces:async()=>({}),cleanupInnerLifeHistory:async()=>({}),recordRuntimeEvent:async()=>{}}}),
    notifyRuntimeChanged:()=>{},runProductScheduledBackup:async()=>{backups++;settings['backup.last_run_date']=`${clock.getFullYear()}-09-${clock.getDate()}`;},
    runProductMemoryMaintenance:async()=>({}),saveProductSettings:async(_,v)=>Object.assign(settings,v),
    setMaintenanceTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearMaintenanceTimeout:i=>timers.delete(i) });
  const flush = async()=>{for(let i=0;i<60;i++)await Promise.resolve();};
  const fire = async()=>{const [i,t]=[...timers][0];timers.delete(i);await t.fn();};
  try {
    scheduler.start();await flush();assert.equal(powerMonitor.listenerCount('resume'),1);
    await fire();assert.equal(backups,1);assert.equal(cleanups,0,'Backup catch-up must not repeat completed cleanup');
    clock = new Date(2026,8,12,10);powerMonitor.emit('resume');await flush();
    assert.equal(timers.size,1);assert.equal([...timers.values()][0].delay,0,'Resume after missed hour catches up');
    await fire();assert.equal(backups,2);assert.equal(cleanups,1);
    powerMonitor.emit('resume');await flush();assert([...timers.values()][0].delay>0,'Same-day wake does not repeat work');
  } finally {scheduler.stop();}
  assert.equal(powerMonitor.listenerCount('resume'),0);assert.equal(timers.size,0);

  const tasks = new Map();let serial=0,resolveOld,reads=0;const rendered=[],errors=[];
  const loop=createClaraCoreResourceRefreshLoop({documentRef:{hidden:false,addEventListener(){},removeEventListener(){}},requestTimeoutMs:15,
    setTimer:(fn,delay)=>{tasks.set(++serial,{fn,delay});return serial;},clearTimer:id=>tasks.delete(id),
    fetchSnapshot:()=>++reads===1?new Promise(r=>{resolveOld=r;}):Promise.resolve('fresh'),
    renderSnapshot:value=>rendered.push(value),handleError:e=>errors.push(e.message)});
  const first=loop.start();await flush();[...tasks.values()].find(t=>t.delay===15).fn();await first;
  assert.equal(errors.length,1);await loop.refreshNow();resolveOld('stale');await flush();
  assert.deepEqual(rendered,['fresh'],'Late timed-out response must not overwrite recovery');loop.stop();assert.equal(tasks.size,0);
  console.log('Missed-hour wake, same-day idempotency, backup-only catch-up, listener cleanup and hung-refresh recovery passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
