import { createRequire } from 'node:module';
import { readdir, readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = process.env.IMAGE_TOOL_MODULES
  ? require(path.join(process.env.IMAGE_TOOL_MODULES, 'sharp'))
  : require('sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archive = path.resolve(process.argv[2] || path.join(root, '..', 'creator-studio-ramanaidu-image-library'));
const widths = [160, 320, 480, 640, 800, 960, 1280, 1600, 1920, 2560];
const manifest = { method: 'Lanczos3, original aspect ratio, no crop/retouch/sharpen/colour adjustment', longestEdge: 3840, webQuality: 85, images: [], vectors: [] };
const hash = data => createHash('sha256').update(data).digest('hex');
await Promise.all(['assets/optimized', 'assets/4k', 'docs'].map(dir => mkdir(path.join(root, dir), { recursive: true })));
await Promise.all(['originals', 'masters-4k'].map(dir => mkdir(path.join(archive, dir), { recursive: true })));
const files = (await readdir(path.join(root, 'assets'))).sort();
for (const file of files.filter(file => file.endsWith('.svg'))) {
  await copyFile(path.join(root, 'assets', file), path.join(archive, 'originals', file));
  await copyFile(path.join(root, 'assets', file), path.join(archive, 'masters-4k', file));
  manifest.vectors.push({ file: `assets/${file}`, sha256: hash(await readFile(path.join(root, 'assets', file))), resolution: 'vector; unlimited' });
}
for (const file of files.filter(file => file.endsWith('.jpg'))) {
  const original = await readFile(path.join(root, 'assets', file));
  const metadata = await sharp(original).metadata();
  if (metadata.orientation && metadata.orientation !== 1) throw new Error(`Review image orientation: ${file}`);
  if (metadata.space !== 'srgb') throw new Error(`Review colour profile: ${file}`);
  const sha256 = hash(original);
  const stem = file.replace(/\.jpg$/, '');
  const version = hash(Buffer.from(`${sha256}:lanczos3-3840-webp85-v1`)).slice(0, 12);
  const factor = 3840 / Math.max(metadata.width, metadata.height);
  const width = Math.round(metadata.width * factor);
  const height = Math.round(metadata.height * factor);
  await copyFile(path.join(root, 'assets', file), path.join(archive, 'originals', file));
  // Create the lossless master once; all responsive files come from this same master.
  const master = await sharp(original).resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
  await writeFile(path.join(archive, 'masters-4k', `${stem}.png`), master);
  const hqFile = `assets/4k/${stem}-${version}.webp`;
  await sharp(master).webp({ lossless: true, effort: 4 }).toFile(path.join(root, hqFile));
  const variants = [];
  for (const w of [...widths.filter(w => w < width), width]) {
    const out = `assets/optimized/${stem}-${version}-${w}.webp`;
    const info = await sharp(master).resize({ width: w, kernel: 'lanczos3' }).webp({ quality: 85, effort: 5 }).toFile(path.join(root, out));
    variants.push({ file: out, width: info.width, height: info.height, bytes: info.size });
  }
  let socialFile;
  if (stem === 'suresh-statement') {
    socialFile = `assets/4k/${stem}-${version}.jpg`;
    await sharp(master).jpeg({ quality: 95, chromaSubsampling: '4:4:4', mozjpeg: true }).toFile(path.join(root, socialFile));
  }
  manifest.images.push({ original: `assets/${file}`, sha256, originalWidth: metadata.width, originalHeight: metadata.height, originalBytes: original.length, masterWidth: width, masterHeight: height, hqFile, hqBytes: (await stat(path.join(root, hqFile))).size, socialFile, variants });
  console.log(`${file}: ${metadata.width}×${metadata.height} → ${width}×${height}`);
}
await writeFile(path.join(root, 'docs/image-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(path.join(archive, 'image-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Saved ${manifest.images.length} photos and ${manifest.vectors.length} vectors. Local archive: ${archive}`);
