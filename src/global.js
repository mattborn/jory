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

const normalizeUrl = url => {
  const normalized = url.replace(/^https?:\/\/(www\.)?/, '')
  return normalized.split('/').length < 3
    ? normalized.replace(/\/$/, '')
    : normalized
}

const getFirebaseKey = url => {
  return normalizeUrl(url).replace(/[^a-zA-Z0-9]/g, '_')
}

const reportsList = document.querySelector('.reports-list')
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
            `<a href="d/?url=${encodeURIComponent(value.url)}">${normalizeUrl(
              value.url,
            )}</a>`,
        )
        .join('')
    }
  })
}

const params = new URLSearchParams(location.search)
const url = params.get('url')

if (url) {
  const cleanUrl = decodeURIComponent(url)
  const { get, onValue, ref, serverTimestamp, set, update } =
    window.firebaseUtils
  const urlKey = getFirebaseKey(cleanUrl)
  const urlRef = ref(window.firebaseDb, `urls/${urlKey}`)

  // Set initial state
  document.getElementById('status').textContent = 'Checking if URL is reachable'

  fetch(cleanUrl, { method: 'HEAD', mode: 'no-cors' })
    .then(() => {
      // Listen for all changes
      onValue(urlRef, snapshot => render(snapshot.val() || {}, cleanUrl))

      get(urlRef).then(snapshot => {
        const data = snapshot.val() || {}

        if (!snapshot.exists()) {
          set(urlRef, {
            createdAt: serverTimestamp(),
            status: 'Capturing screenshot',
            url: cleanUrl,
          })
          captureScreenshot(cleanUrl, urlKey)
        } else if (!data.screenshot) {
          update(urlRef, { status: 'Capturing screenshot' })
          captureScreenshot(cleanUrl, urlKey)
        } else if (!data.analysis) {
          update(urlRef, { status: 'Analyzing' })
          analyzeUrl(cleanUrl, urlKey, data.screenshot)
        }
      })
    })
    .catch(() => {
      document.getElementById('status').textContent = 'Unable to reach that URL'
      document.getElementById('content').innerHTML = ''
    })
}

const modules = [
  {
    title: 'Header',
    description: 'Extract the main header/headline text',
  },
  {
    title: 'Subheader',
    description: 'Extract the subheader/tagline text',
  },
  {
    title: 'Benefit',
    description:
      "What's in it for the customer? Is the benefit obvious and compelling?",
    graded: true,
  },
  {
    title: 'Problem',
    description: 'What problem does this solve? Is the pain point clear?',
    graded: true,
  },
  {
    title: 'Customer',
    description:
      'Who is this for specifically? Is the target audience defined?',
    graded: true,
  },
  {
    title: 'Feature',
    description: 'What does the product have? Are key features highlighted?',
    graded: true,
  },
  {
    title: 'Capability',
    description: 'What can the product do? Are capabilities explained?',
    graded: true,
  },
  {
    title: 'Use Case',
    description: 'Where/how is it applied? Are practical use cases shown?',
    graded: true,
  },
]

const getResponseFormat = () => ({
  type: 'json_schema',
  json_schema: {
    name: 'website_analysis',
    strict: true,
    schema: {
      type: 'object',
      properties: modules.reduce((acc, module) => {
        const key = module.title.toLowerCase().replace(' ', '_')
        acc[key] = module.graded
          ? {
              type: 'object',
              properties: {
                pass: { type: 'boolean' },
                explanation: {
                  type: 'string',
                  description: module.description,
                },
              },
              required: ['pass', 'explanation'],
              additionalProperties: false,
            }
          : {
              type: 'string',
              description: module.description,
            }
        return acc
      }, {}),
      required: modules.map(m => m.title.toLowerCase().replace(' ', '_')),
      additionalProperties: false,
    },
  },
})

const makeOpenAIRequest = async prompt => {
  const messages = [{ role: 'user', content: prompt }]
  const response_format = getResponseFormat()

  const response = await fetch(
    'https://us-central1-samantha-374622.cloudfunctions.net/openai-4',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        response_format,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(
      `OpenAI API request failed: ${response.status} ${response.statusText}`,
    )
  }

  const completion = await response.json()
  return {
    content: JSON.parse(completion.choices[0].message.content),
    usage: completion.usage || {},
  }
}

const captureScreenshot = async (url, urlKey) => {
  const { ref, serverTimestamp, update } = window.firebaseUtils
  const urlRef = ref(window.firebaseDb, `urls/${urlKey}`)

  try {
    const response = await fetch(
      'https://us-central1-samantha-374622.cloudfunctions.net/screenshot',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      },
    )

    if (!response.ok) throw new Error(await response.text())

    const { image } = await response.json()

    await update(urlRef, {
      screenshot: image,
      screenshotAt: serverTimestamp(),
      status: 'Analyzing',
    })

    analyzeUrl(url, urlKey, image)
  } catch (error) {
    console.error('Screenshot failed:', error)
    await update(urlRef, { status: 'Screenshot failed, cannot analyze' })
  }
}

const analyzeUrl = async (url, urlKey, screenshot) => {
  if (!screenshot) return // Never analyze without screenshot

  const { ref, serverTimestamp, update } = window.firebaseUtils
  const urlRef = ref(window.firebaseDb, `urls/${urlKey}`)

  const basePrompt = `Analyze this website screenshot from ${url}. Extract the header and subheader text, then evaluate each element.`

  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: basePrompt },
        { type: 'image_url', image_url: { url: screenshot } },
      ],
    },
  ]

  try {
    const response = await fetch(
      'https://us-central1-samantha-374622.cloudfunctions.net/openai-4',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages,
          response_format: getResponseFormat(),
        }),
      },
    )

    if (!response.ok)
      throw new Error(`${response.status} ${response.statusText}`)

    const completion = await response.json()
    const analysis = JSON.parse(completion.choices[0].message.content)

    await update(urlRef, {
      analysis,
      analysisAt: serverTimestamp(),
      status: normalizeUrl(url),
      usage: completion.usage || {},
    })
  } catch (error) {
    await update(urlRef, { status: 'Analysis failed' })
  }
}

const render = (data, cleanUrl) => {
  const status = document.getElementById('status')
  const screenshot = document.getElementById('screenshot')
  const content = document.getElementById('content')

  if (status) status.textContent = data.status || normalizeUrl(cleanUrl)

  if (data?.screenshot) {
    screenshot.classList.remove('loading')
    screenshot.innerHTML = `<img alt="Website screenshot" src="${data.screenshot}" />`
  }

  if (data?.analysis) {
    const html = modules
      .map(module => {
        const key = module.title.toLowerCase().replace(' ', '_')
        const value = data.analysis[key]

        if (!value) return ''

        if (module.graded) {
          const icon = value.pass ? '✓' : '✗'
          return `<h3>${icon} ${module.title}</h3><p>${value.explanation}</p>`
        }

        return `<h3>${module.title}</h3><p>${value}</p>`
      })
      .join('')

    content.innerHTML = '<h2>Above Your Fold™ Analysis</h2>' + html
  }
}
