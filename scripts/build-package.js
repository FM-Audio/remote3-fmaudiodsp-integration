const { build } = require('esbuild');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const version = require(path.join(root, 'package.json')).version;
const outDir = path.join(root, 'pkg-node');
const outArchive = path.join(root, `dist-fmaudiodsp-node-${version}.tar.gz`);
const bundlePath = path.join(root, 'bin', 'driver.bundle.js');

async function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.rmSync(outArchive, { force: true });
  fs.mkdirSync(path.join(outDir, 'bin'), { recursive: true });

  await build({
    entryPoints: [path.join(root, 'bin', 'driver.js')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    banner: { js: '#!/usr/bin/env node' },
    outfile: bundlePath,
  });
  fs.chmodSync(bundlePath, 0o755);

  fs.copyFileSync(path.join(root, 'driver.json'), path.join(outDir, 'driver.json'));
  fs.copyFileSync(bundlePath, path.join(outDir, 'bin', 'driver.js'));
  fs.chmodSync(path.join(outDir, 'bin', 'driver.js'), 0o755);

  execFileSync('tar', ['czf', outArchive, '-C', outDir, '.'], { stdio: 'inherit' });
  const sha = execFileSync('sha256sum', [outArchive], { encoding: 'utf8' }).trim();
  console.log(sha);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
