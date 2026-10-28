# Project website

The public website is a static, bilingual page built from this directory. It
uses HTML, CSS, and a small language switcher, with no external fonts, analytics,
runtime dependencies, or network calls beyond navigation and asset loading.

```sh
npm run build:website
npm run test:website
```

The build copies public files and canonical brand/diagram assets into the
ignored `site-dist/` directory. GitHub Pages deploys that output from `main`
through `.github/workflows/pages.yml`. Relative asset URLs support the repository
subpath. Deployment does not rebuild or publish the Electron application.

For local viewing, serve `site-dist/` with a static server of your choice. The
source HTML remains readable without JavaScript; the language switcher becomes
available when its script loads, and a Chinese README link is provided otherwise.
Append `?lang=zh` for a Chinese landing view.

## Update a release

`release.json` records the public installer version, independently of the
working source version in `package.json`. Update it together with the labels,
four download links, and release link in `index.html` only after publishing the
matching installers. The build checks their consistency, including installer
filenames; an unreleased application version bump does not change public links.
The offline build does not verify remote asset availability; read back the
matching GitHub Release assets before deploying the website.

## Assets

- `continuity-art.webp`: AI-generated brand illustration created for ClaraCore;
  optimized from the original PNG. It is an illustration, not a product screenshot.
- The build copies the canonical mark and favicon from `assets/brand/`.
- The build copies the semantic diagram from `docs/images/how-it-works.svg`.

Keep the brand geometry intact. Use the [design language](../docs/UI_DESIGN_LANGUAGE.md)
and semantic, keyboard-accessible markup when changing the site. Offline DOM
and link checks do not replace browser layout or assistive-technology acceptance.
