#!/usr/bin/env node

// Downloads the scc binary for the current platform during npm install.
// Falls back gracefully — if download fails, occ will look for scc on PATH.

import { createWriteStream, readFileSync, existsSync, mkdirSync, chmodSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
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

// SHA-256 checksums from the official scc v3.7.0 release
const CHECKSUMS = {
  'scc_Darwin_arm64.tar.gz':  '376cbae670be59ee64f398de20e0694ec434bf8a9b842642952b0ab0be5f3961',
  'scc_Darwin_x86_64.tar.gz': 'c3f7457856b9169ccb3c1dd14198e67f730bee065f24d9051bf52cdc2a719ecc',
  'scc_Linux_arm64.tar.gz':   'dcb05c6e993bb2d8d2da4765ff018f2e752325dd205a41698929c55e4123575d',
  'scc_Linux_i386.tar.gz':    '1de91dae8a927ac2063a99b520d9a474644db6827fe6f85e3d8f87a1def3b14d',
  'scc_Linux_x86_64.tar.gz':  '3d9d65b00ca874c2b29151abe7e1480736f5229edc3ce8e4b2791460cdfabf5a',
  'scc_Windows_arm64.zip':    'fd114614c10382c9ed2e32d5455cc4b51960a9f71691c5c1ca42b31adea5b84d',
  'scc_Windows_i386.zip':     '7b887022c37dc79e79ae51897030a6ff2515ab7b124e7b2aabcb0fba15412b05',
  'scc_Windows_x86_64.zip':   '97abf9d55d4b79d3310536d576ccbdf5017aeb425780e850336120b6e67622e1',
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

function verifyChecksum(filePath, assetName) {
  const expected = CHECKSUMS[assetName];
  if (!expected) {
    console.warn(`occ: No checksum available for ${assetName}, skipping verification`);
    return;
  }
  const data = readFileSync(filePath);
  const actual = createHash('sha256').update(data).digest('hex');
  if (actual !== expected) {
    throw new Error(`Checksum mismatch for ${assetName}\n  Expected: ${expected}\n  Got:      ${actual}`);
  }
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
    verifyChecksum(archivePath, assetName);

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
