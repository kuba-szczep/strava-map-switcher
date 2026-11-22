# Map switcher for Strava website

Adds additional maps to Strava.com:

 - [OpenStreetMap](https://www.openstreetmap.org/)
 - [Thunderforest Maps](https://www.thunderforest.com/maps/): OpenCycleMap, Transport, Outdoors
 - [mtbmap.cz](http://mtbmap.cz/)
 - [mapy.cz](https://mapy.cz/)
 - [freemap.sk](https://www.freemap.sk/)
 - [Google Maps](https://maps.google.com/)
 - …

## Strava's new map engine (this fork)

The route builder and the Maps pages now use Strava's own map engine
instead of Mapbox GL. This fork supports it ([fix-fatmap.js](fix-fatmap.js))
with a user script served by [jsDelivr](https://www.jsdelivr.com/) straight
from this repository.

### Install

1. Install a user script manager: [Tampermonkey](https://www.tampermonkey.net/)
   or [Violentmonkey](https://violentmonkey.github.io/get-it/).
   In Chrome and Edge, also turn on *Allow User Scripts* in the extension's
   details (`chrome://extensions`), otherwise no user script runs.
2. Open
   <https://cdn.jsdelivr.net/gh/kuba-szczep/strava-map-switcher@master/standalone.user.js>
   and confirm the installation.
3. Turn off any other strava-map-switcher (the browser extension or other user
   scripts loading it): two switchers fight over the map.
4. Open the [route builder](https://www.strava.com/maps/create). A
   *Map: Strava ▾* panel shows up in the top right corner of the map.

`standalone.user.js` contains everything and is the tested way. The
alternative is the loader
<https://cdn.jsdelivr.net/gh/kuba-szczep/strava-map-switcher@master/greasemonkey.user.js>,
which fetches `load.js` from jsDelivr on every page load and also runs the old
switcher code for pages still using Leaflet or Mapbox GL.

### Updating

jsDelivr caches `@master` for up to 12 hours, and browsers keep it for up to
7 days. After pushing a change:

1. Clear the CDN cache by opening
   <https://purge.jsdelivr.net/gh/kuba-szczep/strava-map-switcher@master/standalone.user.js>
   (with the loader, do the same for `load.js`, `fix-fatmap.js` and `layers.js`).
2. Install the script again from the same URL (with the loader, reload Strava
   with Ctrl+Shift+R instead).

A commit hash instead of `@master` (for example `@1a2b3c4`) is never stale.

`standalone.user.js` is generated from `layers.js` and `fix-fatmap.js`: after
changing them, run `./build-userscript.sh` (or `make userscript`) and commit
the result.

### Notes

- PNG layers (OpenStreetMap, CyclOSM, …) show from zoom level 8 up. Below
  that, Strava's own map is visible. JPEG layers (swisstopo, …) work at every
  zoom level.
- OpenCycleMap, Transport and Outdoors need a free
  [Thunderforest API key](https://manage.thunderforest.com/users/sign_up?price=hobby-project-usd),
  entered at the bottom of the panel. Without it, the tiles carry an
  "API Key Required" watermark.
- Choosing a map style in Strava's map settings turns the switcher off.

## Donations (♥ = €)

If you like this extension and wish to support its development and maintenance
(Strava website changes and this extension must adapt to continue functioning),
please consider [a small donation](https://www.paypal.me/lisknisi/10EUR) or
[recurrent support through GitHub Sponsors](https://github.com/sponsors/liskin).

By donating, you'll also support the development of my other projects. You
might like these:

* [strava-offline](https://github.com/liskin/strava-offline) – Keep a local mirror of Strava activities for further analysis/processing
* [strava-gear](https://github.com/liskin/strava-gear) – Rule based tracker of gear and component wear primarily for Strava

## Installation

 - [Chrome Web Store](https://chrome.google.com/webstore/detail/strava-map-switcher/djcheclpmmkcdkjcenfamalobdenmici)
 - [Firefox Addons](https://addons.mozilla.org/cs/firefox/addon/strava-map-switcher/)
 - [Microsoft Edge Extensions](https://microsoftedge.microsoft.com/addons/detail/stravamapswitcher/dgepecolfdnodeepdmfdojcpmofplbjl)
 - [user script](https://cdn.jsdelivr.net/gh/liskin/strava-map-switcher@master/greasemonkey.user.js)
   ([ViolentMonkey](https://violentmonkey.github.io/get-it/),
   [GreaseMonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/))
 - <details><summary><a href="https://en.wikipedia.org/wiki/Bookmarklet">bookmarklet</a></summary><pre><code>
   javascript:{const s = document.createElement("script"); s.src = 'https://cdn.jsdelivr.net/gh/liskin/strava-map-switcher@master/load.js'; s.type = 'text/javascript'; document.body.appendChild(s);};void(0);
   </code></pre></details>

## Screenshots

![2020-05-23-115146_1920x1080_scrot](https://user-images.githubusercontent.com/300342/82727665-385c2800-9cec-11ea-886b-289a65c4431d.png)
![2020-05-23-115427_1920x1080_scrot](https://user-images.githubusercontent.com/300342/82727668-3c884580-9cec-11ea-8d82-09f4f9af3ee2.png)
![2020-05-22-231817_1920x1080_scrot](https://user-images.githubusercontent.com/300342/82727672-40b46300-9cec-11ea-939d-0157e3d5f661.png)
![2020-05-22-231822_1920x1080_scrot](https://user-images.githubusercontent.com/300342/82727675-4447ea00-9cec-11ea-8109-334b83e5a096.png)
