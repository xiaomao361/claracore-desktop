# ClaraCore Desktop v0.6.0 Performance Baseline

> Captured: 2026-07-21 CST
> Status: local source baseline; no packaged or installed-runtime claim

## Purpose

This baseline decides whether v0.6.0 needs broad performance work or a smaller
targeted loop. It measures existing startup, global snapshot, navigation, Home
rendering, short-run memory stability, Memory retrieval latency, and concurrent
SQLite access from multiple Agent Gateway processes without changing the live
product database.

## Environment And Safety Boundary

- macOS 26.5.2 (25F84), Apple M4, 16 GiB RAM;
- Electron 43.0.0, ClaraCore Desktop source version 0.6.0;
- active product database size at capture: 43,372,544 bytes;
- runtime/startup/navigation measurements used a SQLite `.backup` copy in a
  temporary isolated product root;
- the five-minute long-run check used a separate temporary database and
  Gateway;
- live Memory latency replay read only trace status/timing fields, not request
  or response content;
- no installed app, live setting, live product row, package, or deployment was
  changed.

## Reproducible Commands

```bash
CLARACORE_PERFORMANCE_DB="/path/to/claracore.db" npm run baseline:runtime
npm run test:home:performance
CLARACORE_LONG_RUN_DURATION_MINUTES=5 \
  CLARACORE_LONG_RUN_MAX_RSS_GROWTH_MB=64 \
  npm run test:memory-long-run
npm run baseline:memory-controller:live -- --db "/path/to/claracore.db"
CLARACORE_PERFORMANCE_DB="/path/to/claracore.db" npm run baseline:retrieval
CLARACORE_PERFORMANCE_DB="/path/to/claracore.db" \
  npm run baseline:sqlite:multi-agent
```

`baseline:runtime` always creates and later removes a consistent temporary
database copy. Omitting `CLARACORE_PERFORMANCE_DB` measures a fresh empty
temporary database instead.

`baseline:sqlite:multi-agent` always writes to temporary databases. When
`CLARACORE_PERFORMANCE_DB` is provided, each scenario uses a SQLite `.backup`
copy so the row counts and indexes are realistic without modifying the source.
It starts 1, 4, and 8 independent stdio Gateway processes by default, matching
the connection topology used when multiple Agents access Desktop. Configure it with
`CLARACORE_SQLITE_BASELINE_AGENTS` and
`CLARACORE_SQLITE_BASELINE_OPERATIONS_PER_AGENT`.

## Results

### Startup, Snapshot, And Navigation

| Metric | Result | Current trigger | Interpretation |
| --- | ---: | ---: | --- |
| Source launch to first rendered runtime snapshot | 626–1104 ms across two runs | 2–3 s | healthy |
| Global snapshot p50 | 63.4 ms | 200–300 ms common-action range | healthy |
| Global snapshot p95 | 73.2 ms | 200–300 ms common-action range | healthy |
| Global snapshot max, 20 samples | 75.9 ms | 200–300 ms common-action range | healthy |
| Navigation, two animation frames | 11.8–46.7 ms | 200–300 ms common-action range | healthy |

The sampled global snapshot stayed bounded at 20 recent Memories, 20 Gateway
traces, and 50 runtime events. The copied database contained 16 Controller
events during capture.

### Home Rendering

| Metric | Result |
| --- | ---: |
| Static total CPU average | 0.12% |
| Animated total CPU average | 0.69% |
| Animated CPU delta | +0.58 percentage points |
| Animated frame rate | 11.8 FPS |
| Static renderer private memory average | 139.9 MB |
| Animated renderer private memory average | 124.4 MB |
| Frames after leaving Home | 0 |

The Home animation stayed within its maintained CPU, memory, FPS, and inactive
view budgets. The renderer stopped scheduling frames after navigation away.

### Five-Minute Snapshot/Gateway Endurance

| Process | First RSS | Last RSS | Peak RSS | Net change |
| --- | ---: | ---: | ---: | ---: |
| Baseline runner | 64.0 MB | 61.3 MB | 65.4 MB | -2.7 MB |
| Gateway | 58.4 MB | 52.7 MB | 59.8 MB | -5.7 MB |

Across 60 samples, combined positive RSS growth was 0 bytes. This is a useful
short-run baseline, not proof that the full 30-minute endurance gate passes.

### Memory Controller And Memoria Retrieval

