// Rebuilds public/ from the HDX COD-AB Indonesia admin level 3 boundaries.
//
//   npm ci && npm run build
//
// Downloads the pinned archive (cached in .cache/), checks its SHA-256, simplifies the
// kecamatan polygons with mapshaper and writes one national file plus one file per
// province, so every file stays below Lightdash's 10 MB custom GeoJSON limit.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import {
  BASE_URL,
  INDEX_FILE,
  KEEP_FIELDS,
  NATIONAL_FILE,
  PROVINSI_DIR,
  SIMPLIFY,
  SOURCE,
} from "./config.mjs";
import { validate } from "./validate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = join(root, ".cache");
const outDir = join(root, "public");
const archive = join(cacheDir, "idn_admin_boundaries.geojson.zip");
const source = join(cacheDir, SOURCE.member);
const mapshaper = join(root, "node_modules", "mapshaper", "bin", "mapshaper");

const sha256 = async (path) => {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
};

async function fetchArchive() {
  mkdirSync(cacheDir, { recursive: true });
  if (existsSync(archive) && (await sha256(archive)) === SOURCE.sha256) return;
  console.log(`downloading ${SOURCE.url}`);
  const res = await fetch(SOURCE.url, { redirect: "follow" });
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const partial = `${archive}.part`;
  await pipeline(Readable.fromWeb(res.body), createWriteStream(partial));
  const actual = await sha256(partial);
  if (actual !== SOURCE.sha256) {
    rmSync(partial);
    throw new Error(`archive sha256 ${actual} does not match pinned ${SOURCE.sha256}; update scripts/config.mjs after reviewing the new HDX release`);
  }
  renameSync(partial, archive);
}

function extractMember() {
  console.log(`extracting ${SOURCE.member}`);
  const out = createWriteStream(source);
  const child = execFileSync("unzip", ["-p", archive, SOURCE.member], { maxBuffer: 1 << 30, stdio: ["ignore", "pipe", "inherit"] });
  out.end(child);
  return new Promise((resolve, reject) => out.on("finish", resolve).on("error", reject));
}

function runMapshaper(args) {
  execFileSync("node", ["--max-old-space-size=8192", mapshaper, ...args], { stdio: ["ignore", "inherit", "inherit"] });
}

function build() {
  rmSync(outDir + "/" + NATIONAL_FILE, { force: true });
  rmSync(join(outDir, PROVINSI_DIR), { recursive: true, force: true });
  mkdirSync(join(outDir, PROVINSI_DIR), { recursive: true });

  const common = [source, "-filter-fields", KEEP_FIELDS.join(",")];
  const sort = ["-sort", "adm3_pcode"];

  console.log("building national file");
  runMapshaper([
    ...common, ...sort,
    "-simplify", SIMPLIFY.national.percent, "keep-shapes",
    "-o", join(outDir, NATIONAL_FILE), "format=geojson", `precision=${SIMPLIFY.national.precision}`,
  ]);

  console.log("building province files");
  runMapshaper([
    ...common, ...sort,
    "-simplify", SIMPLIFY.provinsi.percent, "keep-shapes",
    "-split", "adm1_pcode",
    "-o", join(outDir, PROVINSI_DIR) + "/", "format=geojson", "extension=.geojson", `precision=${SIMPLIFY.provinsi.precision}`,
  ]);
}

function writeIndex() {
  const describe = (file, scope) => {
    const json = JSON.parse(readFileSync(join(outDir, file), "utf8"));
    const first = json.features[0].properties;
    return {
      file,
      url: `${BASE_URL}/${file}`,
      bytes: statSync(join(outDir, file)).size,
      kecamatan: json.features.length,
      ...(scope === "provinsi" && { adm1_pcode: first.adm1_pcode, adm1_name: first.adm1_name }),
    };
  };
  const provinsi = readdirSync(join(outDir, PROVINSI_DIR))
    .filter((n) => n.endsWith(".geojson"))
    .sort()
    .map((n) => describe(`${PROVINSI_DIR}/${n}`, "provinsi"));
  const index = {
    source: {
      title: SOURCE.title,
      publisher: SOURCE.publisher,
      license: SOURCE.license,
      dataset: SOURCE.dataset,
      resource_modified: SOURCE.resourceModified,
      archive_sha256: SOURCE.sha256,
    },
    simplification: {
      tool: "mapshaper 0.6.112",
      national: `-simplify ${SIMPLIFY.national.percent} keep-shapes`,
      provinsi: `-simplify ${SIMPLIFY.provinsi.percent} keep-shapes`,
    },
    join_property: "adm3_pcode",
    national: describe(NATIONAL_FILE, "national"),
    provinsi,
  };
  writeFileSync(join(outDir, INDEX_FILE), JSON.stringify(index, null, 2) + "\n");
}

await fetchArchive();
await extractMember();
build();
writeIndex();
const errors = validate(outDir);
if (errors.length) {
  console.error(errors.slice(0, 50).join("\n"));
  process.exit(1);
}
console.log("done");
