// ATV fork: put the location in the titles of city-specific screens, e.g.
// "Local / Forecast" -> "Fayetteville / Forecast". Region-wide screens (Regional, Travel,
// Latest Observations), the SPC Outlook and Hazards keep their upstream titles.
//
// The city comes from the location the app reports to the headend panel ("City, ST"), so it
// follows searches, GPS and the rotation alike. A screen that is on screen when the location
// changes (the one held during a rotation switch) keeps its title until it goes off screen,
// so a title never changes under the data it belongs to.

// display element id -> bottom line under the city
const LABELS = {
	'current-weather-html': 'Conditions',
	'local-forecast-html': 'Forecast',
	'extended-forecast-html': 'Extended Forecast',
	'hourly-html': 'Hourly Forecast',
	'hourly-graph-html': 'Hourly Graph',
	'almanac-html': 'Almanac',
	'climate-html': 'Climate',
	'radar-html': 'Radar',
	'future-radar-html': 'Future Radar',
};
// upstream's Hourly Graph finds its chart areas with the bare selectors '.top' and '.bottom', so its
// title lines use their own class names (positioned the same in custom/theme/_overrides.scss)
const LINE_CLASSES = { 'hourly-graph-html': ['atv-top', 'atv-bottom'] };
const DEFAULT_LINE_CLASSES = ['top', 'bottom'];
// upstream's Current Conditions writes "Current" or "Recent" (stale data) into its title on every draw
const STALE_LABEL = 'Recent Conditions';
// names longer than this are drawn smaller so they still fit before the clock
const FIT_CHARS = 12;

let city = '';
const stale = {}; // element id -> upstream reported stale data
const titleCity = {}; // element id -> city its title currently shows

const render = (display, name = city) => {
	const title = display.querySelector(':scope > .header .title');
	if (!title || !name) return;
	const label = stale[display.id] ? STALE_LABEL : LABELS[display.id];
	const [topClass, bottomClass] = LINE_CLASSES[display.id] ?? DEFAULT_LINE_CLASSES;
	const top = title.querySelector(`:scope > .${topClass}`);
	const bottom = title.querySelector(`:scope > .${bottomClass}`);
	if (title.classList.contains('atv-city-title') && top?.textContent === name && bottom?.textContent === label && title.children.length === 2) return;
	const topDiv = document.createElement('div');
	topDiv.className = topClass;
	topDiv.textContent = name;
	const bottomDiv = document.createElement('div');
	bottomDiv.className = bottomClass;
	bottomDiv.textContent = label;
	title.classList.remove('single');
	title.classList.add('dual', 'atv-city-title');
	title.style.setProperty('--atv-city-fit', Math.min(1, FIT_CHARS / name.length));
	title.replaceChildren(topDiv, bottomDiv);
	titleCity[display.id] = name;
};

const start = () => {
	const displays = Object.keys(LABELS).map((id) => document.getElementById(id)).filter(Boolean);
	const pending = new Set(); // on screen when the city changed; retitled when they go off screen

	displays.forEach((display) => {
		const title = display.querySelector(':scope > .header .title');
		if (!title) return;
		// upstream rewrote the title (Current Conditions does on every draw): note its wording, then reapply
		new MutationObserver(() => {
			const top = title.querySelector('.top')?.textContent?.trim();
			if (top === 'Recent' || top === 'Current') stale[display.id] = top === 'Recent';
			// a screen still showing the previous city keeps it
			render(display, pending.has(display) ? titleCity[display.id] : city);
		}).observe(title, { subtree: true, childList: true, characterData: true });
		// going off screen: apply a city change that was waiting for it
		new MutationObserver(() => {
			if (pending.has(display) && !display.classList.contains('show')) {
				pending.delete(display);
				render(display);
			}
		}).observe(display, { attributes: true, attributeFilter: ['class'] });
	});

	// the app writes "City, ST" here on every location change
	const source = document.querySelector('#divInfo [data-headend="location"]');
	if (!source) return;
	const update = () => {
		const next = source.textContent.replace(/,\s*[A-Z]{2}\s*$/, '').trim();
		if (!next || next === city) return;
		city = next;
		displays.forEach((display) => {
			if (display.classList.contains('show')) pending.add(display);
			else render(display);
		});
	};
	new MutationObserver(update).observe(source, { subtree: true, childList: true, characterData: true });
	update();
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
