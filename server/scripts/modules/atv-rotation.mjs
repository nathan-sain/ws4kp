// ATV fork: rotate the display between the Regional map's communities.
//
// When the screen cycle ends (the last enabled screen finishes and navigation would wrap back
// to the first), the next community is loaded the same way choosing a location does, and the
// normal auto-start then plays every screen for that city. The last screen stays on air while
// the next city loads and is replaced in the same frame, so the output never goes blank
// (broadcast-safe). The viewer's saved location is not changed.
//
// Turn on with ?rotate=true (Docker: WSQS_rotate=true). ?rotateCycles=N shows each city for
// N full cycles (default 1). Both are kept in the Share permalink. ?debug=rotation logs it.
import { latLonReceived } from './location.mjs';
import { setWrapHandler, resetStatuses, holdCurrentDisplay } from './navigation.mjs';
import { RegionalCities } from './utils/data-loader.mjs';
import { parseQueryString } from './utils/setting.mjs';
import { registerHiddenSetting } from './share.mjs';
import { debugFlag } from './utils/debug.mjs';

const params = parseQueryString();
const enabled = params.rotate === 'true';
const cyclesPerCity = Math.max(1, parseInt(params.rotateCycles ?? '1', 10) || 1);
// a city that hasn't started playing by then (e.g. NWS down for it) is skipped
const LOAD_TIMEOUT = 30_000;

const log = (...args) => {
	if (debugFlag('rotation')) console.log('🔁 rotation:', ...args);
};

// index of the starting location in the list, or -1 if it isn't one of the communities
const startingIndex = (cities) => {
	try {
		const { lat, lon } = JSON.parse(params.latLon ?? localStorage.getItem('latLon'));
		return cities.findIndex((c) => Math.abs(c.lat - lat) < 0.05 && Math.abs(c.lon - lon) < 0.05);
	} catch {
		return -1;
	}
};

const start = async () => {
	const cities = (await RegionalCities).map((c) => ({ name: c.city, lat: parseFloat(c.lat), lon: parseFloat(c.lon) }));
	if (cities.length < 2) return;

	let current = startingIndex(cities);
	let cycles = 0;
	let held = null; // element kept on screen while the next city loads
	let watchdog = null;

	const switchToNext = () => {
		current = (current + 1) % cities.length;
		const city = cities[current];
		log(`switching to ${city.name}`);
		// keep the current screen up until the new city's first screen replaces it
		holdCurrentDisplay();
		held = document.querySelector('.weather-display.show');
		// mark every display as loading: otherwise navigation can treat the previous city's
		// data as ready and show a display that is about to be cleared for the reload
		resetStatuses();
		latLonReceived({ lat: city.lat, lon: city.lon });

		clearTimeout(watchdog);
		watchdog = setTimeout(() => {
			if (held?.classList.contains('show')) {
				log(`${city.name} didn't start within ${LOAD_TIMEOUT / 1000}s, skipping it`);
				switchToNext();
			}
		}, LOAD_TIMEOUT);
	};

	setWrapHandler(() => {
		cycles += 1;
		log(`cycle ${cycles}/${cyclesPerCity} complete`);
		if (cycles < cyclesPerCity) return false; // keep playing this city
		cycles = 0;
		switchToNext();
		return true; // the new city's first display replaces the held one once it's loaded
	});
	log(`on: ${cities.map((c) => c.name).join(', ')}; ${cyclesPerCity} cycle(s) per city`);
};

if (enabled) {
	registerHiddenSetting('rotate', () => 'true');
	if (cyclesPerCity !== 1) registerHiddenSetting('rotateCycles', () => String(cyclesPerCity));
	start();
}
