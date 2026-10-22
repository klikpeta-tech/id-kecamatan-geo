// Checks the committed files in public/ without needing the source download.
// Run by build.mjs after a build and by CI on every pull request.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  EXPECTED_KECAMATAN,
  EXPECTED_PROVINSI,
  INDEX_FILE,
  KEEP_FIELDS,
  MAX_FILE_BYTES,
  NATIONAL_FILE,
  PROVINSI_DIR,
} from "./config.mjs";

export function validate(outDir) {
  const errors = [];
  const fail = (msg) => errors.push(msg);

  const readCollection = (path) => {
    const bytes = statSync(path).size;
    if (bytes > MAX_FILE_BYTES) fail(`${path}: ${bytes} bytes exceeds ${MAX_FILE_BYTES}`);
    const json = JSON.parse(readFileSync(path, "utf8"));
    if (json.type !== "FeatureCollection") fail(`${path}: not a FeatureCollection`);
    for (const f of json.features) {
      const keys = Object.keys(f.properties ?? {}).sort().join(",");
      if (keys !== [...KEEP_FIELDS].sort().join(",")) fail(`${path}: unexpected properties ${keys}`);
      if (!f.geometry || !["Polygon", "MultiPolygon"].includes(f.geometry.type)) {
        fail(`${path}: ${f.properties?.adm3_pcode} has no polygon geometry`);
      }
      if (!/^ID\d{7}$/.test(f.properties?.adm3_pcode ?? "")) {
        fail(`${path}: bad adm3_pcode ${f.properties?.adm3_pcode}`);
      }
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
    const size = statSync(join(outDir, entry.file)).size;
    if (size !== entry.bytes) fail(`${INDEX_FILE}: ${entry.file} is ${size} bytes, index says ${entry.bytes}`);
  }
  if (index.provinsi.length !== provinceFiles.length) fail(`${INDEX_FILE} lists ${index.provinsi.length} provinces`);

  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = validate(new URL("../public", import.meta.url).pathname);
  if (errors.length) {
    console.error(errors.slice(0, 50).join("\n"));
    process.exit(1);
  }
  console.log("public/ OK");
}
