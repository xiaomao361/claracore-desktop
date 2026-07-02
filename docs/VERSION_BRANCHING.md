# Version Branching

## Stable Baseline

- `v0.1.0` tags the current stable Desktop baseline.
- `main` stays the source for the currently used 0.1.x line unless a small stable fix is intentionally merged there.
- `develop/0.2.0` is the next-version branch.

## Isolated 0.2.0 Development

Use the next-version launcher for manual development:

```bash
npm run start:next
```

That command sets:

```text
CLARACORE_DESKTOP_DATA_DIR=~/Library/Application Support/claracore-desktop-next/data
CLARACORE_DESKTOP_TEST_INSTANCE=1
```

The separate data root keeps 0.2.0 development from writing the installed 0.1.0 product database. The test-instance flag also avoids colliding with the normal app's single-instance lock while the stable app is open.

Automated smoke tests already create temporary data roots under `/tmp` through `CLARACORE_DESKTOP_DATA_DIR`. Keep new tests on the same pattern unless the test is explicitly checking migration from a real backup.

For packaged release checks, keep using:

```bash
npm run pack:mac
npm run dist:mac
```

Only install or replace the daily-use app after the target build is promoted from `develop/0.2.0` back through the stable flow.
