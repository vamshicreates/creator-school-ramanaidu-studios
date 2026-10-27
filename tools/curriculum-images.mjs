import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = process.env.IMAGE_TOOL_MODULES ? require(path.join(process.env.IMAGE_TOOL_MODULES, 'sharp')) : require('sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const selection = JSON.parse(await readFile(path.join(root, 'docs/curriculum-source-selection.json'), 'utf8'));
const archive = path.resolve(process.argv[2] || path.resolve(root, selection.archiveDirectory));
const scenes = selection.scenes;
await mkdir(path.join(archive, 'masters-4k'), { recursive: true });
const manifest = { provenance: selection.provenance, method: 'One Lanczos3 upscale from each native generated source to a lossless 3840px master; responsive AVIF and WebP files downsampled from that master', webQuality: 82, avifQuality: 50, images: [] };
async function cachedOrEncode(file, pipeline) {
  try {
    const metadata = await sharp(path.join(root, file)).metadata();
    const size = (await stat(path.join(root, file))).size;
    if (!size || !metadata.width || !metadata.height) throw new Error('Invalid cached image');
    return { width: metadata.width, height: metadata.height, size };
  } catch {
    return pipeline.toFile(path.join(root, file));
  }
}
for (const [name, alt] of scenes) {
  const source = await readFile(path.join(archive, 'sources', `${name}.png`));
  const metadata = await sharp(source).metadata();
  const sha256 = createHash('sha256').update(source).digest('hex');
  const version = createHash('sha256').update(`${sha256}:curriculum-4k-webp82-v1`).digest('hex').slice(0, 12);
  const factor = 3840 / Math.max(metadata.width, metadata.height);
  const width = Math.round(metadata.width * factor), height = Math.round(metadata.height * factor);
  const master = await sharp(source).resize(width, height, { kernel: 'lanczos3', fit: 'fill' }).png().toBuffer();
  await writeFile(path.join(archive, 'masters-4k', `${name}.png`), master);
  const variants = [], avifVariants = [];
  for (const w of [320, 480, 640, 800, 960, 1280, 1600, 1920, 2560, width]) {
    const file = `assets/optimized/curriculum-${name}-${version}-${w}.webp`;
    const info = await cachedOrEncode(file, sharp(master).resize({ width: w, kernel: 'lanczos3' }).webp({ quality: 82, effort: 6 }));
    variants.push({ file, width: info.width, height: info.height, bytes: info.size });
    const avifFile = file.replace(/\.webp$/, '.avif');
    const avifInfo = await cachedOrEncode(avifFile, sharp(master).resize({ width: w, kernel: 'lanczos3' }).avif({ quality: 50, effort: 4 }));
    avifVariants.push({ file: avifFile, width: avifInfo.width, height: avifInfo.height, bytes: avifInfo.size });
  }
  manifest.images.push({ name, alt, sha256, sourceWidth: metadata.width, sourceHeight: metadata.height, width, height, variants, avifVariants });
}
let html = await readFile(path.join(root, 'index.html'), 'utf8');
const start = html.indexOf('<section class="curr '), end = html.indexOf('</section>', start);
if (start < 0 || end < start) throw new Error('Curriculum section missing');
let count = 0;
const section = html.slice(start, end).replace(/<picture>.*?<\/picture>|<img\b[^>]*>/gs, () => {
  const image = manifest.images[count++];
  if (!image) throw new Error('Unexpected curriculum image');
  const fallback = image.variants.find(v => v.width === 640);
  const factor = Math.max(1, image.width / image.height / 1.5);
  const sizes = factor > 1.01 ? `(max-width: 1080px) calc((100vw - 88px) * ${factor.toFixed(4)}), ${Math.ceil(554 * factor)}px` : '(max-width: 1080px) calc(100vw - 88px), 554px';
  return `<picture><source type="image/avif" srcset="${image.avifVariants.map(v => `${v.file} ${v.width}w`).join(', ')}" sizes="${sizes}"><img src="${fallback.file}" srcset="${image.variants.map(v => `${v.file} ${v.width}w`).join(', ')}" sizes="${sizes}" width="${image.width}" height="${image.height}" loading="lazy" decoding="async" alt="${image.alt}"></picture>`;
});
if (count !== 4) throw new Error(`Expected four curriculum images, found ${count}`);
html = html.slice(0, start) + section + html.slice(end);
await writeFile(path.join(root, 'index.html'), html);
await writeFile(path.join(root, 'docs/curriculum-image-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(path.join(archive, 'image-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest.images.map(i => ({ name: i.name, native: `${i.sourceWidth}x${i.sourceHeight}`, master: `${i.width}x${i.height}`, web1280Bytes: i.variants.find(v => v.width === 1280).bytes, avif1280Bytes: i.avifVariants.find(v => v.width === 1280).bytes })), null, 2));
