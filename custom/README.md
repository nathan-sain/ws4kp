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
  theme/_backgrounds.scss  points each screen at the ATV backgrounds
  theme/_shadow.scss       softer text shadow (tuning variables at the top)
  fonts/src/               Chivo Mono variable font + OFL license (source for build-fonts.sh)
  data/points-cache.json   NWS grid points per community (generated, committed)
  scripts/build-data.mjs   region.config -> datagenerators/output/*.json + atv-region.mjs
  scripts/check-regional.mjs  fails if a community is missing/duplicated on the Regional map
  scripts/check-theme.mjs  fails if upstream adds a color variable we don't define
  scripts/build-fonts.sh   fonts/src -> server/fonts/atv/*.woff2
  scripts/make-enhanced-backgrounds.py  ATV art -> atv/*-wide-enhanced.png
  scripts/sync-upstream.sh merge upstream + rebuild everything
  docker/Dockerfile        compose build: data -> checks -> site -> nginx (also an `export` target for the JSON)
  .env.example             default location/displays (copy to ../.env)
```

## Where the fork touches upstream files

| File | Change | Why |
|---|---|---|
| `server/styles/scss/shared/_colors.scss` | replaced with one `@forward` line | theme lives in `custom/theme` |
| `server/styles/scss/shared/_utils.scss` | `text-shadow()` mixin body replaced by a call into `custom/theme/_shadow.scss` (+1 `@use`) | softer shadow on every screen without touching ~20 call sites |
| `server/styles/scss/ws.scss` | +1 `@use` line at the end | loads `custom/theme/_overrides.scss` |
| `compose.yaml` | new file | `docker compose build` / `up` for the ATV image |
| `.github/workflows/atv-build.yaml` | new file | CI for `atv/main`: compose build, smoke test, JSON artifact |
| `server/scripts/modules/navigation.mjs` | small hooks (marked `ATV fork`): cycle-wrap handler, hold the current display during a location change, guard for an upstream `showDisplay(undefined)` | location rotation without blank frames |
| `server/scripts/index.mjs` | +2 imports | loads `modules/atv-rotation.mjs` and `modules/atv-titles.mjs` |
| `server/scripts/modules/atv-rotation.mjs` | new file | location rotation |
| `server/scripts/modules/atv-titles.mjs` | new file | location in the titles of city-specific screens |
| `server/scripts/modules/regionalforecast.mjs` | +1 import, 2 small hooks (marked `ATV fork`) | fixed map center; per-city label offsets |
| `server/scripts/modules/atv-region.mjs` | new file (generated, committed) | map center from `region.config.mjs` |
| `server/images/backgrounds/atv/` | new folder | ATV background art; upstream images are left in place |
| `server/fonts/atv/` | new folder (generated, committed) | web fonts + OFL; served and copied to `dist/` like upstream fonts |
| `.gitattributes` | +6 lines | generated files use `merge=ours` |
| `datagenerators/output/*.json` | regenerated | Arkansas data |
| `server/styles/ws.min.css` | regenerated | compiled theme |

Keep this table up to date when adding a new touch point.

## Everyday commands

```bash
node custom/scripts/build-data.mjs     # after editing region.config.mjs (needs api.weather.gov for new cities)
node custom/scripts/check-regional.mjs # after moving/adding communities or offsets
npm run build:css                      # after editing custom/theme/*
custom/scripts/build-fonts.sh          # after changing fonts/src (needs: pip install fonttools brotli)
npm start                              # dev server on http://localhost:8080
npm run build                          # static build in dist/ (Docker builds do this too)
custom/scripts/sync-upstream.sh        # pull in a new upstream release
```

Behind an HTTPS proxy (CI, cloud sandboxes), prefix Node commands with `NODE_USE_ENV_PROXY=1`, because Node's `fetch` and `https` ignore `HTTPS_PROXY` otherwise.

## Docker Compose build

```bash
docker compose build        # pulls atv/main from GitHub, regenerates the JSON, builds the image
docker compose up -d        # serves it on http://localhost:8080
```

`compose.yaml` builds from `https://github.com/nathan-sain/ws4kp.git#atv/main`, so a machine only needs this one file. `custom/docker/Dockerfile` runs these steps inside the build:

1. `npm ci`
2. `build-data.mjs` regenerates `travelcities.json`, `regionalcities.json`, `stations.json` and `atv-region.mjs` from `region.config.mjs`. Cached grid points are reused, and any missing one is looked up at api.weather.gov. The build fails if a lookup fails.
3. `check-regional.mjs` fails the build if a community would be missing from the Regional map.
4. `npm run build` compiles the theme and bundles the site.
5. nginx serves `dist/`, the same as upstream's image.

The JSON comes from `region.config.mjs` on every build, so the committed copies in `datagenerators/output/` are only what `npm start` uses.

| Setting (env or `.env`) | Default | |
|---|---|---|
| `ATV_SOURCE` | `https://github.com/nathan-sain/ws4kp.git#atv/main` | `.` builds the local checkout; `…git#<branch-or-tag>` builds another ref |
| `ATV_IMAGE` | `ws4kp-atv:latest` | image name |
| `ATV_PORT` | `8080` | host port |
| `REFRESH_POINTS` | `0` | `1` re-looks-up every grid point instead of using the cache |
| `WSQS_*` | Little Rock, Travel on, kiosk off | any permalink setting (see `.env.example`), applied at container start |

To get just the generated JSON:

```bash
docker buildx build -f custom/docker/Dockerfile --target export --output type=local,dest=out .
```

If `atv/main` becomes private, the Git build context needs credentials, for example a `GIT_AUTH_TOKEN` build secret. Alternatively, clone the repo and use `ATV_SOURCE=.`.

**CI:** `.github/workflows/atv-build.yaml` runs on every push and pull request to `atv/main`, and manually with an option to refresh the grid points. It builds the image with `docker compose build`, starts it, and checks that the page, data, fonts and backgrounds load and that every community is in the Travel data. It then uploads the generated JSON as the `ws4kp-atv-data` artifact. Upstream's own workflows only run on upstream's branch names and on pull requests, so they don't fire for `atv/main` pushes.

## Location in the titles

City-specific screens show the location in their title, with the city on the top line (`modules/atv-titles.mjs`):

| Screen | Title |
|---|---|
| Current Conditions | *City* / Conditions, or *City* / Recent Conditions when upstream marks the data stale |
| Local Forecast | *City* / Forecast |
| Extended Forecast | *City* / Extended Forecast |
| Hourly Forecast | *City* / Hourly Forecast |
| Hourly Graph | *City* / Hourly Graph |
| Almanac | *City* / Almanac |
| Climate | *City* / Climate |
| Local / Future Radar | *City* / Radar, *City* / Future Radar |

Region-wide screens (Regional, Travel, Latest Observations), the SPC Outlook and Hazards keep their upstream titles.

- **Source:** the city is the location the app reports to the headend tab (the state suffix is dropped), so it follows searches and the rotation.
- **Timing:** a screen that's on screen when the location changes keeps its title until it goes off screen, so a title never changes over the data it belongs to.
- **Long names:** names over 12 characters are drawn smaller to fit before the clock.
- **NOAA logo:** moved into the free space right of the clock (x 490) to make room for the city.

The module rewrites title markup at runtime, so the EJS templates are unchanged. Two upstream behaviors it works with:

- Current Conditions rewrites its title's top line on every draw ("Current"/"Recent"). The module reads that word, then puts the city back before the frame is painted.
- Hourly Graph looks up its chart areas with the bare selectors `.top`/`.bottom`, so its title lines use `atv-top`/`atv-bottom` instead.

## Location rotation

The display rotates between the Regional map's communities (`regionalcities.json`, in `region.config.mjs` order). After each full cycle of the enabled screens, it loads the next city and plays every screen for it, starting from the city after the configured location. It's on by default in `compose.yaml` (`WSQS_rotate=true`). Elsewhere, add `?rotate=true` to the URL. `rotateCycles=N` holds each city for N cycles (default 1). Both are kept in the Share permalink, and `?debug=rotation` logs each switch to the browser console.

**Broadcast-safe:** the last screen stays on air while the next city loads, then the new city's first screen replaces it in the same frame. There's no blank frame, progress screen or title card between cities. Tested in Chrome fullscreen at 1920×1080: zero such frames across city switches, checked on every painted frame. If a city doesn't start playing within 30 s (for example, the NWS is down for it), the rotation skips to the next one.

Screens that show the whole region (Regional map, Travel, Latest Observations) look the same for every city and play every cycle, as upstream would.

How it works: `navigation.mjs` calls the rotation when the cycle would wrap from the last screen to the first. `modules/atv-rotation.mjs` then holds the current screen, marks every screen as loading, and loads the next city through the same path a location search uses. The viewer's saved location isn't changed.

## Geography

`region.config.mjs` lists 7 communities covering Arkansas's corners and its north/south regions: Fayetteville (NW), Jonesboro (NE), Fort Smith (W), Little Rock (central), Pine Bluff (SE), Texarkana (SW) and El Dorado (S).

- **Travel Forecast** shows exactly these communities. Each one needs an NWS grid point in `data/points-cache.json`.
- **Regional map** shows all 7 communities in standard and widescreen modes, wherever the display is located.
  - `regionalMap.center` fixes the map on central Arkansas instead of the viewer. The map window is only about 4° tall, so centering on a viewer in Fayetteville would push El Dorado and Texarkana off the map. Set it to `null` for upstream behavior.
  - The app drops any label whose 136×60 px box overlaps a closer one. Pine Bluff/Little Rock, Fayetteville/Fort Smith and Texarkana/El Dorado sit too close for that, so `mapOffset` nudges four labels by 11–25 px (the number stays with its label). Stations get the same nudge, so a community is never drawn twice.
  - Portrait + enhanced mode uses 26 px taller boxes and still drops 3 communities. It would need separate offsets for that mode if portrait displays are used.
  - `check-regional.mjs` reruns the app's placement logic for every mode, and `sync-upstream.sh` runs it after each merge.
- **Latest Observations** and current-conditions names use `stations.json`. With `stationsMode: 'communities'`, only the 7 community stations ship, labeled with the community names. Switch to `'region'` to include every station inside `bounds`. This fills the map more densely but shows non-ATV places.
- **Location search** still accepts any US address. To pin the display to one place, set `WSQS_latLon`/`WSQS_latLonQuery` (and optionally `WSQS_kiosk=true`) in `.env`.

## Theme

`theme/_colors.scss` defines the brand palette as `$atv-*` variables and maps them onto upstream's 16 semantic variables (`$title-color`, `$column-header`, ...). Change a mapping there; don't edit upstream SCSS.

### Backgrounds

ATV art lives in `server/images/backgrounds/atv/`, and `theme/_backgrounds.scss` repoints each screen to it, so upstream's images stay untouched. The ATV set uses its own numbering, so files are matched to screens by layout:

| ATV file | Screen | Replaces upstream |
|---|---|---|
| `1.png` | most screens; stand-in for the Hourly Graph | `1.png`, `1-chart.png` |
| `1-wide.png` | widescreen side panels (ATV logo + photo) | `1-wide.png` |
| `3.png` | Extended Forecast (three day panels) | `2.png` |
| `5.png` | Almanac | `3.png` |
| `4.png`, `4-wide.png` | Local and Future Radar | same names |
| `6.png` | SPC Outlook | `6.png` |

Hazards (`7.png`, `7-wide.png`) are identical to upstream, so they aren't overridden.

Widescreen + enhanced mode widens several screens to 854 px, and the ATV set had no art for that. `custom/scripts/make-enhanced-backgrounds.py` (needs Pillow) generates it from the ATV files:

| Generated file | From | Used by |
|---|---|---|
| `1-wide-enhanced.png` | `1-wide.png` with its panel widened to upstream's enhanced panel (x 52–797) | Current Conditions, Latest Observations, Local Forecast, Regional, Climate, Hourly Graph |
| `3-wide-enhanced.png` | `5.png` stretched to 854 px (edges unscaled) in the `1-wide.png` header and bottom bar | Almanac |

Rerun the script after changing `1-wide.png` or `5.png`, or replace the outputs with designer-made files.

Still upstream art, used only in portrait + enhanced mode: all `*-portrait.png` and `1-chart-portrait.png`. A dedicated `1-chart.png` would also suit the Hourly Graph better than the `1.png` stand-in.

To add or replace art, drop the PNG into `atv/` at upstream's pixel size (640×480, 854×480 wide, 640×1137 portrait). Add a rule in `_backgrounds.scss` that repeats the upstream selector, then run `npm run build:css`.

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
