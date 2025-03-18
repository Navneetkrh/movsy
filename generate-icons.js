const fs = require('fs');
const { createCanvas } = require('canvas');
const path = require('path');

// Ensure icons directory exists
const iconDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir);
  console.log('Created icons directory');
}

// Generate icons in different sizes
[16, 48, 128].forEach(size => {
  generateIcon(size);
});

// Function to generate an icon
function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#34d399');
  gradient.addColorStop(1, '#06b6d4');
  
  // Fill background
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw play button
  const triangleSize = size * 0.4;
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.moveTo(size * 0.6, size/2);
  ctx.lineTo(size * 0.4, size/2 - triangleSize/2);
  ctx.lineTo(size * 0.4, size/2 + triangleSize/2);
  ctx.closePath();
  ctx.fill();
  
  // Save to file
  const buffer = canvas.toBuffer('image/png');
  const filePath = path.join(iconDir, `icon${size}.png`);
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated icon: ${filePath}`);
}

console.log('Icons generated successfully!');
