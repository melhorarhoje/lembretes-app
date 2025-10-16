// scripts/generate-icons.js
// Gera icon.ico e icon.icns a partir de assets/clocklogo.png usando png2icons
const fs = require('fs');
const path = require('path');

async function main() {
  const p = path.join(__dirname, '..', 'assets', 'clocklogo.png');
  if (!fs.existsSync(p)) {
    console.error('Arquivo fonte não encontrado:', p);
    process.exit(1);
  }

  // Reprocessar PNG para um formato previsível (p.ex. 1024x1024 RGBA)
  let sharp;
  try { sharp = require('sharp'); } catch (e) { console.error('Instale sharp: npm install sharp'); process.exit(1); }

  const png = await sharp(p).resize(1024, 1024, { fit: 'contain', background: { r:255, g:255, b:255, alpha:0 } }).png().toBuffer();
  let png2icons;
  try {
    png2icons = require('png2icons');
  } catch (e) {
    console.error('Erro ao carregar png2icons. Instale: npm install png2icons');
    process.exit(1);
  }

  try {
    // gerar ICO (Windows)
    const icoBuf = png2icons.createICO(png, png2icons.BICUBIC, false, 0);
    if (icoBuf) {
      fs.writeFileSync(path.join(__dirname, '..', 'assets', 'icon.ico'), icoBuf);
      console.log('Gerado assets/icon.ico');
    } else console.warn('Falha ao gerar icon.ico');

    // gerar ICNS (macOS)
    const icnsBuf = png2icons.createICNS(png, png2icons.BICUBIC, false, 0);
    if (icnsBuf) {
      fs.writeFileSync(path.join(__dirname, '..', 'assets', 'icon.icns'), icnsBuf);
      console.log('Gerado assets/icon.icns');
    } else console.warn('Falha ao gerar icon.icns');

    // opcional: gerar um icon.png redimensionado (512x512)
    // png2icons não faz redimensionamento em PNG — manter clocklogo.png como icon.png

  } catch (e) {
    console.error('Erro durante geração:', e);
    process.exit(1);
  }
}

main();
