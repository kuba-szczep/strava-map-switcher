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

var AdditionalMapLayers;

{
	const osmAttr = '&copy; <a href="https://openstreetmap.org" target="_blank">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/" target="_blank">CC-BY-SA</a>';
	const thunderforestAttr = osmAttr + ', Tiles courtesy of <a href="https://www.thunderforest.com/" target="_blank">Andy Allan</a>';
	const mtbMapAttr = osmAttr + ', Tiles courtesy of <a href="https://mtbmap.cz/" target="_blank">mtbmap.cz</a>';
	const freeMapSkAttr = osmAttr + ', Tiles courtesy of <a href="https://freemap.sk/" target="_blank">freemap.sk</a>';
	const mapyCzAttr = '&copy; <a href="https://www.seznam.cz/" target="_blank">Seznam.cz, a.s</a>, ' + osmAttr;
	const cuzkAttr = '&copy; <a href="https://geoportal.cuzk.cz" target="_blank">ČÚZK</a>';
	const kartverketAttr = '&copy; <a href="https://www.kartverket.no/">Kartverket</a>';
	const geoportailAttr = '&copy; <a href="https://www.geoportail.gouv.fr/">Geoportail</a>';
	const swisstopoAttr = '&copy; <a href="https://www.swisstopo.admin.ch/" target="_blank">swisstopo</a>';
	const mtbMapNOAttr = osmAttr + ', Tiles courtesy of <a href="https://mtbmap.no/" target="_blank">mtbmap.no</a>';
	const cyclOsmAttr = osmAttr + ', Tiles style by <a href="https://www.cyclosm.org/" target="_blank">CyclOSM</a> hosted by <a href="https://openstreetmap.fr/" target="_blank">OpenStreetMap France</a>';
	const openTopoMapAttr = osmAttr + ', <a href="https://viewfinderpanoramas.org/" target="_blank">SRTM</a>, Tiles style by <a href="https://opentopomap.org/" target="_blank">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank">CC-BY-SA</a>)';

	// format: image format of the tiles ("png"/"jpg"), needed by Strava's new map engine (fix-fatmap.js)
	// mre: false hides the layer from Strava's new map engine (tiles not usable there: no CORS, API key needed…)
	AdditionalMapLayers = {
		openstreetmap: {name: "OpenStreetMap", format: "png",
			url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
			opts: {maxZoom: 20, maxNativeZoom: 19, attribution: osmAttr}},
		cyclosm: {name: "CyclOSM", format: "png",
			url: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
			opts: {maxZoom: 20, attribution: cyclOsmAttr}},
		opencyclemap: {name: "OpenCycleMap", format: "png",
			url: "https://{s}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png",
			opts: {maxZoom: 20, attribution: thunderforestAttr}},
		transport: {name: "Transport", format: "png",
			url: "https://{s}.tile.thunderforest.com/transport/{z}/{x}/{y}.png",
			opts: {maxZoom: 20, attribution: thunderforestAttr}},
		outdoors: {name: "Outdoors", format: "png",
			url: "https://{s}.tile.thunderforest.com/outdoors/{z}/{x}/{y}.png",
			opts: {maxZoom: 20, attribution: thunderforestAttr}},
		opentopomap: {name: "OpenTopoMap", format: "png",
			url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
			opts: {maxZoom: 20, maxNativeZoom: 17, attribution: openTopoMapAttr}},
		mapycz: {name: "mapy.cz (Outdoor)", mre: false,
			url: "https://mapserver.mapy.cz/turist-m/{z}-{x}-{y}",
			opts: {minZoom: 2, maxZoom: 20, maxNativeZoom: 18, attribution: mapyCzAttr}},
		mapyczwinter: {name: "mapy.cz (Winter)", mre: false,
			url: "https://mapserver.mapy.cz/winter-m/{z}-{x}-{y}",
			opts: {minZoom: 2, maxZoom: 20, maxNativeZoom: 18, attribution: mapyCzAttr}},
		mapyczbing: {name: "mapy.cz (Aerial)", mre: false,
			url: "https://mapserver.mapy.cz/ophoto-m/{z}-{x}-{y}",
			opts: {minZoom: 2, maxZoom: 20, attribution: mapyCzAttr},
			overlay:
				{url: "https://mapserver.mapy.cz/hybrid-trail_bike-m/{z}-{x}-{y}",
					opts: {minZoom: 2, maxZoom: 20, maxNativeZoom: 18, attribution: mapyCzAttr}}},
		mtbmap: {name: "mtbmap.cz [Europe]", format: "png",
			url: "https://tile.mtbmap.cz/mtbmap_tiles/{z}/{x}/{y}.png",
			opts: {minZoom: 3, maxZoom: 20, maxNativeZoom: 18, attribution: mtbMapAttr}},
		freemapsk: {name: "freemap.sk [Europe south-east]", format: "jpg", mre: false,
			url: "https://outdoor.tiles.freemap.sk/{z}/{x}/{y}",
			opts: {minZoom: 3, maxZoom: 20, maxNativeZoom: 19, attribution: freeMapSkAttr}},
		zmcr: {name: "Základní mapy ČR [CZ]", format: "jpg",
			url: "https://ags.cuzk.cz/arcgis1/rest/services/ZTM_WM/MapServer/tile/{z}/{y}/{x}",
			opts: {minZoom: 7, maxZoom: 20, maxNativeZoom: 18, attribution: cuzkAttr}},
		mtbmapno: {name: "mtbmap.no [NO]", format: "jpg",
			url: "https://mtbmap.no/tiles/osm/mtbmap/{z}/{x}/{y}.jpg",
			opts: {minZoom: 1, maxZoom: 20, maxNativeZoom: 16, attribution: mtbMapNOAttr}},
		kartverket: {name: "Kartverket [NO]", format: "png",
			url: "https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png",
			opts: {minZoom: 2, maxZoom: 20, maxNativeZoom: 18, attribution: kartverketAttr}},
		swisstopo: {name: "swisstopo [CH]", format: "jpg",
			url: "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
			opts: {minZoom: 2, maxZoom: 20, maxNativeZoom: 18, attribution: swisstopoAttr}},
		swisstopoAerial: {name: "swisstopo Aerial [CH]", format: "jpg",
			url: "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg",
			opts: {minZoom: 2, maxZoom: 20, maxNativeZoom: 20, attribution: swisstopoAttr}},
		geoportail: {name: "Geoportail Aerial [FR]", format: "jpg",
			url: "https://data.geopf.fr/wmts?layer=ORTHOIMAGERY.ORTHOPHOTOS&style=normal&tilematrixset=PM&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image%2Fjpeg&TileMatrix={z}&TileCol={x}&TileRow={y}",
			opts: {maxZoom: 20, maxNativeZoom: 19, attribution: geoportailAttr}},
	};
}
