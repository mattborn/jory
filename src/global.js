// Global JavaScript

// Handle form submission
const form = document.querySelector('#hero form')
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const input = form.querySelector('input')
    const url = encodeURIComponent(input.value)
    window.location.href = `d.html?url=${url}`
  })
}

// Display URL on not ready page
const urlDisplay = document.querySelector('.url-display')
if (urlDisplay) {
  const params = new URLSearchParams(window.location.search)
  const url = params.get('url')
  if (url) {
    urlDisplay.textContent = `You entered: ${decodeURIComponent(url)}`
  }
}
