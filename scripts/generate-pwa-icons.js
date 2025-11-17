#!/usr/bin/env node

/**
 * Script untuk generate icon PWA dari SVG
 * 
 * Catatan: Script ini memerlukan sharp untuk convert SVG ke PNG
 * Alternatif: Gunakan online tool seperti https://realfavicongenerator.net/
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sizes = [192, 512]
const svgPath = path.join(__dirname, '../public/icon.svg')
const outputDir = path.join(__dirname, '../public')

console.log('Generating PWA icons...')
console.log('Note: This script requires sharp package.')
console.log('For now, please use an online tool to convert SVG to PNG:')
console.log('1. Visit https://realfavicongenerator.net/')
console.log('2. Upload public/icon.svg')
console.log('3. Download and save as icon-192x192.png and icon-512x512.png in public/ folder')
console.log('')
console.log('Or install sharp and run this script:')
console.log('  npm install sharp --save-dev')

// Check if sharp is available
try {
  const sharp = (await import('sharp')).default
  
  if (!fs.existsSync(svgPath)) {
    console.error(`SVG file not found: ${svgPath}`)
    process.exit(1)
  }

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`)
    try {
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(outputPath)
      console.log(`✓ Generated ${outputPath}`)
    } catch (err) {
      console.error(`✗ Failed to generate ${outputPath}:`, err.message)
    }
  }
} catch (err) {
  console.log('Sharp not installed. Please use online tool or install sharp.')
  console.log('  npm install sharp --save-dev')
  process.exit(1)
}

