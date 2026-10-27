import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'docs/image-manifest.json'), 'utf8'));
let html = await readFile(path.join(root, 'index.html'), 'utf8');
if (html.includes('assets/optimized/')) throw new Error('Already responsive. Restore the original HTML before reapplying.');

function sizesFor(image, tag, offset) {
  const preceding = html.slice(0, offset);
  const section = preceding.slice(preceding.lastIndexOf('<section')).match(/^<section[^>]*class="([^"]+)"/)?.[1] || '';
  const ratio = image.originalWidth / image.originalHeight;
  const scaled = (length, factor) => `calc(${length} * ${Math.max(1, factor).toFixed(4)})`;
  if (section.includes('hero')) return scaled('clamp(200px, 19vw, 260px)', ratio / (3 / 4.1));
  if (section.includes('mono')) {
    if (tag.includes('monoImg')) return '(max-width: 1080px) calc((100vw - 32px) * 1.12), 752px';
    if (image.original.endsWith('/suresh.jpg')) return '52px';
    return '(max-width: 640px) 84px, (max-width: 1080px) 110px, 150px';
  }
  if (section.includes('mentors')) {
    if (preceding.lastIndexOf('<div class="mclass"') > preceding.lastIndexOf('<section')) return scaled('clamp(230px, 22vw, 280px)', ratio / 0.8);
    return '(max-width: 640px) calc(100vw - 60px), (max-width: 1080px) calc((100vw - 86px) / 2), 357px';
  }
  if (section.includes('curr')) return '(max-width: 1080px) calc(100vw - 88px), 554px';
  if (section.includes('lot')) return '(max-width: 640px) calc((100vw - 32px) * 1.85), (max-width: 1080px) calc((100vw - 32px) * 1.02), 730px';
  if (section.includes('adm')) {
    const factor = Math.max(1, ratio / (16 / 11));
    return `(max-width: 592px) ${scaled('(100vw - 66px)', factor)}, (max-width: 1080px) ${(526 * factor).toFixed(0)}px, ${(354 * factor).toFixed(0)}px`;
  }
  if (section.includes('tuition')) return '124px';
  if (section.includes('faq')) return '(max-width: 640px) 320px, (max-width: 1080px) 420px, 490px';
  if (section.includes('pillars')) return '100vw';
  throw new Error(`Unknown image placement: ${section}, ${image.original}`);
}

function attributes(image, sizes, maxWidth = Infinity) {
  const fallback = image.variants.find(v => v.width === 640) || image.variants[0];
  const srcset = image.variants.filter(v => v.width <= maxWidth).map(v => `${v.file} ${v.width}w`).join(', ');
  return `src="${fallback.file}" srcset="${srcset}" sizes="${sizes}" width="${image.masterWidth}" height="${image.masterHeight}" loading="lazy" decoding="async"`;
}

html = html.replace(/<img\b[^>]*src="(assets\/[^"<>]+\.jpg)"[^>]*>/g, (tag, src, offset) => {
  const image = manifest.images.find(image => image.original === src);
  if (!image) throw new Error(`Missing source ${src}`);
  const other = tag.replace(/^<img\s*|\/?\s*>$/g, '').replace(/\b(src|loading|decoding|width|height)="[^"]*"\s*/g, '').trim();
  return `<img ${attributes(image, sizesFor(image, tag, offset))} ${other}>`;
});

const background = manifest.images.find(image => image.original === 'assets/studio-space.jpg');
const social = manifest.images.find(image => image.original === 'assets/suresh-statement.jpg');
if (social.socialFile) {
  html = html.replace('<meta property="og:image" content="assets/suresh-statement.jpg">', `<meta property="og:image" content="https://creator-studio-ramanaidu.vercel.app/${social.socialFile}">\n<meta property="og:image:width" content="${social.masterWidth}">\n<meta property="og:image:height" content="${social.masterHeight}">\n<meta property="og:image:type" content="image/jpeg">`);
}
html = html.replace('background:url(assets/studio-space.jpg) center/cover;', '');
// Keep CSS sizing identical when intrinsic width/height attributes are added.
html = html.replace('img{max-width:100%;display:block}', 'img{max-width:100%;height:auto;display:block}');
html = html.replace('.pillars .in{', '.pillars .bgimg img{width:100%;height:100%;object-fit:cover}\n.pillars .in{');
html = html.replace('<div class="bgimg" id="pilBg" aria-hidden="true"></div>', `<div class="bgimg" id="pilBg" aria-hidden="true"><img ${attributes(background, '100vw', 1280)} alt=""></div>`);
await writeFile(path.join(root, 'index.html'), html);
console.log('Added responsive sources, dimensions and native lazy loading to all 33 photo placements.');
