import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const repository = "SakuraCordApp/SakuraCord";
const caskPath = new URL("../Casks/sakuracord.rb", import.meta.url);

export function releaseAsset(release) {
  if (release.draft !== false || release.prerelease !== false ||
      !/^v\d+\.\d+\.\d+$/.test(release.tag_name)) {
    throw new Error("Expected a published regular release.");
  }
  const tag = release.tag_name;
  const names = [`SakuraCord.${tag}.dmg`, `SakuraCord-${tag}.dmg`];
  const assets = release.assets.filter((asset) => names.includes(asset.name));
  if (assets.length !== 1) throw new Error("Expected exactly one SakuraCord DMG.");
  const asset = assets[0];
  const url = `https://github.com/${repository}/releases/download/${tag}/${asset.name}`;
  if (asset.browser_download_url !== url || asset.state !== "uploaded" ||
      !/^sha256:[a-f0-9]{64}$/.test(asset.digest)) {
    throw new Error("Expected a complete GitHub DMG asset with a SHA-256 digest.");
  }
  return { version: tag.slice(1), url, sha256: asset.digest.slice(7) };
}

export function updateCask(current, asset, bytes) {
  if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256) {
    throw new Error("Downloaded DMG does not match the GitHub SHA-256 digest.");
  }
  const currentVersion = current.match(/^  version "(\d+\.\d+\.\d+)"$/m)?.[1];
  if (!currentVersion) throw new Error("Cask has no regular release version.");
  const previous = currentVersion.split(".").map(Number);
  const next = asset.version.split(".").map(Number);
  const difference = next.findIndex((part, index) => part !== previous[index]);
  if (difference !== -1 && next[difference] < previous[difference]) {
    throw new Error("Refusing to downgrade the cask.");
  }
  const url = asset.url.replaceAll(`v${asset.version}`, "v#{version}");
  const replacements = [
    [/^  version "[^"]+"$/m, `  version "${asset.version}"`],
    [/^  sha256 "[a-f0-9]{64}"$/m, `  sha256 "${asset.sha256}"`],
    [/^  url "[^"]+"$/m, `  url "${url}"`],
  ];
  let updated = current;
  for (const [pattern, replacement] of replacements) {
    if (!pattern.test(updated)) throw new Error("Unexpected cask format.");
    updated = updated.replace(pattern, replacement);
  }
  return updated;
}

async function main() {
  const headers = { Accept: "application/vnd.github+json" };
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, {
    headers,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Release lookup failed: HTTP ${response.status}`);
  const asset = releaseAsset(await response.json());
  const current = await readFile(caskPath, "utf8");
  // Reuse the checked-in checksum when nothing changed; do not download hourly.
  if (current.includes(`  version "${asset.version}"\n`) &&
      current.includes(`  sha256 "${asset.sha256}"\n`) &&
      current.includes(`  url "${asset.url.replaceAll(`v${asset.version}`, "v#{version}")}"\n`)) {
    console.log(`SakuraCord ${asset.version} is current.`);
    return;
  }
  const download = await fetch(asset.url, { signal: AbortSignal.timeout(120_000) });
  if (!download.ok) throw new Error(`DMG download failed: HTTP ${download.status}`);
  const updated = updateCask(current, asset, Buffer.from(await download.arrayBuffer()));
  await writeFile(caskPath, updated);
  console.log(`Updated SakuraCord to ${asset.version}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
