// Shared settings for build.mjs and validate.mjs.

export const SOURCE = {
  dataset: "https://data.humdata.org/dataset/cod-ab-idn",
  title: "Indonesia - Subnational Administrative Boundaries (COD-AB, dataset version 01)",
  publisher: "Badan Pusat Statistik (BPS - Statistics Indonesia), via OCHA / HDX",
  license: "CC BY-IGO",
  // Pinned resource: the archive is only accepted when its SHA-256 matches, so a silent
  // re-upload on HDX fails the build instead of changing the published files.
  url: "https://data.humdata.org/dataset/84a1d98a-790b-4d66-9d14-bbfa48500802/resource/e1421da4-8f48-47d2-ac49-79ff5bfa4d24/download/idn_admin_boundaries.geojson.zip",
  sha256: "d285a40f9fc4b726b1bda98ee833d52d23d94fe78b6a47c0a769d2e912ff0970",
  resourceModified: "2026-06-23",
  member: "idn_admin3.geojson",
};

// Properties kept on every feature, with the names used by the HDX source.
export const KEEP_FIELDS = [
  "adm3_pcode",
  "adm3_name",
  "adm2_pcode",
  "adm2_name",
  "adm1_pcode",
  "adm1_name",
];

// Visvalingam simplification, percent of removable vertices kept.
export const SIMPLIFY = {
  national: { percent: "3%", precision: 0.0001 },
  provinsi: { percent: "10%", precision: 0.00001 },
};

// Lightdash rejects custom GeoJSON files above 10 MB; stay well under it.
export const MAX_FILE_BYTES = 9 * 1024 * 1024;

// The source has 7,069 admin 3 features, but 38 of them are not kecamatan: water bodies,
// forest, empty areas and unnamed islands carry placeholder codes. Real kecamatan codes run
// 010, 020, ...; the placeholders end in one of these digit groups (their names are "Danau",
// "Waduk", "Perairan", "Hutan", "Pulau" and "Wilayah Kosong"). They are dropped before
// simplification.
export const NON_KECAMATAN_CODE_SUFFIXES = ["000", "555", "888", "999"];

export const EXPECTED_SOURCE_FEATURES = 7069;
export const EXPECTED_KECAMATAN = 7031;
export const EXPECTED_PROVINSI = 34;

export const NATIONAL_FILE = "kecamatan.geojson";
export const PROVINSI_DIR = "provinsi";
export const INDEX_FILE = "index.json";
// Longitude and latitude range of Indonesia with a margin, to catch swapped or projected coordinates.
export const BOUNDS = { minLon: 90, maxLon: 145, minLat: -15, maxLat: 10 };

export const BASE_URL = "https://klikpeta-tech.github.io/id-kecamatan-geo";
