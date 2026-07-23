# ClaraCore Desktop v0.6.4 Development Notes

## Status

`0.6.4` is the current unreleased development version. The current public
stable release remains `v0.6.3`.

This checkpoint has not been packaged. There is no `0.6.4` App, DMG, tag,
GitHub Release, or update-channel entry yet.

## InnerLife Share Quality

- Continuity-only inbox material is treated as context and does not create a
  share by itself.
- Empty inbox and empty prompt input produces no share.
- Model output may use `[NO_SHARE]` to preserve an intentional decision not to
  speak.
- New candidates are compared with active and recently used shares so repeated
  themes do not keep accumulating.
- Share decisions retain explicit audit reasons, including context-only input,
  no shareable input, model no-share output, distinct material, and similar
  existing material.
- Session afterthoughts follow the same no-share and duplicate-theme rules.

## Validation Completed

- `npm run check`
- `npm run test:phase4`
- `npm run test:phase5`
- persisted background-jobs smoke
- isolated InnerLife share-quality smoke covering six decision paths
- Lite source and packaged-artifact quality smokes against temporary data roots

The quality fix was also installed locally as a same-version `0.6.3` test build
before this version bump. That local installation was validation evidence, not
a `0.6.4` release artifact.

## Remaining Release Work

Before publishing `v0.6.4`, build a fresh Lite artifact from the `0.6.4`
versioned source, validate the App and DMG, generate checksums, and explicitly
authorize the tag, push, and GitHub Release. Packaging and publication are not
part of this checkpoint.
