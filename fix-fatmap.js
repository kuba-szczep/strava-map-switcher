/*
 * Map switcher for Strava website.
 *
 * Copyright © 2016 Tomáš Janoušek.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/*
 * Support for Strava's own WebAssembly map engine ("MRE", inherited from
 * FATMAP), which replaced Mapbox GL in the route builder and on the Maps pages.
 *
 * The engine object comes from the React context that provides it to
 * canvas[data-testid="mre-canvas"]. New tile sources can't be registered, but
 * two raster sources of the engine can be re-pointed to any XYZ tile URL:
 *
 *   PNG layers  -> "winter-overlay-imagery", drawn by map type WINTER (zoom 7+)
 *   JPEG layers -> "summer-imagery", drawn by map type SATELLITE (zoom 0+)
 *
 * The engine picks the image decoder from the source definition, not from the
 * data, so the format has to match. A mismatch draws nothing and makes the
 * engine re-request the same tiles in a tight loop.
 *
 * Tiles are cached per (source, tile), so re-pointing a source that has
 * already been drawn leaves stale tiles behind. They can only be dropped with
 * getDebugApi().clearCache(), which crashes the engine ("memory access out of
 * bounds") when called while tiles are loading or the camera moves. It is
 * therefore only ever called after the map has been quiet for a while.
 */

