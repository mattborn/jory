#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const srcDir = 'src'
const buildDir = 'build'

// Create build directory
fs.rmSync(buildDir, { recursive: true, force: true })
fs.mkdirSync(buildDir, { recursive: true })

// Read layout template
const layoutTemplate = fs.readFileSync(path.join(srcDir, 'layout.html'), 'utf8')

// Determine base href based on environment
const isDevelopment = process.argv.includes('--dev')
const baseHref = isDevelopment ? '<base href="/" />' : '<base href="/jory/" />'
const layout = layoutTemplate.replace('{base}', baseHref)

// Process all files
fs.readdirSync(srcDir).forEach(file => {
  const srcPath = path.join(srcDir, file)
  const destPath = path.join(buildDir, file)

  if (file === 'layout.html') return

  if (file.endsWith('.html')) {
    const content = fs.readFileSync(srcPath, 'utf8')
    const html = layout.replace('{content}', content)
    fs.writeFileSync(destPath, html)
    console.log(`Built ${file}`)
  } else {
    fs.cpSync(srcPath, destPath, { recursive: true })
    console.log(`Copied ${file}`)
  }
})

console.log('Build complete!')