| Path | Samples | Result |
| --- | ---: | ---: |
| Controller Stage A `NOOP` | 14 | 1.5 ms average, 5 ms max |
| Controller `RETRIEVE` | 2 | 1783.5 ms average, 1785 ms max |
| Seven-day successful `memoria_search` | 98 | 574 ms p50, 2438 ms p95, 2992 ms max |

The Controller's deterministic gate is not a performance problem. Retrieval is
the only measured path near a hard product budget: the seven-day p95 is close
to the Controller's 2500 ms timeout. The two Controller retrievals are too few
to justify an algorithm change by themselves.

### Retrieval Phase Breakdown

The content-safe retrieval profiler ran five maintained synthetic query shapes
twice against a consistent copy of the current database. It emitted only
fixture ids, timing, modes, and counts; no live Memory content or ids.

| Phase | First run including cold load | Immediate warm rerun |
| --- | ---: | ---: |
| Total search p95 | 2336.8 ms | 310.0 ms |
| Query embedding p95 | 2058.3 ms | 156.1 ms |
| Read/parse/score up to 200 vector candidates p95 | 274.9 ms | 182.6 ms |
| Keyword query p95 | 1.7 ms | 1.3 ms |
| State annotation p95 | 0.3 ms | 0.2 ms |
| Neighbor lookup p95 | 0.3 ms | 0.3 ms |
| Controller eligibility p95 | 0.2 ms | 0.1 ms |

The active embedding provider was Ollama 0.32.1 with `bge-m3:latest`. After the
first run, `ollama ps` reported the model loaded on GPU at about 664 MB with the
default roughly five-minute expiry. An immediate full rerun removed the
2-second tail: all ten searches finished between about 234 and 310 ms.

This retrieval breakdown is kept as an independent measurement. It is not part
of the multi-Agent SQLite optimization boundary below, and no model-runtime
configuration change is proposed by that work.

### Multi-Agent SQLite Access

Each stdio Agent owns a separate Gateway process and SQLite connection. The
database helper serializes calls inside one process, while coordination across
Agents relies on SQLite WAL mode and a per-connection 30-second busy timeout.
There is no cross-process JavaScript mutex.

The maintained baseline uses an 80/20 read/write tool mix against independent
SQLite `.backup` copies of the 43.4 MB product database. Every tool call also
writes a Gateway trace, so the nominal read path still exercises SQLite's
single-writer coordination.

| Agents | Calls | Before p95 | After p95 | Before/after throughput | Lock failures |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 100 | 4.2 ms | 3.9 ms | 351.7 / 371.9 calls/s | 0 / 0 |
| 4 | 400 | 9.0 ms | 7.1 ms | 725.5 / 847.5 calls/s | 0 / 0 |
| 8 | 800 | 18.0 ms | 17.3 ms | 728.7 / 791.4 calls/s | 0 / 0 |

At eight Agents, write p95 fell from 22.0 ms to 14.7 ms. All six scenario runs
completed with zero call failures and `PRAGMA quick_check = ok`. These are
single-run local baselines, useful for regression direction rather than a
capacity guarantee.

The change removes repeated Gateway trace compatibility work from the hot path.
Previously each recorded trace, and then its immediate read-back, reran schema
inspection plus four `CREATE INDEX IF NOT EXISTS` statements. Concurrent and
later checks now share one compatibility promise per database connection and
retry if that check fails.

The current product database has no automatic Gateway trace retention. A
read-only size inspection found `gateway_traces` at about 6.1 MB, alongside
bounded per-agent digest history and other larger domain tables. Since every
Agent call creates one trace, trace retention is the next scaling loop; it is
separate from this latency fix because it changes audit-history semantics.

## Decision

Do not start a broad Desktop performance refactor. Startup, global snapshot,
navigation, Home scheduling, short-run memory behavior, and 1-8 Agent SQLite
contention are all below the current intervention thresholds.

Optimize this boundary incrementally:

1. Keep the per-connection compatibility cache and its concurrency regression
   test.
2. Define a product-owned Gateway trace retention policy before implementing
   cleanup, including age/count limits and which errors must be preserved.
3. Add a larger-data/longer-duration multi-Agent run after retention is defined;
   the current short burst does not prove day-long WAL or disk-growth behavior.
4. Rerun the maintained baseline and full 30-minute endurance check before a
   package candidate is called performance-validated.

The global Controller aggregate scan remains a future scaling watchpoint, but
at the current 73.2 ms snapshot p95 and 16 Controller events it is not the first
optimization target.
