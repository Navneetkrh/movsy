/**
 * Run this script with node to generate icons for the extension
 * Usage: node create-icons.js
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

console.log('Generating Video Sync icons...');

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
  console.log('Created icons directory');
}

// Icon sizes to generate
const sizes = [16, 48, 128];

// Generate each icon
sizes.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background
  ctx.fillStyle = '#1e1e1e';
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
  ctx.fill();
  
  // Play triangle
  ctx.fillStyle = '#4CAF50';
  ctx.beginPath();
  const triangleSize = size * 0.4;
  ctx.moveTo(size/2 + triangleSize/2, size/2);
  ctx.lineTo(size/2 - triangleSize/3, size/2 - triangleSize/2);
  ctx.lineTo(size/2 - triangleSize/3, size/2 + triangleSize/2);
  ctx.fill();
  
  // Sync circle
  ctx.strokeStyle = '#4CAF50';
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.beginPath();
  ctx.arc(size/2, size/2, size * 0.35, 0, Math.PI * 1.5);
  ctx.stroke();
  
  // Arrow
  const arrowSize = size * 0.12;
  ctx.fillStyle = '#4CAF50';
  ctx.beginPath();
  ctx.moveTo(size/2, size/2 - size * 0.35);
  ctx.lineTo(size/2 - arrowSize, size/2 - size * 0.35 + arrowSize);
  ctx.lineTo(size/2 + arrowSize, size/2 - size * 0.35 + arrowSize);
  ctx.fill();
  
  // Save the image
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), buffer);
  console.log(`Generated icon${size}.png`);
});

console.log('Icon generation complete!');
