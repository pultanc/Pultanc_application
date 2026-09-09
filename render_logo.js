import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const svgContent = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#FE001A" />
  <!-- Left Stem of P -->
  <rect x="163" y="46" width="69" height="350" fill="#000000" />
  
  <!-- Top inner notch bracket -->
  <path d="M 223 46 C 223 46 238 46 238 60 C 238 74 223 74 223 74 Z" fill="#000000" />
  
  <!-- Bottom inner notch bracket -->
  <path d="M 223 235 C 223 235 238 235 238 249 C 238 263 223 263 223 263 Z" fill="#000000" />

  <!-- Center Play Button Triangle -->
  <polygon points="251,97 348,158 251,219" fill="#000000" />

  <!-- Outer Right Semi-Circle Arch of P -->
  <path d="M 346 53 C 420 53 420 263 346 263 L 346 230 C 395 230 395 86 346 86 Z" fill="#000000" />
</svg>`;

const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'pultanc-logo.svg'), svgContent);
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgContent);

async function generateImages() {
  const svgBuffer = Buffer.from(svgContent);

  // 1. Main 512x512 favicon.png & pultanc-logo.png
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));

  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pultanc-logo.png'));

  // 2. 192x192 PNG for Android / PWA
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'favicon-192x192.png'));

  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon-192.png'));

  // 3. 48x48 PNG for minimum crawling requirement
  await sharp(svgBuffer)
    .resize(48, 48)
    .png()
    .toFile(path.join(publicDir, 'favicon-48x48.png'));

  // 4. Apple Touch Icon 180x180
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  // 5. favicon.ico (32x32 PNG file acting as ico or png)
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));

  console.log('Successfully generated all logo PNG assets in /public!');
}

generateImages().catch(console.error);
