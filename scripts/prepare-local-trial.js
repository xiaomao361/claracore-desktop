// Prepare a private data copy and a user-run launcher. Never starts an app.
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert/strict');
const { execFileSync } = require('child_process');
const [appPath, snapshotPath] = process.argv.slice(2);
assert(appPath && snapshotPath, 'Usage: node scripts/prepare-local-trial.js /absolute/App.app /absolute/snapshot.db');
assert(path.isAbsolute(appPath) && path.isAbsolute(snapshotPath), 'Use absolute paths');
const executable = path.join(appPath, 'Contents/MacOS/ClaraCore Desktop');
assert(fs.statSync(executable).isFile());
assert(fs.statSync(snapshotPath).isFile());
const parent = path.join(os.homedir(), 'Library/Application Support/claracore-desktop-trials');
fs.mkdirSync(parent, {recursive:true,mode:0o700});
const root = fs.mkdtempSync(path.join(parent, 'v0.7.0-'));
fs.chmodSync(root,0o700);
const data = path.join(root,'data'), userData = path.join(root,'user-data');
fs.mkdirSync(data,{mode:0o700}); fs.mkdirSync(userData,{mode:0o700});
const target = path.join(data,'claracore.db');
execFileSync('python3',['-c',`
import sqlite3,sys,pathlib
source=sqlite3.connect(pathlib.Path(sys.argv[1]).as_uri()+'?mode=ro',uri=True)
target=sqlite3.connect(sys.argv[2])
source.backup(target)
assert target.execute('PRAGMA quick_check').fetchone()[0]=='ok'
target.close();source.close()
`,snapshotPath,target]);
fs.chmodSync(target,0o600);
const quote = value => "'" + value.replace(/'/g, "'\\''") + "'";
const launcher = path.join(root,'启动隔离试用.command');
const env = {
 CLARACORE_DESKTOP_TEST_INSTANCE:'1',
 CLARACORE_DESKTOP_USER_DATA_DIR:userData,
 CLARACORE_DESKTOP_DATA_DIR:data,
 CLARACORE_DESKTOP_HTTP_PORT:'0',
 CLARACORE_DESKTOP_VECTOR_ENGINE:'sqlite-vec',
 CLARACORE_DESKTOP_DISABLE_SCHEDULERS:'1'
};
const body = '#!/bin/zsh\nset -eu\n' + Object.entries(env).map(([k,v])=>'export '+k+'='+quote(v)).join('\n') + '\nunset ELECTRON_RUN_AS_NODE\nexec '+quote(executable)+'\n';
fs.writeFileSync(launcher,body,{mode:0o700});
execFileSync('/bin/zsh',['-n',launcher]);
fs.writeFileSync(path.join(root,'README.txt'),'此目录只包含隔离数据副本。通过“启动隔离试用.command”启动；不要将 App 复制覆盖日用版。\nGateway 使用独立随机端口；后台 InnerLife、embedding 和维护调度暂停。手动搜索仍会调用副本里配置的 embedding 服务。\n试用中的修改只保留在此副本，不会自动合并回日用库。\n关闭试用窗口后可从托盘退出试用进程。\n');
console.log(JSON.stringify({root,launcher,dataRoot:data,prepared:true,launched:false}));
