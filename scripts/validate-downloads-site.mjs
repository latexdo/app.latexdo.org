import { createHash, createPublicKey, verify } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const appHost = "app.latexdo.org";
const appOrigin = `https://${appHost}`;
const downloadsRoot = path.join(root, "downloads");
const updatesRoot = path.join(root, "updates");
const requireSignedLatestFeed = process.env.LATEXDO_REQUIRE_SIGNED_UPDATE_FEED === "1";
const requiredFiles = [
  ".assetsignore",
  ".github/workflows/ci.yml",
  ".nojekyll",
  "_headers",
  "_redirects",
  "CNAME",
  "index.html",
  "package.json",
  "partials/footer.html",
  "robots.txt",
  "sitemap.xml",
  "site.webmanifest",
  "style.css",
  "update-public-key.pem",
  "wrangler.jsonc",
];
const requiredDirectories = ["assets", "downloads", "updates"];
const requiredDownloadIds = new Set([
  "macos-arm64",
  "macos-x64",
  "windows-x64",
  "linux-x64",
]);
const footerInclude = '<div data-footer-src="/partials/footer.html"></div>';
const siteScript = '<script type="module" src="/assets/site.js"></script>';
const copiedFooter = '<footer class="site-footer">';
const forbiddenText = [
  `https://latexdo.org/${"downloads"}`,
  `https://latexdo.org/${"updates"}`,
  `https://app.${appHost}`,
];
const sha256Pattern = /^[a-f0-9]{64}$/;
let updatePublicKey = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function listHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (![".git", ".wrangler", "node_modules"].includes(entry.name)) {
        files.push(...(await listHtmlFiles(path.join(directory, entry.name))));
      }
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

