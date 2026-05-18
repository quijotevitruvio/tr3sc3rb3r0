/**
 * Optimiza los PNG embebidos dentro de los SVG de wolf heads.
 * Mantiene el wrapper SVG intacto. Recodifica el raster en base64.
 *
 * Estrategia:
 *  - Si el PNG tiene transparencia → mantener PNG pero recomprimirlo con sharp (compressionLevel 9).
 *  - Si NO tiene transparencia → convertir a JPEG quality 88 (ahorro masivo).
 *
 * Uso: node _archive/optimize-svg-raster.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DIR = path.join(__dirname, '..', 'public', 'assets', 'heads');

async function processFile(filename){
  const fullPath = path.join(DIR, filename);
  const svg = fs.readFileSync(fullPath, 'utf8');
  const m = svg.match(/data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)/);
  if(!m){
    console.log(`SKIP ${filename} (no embedded raster found)`);
    return;
  }
  const originalSize = Buffer.byteLength(svg);
  const inputBuffer = Buffer.from(m[2], 'base64');
  const meta = await sharp(inputBuffer).metadata();
  // Detectar si hay transparencia real
  let hasAlpha = meta.hasAlpha;
  if(hasAlpha){
    const stats = await sharp(inputBuffer).stats();
    const alphaChannel = stats.channels[stats.channels.length-1];
    // Si todo el canal alpha es 255, no hay transparencia real
    if(alphaChannel.min === 255 && alphaChannel.max === 255) hasAlpha = false;
  }
  let outputBuffer, mime;
  if(hasAlpha){
    outputBuffer = await sharp(inputBuffer)
      .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
      .toBuffer();
    mime = 'image/png';
  } else {
    outputBuffer = await sharp(inputBuffer)
      .flatten({ background: { r:0, g:0, b:0 } })
      .jpeg({ quality: 88, mozjpeg: true, progressive: true })
      .toBuffer();
    mime = 'image/jpeg';
  }
  const newDataUri = `data:${mime};base64,${outputBuffer.toString('base64')}`;
  const newSvg = svg.replace(/data:image\/(png|jpeg|jpg);base64,[A-Za-z0-9+/=]+/, newDataUri);
  fs.writeFileSync(fullPath, newSvg);
  const newSize = Buffer.byteLength(newSvg);
  const reduction = ((1 - newSize/originalSize) * 100).toFixed(1);
  console.log(`${filename}: ${(originalSize/1024).toFixed(0)}KB → ${(newSize/1024).toFixed(0)}KB (-${reduction}%) [${mime}, alpha=${hasAlpha}]`);
}

(async () => {
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.svg'));
  let totalBefore = 0, totalAfter = 0;
  for(const f of files){
    const before = fs.statSync(path.join(DIR, f)).size;
    totalBefore += before;
    await processFile(f);
    const after = fs.statSync(path.join(DIR, f)).size;
    totalAfter += after;
  }
  console.log(`\nTOTAL: ${(totalBefore/1024/1024).toFixed(2)}MB → ${(totalAfter/1024/1024).toFixed(2)}MB (-${((1-totalAfter/totalBefore)*100).toFixed(1)}%)`);
})();
