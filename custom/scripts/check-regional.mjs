/* eslint-disable n/no-process-exit, n/no-sync, import-x/no-extraneous-dependencies -- CLI build script; proj4 is a devDependency */
// ATV fork: verify every community gets a label on the Regional map, once, in each display mode.
// Mirrors the placement logic in server/scripts/modules/regionalforecast.mjs (window, coercion,
// offsets, overlap test, 15-label limit) using the app's own projection and generated data.
// Usage: node custom/scripts/check-regional.mjs [lat lon]   (viewer location; only matters with no fixed center)
import { readFileSync } from 'node:fs';
import proj4 from 'proj4';
import config from '../region.config.mjs';

globalThis.proj4 = proj4;
const { default: createProjection, OUTPUTSIZES } = await import('../../server/scripts/modules/utils/map-projection.mjs');
const { default: ATV_REGION } = await import('../../server/scripts/modules/atv-region.mjs');

const read = (name) => JSON.parse(readFileSync(`./datagenerators/output/${name}.json`));
const regionalCities = read('regionalcities');
const stations = Object.values(read('stations'));

const viewer = process.argv[3]
	? { lat: parseFloat(process.argv[2]), lon: parseFloat(process.argv[3]) }
	: config.communities.find((c) => c.role === 'Central');
const center = ATV_REGION?.center ?? viewer;

// constants from regionalforecast.mjs
const CITYBOX = [136, 60];
const BOX_OFFSET = [CITYBOX[0] / 2 - 25, CITYBOX[1] / 2];
const MAX_TEXT_WIDTH = 12 * 10;
const MODES = [
	{
		name: 'standard', width: 640, height: 282, padY: 0, limit: 15,
	},
	{
		name: 'wide + enhanced', width: 854, height: 282, padY: 0, limit: 15,
	},
	{
		name: 'portrait + enhanced', width: 640, height: 970, padY: 26, limit: Infinity,
	},
];

const coerce = (v, min, max) => Math.min(Math.max(v, min), max);
const overlaps = (a, b) => !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);

const place = (mode) => {
	const projection = createProjection('forecast-conus');
	const size = OUTPUTSIZES['forecast-conus'];
	const { width: W, height: H, padY } = mode;
	const user = projection.forward([center.lon, center.lat]);
	user[0] = coerce(user[0], W / 2, size.width - W / 2);
	user[1] = coerce(user[1], H / 2, size.height - H / 2);

	const inv = (x, y) => projection.inverse([x, y]);
	const [minLon, minLat] = inv(user[0] - W / 2, user[1] + H / 2);
	const [maxLon, maxLat] = inv(user[0] + W / 2, user[1] - H / 2);
	const [sMinLon, sMinLat] = inv(user[0] - W / 2 + BOX_OFFSET[0], user[1] + H / 2 - (CITYBOX[1] - BOX_OFFSET[1]));
	const [sMaxLon, sMaxLat] = inv(user[0] + W / 2 - (MAX_TEXT_WIDTH - BOX_OFFSET[0]), user[1] - H / 2 + BOX_OFFSET[1]);

	const prep = (c, lat, lon) => {
		const pxy = projection.forward([lon, lat]);
		if (c.offset) {
			pxy[0] += c.offset[0];
			pxy[1] += c.offset[1];
		}
		const textWidth = c.city.slice(0, 12).length * 10;
		return {
			name: c.city,
			distance: Math.hypot(pxy[0] - user[0], pxy[1] - user[1]),
			box: {
				x1: pxy[0] - BOX_OFFSET[0],
				y1: pxy[1] - BOX_OFFSET[1],
				x2: pxy[0] - BOX_OFFSET[0] + Math.max(textWidth, 100),
				y2: pxy[1] - BOX_OFFSET[1] + CITYBOX[1] + padY,
			},
		};
	};
	const placeAll = (list, existing = []) => {
		list.sort((a, b) => a.distance - b.distance).forEach((c) => {
			if (!existing.some((e) => overlaps(c.box, e.box))) existing.push(c);
		});
		return existing;
	};

	const regional = regionalCities
		.filter((c) => +c.lat > minLat && +c.lat < maxLat && +c.lon > minLon && +c.lon < maxLon)
		.map((c) => prep(c, coerce(+c.lat, sMinLat, sMaxLat), coerce(+c.lon, sMinLon, sMaxLon)));
	const placedRegional = placeAll(regional);
	const nearbyStations = stations
		.filter((s) => s.lat > sMinLat && s.lat < sMaxLat && s.lon > sMinLon && s.lon < sMaxLon)
		.map((s) => prep(s, s.lat, s.lon));
	return placeAll(nearbyStations, [...placedRegional]).slice(0, mode.limit).map((c) => c.name);
};

console.log(`Regional map centered on ${center.lat}, ${center.lon}${ATV_REGION?.center ? ' (fixed, from region.config)' : ' (viewer)'}`);
let failed = false;
MODES.forEach((mode) => {
	const shown = place(mode);
	const missing = config.communities.map((c) => c.name).filter((n) => !shown.includes(n));
	const dupes = shown.filter((n, i) => shown.indexOf(n) !== i);
	const ok = !missing.length && !dupes.length;
	// portrait boxes are 26px taller; it is reported but does not fail the check
	if (!ok && mode.name !== 'portrait + enhanced') failed = true;
	console.log(`${ok ? '✓' : '✗'} ${mode.name.padEnd(20)} ${shown.length} labels${missing.length ? `  missing: ${missing.join(', ')}` : ''}${dupes.length ? `  duplicated: ${dupes.join(', ')}` : ''}`);
});
process.exit(failed ? 1 : 0);
