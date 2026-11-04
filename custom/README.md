# ATV fork of WeatherStar 4000+

This is a scoped fork of [netbymatt/ws4kp](https://github.com/netbymatt/ws4kp). All ATV customization lives in `custom/`. Upstream files are touched only at the small set of points listed below, so merging new upstream releases stays painless.

## Branches and remotes

| | |
|---|---|
| `upstream` remote | `https://github.com/netbymatt/ws4kp` (read-only) |
| `origin` remote | the ATV fork on GitHub |
| `main` | mirror of `upstream/main`; never commit here |
| `atv/main` | the deployable ATV branch |

## Layout

```
custom/
  region.config.mjs        geography: communities, station mode, bounds  <- edit this
  theme/_colors.scss       brand palette + mapping onto upstream color variables  <- and this
  theme/_overrides.scss    brand fixes for colors upstream hard-codes elsewhere
  theme/_fonts.scss        Chivo Mono replaces the Star4000 faces
  fonts/src/               Chivo Mono variable font + OFL license (source for build-fonts.sh)
  data/points-cache.json   NWS grid points per community (generated, committed)
  scripts/build-data.mjs   region.config -> datagenerators/output/*.json
  scripts/check-theme.mjs  fails if upstream adds a color variable we don't define
  scripts/build-fonts.sh   fonts/src -> server/fonts/atv/*.woff2
  scripts/sync-upstream.sh merge upstream + rebuild everything
  .env.example             default location/displays (copy to ../.env)
```

## Where the fork touches upstream files

| File | Change | Why |
|---|---|---|
| `server/styles/scss/shared/_colors.scss` | replaced with one `@forward` line | theme lives in `custom/theme` |
| `server/styles/scss/ws.scss` | +1 `@use` line at the end | loads `custom/theme/_overrides.scss` |
| `server/fonts/atv/` | new folder (generated, committed) | web fonts + OFL; served and copied to `dist/` like upstream fonts |
| `.gitattributes` | +6 lines | generated files use `merge=ours` |
| `datagenerators/output/*.json` | regenerated | Arkansas data |
| `server/styles/ws.min.css` | regenerated | compiled theme |

Keep this table up to date when adding a new touch point.

## Everyday commands

```bash
node custom/scripts/build-data.mjs     # after editing region.config.mjs (needs api.weather.gov for new cities)
npm run build:css                      # after editing custom/theme/*
custom/scripts/build-fonts.sh          # after changing fonts/src (needs: pip install fonttools brotli)
npm start                              # dev server on http://localhost:8080
npm run build                          # static build in dist/ (Docker builds do this too)
custom/scripts/sync-upstream.sh        # pull in a new upstream release
```

Behind an HTTPS proxy (CI, cloud sandboxes), prefix Node commands with `NODE_USE_ENV_PROXY=1`, because Node's `fetch` and `https` ignore `HTTPS_PROXY` otherwise.

## Geography

`region.config.mjs` lists 7 communities covering Arkansas's corners and its north/south regions: Fayetteville (NW), Jonesboro (NE), Fort Smith (W), Little Rock (central), Pine Bluff (SE), Texarkana (SW) and El Dorado (S).

- **Travel Forecast** shows exactly these communities. Each one needs an NWS grid point in `data/points-cache.json`.
- **Regional map** places these communities around the viewer's location and drops labels that would overlap. The window is about 11° wide but only about 4–5° tall. From Little Rock it currently shows Fort Smith, Jonesboro, Little Rock and El Dorado: Fayetteville and Texarkana fall outside the window, and Pine Bluff overlaps Little Rock.
- **Latest Observations** and current-conditions names use `stations.json`. With `stationsMode: 'communities'`, only the 7 community stations ship, labeled with the community names. Switch to `'region'` to include every station inside `bounds`. This fills the map more densely but shows non-ATV places.
- **Location search** still accepts any US address. To pin the display to one place, set `WSQS_latLon`/`WSQS_latLonQuery` (and optionally `WSQS_kiosk=true`) in `.env`.

## Theme

`theme/_colors.scss` defines the brand palette as `$atv-*` variables and maps them onto upstream's 16 semantic variables (`$title-color`, `$column-header`, ...). Change a mapping there; don't edit upstream SCSS.

The CRT frame and panel artwork are PNGs in `server/images/backgrounds/`. They are still upstream's blue and orange, so they won't match the green theme until the backgrounds are redone (planned step 4).

## Fonts

[Chivo Mono](https://fonts.google.com/specimen/Chivo+Mono) (SIL Open Font License 1.1, copy taken from `google/fonts` at `ofl/chivomono`, font version 1.008) replaces the four Star4000 bitmap faces. `theme/_fonts.scss` re-declares each upstream family name (`Star4000`, `Star4000 Extended`, `Star4000 Large`, `Star4000 Small`), so no upstream `font-family` rule changes.

Like Star4000, Chivo Mono gives every character the same width, so the layout's fixed-width columns and space-aligned values (such as wind `WNW14`) still line up. Each face gets:

- **`size-adjust`** scales Chivo Mono's 0.600 em character cell to the original face's character width. Measured on 10 live screens, text widths match Star4000 within 0–10% narrower, never wider.
- **`ascent/descent/line-gap-override`** restore Star4000's line box, so baselines and line heights don't move.

| Upstream face | Chivo Mono weight | size-adjust | Glyph height vs. original |
|---|---|---|---|
| Star4000 | 700 | 79.5% | ~79% |
| Star4000 Extended | 700 | 73% | ~72% |
| Star4000 Large | 700 | 100% | ~65% (the original is unusually tall and narrow) |
| Star4000 Small | 600 | 65% | ~120% (kept small so labels fit in the header bars) |

Star4000 Small was all caps, so `_overrides.scss` sets `text-transform: uppercase` on the labels that use it.

Known limit: upstream's `views/index.ejs` still prefetches the four Star4000 `.woff` files (about 46 KB, unused). Removing those `<link rel="prefetch">` lines would be another upstream touch point, so they are left as is.
