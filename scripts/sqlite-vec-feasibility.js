// A0 experiment only: no product schema, runtime settings or daily data access.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { bundledSqlitePath } = require("../core/sqlite-binary");
const sqliteVec = require("sqlite-vec");

const expectedVersion = "v0.1.9";
const setup = `
  CREATE TABLE source(id INTEGER PRIMARY KEY, agent TEXT, status TEXT, sensitivity TEXT, space TEXT);
  INSERT INTO source VALUES
    (1,'clara','active','restricted','builtin'),
    (2,'clara','active','normal','builtin'),
    (3,'clara','active','normal','builtin'),
    (4,'other','active','normal','builtin'),
    (5,'clara','superseded','normal','builtin'),
    (6,'clara','active','normal','other-model');
  CREATE VIRTUAL TABLE vectors USING vec0(embedding float[2] distance_metric=cosine);
  INSERT INTO vectors(rowid,embedding) VALUES
    (1,'[1,0]'),(2,'[0.8,0.6]'),(3,'[0.6,0.8]'),
    (4,'[1,0]'),(5,'[1,0]'),(6,'[1,0]');
  CREATE VIRTUAL TABLE vectors512 USING vec0(embedding float[512] distance_metric=cosine);
  INSERT INTO vectors512(rowid,embedding) VALUES(1,'${JSON.stringify([1, ...Array(511).fill(0)])}');
`;
const filteredQuery = `
  SELECT rowid AS id, 1-distance AS similarity FROM vectors
  WHERE embedding MATCH '[1,0]' AND k=1
    AND rowid IN (SELECT id FROM source WHERE agent='clara' AND status='active'
      AND sensitivity!='restricted' AND space='builtin')
  ORDER BY distance;
`;
const dimensionQuery = `SELECT rowid AS id, distance FROM vectors512
  WHERE embedding MATCH '${JSON.stringify([1, ...Array(511).fill(0)])}' AND k=1;`;
const invalidDimension = "INSERT INTO vectors(rowid,embedding) VALUES(99,'[1,0,0]');";

function verifyRows(rows) {
  assert.equal(rows.length, 1, "Filter before KNN must retain an eligible result");
  assert.equal(Number(rows[0].id), 2, "Excluded nearest rows must not consume k=1");
  assert(Math.abs(rows[0].similarity - 0.8) < 1e-6, "cosine similarity = 1-distance within float32 tolerance");
}

function runChild(command, args, options = {}) {
  const child = spawnSync(command, args, { encoding: "utf8", timeout: 60000, ...options });
  if (child.error) throw child.error;
  return child;
}

function runProbe(mode) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "claracore-vec-a0-"));
  const dbPath = path.join(tempRoot, "experiment.db");
  const extensionPath = sqliteVec.getLoadablePath();
  let db;
  try {
    let rows;
    let version;
    let sqliteVersion;
    let dimensionFailure;
    let loadFailure;
    if (mode === "cli") {
      const executable = bundledSqlitePath();
      assert(executable, "A0 requires the bundled CLI, not an unverified system fallback");
      const query = (sql, library = extensionPath) => {
        // Fixed generated paths and stdin SQL; no shell or sqlite dot-command quoting.
        const quoted = library.replaceAll("'", "''");
        const result = runChild(executable, ["-bail", "-json", dbPath], {
          input: `SELECT load_extension('${quoted}');\n${sql}`
        });
        return result;
      };
      const execute = (sql) => {
        const result = query(sql);
        assert.equal(result.status, 0, result.stderr);
        // load_extension returns its own JSON result before the requested SELECT.
        const lines = result.stdout.trim().split(/\r?\n/);
        return lines.length > 1 ? JSON.parse(lines.slice(1).join("\n")) : [];
      };
      execute(setup);
      rows = execute(filteredQuery);
      const versions = execute("SELECT vec_version() AS vec, sqlite_version() AS sqlite;")[0];
      version = versions.vec;
      sqliteVersion = versions.sqlite;
      assert.equal(execute(dimensionQuery)[0].distance, 0);
      const invalid = query(invalidDimension);
      assert.notEqual(invalid.status, 0, "Dimension errors must fail the CLI request");
      dimensionFailure = invalid.stderr.trim();
      const missing = query("SELECT 1;", path.join(tempRoot, "missing-library"));
      assert.notEqual(missing.status, 0, "A missing library must fail the CLI request");
      loadFailure = missing.stderr.trim();
      assert.equal(execute("SELECT count(*) AS n FROM source;")[0].n, 6);
    } else {
      const { DatabaseSync } = require("node:sqlite");
      db = new DatabaseSync(dbPath, { allowExtension: true });
      db.loadExtension(extensionPath);
      db.exec(setup);
      rows = db.prepare(filteredQuery).all();
      const versions = db.prepare("SELECT vec_version() AS vec, sqlite_version() AS sqlite;").get();
      version = versions.vec;
      sqliteVersion = versions.sqlite;
      assert.equal(db.prepare(dimensionQuery).get().distance, 0);
      assert.throws(() => db.exec(invalidDimension), (error) => {
        dimensionFailure = error.message;
        return /dimension/i.test(error.message);
      });
      assert.throws(() => db.loadExtension(path.join(tempRoot, "missing-library")), (error) => {
        loadFailure = error.message;
        return true;
      });
      assert.equal(db.prepare("SELECT count(*) AS n FROM source;").get().n, 6);
    }
    verifyRows(rows);
    assert.equal(version, expectedVersion, "The experiment must use the pinned extension");
    return {
      mode, status: "passed", platform: process.platform, arch: process.arch,
      node: process.versions.node, electron: process.versions.electron || null,
      sqliteVersion, vecVersion: version, extensionPath,
      extensionSha256: crypto.createHash("sha256").update(fs.readFileSync(extensionPath)).digest("hex"),
      filteredTop1: rows, dimension512: "passed", dimensionFailure, loadFailure,
      sourceRowsAfterFailure: 6,
      verifiedTo: "temporary SQL experiment; not product projection or packaged-app acceptance"
    };
  } finally {
    db?.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function main() {
  const mode = process.argv[2];
  if (mode) {
    assert(["node", "cli", "electron-node"].includes(mode), "Unknown probe mode");
    console.log(JSON.stringify(runProbe(mode)));
    return;
  }
  const results = [];
  for (const target of ["node", "cli", "electron-node"]) {
    try {
      const executable = target === "electron-node" ? require("electron") : process.execPath;
      const child = runChild(executable, [__filename, target], {
        env: {
          ...process.env,
          ...(target === "electron-node" ? { ELECTRON_RUN_AS_NODE: "1" } : {})
        }
      });
      assert.equal(child.status, 0, child.stderr || child.stdout);
      results.push(JSON.parse(child.stdout));
    } catch (error) {
      // Keep independent runtime results visible; a failed runtime fails the suite.
      results.push({ mode: target, status: "failed", error: error.message });
    }
  }
  console.log(JSON.stringify({ suite: "sqlite-vec-feasibility", results }, null, 2));
  if (results.some((result) => result.status !== "passed")) process.exitCode = 1;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error); process.exitCode = 1; }
}
