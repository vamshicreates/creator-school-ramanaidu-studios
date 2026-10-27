# Creators' Studio by Ramanaidu

Landing page for Creators' Studio by Ramanaidu, a 12-week creator program at Ramanaidu Studios, Hyderabad.

Static site: `index.html` plus `assets/`. No build step. Deployed on Vercel (framework preset: Other, no build command, output directory `.`).

Built by [Vamshi Creates](https://vamshicreates.tech).

## Images

All 20 original JPEGs and four SVGs remain in `assets/`. The photos also have lossless 4K copies in `assets/4k/` and responsive WebP delivery copies in `assets/optimized/`. SVGs remain vectors and scale to any resolution.

The 4K copies use a 3840-pixel longest edge, with the original aspect ratio (rounded to the nearest pixel). Lanczos3 resampling preserves composition and does not generate new facial features, textures or objects. No cropping, sharpening, retouching or colour grading is applied. Upscaling cannot recover detail absent from the source.

The website uses `srcset` and placement-specific `sizes`, native lazy loading, asynchronous decoding, intrinsic dimensions and immutable caching for the versioned assets. Responsive WebPs use quality 85 compression; the separate lossless masters are not automatically downloaded by normal page visits. The dark decorative background uses a maximum 1280-pixel delivery candidate. Existing CSS crops and filters are preserved.

The local image library is saved alongside the repository in `../creator-studio-ramanaidu-image-library/`, with byte-identical originals and lossless PNG masters in `masters-4k/`. `docs/image-manifest.json` records source checksums, dimensions and all delivery variants.

To rebuild from the original JPEGs:

```sh
npm install --prefix tools
node tools/images.mjs /absolute/path/to/local-image-library
```

`tools/responsive.mjs` applies the responsive markup to the original HTML once. After replacing source photos, regenerate the manifest and update the corresponding markup so its versioned paths match. There is no production build step; image tools and reports are excluded from deployment.

## Generated curriculum interiors

The four 12-week sprint cards use three relaxed classroom concepts with the wall name “Creator Studios by Rama Naidu” and the earlier production-stage concept. They are AI-generated concepts rather than photographs of actual facilities. The exact built-in image_gen generation and editing prompts are in `docs/curriculum-generation-prompts.json`.

Native PNGs and lossless masters with a 3840-pixel longest edge are stored in `../creator-studio-ramanaidu-image-library/sprint-rama-naidu/`. Each master is enlarged once from its native source. `docs/curriculum-source-selection.json` records the current source folder and image descriptions. `tools/curriculum-images.mjs` rebuilds the responsive image sets and updates only the curriculum card images, reusing existing versioned outputs when available. AVIF quality 50 is preferred with WebP quality 82 fallback, using the existing lazy loading and caching. `docs/curriculum-image-manifest.json` records provenance, checksums, dimensions and delivery sizes.
