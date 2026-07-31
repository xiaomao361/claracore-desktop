const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  discoverJavaScriptFiles,
  lintDirectory,
  lintSource
} = require("./sql-interpolation-lint");

function writeFixture(root, relativePath, source) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, source);
}

function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "claracore-sql-lint-smoke-"));
  try {
    writeFixture(root, "top.js", "const query = `SELECT * FROM records WHERE id = ${sqlString(rawInput)};`;\n");
    writeFixture(root, "nested/unsafe.js", "const query = `SELECT * FROM records WHERE id = ${rawInput};`;\n");
    writeFixture(root, "nested/ignored.txt", "const query = `SELECT * FROM records WHERE id = ${rawInput};`;\n");
    writeFixture(
      root,
      "migrations/005_memory_controller_watermark.js",
      "const query = `CREATE TRIGGER fixture AFTER ${operation.toUpperCase()} ON records BEGIN SELECT 1; END;`;\n"
    );
    writeFixture(
      root,
      "other/same-name.js",
      "const query = `CREATE TRIGGER fixture AFTER ${operation.toUpperCase()} ON records BEGIN SELECT 1; END;`;\n"
    );

    const expectedFiles = [
      "migrations/005_memory_controller_watermark.js",
      "nested/unsafe.js",
      "other/same-name.js",
      "top.js"
    ];
    assert.deepEqual(discoverJavaScriptFiles(root), expectedFiles);

    assert.equal(
      lintSource("const query = `SELECT * FROM records WHERE id = ${rawInput};`;", "unsafe.js").length,
      1,
      "Raw input must fail."
    );
    assert.equal(
      lintSource("const query = `BEGIN; UPDATE records SET value = ${rawInput}; COMMIT;`;", "unsafe-transaction.js").length,
      1,
      "Raw input inside a transaction must fail."
    );
    assert.equal(
      lintSource("const query = `SELECT * FROM records WHERE id = ${sqlString(rawInput)};`;", "safe.js").length,
      0,
      "Escaped input must pass."
    );

    const result = lintDirectory(root);
    assert.deepEqual(result.files, expectedFiles);
    assert.deepEqual(
      result.violations.map((violation) => violation.file),
      ["nested/unsafe.js", "other/same-name.js"],
      "A file-scoped exception must not exempt the same expression elsewhere."
    );

    console.log(JSON.stringify({
      suite: "sql-interpolation-lint-smoke",
      files: result.files,
      violationFiles: result.violations.map((violation) => violation.file)
    }, null, 2));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main();
