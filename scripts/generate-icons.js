import fs from 'fs';
import path from 'path';

const iconsDir = path.resolve('public', 'icons');

// Ensure the public/icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Pre-generated base64 PNGs for the KaiOS icons
const b56 = "iVBORw0KGgoAAAANSUhEUgAAADgAAAA4CAYAAACohjseAAAACXBIWXMAAAsTAAALEwEAmpwYAAACbUlEQVR4nO2bP2hTURTGv7aKDjoIDmpx1sE/Q+m9r6JoNdrNrQ6KBVG6OjpWJ1dr6+TmZidz74tVUCo2aqpCdBGqWDQxIIQOhRKLCTlyTJ9toYaE9Hlfju+DswXy/TiXe+6773tAHfXg7WaN5GkNO65gZhTMNwVT1rDkovi/lz3MaJgxD36CPaJ5jXQq+IMads4VTONl8hr+8CAmuhpCO4IHezTsK/fGm66XPZjcXRdOwR7mJRABsy10M3loXbhe+LtqP3BtsrVSsAUPtnsNHK9fBZNxbW7jIM0L3kf+AGqYS65NhQB5cdUosDmBgF9+jxAFc8a1mbCqF+YU75x3XBsJsYu3oWFfCwbMcAcLro2EVyYPl2fLf9DBMqJgJMyCawMxICLWwcSOR3Ri26RcwMtemoqFH3RjKCsXMNCbp0U6t39KLiBrqVShu9dn6djWlEzAQPlPi3R1ICMXMNC0/U5n9z6RC8gqLVZo/NoH6uvyZQIG+vhuga70peUCsqpVoof38jSw87FMwEAL8z/p5vB78jqEAgbKPp+n8weeyQVkVcpVuj86R/3bWz/yIQZEvEQp3mT+1zExmxU66EuSj2rTUg/beamPS0vLD7xHt6SEXlnsE3hlUZR86ZSQfm2oI1ZwbSAGRIsdVPJfn5m2z8bov1dO/itsDTMmGPAWOJIoF9DvD4JAX8UGgVgKdsi1oY0uD/YCVjTSyXlLOd2z6TVhvJU4Zftn1tR6ccpAHCZt87mY85A6iHriWDDnLduwc2lehWhM1FELpZvP7dA13UwofbWOY2oTRxI5tcdB9ah8VlDzYkcVkifZYz2IX3K6QLouqErgAAAAAElFTkSuQmCC";
const b112 = "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";

async function generateIcons() {
  console.log('Generating KaiOS installation icons...');
  
  try {
    // Write 56x56 icon
    const icon56Path = path.join(iconsDir, 'icon56x56.png');
    fs.writeFileSync(icon56Path, Buffer.from(b56, 'base64'));
    console.log(`Created ${icon56Path}`);

    // Write 112x112 icon
    const icon112Path = path.join(iconsDir, 'icon112x112.png');
    fs.writeFileSync(icon112Path, Buffer.from(b112, 'base64'));
    console.log(`Created ${icon112Path}`);
    
    console.log('Icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
