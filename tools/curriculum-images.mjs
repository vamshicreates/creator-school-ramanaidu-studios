import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = process.env.IMAGE_TOOL_MODULES ? require(path.join(process.env.IMAGE_TOOL_MODULES, 'sharp')) : require('sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archive = path.resolve(process.argv[2] || path.join(root, '..', 'creator-studio-ramanaidu-image-library', 'sprint-generated'));
const scenes = [
  ['phase1', 'Concept of a warm tiered classroom for storytelling and creator workshops'],
  ['phase2', 'Concept of a professional video editing and sound learning lab'],
  ['phase3', 'Concept of a film production training stage with cinema camera and lighting'],
  ['phase4', 'Concept of a warm presentation room for Demo Day and creator showcases']
];
await mkdir(path.join(archive, 'masters-4k'), { recursive: true });
const manifest = { provenance: 'AI-generated concepts using the supplied classroom mood reference; built-in image_gen', method: 'One Lanczos3 upscale from each native generated source to a lossless 3840px master; responsive AVIF and WebP files downsampled from that master', webQuality: 82, avifQuality: 50, images: [] };
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
    const info = await sharp(master).resize({ width: w, kernel: 'lanczos3' }).webp({ quality: 82, effort: 6 }).toFile(path.join(root, file));
    variants.push({ file, width: info.width, height: info.height, bytes: info.size });
    const avifFile = file.replace(/\.webp$/, '.avif');
    const avifInfo = await sharp(master).resize({ width: w, kernel: 'lanczos3' }).avif({ quality: 50, effort: 4 }).toFile(path.join(root, avifFile));
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
  const sizes = '(max-width: 1080px) calc(100vw - 88px), 554px';
  return `<picture><source type="image/avif" srcset="${image.avifVariants.map(v => `${v.file} ${v.width}w`).join(', ')}" sizes="${sizes}"><img src="${fallback.file}" srcset="${image.variants.map(v => `${v.file} ${v.width}w`).join(', ')}" sizes="${sizes}" width="${image.width}" height="${image.height}" loading="lazy" decoding="async" alt="${image.alt}"></picture>`;
});
if (count !== 4) throw new Error(`Expected four curriculum images, found ${count}`);
html = html.slice(0, start) + section + html.slice(end);
await writeFile(path.join(root, 'index.html'), html);
await writeFile(path.join(root, 'docs/curriculum-image-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(path.join(archive, 'image-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest.images.map(i => ({ name: i.name, native: `${i.sourceWidth}x${i.sourceHeight}`, master: `${i.width}x${i.height}`, web1280Bytes: i.variants.find(v => v.width === 1280).bytes, avif1280Bytes: i.avifVariants.find(v => v.width === 1280).bytes })), null, 2));
