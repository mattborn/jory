const form = document.querySelector('#hero form')
const input = document.querySelector('#hero input')

if (form && input) {
  const submitUrl = () => {
    let url = input.value.trim()
    if (url) {
      if (!url.includes('//')) url = 'https://' + url
      window.location.href = `site/?url=${encodeURIComponent(url)}`
    }
  }

  form?.addEventListener('submit', e => {
    e.preventDefault()
    submitUrl()
  })

  input?.addEventListener('paste', () => {
    setTimeout(() => {
      const value = input.value.trim()
      if (value && value.includes('.')) submitUrl()
    }, 10)
  })
}

// Used in home and site
const normalizeUrl = url => {
  const normalized = url.replace(/^https?:\/\/(www\.)?/, '')
  return normalized.split('/')[0]
}

const reportsList = document.querySelector('#recent-sites')
if (reportsList && window.firebaseDb && window.firebaseUtils) {
  const { ref, get } = window.firebaseUtils
  const urlsRef = ref(window.firebaseDb, 'urls')

  get(urlsRef).then(snapshot => {
    if (snapshot.exists()) {
      const data = snapshot.val()
      const reports = Object.entries(data)
        .sort(([, a], [, b]) => b.createdAt - a.createdAt)
        .slice(0, 10)

      reportsList.innerHTML = reports
        .map(
          ([key, value]) =>
            `<a href="site/?url=${encodeURIComponent(
              value.url,
            )}">${normalizeUrl(value.url)}</a>`,
        )
        .join('')
    }
  })
}
