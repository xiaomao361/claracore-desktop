const fs = require("fs");
const path = require("path");

// Guards against the failure mode that matters here: someone interpolates a
// raw value into a SQL template literal and forgets to run it through
// sqlString()/jsonSql(). The database layer builds SQL by string
// interpolation (not parameter binding) because the sqlite3-CLI fallback
// path in core/db/database.js has no bind-parameter protocol, so every
// interpolated value must be escaped by convention instead of by the driver.
// This script cannot prove a value is safe; it flags anything that isn't
// provably safe by a small set of known-safe shapes, so a new unescaped
// interpolation has to be either fixed or explicitly allowlisted in review.

const ROOT = path.join(__dirname, "..", "db");

const FILES = [
  "database.js",
  "repositories/system.js",
  "repositories/continuity.js",
  "repositories/continuity/agents.js",
  "repositories/memoria.js",
  "repositories/memoria/labels.js",
  "repositories/memoria/records.js",
  "repositories/memoria/embeddings.js",
  "repositories/memoria/maintenance.js",
  "repositories/innerlife.js",
  "repositories/innerlife/profile.js",
  "repositories/innerlife/inbox.js",
  "repositories/innerlife/daemon.js",
  "repositories/innerlife/history.js",
  "repositories/innerlife/sessions.js",
  "repositories/innerlife/shares.js"
];

const SQL_KEYWORDS = ["SELECT", "INSERT", "UPDATE", "DELETE", "PRAGMA", "ALTER", "CREATE", "WITH", "DROP"];

// Exact identifier names already known to be pre-built, fully-escaped SQL
// fragments (composed elsewhere out of sqlString()/jsonSql() calls) or
// numeric-only values, verified by hand against their declaration. This is
// deliberately an exact-name list, not a suffix/prefix wildcard: a wildcard
// (e.g. "anything ending in Sql") could be defeated by naming an unsafe
// variable to match it. Add a name here only after reading where it is
// declared and confirming every value that can reach it is either escaped
// or numeric.
const SAFE_IDENTIFIERS = new Set([
  "where",
  "whereClause",
  "agentWhereClause",
  "eventWhereClause",
  "sql",
  "secretUpdates",
  "settingsSql",
  "labelSql",
  "labelList",
  "nextRunSql",
  "agentClause",
  "searchClause",
  "filters",
  "clauses",
  "safeLimit",
  "safeOffset",
  "limit",
  "offset",
  "schemaVersion",
  "dimension",
  "durationMs",
  "olderThanDays",
  "pollSeconds",
  "tickIncrement",
  "retrySeconds",
  "SQLITE_BUSY_TIMEOUT_MS",
  "CONTINUITY_LINE_SELECT"
]);

function isSafeBareIdentifier(name) {
  return SAFE_IDENTIFIERS.has(name);
}

