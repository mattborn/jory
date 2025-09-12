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
  
  if (file === 'layout.html') return

  if (file.endsWith('.html')) {
    const content = fs.readFileSync(srcPath, 'utf8')
    const html = layout.replace('{content}', content)
    
    if (file === 'index.html') {
      // Write index.html to root
      fs.writeFileSync(path.join(buildDir, file), html)
      console.log(`Built ${file}`)
    } else {
      // Create directory with index.html for clean URLs
      const name = file.replace('.html', '')
      const dirPath = path.join(buildDir, name)
      fs.mkdirSync(dirPath, { recursive: true })
      fs.writeFileSync(path.join(dirPath, 'index.html'), html)
      console.log(`Built ${name}/index.html`)
    }
  } else {
    const destPath = path.join(buildDir, file)
    fs.cpSync(srcPath, destPath, { recursive: true })
    console.log(`Copied ${file}`)
  }
})

console.log('Build complete!')
