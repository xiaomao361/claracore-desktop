# Versions and releases

`package.json` is the application version source. Stable releases use a matching
`vX.Y.Z` tag and a GitHub Release with platform/flavor installers and checksums.
The [latest stable release](https://github.com/xiaomao361/claracore-desktop/releases/latest)
ships Full and Lite for macOS Apple Silicon and Windows x64. macOS packages
are signed and notarized. Windows installers are unsigned. The release tag
freezes packaged application source. Later documentation and website commits
do not move that tag. See the [release records](README.md#release-records).

The 1.0.4/1.0.5 and earlier unsigned 1.0.6 local test builds are historical test
artifacts. The [test baseline](AGENT_EXPERIENCE_TESTING.md)
retains their scope and acceptance limits.

## Source and branch policy

`main` is the public default branch. Work on a focused branch, run required
checks, and integrate the intended change. Local branches are development
state, not release channels. Documentation and website changes do not require
an application version bump.

## Release checklist

1. Review the final scope and update version, changelog, and user-facing notes.
2. Run source, relevant domain, and platform checks against the frozen commit.
3. Push the source commit and tag it. Create a draft at that tag for the
   Windows workflow and attach the verified platform installers and manifests.
4. Verify all four installers, including their package contents, runtime checks,
   macOS signatures, and checksums. Publish with concise release notes.
5. Read back the public release, tag, and asset metadata. Check the downloaded
   installers against the published SHA-256 manifests.

Keep previously published tags immutable. A later documentation commit need
not equal the packaged-source tag. Build success, installation, visual
acceptance, and long-running user experience are distinct verification layers.

The website's published installer version lives in `website/release.json`.
Keep it and the website links on the public release while the working source
version advances. Update them only after the new release assets are available.

## Windows workflow inputs

`Build Windows Release` resolves `source_ref` (branch, tag, full or short commit
SHA) through GitHub to a full immutable commit before building. Without an
explicit source, it uses `publish_tag` when publishing, otherwise the event's
commit; PR builds use the PR head commit instead of a transient merge ref.
The workflow retains its own preflight helper when checking out an older tag.

When `publish_tag` is supplied, an existing `vX.Y.Z` GitHub Release is required.
Its tag commit must equal the resolved build source and its version must match
the checked-out package. These checks run before dependencies/builds and again
before upload. Existing Windows installers or the Windows checksum manifest
cause a failure; uploads do not overwrite published assets. A missing ref,
unavailable release, mismatched version/commit, or API failure blocks publication.
For a build-only validation run, leave `publish_tag` empty.

Run `npm run test:release`, `npm run test:website`, `npm run test:core`, and
`npm run test:gateway` before a release checkpoint, plus the relevant domain
and platform checks. `npm run check` alone does not cover the whole CI pipeline.

See [Packaging](mac-packaging.md), [Changelog](../CHANGELOG.md), and
[GitHub Releases](https://github.com/xiaomao361/claracore-desktop/releases).
