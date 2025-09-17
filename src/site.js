const { get, ref } = window.firebaseUtils

// Utility functions
const getFirebaseKey = url => {
  return normalizeUrl(url).replace(/[^a-zA-Z0-9]/g, '_')
}

// Site analysis sequence
const params = new URLSearchParams(location.search)
const encodedUrl = params.get('url')

if (!encodedUrl) location.href = '/'

const url = decodeURIComponent(encodedUrl)
const displayUrl = url.replace(/^https?:\/\/(www\.)?/, '')

// UI elements
const message = document.getElementById('message')
const address = document.getElementById('address')
const viewport = document.getElementById('viewport')
const analysis = document.getElementById('analysis')

// Display URL
address.textContent = displayUrl

// Show start message
message.textContent = 'Press enter to continue'

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') runSequence()
}, { once: true })

const chat = async (text, type = 'message') => {
  console.log(type === 'message' ? text : `(${text})`)
  document.getElementById(type === 'message' ? 'message' : 'thought').textContent = text

  if (type === 'message') {
    try {
      const response = await fetch('https://us-central1-samantha-374622.cloudfunctions.net/openai-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: text,
          model: 'tts-1',
          voice: 'nova',
        }),
      })
      const audioBlob = await response.blob()
      const audio = new Audio(URL.createObjectURL(audioBlob))
      audio.play()
    } catch (error) {
      console.log('TTS error:', error)
    }
  }
}

const runSequence = async () => {
  // 1. lets make sure we have everything
  const data = await get(ref(window.firebaseDb, `urls/${getFirebaseKey(url)}`)).then(s => s.val())

  if (data?.analysis) await chat('lets make sure we have everything')
  else console.log('no analysis found')

  // 2. let me pull up the site
  if (!data?.screenshot) {
    await chat('let me pull up the site')
  }

  render(data)
}

const render = data => {
  address.textContent = displayUrl

  if (data?.screenshot) {
    viewport.innerHTML = `<img alt="Website screenshot" src="${data.screenshot}" />`
  } else {
    const iframe = document.createElement('iframe')
    iframe.src = url
    viewport.appendChild(iframe)
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

    analysis.innerHTML = '<h2>Above Your Fold™ Analysis</h2>' + html
  }
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
  if (!screenshot) return

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

