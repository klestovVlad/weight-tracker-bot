#!/usr/bin/env node
// Simple, safe migration runner for the D1 database.
//
// Applies migrations/*.sql in filename order, tracking what has run in a
// `schema_migrations` table so nothing is applied twice (important: some
// migrations use `ALTER TABLE ADD COLUMN`, which is NOT idempotent).
//
// Usage:
//   node scripts/migrate.mjs --local            apply pending to local DB
//   node scripts/migrate.mjs --remote           apply pending to remote DB
//   node scripts/migrate.mjs --remote --status  show applied / pending, run nothing
//   node scripts/migrate.mjs --remote --baseline [name.sql]
//        Mark migrations as applied WITHOUT running them — use once when adopting
//        this runner on a DB whose migrations were already applied by hand.
//        With a filename argument, only files up to AND INCLUDING it are baselined
//        (later, genuinely-new migrations stay pending and run normally). Without
//        an argument, ALL pending files are baselined (only safe on a DB where
//        every migration file has truly already been applied).
//
// npm aliases: migrate:local, migrate:remote, migrate:status, migrate:baseline

import { readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");
const BINDING = "DB";

const args = process.argv.slice(2);
const scope = args.includes("--remote") ? "--remote" : args.includes("--local") ? "--local" : null;
const isStatus = args.includes("--status");
const baselineIdx = args.indexOf("--baseline");
const isBaseline = baselineIdx !== -1;
// Optional filename right after --baseline: baseline only up to & including it.
const baselineTo =
  isBaseline && args[baselineIdx + 1]?.endsWith(".sql") ? args[baselineIdx + 1] : null;

if (!scope) {
  console.error("Specify --local or --remote.");
  process.exit(1);
}

/** Run a wrangler d1 command; returns stdout. */
function wrangler(extraArgs) {
  return execFileSync("npx", ["wrangler", "d1", "execute", BINDING, scope, ...extraArgs], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

/** Run a single SQL statement. */
function exec(sql) {
  return wrangler(["--command", sql]);
}

/** Run a query and parse the JSON result rows. */
function query(sql) {
  const out = wrangler(["--json", "--command", sql]);
  const start = out.indexOf("[");
  const end = out.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  const parsed = JSON.parse(out.slice(start, end + 1));
  // wrangler returns an array of result sets; take the first's rows.
  return parsed[0]?.results ?? [];
}

function listMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

console.log(`Migration runner (${scope})`);

// 1. Ensure the tracking table exists (idempotent).
exec(
  "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);",
);

// 2. What is already applied?
const appliedRows = query("SELECT name FROM schema_migrations ORDER BY name;");
const applied = new Set(appliedRows.map((r) => r.name));

const files = listMigrationFiles();
const pending = files.filter((f) => !applied.has(f));

if (isStatus) {
  console.log(`\nApplied (${applied.size}):`);
  for (const f of files.filter((f) => applied.has(f))) console.log(`  ✓ ${f}`);
  console.log(`\nPending (${pending.length}):`);
  for (const f of pending) console.log(`  • ${f}`);
  process.exit(0);
}

if (pending.length === 0) {
  console.log("Nothing to do — database is up to date.");
  process.exit(0);
}

if (isBaseline) {
  if (baselineTo && !files.includes(baselineTo)) {
    console.error(`Baseline target not found: ${baselineTo}`);
    process.exit(1);
  }
  const toMark = baselineTo ? pending.filter((f) => f <= baselineTo) : pending;
  console.log(
    `\nBaselining ${toMark.length} migration(s) as applied (NOT running SQL)` +
      (baselineTo ? ` up to ${baselineTo}` : "") +
      ":",
  );
  for (const f of toMark) {
    exec(
      `INSERT OR IGNORE INTO schema_migrations (name, applied_at) VALUES ('${f}', '${new Date().toISOString()}');`,
    );
    console.log(`  ✓ marked ${f}`);
  }
  const stillPending = pending.filter((f) => !toMark.includes(f));
  console.log(
    `\nBaseline complete.` +
      (stillPending.length
        ? ` ${stillPending.length} migration(s) still pending — run migrate:remote to apply them.`
        : " Future migrations will run normally."),
  );
  process.exit(0);
}

console.log(`\nApplying ${pending.length} migration(s):`);
for (const f of pending) {
  console.log(`\n→ ${f}`);
  // readFileSync is only used to fail fast on an unreadable file before running.
  readFileSync(join(MIGRATIONS_DIR, f), "utf8");
  wrangler(["--file", join(MIGRATIONS_DIR, f)]);
  exec(
    `INSERT INTO schema_migrations (name, applied_at) VALUES ('${f}', '${new Date().toISOString()}');`,
  );
  console.log(`  ✓ applied ${f}`);
}
console.log("\nAll migrations applied.");
