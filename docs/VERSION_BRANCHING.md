# Versions and releases

`package.json` is the application version source. Stable releases use a matching
`vX.Y.Z` tag and a GitHub Release with platform/flavor installers and checksums.
The current stable release is [1.0.3](https://github.com/xiaomao361/claracore-desktop/releases/tag/v1.0.3).

## Source and branch policy

`main` is the public default branch. Work on a focused branch, run required
checks, and integrate the intended change. Local branches are development
state, not release channels. Documentation and website changes do not require
an application version bump.

## Release checklist

1. Review the final scope and update version, changelog, and user-facing notes.
2. Run source, relevant domain, and platform checks against the frozen commit.
3. Build Full/Lite installers; verify package contents, signatures where
   supported, runtime boundaries, and checksums.
4. Tag the exact source commit. Publish installers, SHA-256 manifests, and
   concise release notes describing behavior and material platform limitations.
5. Read back the public release, tag, and asset metadata; verify downloads
   against the published checksums.

Keep previously published tags immutable. A later documentation commit need
not equal the packaged-source tag. Build success, installation, visual
acceptance, and long-running user experience are distinct verification layers.

See [Packaging](mac-packaging.md), [Changelog](../CHANGELOG.md), and
[GitHub Releases](https://github.com/xiaomao361/claracore-desktop/releases).
