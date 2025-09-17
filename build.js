#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const srcDir = 'src'
const buildDir = 'build'

fs.rmSync(buildDir, { recursive: true, force: true })
fs.mkdirSync(buildDir, { recursive: true })

const layoutTemplate = fs.readFileSync(path.join(srcDir, 'layout.html'), 'utf8')

const isDevelopment = process.argv.includes('--dev')
const basePath = isDevelopment ? '/' : '/jory/'

let layout = layoutTemplate.replace(/{base}/g, basePath)

fs.readdirSync(srcDir).forEach(file => {
  const srcPath = path.join(srcDir, file)
  
  if (file === 'layout.html') return

  if (file.endsWith('.html')) {
    const content = fs.readFileSync(srcPath, 'utf8')
    const pageName = file.replace('.html', '')
    const pageJsPath = path.join(srcDir, `${pageName}.js`)
    const scriptTag = fs.existsSync(pageJsPath) && pageName !== 'index'
      ? `\n    <script defer src="${pageName}.js"></script>`
      : ''
    let html = layout.replace('{content}', content).replace('{script}', scriptTag)

    if (file === 'index.html') {
      fs.writeFileSync(path.join(buildDir, file), html)
      console.log(`Built ${file}`)
    } else {
      // Create directory with index.html for clean URLs
      const dirPath = path.join(buildDir, pageName)
      fs.mkdirSync(dirPath, { recursive: true })
      fs.writeFileSync(path.join(dirPath, 'index.html'), html)
      console.log(`Built ${pageName}/index.html`)
    }
  } else {
    const destPath = path.join(buildDir, file)
    fs.cpSync(srcPath, destPath, { recursive: true })
    console.log(`Copied ${file}`)
  }
})

console.log('Build complete!')
