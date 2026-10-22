# id-kecamatan-geo

Simplified Indonesian kecamatan (admin level 3) boundaries for map visualisation, published with GitHub Pages. Built for the Lightdash map charts that use a custom GeoJSON region, but usable by any map tool.

This repository contains only public government boundary data, the script that builds it, and documentation.

## Files

Served at `https://klikpeta-tech.github.io/id-kecamatan-geo/`:

| File | Content | Size |
|---|---|---|
| [`kecamatan.geojson`](https://klikpeta-tech.github.io/id-kecamatan-geo/kecamatan.geojson) | all 7,031 kecamatan, simplified | about 7.2 MB |

The source uses the boundaries valid from 2020, so the four provinces created from Papua in 2022 (Papua Selatan, Papua Tengah, Papua Pegunungan, Papua Barat Daya) are not separate: their kecamatan carry the old province in `adm1_pcode` and `adm1_name` (`ID94` Papua, `ID91` Papua Barat). Kecamatan codes are unaffected, so join on `adm3_pcode`. There is no mapping to current provinces here. The file is below 9 MB, under the 10 MB limit Lightdash enforces on custom GeoJSON files.

Each feature is a `Polygon` or `MultiPolygon` in WGS 84 (EPSG:4326) with these properties, named as in the HDX source:

| Property | Meaning | Example |
|---|---|---|
| `adm3_pcode` | kecamatan code (BPS code with an `ID` prefix), the key to join on | `ID3374010` |
| `adm3_name` | kecamatan name | `Mijen` |
| `adm2_pcode`, `adm2_name` | kabupaten or kota | `ID3374`, `Kota Semarang` |
| `adm1_pcode`, `adm1_name` | province | `ID33`, `Jawa Tengah` |

The source has 7,069 admin 3 features. 38 of them are not kecamatan (lakes and reservoirs such as Danau Toba and Waduk Cirata, forest, empty areas, unnamed islands) and are left out, which is why there are 7,031. They are recognised by their placeholder codes, which end in `000`, `555`, `888` or `999` where real kecamatan codes end in `010`, `020` and so on (`NON_KECAMATAN_CODE_SUFFIXES` in `scripts/config.mjs`). A point that falls inside one of those areas does not match any kecamatan.

`adm3_pcode` is unique in the file. Kecamatan names are not (the same name repeats across kabupaten), so join on the code, not the name.

In Lightdash, set the map chart to a custom region with `customGeoJsonUrl` pointing at the URL above and `geoJsonPropertyKey: adm3_pcode`.

## Source and attribution

- Dataset: [Indonesia - Subnational Administrative Boundaries](https://data.humdata.org/dataset/cod-ab-idn) (COD-AB, dataset version 01, admin levels 0-4) on the Humanitarian Data Exchange.
- Source organisation: Badan Pusat Statistik (BPS - Statistics Indonesia), contributed by OCHA Regional Office for Asia and the Pacific, published by OCHA Field Information Services and HDX.
- HDX resource `idn_admin_boundaries.geojson.zip`, last modified 2026-06-23, SHA-256 `d285a40f9fc4b726b1bda98ee833d52d23d94fe78b6a47c0a769d2e912ff0970`. Boundaries valid from 2020-04-01.
- Licence: [Creative Commons Attribution 3.0 IGO (CC BY-IGO)](https://creativecommons.org/licenses/by/3.0/igo/). Attribution required: "Boundaries: Badan Pusat Statistik (BPS), via OCHA and the Humanitarian Data Exchange, CC BY-IGO."
- The files here are adapted from the source: simplified and reduced to the properties above. They are not an official representation of the boundaries, and the simplification is not suitable for surveying or area calculation. The source dataset carries the usual COD disclaimer: the designations used do not imply any opinion about the legal status of a territory.

## Rebuilding

```sh
npm ci
npm run build
```

Requires Node 20 or later and `unzip`. The build:

1. downloads the pinned HDX archive into `.cache/` (about 456 MB, not committed) and refuses it unless the SHA-256 matches the one in [`scripts/config.mjs`](scripts/config.mjs), so a silent re-upload on HDX cannot change the output;
2. extracts `idn_admin3.geojson`, drops the 38 non-kecamatan features and keeps only the properties listed above;
3. simplifies with [mapshaper](https://github.com/mbloch/mapshaper) 0.6.112 (pinned in `package.json`), Visvalingam, `keep-shapes`, 3% of vertices kept;
4. writes `public/kecamatan.geojson` and validates it (feature count, unique codes, properties, geometry, file size below the limit).

Mapshaper reports a handful of self-intersections it could not repair after simplification (3 at the time of writing); they do not affect joining or colouring.

To move to a newer HDX release, review the new archive, then update `url`, `sha256` and `resourceModified` in `scripts/config.mjs` and rebuild.

`npm run validate` re-checks the committed files without downloading anything (geometry, properties, count, unique codes, file size); the pull request workflow runs it.

## Publishing

`public/` is deployed to GitHub Pages by [`.github/workflows/pages.yml`](.github/workflows/pages.yml) on every push to `main` that changes `public/`. The generated files are committed, so a rebuild is a normal reviewed pull request.

One-time setup, already done for this repository: under Settings, Pages, Source must be GitHub Actions. The workflow cannot switch it on itself (`actions/configure-pages` is used without `enablement`), so a deployment fails until that is set. If the site ever stops deploying, check that setting and re-run the workflow from the Actions tab.

The workflow actions are pinned to commit SHAs, with the version tag in a comment; update the SHA and the tag together.
