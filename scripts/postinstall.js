#!/usr/bin/env node

// Downloads the scc binary for the current platform during npm install.
// Falls back gracefully — if download fails, occ will look for scc on PATH.

import { createWriteStream, existsSync, mkdirSync, chmodSync, unlinkSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const SCC_VERSION = '3.7.0';
const GITHUB_RELEASE_BASE = `https://github.com/boyter/scc/releases/download/v${SCC_VERSION}`;

const PLATFORM_MAP = {
  darwin: 'Darwin',
  linux: 'Linux',
  win32: 'Windows',
};

const ARCH_MAP = {
  x64: 'x86_64',
  arm64: 'arm64',
  ia32: 'i386',
};

function getAssetName() {
  const platform = PLATFORM_MAP[process.platform];
  const arch = ARCH_MAP[process.arch];
  if (!platform || !arch) {
    throw new Error(`Unsupported platform: ${process.platform}-${process.arch}`);
  }
  const ext = process.platform === 'win32' ? 'zip' : 'tar.gz';
  return `scc_${platform}_${arch}.${ext}`;
}

function getVendorDir() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  return path.join(__dirname, '..', 'vendor');
}

function getSccPath() {
  const binary = process.platform === 'win32' ? 'scc.exe' : 'scc';
  return path.join(getVendorDir(), binary);
}

async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  await pipeline(res.body, createWriteStream(dest));
}

async function extract(archive, destDir) {
  if (archive.endsWith('.tar.gz')) {
    await execFileAsync('tar', ['xzf', archive, '-C', destDir]);
  } else {
    // .zip (Windows)
    await execFileAsync('unzip', ['-o', archive, '-d', destDir]);
  }
}

async function main() {
  // Skip if scc already vendored
  const sccPath = getSccPath();
  if (existsSync(sccPath)) {
    console.log(`scc already exists at ${sccPath}`);
    return;
  }

  // Skip if SCC_SKIP_DOWNLOAD is set
  if (process.env.SCC_SKIP_DOWNLOAD) {
    console.log('SCC_SKIP_DOWNLOAD set, skipping scc download');
    return;
  }

  let assetName;
  try {
    assetName = getAssetName();
  } catch (err) {
    console.warn(`occ: ${err.message}. scc must be installed manually.`);
    return;
  }

  const url = `${GITHUB_RELEASE_BASE}/${assetName}`;
  const vendorDir = getVendorDir();
  mkdirSync(vendorDir, { recursive: true });
  const archivePath = path.join(vendorDir, assetName);

  try {
    console.log(`Downloading scc v${SCC_VERSION} for ${process.platform}-${process.arch}...`);
    await download(url, archivePath);

    console.log('Extracting...');
    await extract(archivePath, vendorDir);

    // Make executable on unix
    if (process.platform !== 'win32') {
      chmodSync(sccPath, 0o755);
    }

    // Clean up extra files extracted from the archive (LICENSE, README, etc.)
    for (const name of ['LICENSE', 'README.md']) {
      try { unlinkSync(path.join(vendorDir, name)); } catch {}
    }

    console.log(`scc installed to ${sccPath}`);
  } catch (err) {
    console.warn(`occ: Failed to download scc: ${err.message}`);
    console.warn('occ will fall back to scc on PATH at runtime.');
  } finally {
    // Clean up archive
    try { unlinkSync(archivePath); } catch {}
  }
}

main();
