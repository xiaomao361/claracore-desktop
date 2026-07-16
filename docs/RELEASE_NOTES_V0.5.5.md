# ClaraCore Desktop v0.5.5

`v0.5.5` introduces explicit Full and Lite distributions and tightens several
runtime truth boundaries.

## Highlights

- Adds a Lite macOS build that removes the bundled embedding model and its
  Xenova, ONNX, and Sharp runtime dependency closure.
- Keeps the Full build's existing offline, zero-configuration embedding path.
- Lite exposes only Ollama and Disabled for Memory embeddings. A fresh Lite
  install leaves the model empty until the user fetches and saves a model that
  is actually available.
- Ollama model aliases such as `bge-m3` now resolve to the listed canonical
  model name, such as `bge-m3:latest`.
- Existing saved Ollama settings survive reinstall. Opening an older Full data
  root in Lite prompts for an explicit provider change without rewriting the
  database or deleting vectors.
- Update checks now open the GitHub Release page instead of guessing a specific
  Full or Lite installer. The Release address can also be copied.
- InnerLife candidates count as confirmed shares only after a `used` action has
  auditable delivery evidence from the actual response.

## Downloads

- macOS Apple silicon Full: `ClaraCore-Desktop-0.5.5-arm64.dmg`
- macOS Apple silicon Lite: `ClaraCore-Desktop-0.5.5-lite-arm64.dmg`
- Windows 64-bit Full: `ClaraCore-Desktop-0.5.5-x64-Setup.exe`
- Integrity hashes: `SHA256SUMS.txt`

Full is the existing offline-capable distribution. Lite is smaller and requires
Ollama for semantic Memory embeddings. Keyword search remains available when an
embedding provider is unavailable.

## Important Installation Note

These test packages are unsigned. macOS may require a manual Gatekeeper
override, and Windows may show an unknown-publisher or SmartScreen warning.
SHA-256 hashes verify download integrity but do not replace platform signing.

User data lives outside the application bundle and is preserved when replacing
or reinstalling the app.
