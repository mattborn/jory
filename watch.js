#!/usr/bin/env node

const fs = require('fs')
const { exec } = require('child_process')

console.log('Watching for changes...')

// Initial build
exec('node build.js --dev')

// Watch for changes
fs.watch('src', { recursive: true }, (event, filename) => {
  if (filename) {
    console.log(`${filename} changed, rebuilding...`)
    exec('node build.js --dev')
  }
})
