const form = document.querySelector('#hero form')
const input = document.querySelector('#hero input')

if (form && input) {
  const submitUrl = () => {
    let url = input.value.trim()
    if (url) {
      if (!url.includes('//')) url = 'https://' + url
      window.location.href = `d/?url=${encodeURIComponent(url)}`
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

const reportsList = document.querySelector('.reports-list')
if (reportsList && window.firebaseDb && window.firebaseUtils) {
  const { ref, get } = window.firebaseUtils
  const urlsRef = ref(window.firebaseDb, 'urls')
  
  get(urlsRef).then(snapshot => {
    if (snapshot.exists()) {
      const data = snapshot.val()
      const reports = Object.entries(data)
        .sort(([,a], [,b]) => b.createdAt - a.createdAt)
        .slice(0, 10)
      
      reportsList.innerHTML = reports.map(([key, value]) => 
        `<a href="d/?url=${encodeURIComponent(value.url)}">${value.url}</a>`
      ).join('')
    }
  })
}

const urlDisplay = document.querySelector('.url-display')
if (urlDisplay) {
  const params = new URLSearchParams(location.search)
  const url = params.get('url')
  if (url) {
    const cleanUrl = decodeURIComponent(url)
    urlDisplay.textContent = 'Checking if URL is reachable...'

    fetch(cleanUrl, { method: 'HEAD' })
      .then(() => {
        if (window.firebaseDb && window.firebaseUtils) {
          const { get, ref, serverTimestamp, set } = window.firebaseUtils
          const urlKey = cleanUrl.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '_')
          const urlRef = ref(window.firebaseDb, `urls/${urlKey}`)
          
          get(urlRef).then(snapshot => {
            if (!snapshot.exists()) {
              set(urlRef, {
                createdAt: serverTimestamp(),
                url: cleanUrl
              })
            }
            urlDisplay.textContent = urlKey
          })
        
        } else {
          urlDisplay.textContent = cleanUrl
        }
      })
      .catch(error => {
        console.error(error)
        urlDisplay.textContent =
          'Unable to reach that URL. Please check the address and try again.'
      })
  }
}