function findMatchingParen(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function isWrappedCall(expr, names) {
  for (const name of names) {
    const prefix = `${name}(`;
    if (!expr.startsWith(prefix)) continue;
    const closeIndex = findMatchingParen(expr, expr.indexOf("("));
    if (closeIndex === expr.length - 1) return true;
  }
  return false;
}

function splitTopLevelTernary(expr) {
  let depth = 0;
  let questionIndex = -1;
  for (let i = 0; i < expr.length; i += 1) {
    const ch = expr[i];
    if ("([{".includes(ch)) depth += 1;
    else if (")]}".includes(ch)) depth -= 1;
    else if (depth === 0 && ch === "?" && expr[i + 1] !== "." && expr[i - 1] !== "?" && expr[i + 1] !== "?") {
      questionIndex = i;
      break;
    }
  }
  if (questionIndex === -1) return null;
  let colonDepth = 0;
  for (let i = questionIndex + 1; i < expr.length; i += 1) {
    const ch = expr[i];
    if ("([{".includes(ch)) colonDepth += 1;
    else if (")]}".includes(ch)) colonDepth -= 1;
    else if (colonDepth === 0 && ch === ":") {
      return {
        test: expr.slice(0, questionIndex).trim(),
        whenTrue: expr.slice(questionIndex + 1, i).trim(),
        whenFalse: expr.slice(i + 1).trim()
      };
    }
  }
  return null;
}

function isSafeLiteralBranch(expr) {
  if (/^(['"]).*\1$/.test(expr)) return true;
  if (/^NULL$/i.test(expr)) return true;
  if (/^-?\d+(\.\d+)?$/.test(expr)) return true;
  return false;
}

function splitTopLevelBinary(expr, operator) {
  let depth = 0;
  for (let i = 0; i < expr.length - 1; i += 1) {
    const ch = expr[i];
    if ("([{".includes(ch)) depth += 1;
    else if (")]}".includes(ch)) depth -= 1;
    else if (depth === 0 && expr.slice(i, i + operator.length) === operator) {
      return { left: expr.slice(0, i).trim(), right: expr.slice(i + operator.length).trim() };
    }
  }
  return null;
}

// Finds the first top-level backtick-delimited span in expr, respecting
// nested ${...} the same way the top-level template scanner does, so a
// nested template literal (e.g. inside a .map() callback) can be located
// and checked on its own.
function findNestedTemplateSpan(expr) {
  const start = expr.indexOf("`");
  if (start === -1) return null;
  let depth = 0;
  let j = start + 1;
  while (j < expr.length) {
    if (expr[j] === "\\") {
      j += 2;
      continue;
    }
    if (expr[j] === "$" && expr[j + 1] === "{") {
      depth += 1;
      j += 2;
      continue;
    }
    if (depth > 0 && expr[j] === "{") {
      depth += 1;
      j += 1;
      continue;
    }
    if (depth > 0 && expr[j] === "}") {
      depth -= 1;
      j += 1;
      continue;
    }
    if (depth === 0 && expr[j] === "`") return { start, end: j, body: expr.slice(start + 1, j) };
    j += 1;
  }
  return null;
}

function isSafeMapJoinWithNestedTemplate(expr) {
  const span = findNestedTemplateSpan(expr);
  if (!span) return false;
  const scaffold = `${expr.slice(0, span.start)}__TPL__${expr.slice(span.end + 1)}`.replace(/\s+/g, "");
  if (!/^[\w.$]+\.map\(\([\w$,]*\)=>__TPL__\)\.join\([^)]*\)$/.test(scaffold)) return false;
  return extractInterpolations(span.body).every(({ expr: innerExpr }) => isSafeExpr(innerExpr));
}

function isSafeExpr(rawExpr) {
  const expr = rawExpr.trim();
  if (isWrappedCall(expr, ["sqlString", "jsonSql"])) return true;
  if (isWrappedCall(expr, ["Number.parseInt", "Number.isFinite", "Math.max", "Math.min", "Math.round"])) return true;
  if (/^-?\d+(\.\d+)?$/.test(expr)) return true;
  if (/^[\w.$]+\.length$/.test(expr)) return true;
  if (/^[A-Za-z_$][\w.$]*\.map\(sqlString\)\.join\([^)]*\)$/.test(expr)) return true;
  if (/^[A-Za-z_$][\w.$]*\.map\(\(\s*[\w$]+\s*\)\s*=>\s*sqlString\(\s*[\w$]+(\.[\w$]+)*\s*\)\)\.join\([^)]*\)$/.test(expr)) return true;
  if (/^[A-Za-z_$][\w$]*$/.test(expr) && isSafeBareIdentifier(expr)) return true;
  if (/^[A-Za-z_$][\w$]*\.join\([^)]*\)$/.test(expr)) {
    const identifier = expr.slice(0, expr.indexOf("."));
    if (isSafeBareIdentifier(identifier)) return true;
  }
  if (expr.includes("`") && isSafeMapJoinWithNestedTemplate(expr)) return true;
  const ternary = splitTopLevelTernary(expr);
  if (ternary) {
    const trueOk = isSafeExpr(ternary.whenTrue) || isSafeLiteralBranch(ternary.whenTrue);
    const falseOk = isSafeExpr(ternary.whenFalse) || isSafeLiteralBranch(ternary.whenFalse);
    return trueOk && falseOk;
  }
  const orSplit = splitTopLevelBinary(expr, "||");
  if (orSplit) {
    return (isSafeExpr(orSplit.left) || isSafeLiteralBranch(orSplit.left)) && (isSafeExpr(orSplit.right) || isSafeLiteralBranch(orSplit.right));
  }
  return false;
}

