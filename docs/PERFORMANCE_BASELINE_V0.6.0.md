# ClaraCore Desktop v0.6.0 Performance Baseline

> Captured: 2026-07-21 CST
> Status: local source baseline; no packaged or installed-runtime claim

## Purpose

This baseline decides whether v0.6.0 needs broad performance work or a smaller
targeted loop. It measures existing startup, global snapshot, navigation, Home
rendering, short-run memory stability, and Memory retrieval latency without
changing the live product database.

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
```

`baseline:runtime` always creates and later removes a consistent temporary
database copy. Omitting `CLARACORE_PERFORMANCE_DB` measures a fresh empty
temporary database instead.

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

The legacy `/api/embeddings` endpoint used by Desktop supports `keep_alive` and
defaults to five minutes according to the
[official Ollama API reference](https://github.com/ollama/ollama/blob/main/docs/api.md#generate-embedding). A
longer value would trade roughly 664 MB of persistent GPU memory on this machine
for fewer post-idle cold searches. That is a product/operator tradeoff, not a
safe hidden default change.

## Decision

Do not start a broad Desktop performance refactor. Startup, global snapshot,
navigation, Home scheduling, and short-run memory behavior are all below the
current intervention thresholds.

Retrieval observability is now sufficient to split the next decision:

1. **Memory-balanced:** keep Ollama's five-minute default and accept an
   occasional roughly 2.3-second first retrieval after idle.
2. **Speed-biased:** add an explicit bounded embedding `keep_alive` such as
   `30m`, then validate that the observed cold tail falls without unacceptable
   system pressure.
3. Independently evaluate reducing or indexing the 200-row vector candidate
   path only after recall-quality fixtures prove that a smaller candidate set
   does not remove relevant Memories. Its warm cost is material but not the
   source of the 2.3-second tail.
4. Rerun this baseline and the full 30-minute endurance check before a package
   candidate is called performance-validated.

The global Controller aggregate scan remains a future scaling watchpoint, but
at the current 73.2 ms snapshot p95 and 16 Controller events it is not the first
optimization target.
