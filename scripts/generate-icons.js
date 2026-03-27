import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const iconsDir = path.resolve('public', 'icons');

// Ensure the public/icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create a simple, clean "Play" button icon using SVG
// Theme color from manifest: #3700b3
const svgBuffer = Buffer.from(`
  <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="512" rx="115" fill="#3700b3"/>
    <path d="M360 256L190 360V152z" fill="white"/>
  </svg>
`);

async function generateIcons() {
  console.log('Generating KaiOS installation icons...');
  
  try {
    // Generate 56x56 icon
    const icon56Path = path.join(iconsDir, 'icon56x56.png');
    await sharp(svgBuffer)
      .resize(56, 56)
      .png()
      .toFile(icon56Path);
    console.log(`Created ${icon56Path}`);

    // Generate 112x112 icon
    const icon112Path = path.join(iconsDir, 'icon112x112.png');
    await sharp(svgBuffer)
      .resize(112, 112)
      .png()
      .toFile(icon112Path);
    console.log(`Created ${icon112Path}`);
    
    console.log('Icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