async function pathExists(relativePath) {
  try {
    await stat(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function assertFooterIncludes() {
  const footerPartial = await readFile(path.join(root, "partials/footer.html"), "utf8");
  assert(
    countOccurrences(footerPartial, copiedFooter) === 1,
    "partials/footer.html must contain exactly one site footer.",
  );
  assert(
    !footerPartial.includes(footerInclude),
    "partials/footer.html must not include itself.",
  );

  for (const file of await listHtmlFiles(root)) {
    const relativePath = path.relative(root, file);
    if (relativePath === "partials/footer.html") continue;
    const html = await readFile(file, "utf8");
    assert(
      !html.includes(copiedFooter),
      `${relativePath} must use partials/footer.html instead of copying the footer.`,
    );
    assert(
      countOccurrences(html, footerInclude) === 1,
      `${relativePath} must include partials/footer.html exactly once.`,
    );
    assert(
      countOccurrences(html, siteScript) === 1,
      `${relativePath} must load assets/site.js exactly once.`,
    );
  }
}

function assertContains(text, needle, label) {
  assert(text.includes(needle), `${label} is missing: ${needle}`);
}

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

function parseAppUrl(value, label, expectedPrefix) {
  assert(typeof value === "string" && value, `${label} is missing.`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} is not a valid URL.`);
  }
  assert(url.protocol === "https:", `${label} must use https.`);
  assert(url.hostname === appHost, `${label} must use ${appHost}.`);
  assert(
    url.pathname.startsWith(expectedPrefix),
    `${label} must live under ${expectedPrefix}.`,
  );
  return url;
}

function assertAppDownloadUrl(value, label) {
  return parseAppUrl(value, label, "/downloads/");
}

function releaseSlugFromDownloadsPage(value, label) {
  const url = assertAppDownloadUrl(value, label);
  const match = url.pathname.match(/^\/downloads\/([^/]+)\/$/);
  assert(match, `${label} must point at a release downloads directory.`);
  return match[1];
}

function compareTimestampsDescending(left, right) {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  assert(Number.isFinite(leftMs), `Invalid timestamp: ${left}`);
  assert(Number.isFinite(rightMs), `Invalid timestamp: ${right}`);
  return rightMs - leftMs;
}

function canonicalJson(value) {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Feed contains a non-finite number.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  throw new Error("Feed contains an unsupported JSON value.");
}

function unsignedFeed(feed) {
  const value = { ...feed };
  delete value.signature;
  return value;
}

function assertManifest(manifest, label, options = {}) {
  assert(manifest?.schemaVersion === 1, `${label} schemaVersion must be 1.`);
  assert(manifest.product === "LatexDo", `${label} product must be LatexDo.`);
  assert(manifest.repository === "latexdo/latexdo", `${label} repository is invalid.`);
  assert(/^\d+\.\d+\.\d+$/.test(manifest.version ?? ""), `${label} version is invalid.`);
  assert(/^[a-f0-9]{40}$/.test(manifest.commit ?? ""), `${label} commit is invalid.`);
  assert(Number.isFinite(Date.parse(manifest.publishedAt)), `${label} publishedAt is invalid.`);
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

function assertUpdateSignature(feed, label) {
  const signature = feed.signature;
  assert(signature?.algorithm === "ed25519", `${label} signature algorithm is invalid.`);
  assert(/^[a-f0-9]{16}$/.test(signature.keyId ?? ""), `${label} signature keyId is invalid.`);
  assert(/^[A-Za-z0-9+/]{86}==$/.test(signature.value ?? ""), `${label} signature value is invalid.`);
  assert(updatePublicKey, "Update public key was not loaded.");
  const expectedKeyId = createHash("sha256")
    .update(updatePublicKey.export({ type: "spki", format: "der" }))
    .digest("hex")
    .slice(0, 16);
  assert(signature.keyId === expectedKeyId, `${label} signature keyId does not match update-public-key.pem.`);
  assert(
    verify(
      null,
      Buffer.from(canonicalJson(unsignedFeed(feed))),
      updatePublicKey,
      Buffer.from(signature.value, "base64"),
    ),
    `${label} signature does not verify.`,
  );
  const publishedAt = Date.parse(feed.publishedAt);
  const expiresAt = Date.parse(feed.expiresAt);
  assert(Number.isFinite(publishedAt), `${label} publishedAt is invalid.`);
  assert(Number.isFinite(expiresAt), `${label} expiresAt is invalid.`);
  assert(expiresAt > publishedAt, `${label} expires before it starts.`);
  assert(expiresAt > Date.now(), `${label} signed feed is expired.`);
}

function assertUpdateFeed(feed, label, options = {}) {
  assert(
    feed?.schemaVersion === 1 || feed?.schemaVersion === 2,
    `${label} has an unsupported schema.`,
  );
  assert(feed.product === "LatexDo", `${label} product must be LatexDo.`);
  assert(feed.repository === "latexdo/latexdo", `${label} repository is invalid.`);
  assert(feed.channel === "stable", `${label} channel must be stable.`);
  assert(/^\d+\.\d+\.\d+$/.test(feed.version ?? ""), `${label} version is invalid.`);
  assert(/^[a-f0-9]{40}$/.test(feed.commit ?? ""), `${label} commit is invalid.`);
  assert(Number.isFinite(Date.parse(feed.publishedAt)), `${label} publishedAt is invalid.`);
  const release = releaseSlugFromDownloadsPage(feed.downloadsPage, `${label} downloadsPage`);
  assert(feed.release === release, `${label} release does not match downloadsPage.`);
  assert(feed.releaseUrl === feed.downloadsPage, `${label} releaseUrl must match downloadsPage.`);
  assert(feed.manifestUrl === `${feed.downloadsPage}manifest.json`, `${label} manifestUrl is invalid.`);
  if (options.expectedRelease) {
    assert(feed.release === options.expectedRelease.tag, `${label} is not the latest release.`);
    assert(feed.version === options.expectedRelease.version, `${label} version is stale.`);
    assert(feed.commit === options.expectedRelease.commit, `${label} commit is stale.`);
  }
  if (feed.schemaVersion === 2) {
    assertUpdateSignature(feed, label);
  } else {
    assert(
      !requireSignedLatestFeed || label !== "updates/latest.json",
      "updates/latest.json must be a signed schemaVersion 2 feed.",
    );
  }
  if (Array.isArray(feed.files)) {
    for (const file of feed.files) {
      assert(
        typeof file.url === "string" &&
          file.url.startsWith("https://github.com/latexdo/latexdo/releases/download/"),
        `${label} file URL is invalid.`,
      );
      assert(
        typeof file.sha256 === "string" && sha256Pattern.test(file.sha256),
        `${label} file checksum is invalid.`,
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

async function assertRoutingAndCiConfig() {
  assert((await readFile(path.join(root, "CNAME"), "utf8")).trim() === appHost, "CNAME must be app.latexdo.org.");

  const redirects = await readFile(path.join(root, "_redirects"), "utf8");
  for (const line of [
    "/ /downloads/ 302",
    "/latest /downloads/ 302",
    "/about https://latexdo.org/about/ 301",
    "/privacy.html https://latexdo.org/privacy.html 301",
  ]) {
    assertContains(redirects, line, "_redirects");
  }

  const headers = await readFile(path.join(root, "_headers"), "utf8");
  for (const line of [
    "/downloads/*.json",
    "/updates/*.json",
    "Access-Control-Allow-Origin: *",
    "Cache-Control: public, max-age=60",
  ]) {
    assertContains(headers, line, "_headers");
  }

  const assetsIgnore = await readFile(path.join(root, ".assetsignore"), "utf8");
  for (const line of ["!/downloads/", "!/downloads/**", "!/updates/", "!/updates/**"]) {
    assertContains(assetsIgnore, line, ".assetsignore");
  }

  const wrangler = await readFile(path.join(root, "wrangler.jsonc"), "utf8");
  assertContains(wrangler, '"name": "app-latexdo-org"', "wrangler.jsonc");
  assertContains(wrangler, '"directory": "."', "wrangler.jsonc");

  const ci = await readFile(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
  for (const required of [
    "pull_request:",
    "push:",
    "workflow_dispatch:",
    "source_repository:",
    "source_sha:",
    "node-version: 22.17.0",
    "npm run ci",
  ]) {
    assertContains(ci, required, ".github/workflows/ci.yml");
  }
}

async function collectTextFiles(relativePath, files = []) {
  const absolutePath = path.join(root, relativePath);
  const entryStat = await stat(absolutePath);
  if (entryStat.isDirectory()) {
    for (const entry of await readdir(absolutePath, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      await collectTextFiles(path.join(relativePath, entry.name), files);
    }
  } else if (
    /\.(html|json|js|mjs|txt|xml|yml|yaml|md|css|webmanifest)$/.test(relativePath) ||
    ["CNAME", "_headers", "_redirects", ".assetsignore", ".gitignore"].includes(relativePath)
  ) {
    files.push(relativePath);
  }
  return files;
}

async function assertNoForbiddenHosts() {
  for (const relativePath of await collectTextFiles(".")) {
    const text = await readFile(path.join(root, relativePath), "utf8");
    for (const forbidden of forbiddenText) {
      assert(!text.includes(forbidden), `${relativePath} contains stale host: ${forbidden}`);
    }
  }
}

await assertStaticShape();
await assertFooterIncludes();
updatePublicKey = createPublicKey(
  await readFile(path.join(root, "update-public-key.pem"), "utf8"),
);
assert(updatePublicKey.asymmetricKeyType === "ed25519", "update-public-key.pem must be Ed25519.");
await assertRoutingAndCiConfig();
await assertNoForbiddenHosts();

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
assert(releasesIndex.releases.length > 0, "downloads/releases.json must contain releases.");

const seenReleases = new Set();
let previousPublishedAt = null;
for (const release of releasesIndex.releases) {
  assert(typeof release.tag === "string" && release.tag, "Release index contains an invalid tag.");
  assert(!seenReleases.has(release.tag), `Duplicate release: ${release.tag}`);
  seenReleases.add(release.tag);
  assert(/^\d+\.\d+\.\d+$/.test(release.version ?? ""), `${release.tag} version is invalid.`);
  assert(/^[a-f0-9]{40}$/.test(release.commit ?? ""), `${release.tag} commit is invalid.`);
  assert(Number.isFinite(Date.parse(release.publishedAt)), `${release.tag} publishedAt is invalid.`);
  if (previousPublishedAt) {
    assert(
      compareTimestampsDescending(previousPublishedAt, release.publishedAt) <= 0,
      "downloads/releases.json must be sorted newest first.",
    );
  }
  previousPublishedAt = release.publishedAt;
  assertAppDownloadUrl(release.downloadsPage, `${release.tag} downloadsPage`);
  assert(releaseSlugFromDownloadsPage(release.downloadsPage, `${release.tag} downloadsPage`) === release.tag, `${release.tag} downloadsPage slug is wrong.`);
  assert(release.manifestUrl === `${release.downloadsPage}manifest.json`, `${release.tag} manifestUrl is invalid.`);
  assert(release.checksumsUrl === `${release.downloadsPage}SHA256SUMS.txt`, `${release.tag} checksumsUrl is invalid.`);

  const releaseManifest = await readJson(path.join(downloadsRoot, release.tag, "manifest.json"));
  assertManifest(releaseManifest, `${release.tag}/manifest.json`);
  assert(releaseManifest.version === release.version, `${release.tag} manifest version differs from index.`);
  assert(releaseManifest.commit === release.commit, `${release.tag} manifest commit differs from index.`);
  assert(releaseManifest.downloadsPage === release.downloadsPage, `${release.tag} manifest downloadsPage differs from index.`);
  assertChecksumFile(
    releaseManifest,
    await readFile(path.join(downloadsRoot, release.tag, "SHA256SUMS.txt"), "utf8"),
    `${release.tag}/SHA256SUMS.txt`,
  );
}

const latestRelease = releasesIndex.releases[0];
assert(latestManifest.version === latestRelease.version, "downloads/manifest.json is not the latest release version.");
assert(latestManifest.commit === latestRelease.commit, "downloads/manifest.json is not the latest release commit.");
assert(latestManifest.downloadsPage === latestRelease.downloadsPage, "downloads/manifest.json is not the latest release page.");

const latestUpdateFeed = await readJson(path.join(updatesRoot, "latest.json"));
assertUpdateFeed(latestUpdateFeed, "updates/latest.json", {
  expectedRelease: latestRelease,
});
assert(await pathExists(path.join("updates", `${latestRelease.tag}.json`)), `Missing latest release feed: updates/${latestRelease.tag}.json`);

for (const entry of await readdir(updatesRoot, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
  const feed = await readJson(path.join(updatesRoot, entry.name));
  const label = `updates/${entry.name}`;
  assertUpdateFeed(feed, label);
  if (entry.name !== "latest.json") {
    assert(entry.name === `${feed.release}.json`, `${label} filename does not match release.`);
  }
  assert(seenReleases.has(feed.release), `${label} does not have a matching downloads release.`);
}

console.log(
  `Validated app.latexdo.org downloads site with ${releasesIndex.releases.length} releases.`,
);