(function () {
	'use strict';

	if (window.mapSwitcherMRE)
		return;

	const TAG = '[MapSwitcher]';
	const PREF_KEY = 'stravaMapSwitcherPreferred';
	const TF_KEY = 'stravaMapSwitcherThunderforestKey';
	const OPEN_KEY = 'stravaMapSwitcherPanelOpen';
	const QUIET_MS = 500;

	const WINTER = 'winter-overlay-imagery';
	const SUMMER = 'summer-imagery';
	const SLOTS = {
		png: {source: WINTER, mapType: 7}, // STRAVA_PLANET_TOPO_WINTER_HYBRID_EXPERIMENT
		jpg: {source: SUMMER, mapType: 9}, // STRAVA_PLANET_SATELLITE_SUMMER_EXPERIMENT
	};
	// imagery source drawn by each engine map type (from the styles bundled in the engine)
	const MAP_TYPE_SOURCE = {2: WINTER, 7: WINTER, 3: SUMMER, 4: SUMMER, 8: SUMMER, 9: SUMMER};
	// used when a source hasn't been registered by the engine yet (summer-imagery is lazy)
	const DEFAULT_URLS = {
		[WINTER]: '{STRAVA_TILE_SERVER_URL}/winter-imagery/{quadkey}.png?groupId={groupId}',
		[SUMMER]: '{STRAVA_TILE_SERVER_URL}/summer-imagery/{quadkey}.jpg?groupId={groupId}',
	};
	const DEFAULT_MAP_TYPE = 5; // STRAVA_PLANET_TOPO_LIGHT_EXPERIMENT

	const storage = {
		get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
		set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode etc. */ } },
	};

	function availableLayers() {
		const all = typeof AdditionalMapLayers === 'object' && AdditionalMapLayers ? AdditionalMapLayers : {};
		return Object.fromEntries(Object.entries(all).filter(([, l]) => l.mre !== false));
	}

	function findEngine(canvas) {
		const key = Object.keys(canvas).find(k => k.startsWith('__reactFiber$'));
		let te = null, state = null;
		for (let f = key && canvas[key], i = 0; f && i < 300 && !(te && state); f = f.return, i++) {
			const v = f.memoizedProps && f.memoizedProps.value;
			if (!v || typeof v !== 'object')
				continue;
			if (!te && v.terrainEngine)
				te = v.terrainEngine;
			if (!state && 'mapType' in v && typeof v.setMapType === 'function')
				state = v;
		}
		return te ? {te, state} : null;
	}

	// is the current event a click on one of the map style tiles in Strava's map settings?
	function clickedStravaMapStyle() {
		const ev = window.event;
		if (!ev || !/^(click|pointerup|mouseup|keydown|keyup)$/.test(ev.type) || !(ev.target instanceof Element))
			return false;
		const button = ev.target.closest('button, [role="button"], label');
		return !!(button && button.querySelector(['standard', 'dark', 'satellite', 'hybrid', 'winter'].map(s => `img[src*="/media/${s}."]`).join()));
	}

	function resolveUrl(layer) {
		let url = layer.url.replace('{s}', (layer.subdomains || 'abc')[0]);
		const key = storage.get(TF_KEY).trim();
		if (key && /\.thunderforest\.com\//.test(url))
			url += (url.includes('?') ? '&' : '?') + 'apikey=' + encodeURIComponent(key);
		return url;
	}

	// a tile around the current view, used to sniff the format of layers that don't declare it
	function sampleTileUrl(url, layer) {
		let zoom = 12, lat = 50, lon = 15;
		const m = location.hash.match(/^#([\d.]+)\/(-?[\d.]+)\/(-?[\d.]+)/);
		if (m)
			[zoom, lat, lon] = [+m[1], +m[2], +m[3]];
		const o = layer.opts || {};
		const z = Math.max(o.minZoom || 0, Math.min(o.maxNativeZoom || o.maxZoom || 18, Math.round(zoom) + 1));
		const n = 2 ** z, r = lat * Math.PI / 180;
		const x = Math.floor((lon + 180) / 360 * n);
		const y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n);
		return url.replace('{z}', z).replace('{x}', x).replace('{y}', y);
	}

	const probedFormats = {};
	async function layerFormat(key, layer, url) {
		if (layer.format)
			return layer.format;
		if (probedFormats[key])
			return probedFormats[key];

		let format = /\.jpe?g($|\?)/i.test(layer.url) ? 'jpg' : 'png';
		const resp = await fetch(sampleTileUrl(url, layer), {credentials: 'omit'}); // throws on CORS/network errors
		if (resp.ok) {
			const b = new Uint8Array(await resp.arrayBuffer());
			if (b[0] === 0x89 && b[1] === 0x50)
				format = 'png';
			else if (b[0] === 0xff && b[1] === 0xd8)
				format = 'jpg';
		}
		return probedFormats[key] = format;
	}

	class Controller {
		constructor(canvas, te, state) {
			this.canvas = canvas;
			this.te = te;
			this.stravaMapType = state && state.mapType != null ? state.mapType : DEFAULT_MAP_TYPE;
			this.engineMapType = this.stravaMapType;
			this.active = null;    // {key, layer, format, url}
			this.original = {};    // source -> Strava's template URL
			this.current = {};     // source -> template URL set in the engine by us
			this.cached = {};      // source -> template URL whose tiles may be in the engine cache
			this.loading = false;
			this.created = this.lastEvent = this.lastOp = this.camSince = performance.now();
			this.camKey = null;
			this.selection = 0;
			this.status = null;    // {key, text}

			this.hookSetMapType();
			this.hookTileLoading();
			this.noteDrawn();
			this.panel = new Panel(this);
			this.whenQuiet(1500).then(() => this.applyPreferred());
		}

		destroy() {
			this.destroyed = true;
			clearTimeout(this.clearTimer);
			this.panel.remove();
		}

		hookSetMapType() {
			const self = this, orig = this.te.setMapType;
			this.origSetMapType = orig;
			this.te.setMapType = function (type) {
				const passThrough = () => orig.apply(this, arguments);
				if (self.destroyed)
					return passThrough();
				try {
					return self.stravaSetMapType(type, passThrough);
				} catch (e) {
					console.error(TAG, e);
					return passThrough();
				}
			};
		}

		hookTileLoading() {
			const mark = loading => () => { this.loading = loading; this.lastEvent = performance.now(); };
			try {
				this.te.addTileLoadingListener({onTilesLoadingStarted: mark(true), onTilesLoaded: mark(false)});
				this.tileEvents = true;
			} catch (e) {
				console.warn(TAG, 'tile loading listener unavailable', e);
			}
		}

		// Strava (UI or its React effects) changes the map type
		stravaSetMapType(type, passThrough) {
			const previous = this.stravaMapType;
			this.stravaMapType = type;
			if (this.active) {
				if (type === previous && !clickedStravaMapStyle()) {
					// Strava re-applies its current style (e.g. after toggling 3D or POIs): keep ours
					this.setEngineMapType(SLOTS[this.active.format].mapType);
					return;
				}
				// the user picked one of Strava's map styles: step aside
				storage.set(PREF_KEY, '');
				this.deactivate(false);
			}
			const ret = passThrough();
			this.afterMapType(type);
			return ret;
		}

		setEngineMapType(type) {
			if (this.engineMapType !== type)
				this.origSetMapType.call(this.te, type);
			this.afterMapType(type);
		}

		afterMapType(type) {
			this.engineMapType = type;
			this.lastOp = performance.now();
			this.noteDrawn();
		}

		originalUrl(source) {
			if (!(source in this.original)) {
				let url = DEFAULT_URLS[source];
				try {
					const s = this.te.getTileSources().getTileSources().find(s => s.name === source);
					if (s)
						url = s.templateUrl;
				} catch (e) {
					console.warn(TAG, e);
				}
				this.original[source] = url;
			}
			return this.original[source];
		}

		currentUrl(source) {
			return source in this.current ? this.current[source] : this.originalUrl(source);
		}

		setSource(source, url) {
			const target = url == null ? this.originalUrl(source) : url;
			if (this.currentUrl(source) === target)
				return;
			this.te.getTileSources().setTileSourceTemplateUrl(source, target);
			this.current[source] = target;
			this.lastOp = performance.now();
			if (MAP_TYPE_SOURCE[this.engineMapType] === source)
				this.noteDrawn();
		}

		drawnSource() {
			return MAP_TYPE_SOURCE[this.engineMapType];
		}

		// the drawn source now caches tiles for its current URL; schedule a cache clear if it holds other tiles
		noteDrawn() {
			const source = this.drawnSource();
			if (!source)
				return;
			const url = this.currentUrl(source);
			if (!(source in this.cached))
				this.cached[source] = url;
			else if (this.cached[source] !== url)
				this.scheduleClear();
		}

		isStale() {
			const source = this.drawnSource();
			return !!source && source in this.cached && this.cached[source] !== this.currentUrl(source);
		}

		quiet() {
			const now = performance.now();
			let cam = null;
			try {
				cam = JSON.stringify(this.te.getCamera().getTarget(), (k, v) => typeof v === 'bigint' ? Number(v) : v);
			} catch (e) { /* keep null */ }
			if (cam !== this.camKey) {
				this.camKey = cam;
				this.camSince = now;
			}
			const settle = this.tileEvents ? QUIET_MS : 3 * QUIET_MS;
			return !this.loading
				&& document.visibilityState === 'visible'
				&& now - this.lastEvent > settle
				&& now - this.lastOp > settle
				&& now - this.camSince > settle;
		}

		whenQuiet(minAge = 0) {
			return new Promise(resolve => {
				const tick = () => {
					if (this.destroyed)
						return;
					if (performance.now() - this.created > minAge && this.quiet())
						resolve();
					else
						setTimeout(tick, 100);
				};
				tick();
			});
		}

		scheduleClear() {
			if (this.clearTimer || this.destroyed || this.cannotClear)
				return;
			const tick = () => {
				this.clearTimer = null;
				if (this.destroyed || !this.isStale())
					return;
				if (!this.quiet()) {
					this.clearTimer = setTimeout(tick, 100);
					return;
				}
				// checked and done within one task, so nothing can start loading in between
				this.clearCache();
			};
			this.clearTimer = setTimeout(tick, 100);
		}

		clearCache() {
			try {
				this.te.getDebugApi().clearCache();
			} catch (e) {
				console.warn(TAG, 'cannot clear the tile cache, zoom in/out to refresh the map', e);
				this.cannotClear = true;
				return;
			}
			this.cached = {};
			this.lastOp = performance.now();
			this.noteDrawn();
			try { this.te.requestRender(); } catch (e) { /* ignore */ }
		}

		applyPreferred() {
			if (this.destroyed || this.active)
				return;
			const fresh = findEngine(this.canvas);
			if (fresh && fresh.state && fresh.state.mapType != null)
				this.stravaMapType = this.engineMapType = fresh.state.mapType;
			const preferred = storage.get(PREF_KEY);
			if (preferred && availableLayers()[preferred])
				this.select(preferred);
		}

		async select(key) {
			const token = ++this.selection;
			storage.set(PREF_KEY, key || '');
			this.status = null;

			const layer = key && availableLayers()[key];
			if (!layer) {
				this.deactivate(true);
				return;
			}

			const url = resolveUrl(layer);
			let format;
			try {
				this.status = {key, text: '…'};
				this.panel.refresh();
				format = await layerFormat(key, layer, url);
			} catch (e) {
				console.warn(TAG, `cannot load tiles of ${key}`, e);
				if (token === this.selection) {
					this.status = {key, text: 'unavailable'};
					this.panel.refresh();
				}
				return;
			}
			if (token !== this.selection || this.destroyed)
				return;

			// the other slot keeps its URL until deactivate(): restoring it here would make the
			// engine fetch Strava's imagery for it during the few frames the old style is still drawn
			const slot = SLOTS[format] || SLOTS.png;
			this.setSource(slot.source, url);
			this.active = {key, layer, format, url};
			this.status = null;
			this.setEngineMapType(slot.mapType);
			this.panel.refresh();
		}

		deactivate(restoreMapType) {
			this.active = null;
			for (const slot of Object.values(SLOTS))
				this.setSource(slot.source, null);
			if (restoreMapType)
				this.setEngineMapType(this.stravaMapType);
			this.panel.refresh();
		}

		refreshActive() {
			if (this.active)
				this.select(this.active.key);
		}
	}

	const STYLE = `
#msw-panel { position: absolute; top: 64px; right: 12px; z-index: 3; min-width: 190px; max-width: 250px;
	background: #fff; color: #242428; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.25);
	font: 12px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
#msw-panel button { display: flex; justify-content: space-between; gap: 8px; width: 100%; padding: 6px 10px;
	font: inherit; color: inherit; text-align: left; background: none; border: 0; cursor: pointer; }
#msw-panel button:hover { background: #f2f2f5; }
#msw-panel .msw-head { font-weight: 600; border-radius: 8px; }
#msw-panel .msw-body { border-top: 1px solid #e5e5ea; }
#msw-panel .msw-list { max-height: min(55vh, 420px); overflow-y: auto; padding: 4px 0; }
#msw-panel .msw-item[aria-checked="true"] { color: #fc5200; font-weight: 600; }
#msw-panel .msw-status { color: #86868b; font-weight: normal; }
#msw-panel .msw-foot { border-top: 1px solid #e5e5ea; padding: 6px 10px 8px; font-size: 11px; color: #6d6d78; }
#msw-panel .msw-foot a { color: inherit; }
#msw-panel input { box-sizing: border-box; width: 100%; margin: 3px 0 6px; padding: 3px 6px;
	font: inherit; border: 1px solid #cfcfd6; border-radius: 4px; }
#msw-attribution { position: absolute; right: 44px; bottom: 6px; z-index: 3; max-width: 55%; padding: 1px 6px;
	font: 10px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
	color: #333; background: rgba(255,255,255,.8); border-radius: 3px; }
#msw-attribution a { color: inherit; }
`;

	class Panel {
		constructor(ctrl) {
			this.ctrl = ctrl;
			if (!document.getElementById('msw-style')) {
				const style = document.createElement('style');
				style.id = 'msw-style';
				style.textContent = STYLE;
				document.head.appendChild(style);
			}

			this.root = this.el('div', {id: 'msw-panel'});
			for (const ev of ['pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick', 'wheel', 'touchstart', 'contextmenu', 'keydown', 'keyup'])
				this.root.addEventListener(ev, e => e.stopPropagation());

			this.head = this.el('button', {className: 'msw-head', type: 'button'});
			this.head.addEventListener('click', () => {
				storage.set(OPEN_KEY, this.body.hidden ? '1' : '');
				this.refresh();
			});
			this.body = this.el('div', {className: 'msw-body'});
			this.list = this.el('div', {className: 'msw-list', role: 'menu'});
			this.body.append(this.list, this.footer());
			this.root.append(this.head, this.body);

			this.attribution = this.el('div', {id: 'msw-attribution'});
			this.refresh();
			this.mount();
		}

		el(tag, props = {}) {
			return Object.assign(document.createElement(tag), props);
		}

		footer() {
			const foot = this.el('div', {className: 'msw-foot'});
			const label = this.el('label', {textContent: 'Thunderforest API key '});
			const getKey = this.el('a', {href: 'https://manage.thunderforest.com/users/sign_up?price=hobby-project-usd', target: '_blank', rel: 'noopener', textContent: '(free)'});
			label.append(getKey);
			const input = this.el('input', {type: 'text', placeholder: 'removes the watermark', value: storage.get(TF_KEY), spellcheck: false});
			input.addEventListener('change', () => {
				storage.set(TF_KEY, input.value.trim());
				const active = this.ctrl.active;
				if (active && /\.thunderforest\.com\//.test(active.layer.url))
					this.ctrl.refreshActive();
			});
			label.append(input);
			const home = this.el('a', {href: 'https://github.com/liskin/strava-map-switcher#readme', target: '_blank', rel: 'noopener', textContent: 'strava-map-switcher'});
			foot.append(label, home);
			return foot;
		}

		mount() {
			const container = this.ctrl.canvas.parentElement;
			if (!container)
				return;
			if (this.root.parentElement !== container)
				container.appendChild(this.root);
			if (this.attribution.parentElement !== container)
				container.appendChild(this.attribution);
		}

		remove() {
			this.root.remove();
			this.attribution.remove();
		}

		refresh() {
			const {active, status} = this.ctrl;
			const layers = availableLayers();
			const activeName = active ? active.layer.name : 'Strava';

			const open = !!storage.get(OPEN_KEY);
			this.body.hidden = !open;
			this.head.setAttribute('aria-expanded', String(open));
			this.head.replaceChildren(this.el('span', {textContent: `Map: ${activeName}`}), this.el('span', {textContent: open ? '▴' : '▾'}));

			const items = [['', {name: 'Strava (default)'}], ...Object.entries(layers)].map(([key, layer]) => {
				const checked = active ? active.key === key : !key;
				const item = this.el('button', {className: 'msw-item', type: 'button', role: 'menuitemradio'});
				item.setAttribute('aria-checked', String(checked));
				item.append(this.el('span', {textContent: layer.name}));
				if (status && status.key === key)
					item.append(this.el('span', {className: 'msw-status', textContent: status.text}));
				item.addEventListener('click', () => this.ctrl.select(key));
				return item;
			});
			this.list.replaceChildren(...items);

			// attribution strings come from layers.js (trusted, part of this script)
			this.attribution.innerHTML = active && active.layer.opts && active.layer.opts.attribution || '';
			this.attribution.hidden = !this.attribution.innerHTML;
		}
	}

	let controller = null;

	function tick() {
		try {
			const canvas = document.querySelector('canvas[data-testid="mre-canvas"]');
			if (!canvas) {
				if (controller) {
					controller.destroy();
					controller = null;
				}
				return;
			}

			const found = findEngine(canvas);
			if (!found)
				return;
			if (controller && controller.canvas === canvas && controller.te === found.te) {
				controller.panel.mount();
				return;
			}
			if (controller)
				controller.destroy();
			controller = new Controller(canvas, found.te, found.state);
		} catch (e) {
			console.error(TAG, e);
		}
	}

	window.mapSwitcherMRE = {
		get controller() { return controller; },
	};
	setInterval(tick, 1000);
	tick();
})();
