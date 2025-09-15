#!/usr/bin/env node

const fs = require('fs')
const { exec } = require('child_process')

console.log('Watching for changes...')

exec('node build.js --dev')

fs.watch('src', { recursive: true }, (event, filename) => {
  if (filename) {
    console.log(`${filename} changed, rebuilding...`)
    exec('node build.js --dev')
  }
})
