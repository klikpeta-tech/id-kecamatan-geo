// Checks the committed files in public/ without needing the source download.
// Run by build.mjs after a build and by CI on every pull request.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  BASE_URL,
  BOUNDS,
  EXPECTED_KECAMATAN,
  EXPECTED_PROVINSI,
  INDEX_FILE,
  KEEP_FIELDS,
  MAX_FILE_BYTES,
  NATIONAL_FILE,
  NON_KECAMATAN_CODE_SUFFIXES,
  PROVINSI_DIR,
} from "./config.mjs";

const isPosition = (p) =>
  Array.isArray(p) &&
  p.length >= 2 &&
  p.slice(0, 2).every(Number.isFinite) &&
  p[0] >= BOUNDS.minLon && p[0] <= BOUNDS.maxLon &&
  p[1] >= BOUNDS.minLat && p[1] <= BOUNDS.maxLat;

// A linear ring is closed and has at least four positions.
const isRing = (ring) =>
  Array.isArray(ring) &&
  ring.length >= 4 &&
  ring.every(isPosition) &&
  ring[0][0] === ring.at(-1)[0] &&
  ring[0][1] === ring.at(-1)[1];

const isPolygon = (rings) => Array.isArray(rings) && rings.length > 0 && rings.every(isRing);

function hasUsableGeometry(geometry) {
  if (geometry?.type === "Polygon") return isPolygon(geometry.coordinates);
  if (geometry?.type === "MultiPolygon") {
    return Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0 && geometry.coordinates.every(isPolygon);
  }
  return false;
}

export function validate(outDir) {
  const errors = [];
  const fail = (msg) => errors.push(msg);

  const readCollection = (path) => {
    if (!existsSync(path)) {
      fail(`${path}: file is missing`);
      return [];
    }
    const bytes = statSync(path).size;
    if (bytes > MAX_FILE_BYTES) fail(`${path}: ${bytes} bytes exceeds ${MAX_FILE_BYTES}`);
    const json = JSON.parse(readFileSync(path, "utf8"));
    if (json.type !== "FeatureCollection") fail(`${path}: not a FeatureCollection`);
    for (const f of json.features) {
      const code = f.properties?.adm3_pcode;
      const keys = Object.keys(f.properties ?? {}).sort().join(",");
      if (keys !== [...KEEP_FIELDS].sort().join(",")) fail(`${path}: unexpected properties ${keys}`);
      if (!hasUsableGeometry(f.geometry)) fail(`${path}: ${code} has no usable polygon geometry`);
      if (!/^ID\d{7}$/.test(code ?? "")) fail(`${path}: bad adm3_pcode ${code}`);
      else if (NON_KECAMATAN_CODE_SUFFIXES.includes(code.slice(-3))) fail(`${path}: ${code} is not a kecamatan`);
    }
    return json.features;
  };

  const national = readCollection(join(outDir, NATIONAL_FILE));
  const nationalCodes = new Set(national.map((f) => f.properties.adm3_pcode));
  if (national.length !== EXPECTED_KECAMATAN) fail(`national has ${national.length} features, expected ${EXPECTED_KECAMATAN}`);
  if (nationalCodes.size !== national.length) fail("national has duplicate adm3_pcode values");

  const provinceFiles = readdirSync(join(outDir, PROVINSI_DIR)).filter((n) => n.endsWith(".geojson"));
  if (provinceFiles.length !== EXPECTED_PROVINSI) fail(`${provinceFiles.length} province files, expected ${EXPECTED_PROVINSI}`);
  const provinceCodes = new Set();
  for (const name of provinceFiles) {
    const features = readCollection(join(outDir, PROVINSI_DIR, name));
    const prov = name.replace(".geojson", "");
    for (const f of features) {
      if (f.properties.adm1_pcode !== prov) fail(`${name}: contains ${f.properties.adm1_pcode}`);
      if (provinceCodes.has(f.properties.adm3_pcode)) fail(`${name}: duplicate ${f.properties.adm3_pcode}`);
      provinceCodes.add(f.properties.adm3_pcode);
      if (!nationalCodes.has(f.properties.adm3_pcode)) fail(`${name}: ${f.properties.adm3_pcode} missing from national`);
    }
  }
  if (provinceCodes.size !== nationalCodes.size) {
    fail(`province files cover ${provinceCodes.size} kecamatan, national covers ${nationalCodes.size}`);
  }

  const index = JSON.parse(readFileSync(join(outDir, INDEX_FILE), "utf8"));
  for (const entry of [index.national, ...index.provinsi]) {
    const path = join(outDir, entry.file);
    if (!existsSync(path)) {
      fail(`${INDEX_FILE}: ${entry.file} is listed but missing`);
      continue;
    }
    const size = statSync(path).size;
    if (size !== entry.bytes) fail(`${INDEX_FILE}: ${entry.file} is ${size} bytes, index says ${entry.bytes}`);
    if (entry.url !== `${BASE_URL}/${entry.file}`) fail(`${INDEX_FILE}: ${entry.file} has url ${entry.url}, expected ${BASE_URL}/${entry.file}`);
  }
  if (index.provinsi.length !== provinceFiles.length) fail(`${INDEX_FILE} lists ${index.provinsi.length} provinces`);

  return errors;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = validate(fileURLToPath(new URL("../public", import.meta.url)));
  if (errors.length) {
    console.error(errors.slice(0, 50).join("\n"));
    process.exit(1);
  }
  console.log("public/ OK");
}
