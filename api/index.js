import express from 'express'
import fetch from 'node-fetch'

const app = express()
const PORT = process.env.PORT || 3001

let cachedPosts = []
let lastUpdated = 0
// Reduced to 5 minutes from 15 minutes
const CACHE_INTERVAL = 5 * 60 * 1000
const SUBREDDITS = [
  'ArtificialInteligence',
  'Bitcoin',
  'BitcoinUK',
  'Bogleheads',
  'business',
  'consulting',
  'Economics',
  'Entrepreneur',
  'eupersonalfinance',
  'FIREUK',
  'financialindependence',
  'frugaluk',
  'Leadership',
  'passiveincome',
  'smallbusiness',
  'stocks',
  'technology',
  'UKInvesting',
  'UKPersonalFinance',
] // Hardcoded subreddits

// Rate limit tracking
const rateLimitState = {
  remaining: 100, // Default to 100 QPM
  resetTime: 0,
  lastChecked: 0,
}

// Request queue to stagger API calls
const requestQueue = []
let isProcessingQueue = false

function timeAgo(utcSeconds) {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - utcSeconds
  if (diff < 60) return `${diff} seconds ago`
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`
  return `${Math.floor(diff / 86400)} days ago`
}

async function fetchSubreddit(subreddit) {
  const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=5`
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'reddit-aggregator/1.0',
      },
    })

    // Track rate limits from headers
    if (response.headers.has('x-ratelimit-remaining')) {
      rateLimitState.remaining = parseInt(
        response.headers.get('x-ratelimit-remaining'),
        10,
      )
    }
    if (response.headers.has('x-ratelimit-reset')) {
      rateLimitState.resetTime = parseInt(
        response.headers.get('x-ratelimit-reset'),
        10,
      )
    }
    rateLimitState.lastChecked = Date.now()

    if (response.ok) {
      const data = await response.json()
      return data.data.children.map(post => ({
        title: post.data.title,
        url: post.data.url,
        permalink: `https://www.reddit.com${post.data.permalink}`,
        upvotes: post.data.ups,
        author: post.data.author,
        time_ago: timeAgo(post.data.created_utc),
        subreddit: subreddit,
      }))
    }
    return []
  } catch (error) {
    console.error(`Error fetching ${subreddit}:`, error)
    return []
  }
}

async function processQueue() {
  if (isProcessingQueue || requestQueue.length === 0) return

  isProcessingQueue = true

  // Check if we need to wait due to rate limits
  if (rateLimitState.remaining < 10 && rateLimitState.resetTime > 0) {
    const waitTime = rateLimitState.resetTime * 1000
    console.log(
      `Rate limit approaching, waiting ${waitTime / 1000}s before next request`,
    )
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }

  const subreddit = requestQueue.shift()
  const posts = await fetchSubreddit(subreddit)

  // Update cached posts for this subreddit
  cachedPosts = cachedPosts.filter(post => post.subreddit !== subreddit)
  cachedPosts.push(...posts)
  lastUpdated = Date.now()

  // Add a small delay between requests to avoid hitting rate limits
  await new Promise(resolve => setTimeout(resolve, 1000))

  isProcessingQueue = false
  processQueue() // Process next in queue
}

function enqueueSubreddits() {
  // Clear the queue first
  requestQueue.length = 0

  // Add all subreddits to the queue in random order to distribute popular ones
  const shuffledSubreddits = [...SUBREDDITS].sort(() => 0.5 - Math.random())
  requestQueue.push(...shuffledSubreddits)

  // Start processing the queue
  processQueue()

  console.log('Refresh cycle started at', new Date().toLocaleTimeString())
}

app.get('/subreddits', (req, res) => {
  res.json({
    lastUpdated,
    posts: cachedPosts,
    rateLimit: {
      remaining: rateLimitState.remaining,
      resetIn: rateLimitState.resetTime,
    },
  })
})

// Initial fetch on startup
enqueueSubreddits()

// Schedule regular refreshes
setInterval(enqueueSubreddits, CACHE_INTERVAL)

// Continuous queue monitoring to ensure processing continues
setInterval(() => {
  if (requestQueue.length > 0 && !isProcessingQueue) {
    processQueue()
  }
}, 2000)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
