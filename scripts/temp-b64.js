import sharp from 'sharp';

const svgBuffer = Buffer.from(`
  <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="512" rx="115" fill="#3700b3"/>
    <path d="M360 256L190 360V152z" fill="white"/>
  </svg>
`);

async function run() {
  const b56 = await sharp(svgBuffer).resize(56, 56).png().toBuffer();
  const b112 = await sharp(svgBuffer).resize(112, 112).png().toBuffer();
  console.log("B56:" + b56.toString('base64'));
  console.log("B112:" + b112.toString('base64'));
}
run();