function extractInterpolations(literalBody) {
  const expressions = [];
  for (let i = 0; i < literalBody.length; i += 1) {
    if (literalBody[i] === "$" && literalBody[i + 1] === "{") {
      const closeIndex = findMatchingBrace(literalBody, i + 1);
      if (closeIndex === -1) break;
      expressions.push({
        expr: literalBody.slice(i + 2, closeIndex),
        offset: i
      });
      i = closeIndex;
    }
  }
  return expressions;
}

function findMatchingBrace(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findTemplateLiterals(source) {
  const literals = [];
  let i = 0;
  let inLineComment = false;
  let inBlockComment = false;
  let inString = null;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      i += 1;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    if (inString) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === inString) inString = null;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      inString = ch;
      i += 1;
      continue;
    }
    if (ch === "`") {
      const start = i + 1;
      let depth = 0;
      let j = start;
      while (j < source.length) {
        if (source[j] === "\\") {
          j += 2;
          continue;
        }
        if (source[j] === "$" && source[j + 1] === "{") {
          depth += 1;
          j += 2;
          continue;
        }
        if (depth > 0 && source[j] === "{") {
          depth += 1;
          j += 1;
          continue;
        }
        if (depth > 0 && source[j] === "}") {
          depth -= 1;
          j += 1;
          continue;
        }
        if (depth === 0 && source[j] === "`") break;
        j += 1;
      }
      const body = source.slice(start, j);
      const lineNumber = source.slice(0, i).split("\n").length;
      literals.push({ body, line: lineNumber });
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return literals;
}

function looksLikeSql(body) {
  const trimmed = body.trimStart().toUpperCase();
  return SQL_KEYWORDS.some((keyword) => trimmed === keyword || trimmed.startsWith(`${keyword} `) || trimmed.startsWith(`${keyword}\n`));
}

function lintFile(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  const source = fs.readFileSync(filePath, "utf8");
  const literals = findTemplateLiterals(source);
  const violations = [];
  for (const literal of literals) {
    if (!looksLikeSql(literal.body)) continue;
    const interpolations = extractInterpolations(literal.body);
    for (const { expr, offset } of interpolations) {
      if (isSafeExpr(expr)) continue;
      const lineInLiteral = literal.body.slice(0, offset).split("\n").length - 1;
      violations.push({
        file: relativePath,
        line: literal.line + lineInLiteral,
        expr: expr.trim()
      });
    }
  }
  return violations;
}

function main() {
  const allViolations = [];
  for (const relativePath of FILES) {
    allViolations.push(...lintFile(relativePath));
  }
  if (allViolations.length) {
    console.error(`SQL interpolation lint found ${allViolations.length} unescaped interpolation(s):`);
    for (const violation of allViolations) {
      console.error(`  core/db/${violation.file}:${violation.line}  \${${violation.expr}}`);
    }
    console.error("\nWrap the value in sqlString()/jsonSql(), or if it is a verified pre-built SQL fragment,");
    console.error("add its identifier to SAFE_IDENTIFIERS in core/tests/sql-interpolation-lint.js.");
    process.exit(1);
  }
  console.log(`SQL interpolation lint: ok (${FILES.length} files checked, 0 unescaped interpolations)`);
}

module.exports = { findTemplateLiterals, extractInterpolations, looksLikeSql, isSafeExpr, lintFile };

if (require.main === module) {
  main();
}
