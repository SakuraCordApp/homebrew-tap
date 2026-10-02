import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { releaseAsset, updateCask } from "./update-cask.mjs";

const current = await readFile(new URL("../Casks/sakuracord.rb", import.meta.url), "utf8");
const bytes = Buffer.from("release archive fixture");
const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function release(separator = "-", version = "99.0.0") {
  const tag = `v${version}`;
  const name = `SakuraCord${separator}${tag}.dmg`;
  return {
    tag_name: tag,
    draft: false,
    prerelease: false,
    assets: [{
      name,
      state: "uploaded",
      digest,
      browser_download_url: `https://github.com/SakuraCordApp/SakuraCord/releases/download/${tag}/${name}`,
    }],
  };
}

test("updates both released DMG naming conventions without changing installation requirements", () => {
  for (const separator of [".", "-"]) {
    const asset = releaseAsset(release(separator));
    const updated = updateCask(current, asset, bytes);
    assert.match(updated, /version "99\.0\.0"/);
    assert.ok(updated.includes(`sha256 "${digest.slice(7)}"`));
    assert.ok(updated.includes(`SakuraCord${separator}v#{version}.dmg`));
    assert.equal(updated.slice(updated.indexOf("  name ")), current.slice(current.indexOf("  name ")));
    assert.equal(updateCask(updated, asset, bytes), updated);
  }
});

test("rejects unpublished, beta, ambiguous, and untrusted assets", () => {
  for (const modify of [
    (value) => { value.draft = true; },
    (value) => { value.prerelease = true; },
    (value) => { value.tag_name = "v99.0.0-Beta-1"; },
    (value) => { value.assets.push({ ...value.assets[0] }); },
    (value) => { value.assets[0].browser_download_url = "https://example.com/app.dmg"; },
    (value) => { value.assets[0].digest = null; },
    (value) => { value.assets[0].state = "new"; },
  ]) {
    const value = release();
    modify(value);
    assert.throws(() => releaseAsset(value));
  }
});

test("refuses corrupt downloads and version downgrades", () => {
  assert.throws(() => updateCask(current, releaseAsset(release()), Buffer.from("corrupt")), /SHA-256/);
  assert.throws(() => updateCask(current, releaseAsset(release("-", "0.0.0")), bytes), /downgrade/);
});
