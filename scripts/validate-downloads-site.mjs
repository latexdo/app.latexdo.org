import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const appOrigin = "https://app.latexdo.org";
const downloadsRoot = path.join(root, "downloads");
const updatesRoot = path.join(root, "updates");
const requiredFiles = [
  ".assetsignore",
  ".nojekyll",
  "_headers",
  "_redirects",
  "CNAME",
  "index.html",
  "package.json",
  "robots.txt",
  "sitemap.xml",
  "site.webmanifest",
  "style.css",
  "wrangler.jsonc",
];
const requiredDirectories = ["assets", "downloads", "updates"];
const requiredDownloadIds = new Set([
  "macos-arm64",
  "macos-x64",
  "windows-x64",
  "linux-x64",
]);
const sha256Pattern = /^[a-f0-9]{64}$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function pathExists(relativePath) {
  try {
    await stat(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

function assertAppDownloadUrl(value, label) {
  assert(
    typeof value === "string" && value.startsWith(`${appOrigin}/downloads/`),
    `${label} must use ${appOrigin}/downloads/.`,
  );
}

function assertManifest(manifest, label, options = {}) {
  assert(manifest?.schemaVersion === 1, `${label} schemaVersion must be 1.`);
  assert(manifest.product === "LatexDo", `${label} product must be LatexDo.`);
  assert(typeof manifest.repository === "string", `${label} repository is missing.`);
  assert(Array.isArray(manifest.files), `${label} files must be an array.`);
  assertAppDownloadUrl(manifest.downloadsPage, `${label} downloadsPage`);

  if (options.requireFullInstallerSet) {
    const ids = new Set(manifest.files.map((file) => file.id));
    for (const id of requiredDownloadIds) {
      assert(ids.has(id), `${label} is missing ${id}.`);
    }
  }

  for (const file of manifest.files) {
    assert(typeof file.id === "string" && file.id, `${label} file id is invalid.`);
    assert(
      typeof file.label === "string" && file.label,
      `${label} file label is invalid.`,
    );
    assert(
      typeof file.platform === "string" && file.platform,
      `${label} file platform is invalid.`,
    );
    assert(
      typeof file.arch === "string" && file.arch,
      `${label} file arch is invalid.`,
    );
    assert(
      typeof file.filename === "string" && !/[\\/]/.test(file.filename),
      `${label} file name is invalid.`,
    );
    assert(
      typeof file.url === "string" &&
        file.url.startsWith("https://github.com/latexdo/latexdo/releases/download/"),
      `${label} file URL is invalid.`,
    );
    assert(
      typeof file.sha256 === "string" && sha256Pattern.test(file.sha256),
      `${label} file checksum is invalid.`,
    );
    assert(Number.isFinite(file.size) && file.size > 0, `${label} file size is invalid.`);
  }
}

function assertChecksumFile(manifest, checksums, label) {
  const lines = new Set(
    checksums
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  );

  for (const file of manifest.files ?? []) {
    assert(
      lines.has(`${file.sha256}  ${file.filename}`),
      `${label} is missing ${file.filename}.`,
    );
  }
}

function assertUpdateFeed(feed, label) {
  assert(
    feed?.schemaVersion === 1 || feed?.schemaVersion === 2,
    `${label} has an unsupported schema.`,
  );
  assert(feed.product === "LatexDo", `${label} product must be LatexDo.`);
  if (feed.downloadsPage) assertAppDownloadUrl(feed.downloadsPage, `${label} downloadsPage`);
  if (feed.releaseUrl) assertAppDownloadUrl(feed.releaseUrl, `${label} releaseUrl`);
  if (feed.manifestUrl) assertAppDownloadUrl(feed.manifestUrl, `${label} manifestUrl`);
  if (Array.isArray(feed.files)) {
    for (const file of feed.files) {
      assert(
        typeof file.url === "string" &&
          file.url.startsWith("https://github.com/latexdo/latexdo/releases/download/"),
        `${label} file URL is invalid.`,
      );
    }
  }
}

async function assertStaticShape() {
  for (const relativePath of requiredFiles) {
    assert(await pathExists(relativePath), `Missing required file: ${relativePath}`);
  }
  for (const relativePath of requiredDirectories) {
    assert(await pathExists(relativePath), `Missing required directory: ${relativePath}`);
  }
}

await assertStaticShape();

const latestManifest = await readJson(path.join(downloadsRoot, "manifest.json"));
assertManifest(latestManifest, "downloads/manifest.json", {
  requireFullInstallerSet: true,
});
assertChecksumFile(
  latestManifest,
  await readFile(path.join(downloadsRoot, "SHA256SUMS.txt"), "utf8"),
  "downloads/SHA256SUMS.txt",
);

const releasesIndex = await readJson(path.join(downloadsRoot, "releases.json"));
assert(releasesIndex?.schemaVersion === 1, "downloads/releases.json schemaVersion must be 1.");
assert(releasesIndex.product === "LatexDo", "downloads/releases.json product must be LatexDo.");
assert(Array.isArray(releasesIndex.releases), "downloads/releases.json releases must be an array.");

for (const release of releasesIndex.releases) {
  assert(typeof release.tag === "string" && release.tag, "Release index contains an invalid tag.");
  assertAppDownloadUrl(release.downloadsPage, `${release.tag} downloadsPage`);
  assertAppDownloadUrl(release.manifestUrl, `${release.tag} manifestUrl`);
  assertAppDownloadUrl(release.checksumsUrl, `${release.tag} checksumsUrl`);

  const releaseManifest = await readJson(path.join(downloadsRoot, release.tag, "manifest.json"));
  assertManifest(releaseManifest, `${release.tag}/manifest.json`);
  assertChecksumFile(
    releaseManifest,
    await readFile(path.join(downloadsRoot, release.tag, "SHA256SUMS.txt"), "utf8"),
    `${release.tag}/SHA256SUMS.txt`,
  );
}

for (const entry of await readdir(updatesRoot, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
  assertUpdateFeed(
    await readJson(path.join(updatesRoot, entry.name)),
    `updates/${entry.name}`,
  );
}

console.log(
  `Validated app.latexdo.org downloads site with ${releasesIndex.releases.length} releases.`,
);
