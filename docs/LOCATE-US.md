# Locate us page – add your Google Maps link

The **Locate us** page (`/locate`) shows a link that opens your salon’s location in Google Maps. To use your own address:

## 1. Get your Google Maps link

1. Open [Google Maps](https://www.google.com/maps).
2. Search for your salon’s address, or find your business on the map.
3. Click **Share** (or the share icon).
4. Click **Copy link**. You’ll get a URL like `https://www.google.com/maps/place/...` or `https://goo.gl/maps/...`.

## 2. Put the link in the site

1. Open **`public/locate.html`** in your project.
2. Find the link with id `maps-link`:
   ```html
   <a id="maps-link" href="https://www.google.com/maps" ...>Open in Google Maps</a>
   ```
3. Replace `href="https://www.google.com/maps"` with your copied link, e.g.:
   ```html
   <a id="maps-link" href="https://www.google.com/maps/place/Your+Salon+Name/@lat,lng" ...>Open in Google Maps</a>
   ```
4. Save the file. Redeploy if the site is hosted (e.g. on Render).

After that, **Locate us** will open your salon’s location in Google Maps when users click “Open in Google Maps”.
