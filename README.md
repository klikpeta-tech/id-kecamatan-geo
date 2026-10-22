# id-kecamatan-geo

Simplified Indonesian kecamatan (admin level 3) boundaries for map visualisation, published with GitHub Pages. Built for the Lightdash map charts that use a custom GeoJSON region, but usable by any map tool.

This repository contains only public government boundary data, the script that builds it, and documentation.

## Files

Served at `https://klikpeta-tech.github.io/id-kecamatan-geo/`:

| File | Content | Size |
|---|---|---|
| [`kecamatan.geojson`](https://klikpeta-tech.github.io/id-kecamatan-geo/kecamatan.geojson) | all 7,069 kecamatan, strongly simplified (national view) | about 7.2 MB |
| `provinsi/<adm1_pcode>.geojson`, for example [`provinsi/ID33.geojson`](https://klikpeta-tech.github.io/id-kecamatan-geo/provinsi/ID33.geojson) | the kecamatan of one province, simplified less (regional or provincial view) | 0.05 to 1.7 MB |
| [`index.json`](https://klikpeta-tech.github.io/id-kecamatan-geo/index.json) | manifest: source, simplification settings, and every file with its URL, size and feature count | small |

All 34 provinces are published, so every Klikpeta Sales region is covered. Every file is below 9 MB, under the 10 MB limit Lightdash enforces on custom GeoJSON files.

Each feature is a `Polygon` or `MultiPolygon` in WGS 84 (EPSG:4326) with these properties, named as in the HDX source:

| Property | Meaning | Example |
|---|---|---|
| `adm3_pcode` | kecamatan code (BPS code with an `ID` prefix), the key to join on | `ID3374010` |
| `adm3_name` | kecamatan name | `Mijen` |
| `adm2_pcode`, `adm2_name` | kabupaten or kota | `ID3374`, `Kota Semarang` |
| `adm1_pcode`, `adm1_name` | province | `ID33`, `Jawa Tengah` |

`adm3_pcode` is unique across the national file. Kecamatan names are not (the same name repeats across kabupaten), so join on the code, not the name.

In Lightdash, set the map chart to a custom region with `customGeoJsonUrl` pointing at one of the URLs above and `geoJsonPropertyKey: adm3_pcode`.

## Source and attribution

- Dataset: [Indonesia - Subnational Administrative Boundaries](https://data.humdata.org/dataset/cod-ab-idn) (COD-AB, dataset version 01, admin levels 0-4) on the Humanitarian Data Exchange.
- Source organisation: Badan Pusat Statistik (BPS - Statistics Indonesia), contributed by OCHA Regional Office for Asia and the Pacific, published by OCHA Field Information Services and HDX.
- HDX resource `idn_admin_boundaries.geojson.zip`, last modified 2026-06-23, SHA-256 `d285a40f9fc4b726b1bda98ee833d52d23d94fe78b6a47c0a769d2e912ff0970`. Boundaries valid from 2020-04-01.
- Licence: [Creative Commons Attribution 3.0 IGO (CC BY-IGO)](https://creativecommons.org/licenses/by/3.0/igo/). Attribution required: "Boundaries: Badan Pusat Statistik (BPS), via OCHA and the Humanitarian Data Exchange, CC BY-IGO."
- The files here are adapted from the source: simplified, reduced to the properties above and split by province. They are not an official representation of the boundaries, and the simplification is not suitable for surveying or area calculation. The source dataset carries the usual COD disclaimer: the designations used do not imply any opinion about the legal status of a territory.

## Rebuilding

```sh
npm ci
npm run build
```

Requires Node 20 or later and `unzip`. The build:

1. downloads the pinned HDX archive into `.cache/` (about 456 MB, not committed) and refuses it unless the SHA-256 matches the one in [`scripts/config.mjs`](scripts/config.mjs), so a silent re-upload on HDX cannot change the output;
2. extracts `idn_admin3.geojson` and keeps only the properties listed above;
3. simplifies with [mapshaper](https://github.com/mbloch/mapshaper) 0.6.112 (pinned in `package.json`), Visvalingam, `keep-shapes`: 3% of vertices kept for the national file and 10% for the province files;
4. writes `public/` and validates it (feature counts, unique codes, properties, province files add up to the national file, file sizes below the limit).

Mapshaper reports a handful of self-intersections it could not repair after the national simplification (3 at the time of writing); they do not affect joining or colouring.

To move to a newer HDX release, review the new archive, then update `url`, `sha256` and `resourceModified` in `scripts/config.mjs` and rebuild.

`npm run validate` re-checks the committed files without downloading anything; the pull request workflow runs it.

## Publishing

`public/` is deployed to GitHub Pages by [`.github/workflows/pages.yml`](.github/workflows/pages.yml) on every push to `main` that changes `public/`. The generated files are committed, so a rebuild is a normal reviewed pull request.
