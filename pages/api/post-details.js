import rateLimiter from '../../utils/rateLimiter'

// Local in-memory cache
const postCache = new Map()
const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes in milliseconds

// Global rate limit tracking
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL = 3000 // 3 seconds between requests - increased from 2s

export default async function handler(req, res) {
  const {permalink} = req.query

  if (!permalink) {
    return res.status(400).json({error: 'Permalink is required'})
  }

  // Check cache first
  const cacheKey = permalink
  const cachedData = postCache.get(cacheKey)
  const now = Date.now()

  if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
    console.log(`Using cached data for ${permalink}`)
    return res.status(200).json(cachedData.data)
  }

  try {
    // Use the rateLimiter utility
    await rateLimiter.limit()

    // Additional internal rate limiting
    const timeSinceLastRequest = now - lastRequestTime
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest
      console.log(`Rate limiting: Waiting ${waitTime}ms before making request`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }

    // Update last request time
    lastRequestTime = Date.now()

    // Reddit's JSON API
    const url = `${permalink}.json`

    console.log(`Fetching post data from Reddit: ${permalink}`)

    // Make the request with better headers
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; Reddit Terminal/1.0; +http://localhost)',
        Accept: 'application/json',
        Connection: 'keep-alive',
      },
      // Adding a timeout
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    // Handle rate limiting from Reddit
    if (response.status === 429) {
      console.log('Reddit API rate limit reached, waiting longer before retry')
      // Wait for 30 seconds and let the client retry
      await new Promise(resolve => setTimeout(resolve, 30000)) // 30 seconds
      return res.status(429).json({
        error: 'Rate limit reached',
        message: 'Please try again in a moment',
        retryAfter: 30, // tell client to wait 30 seconds
      })
    }

    if (!response.ok) {
      throw new Error(`Reddit API returned status: ${response.status}`)
    }

    const responseData = await response.json()

    // Validate the response structure
    if (!Array.isArray(responseData) || responseData.length < 2) {
      console.error(
        'Invalid Reddit API response structure:',
        JSON.stringify(responseData).substring(0, 200),
      )
      return res
        .status(500)
        .json({error: 'Invalid response format from Reddit API'})
    }

    // Make sure the expected data is available
    if (!responseData[0]?.data?.children?.[0]?.data) {
      console.error('Missing post data in Reddit API response')
      return res
        .status(500)
        .json({error: 'Post data not found in Reddit API response'})
    }

    const postData = responseData[0].data.children[0].data
    const commentsData = responseData[1].data.children || []

    // Format post details and decode HTML entities for better markdown rendering
    const post = {
      title: decodeHtmlEntities(postData.title || 'Untitled Post'),
      author: postData.author || '[deleted]',
      selftext: decodeHtmlEntities(postData.selftext || ''),
      selftext_html: postData.selftext_html || '',
      score: postData.score,
      subreddit: `r/${postData.subreddit}`,
      created_utc: postData.created_utc,
      url: postData.url,
      is_self: postData.is_self,
      comments: [],
    }

    // Process comments with the new recursive function
    post.comments = commentsData
      .map(child => processComments(child))
      .filter(comment => comment !== null)
      .slice(0, 25) // Limit to 25 top-level comments to manage payload size

    // Store in cache
    postCache.set(cacheKey, {
      timestamp: now,
      data: post,
    })

    console.log(`Cached post details for: ${permalink}`)
    res.status(200).json(post)
  } catch (error) {
    console.error('Error fetching post details:', error)
    return res.status(500).json({
      error: 'Failed to fetch post details',
      message: error.message,
    })
  }
}

// Function to decode HTML entities in markdown content
function decodeHtmlEntities(text) {
  if (!text) {
    return ''
  }

  // Replace common HTML entities
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x200B;/g, '') // Zero width space often used in Reddit markdown
}

// Function to format time ago string
function formatTimeAgo(timestamp) {
  if (!timestamp) {
    return 'unknown time'
  }

  const seconds = Math.floor(Date.now() / 1000 - timestamp)

  if (seconds < 60) {
    return `${seconds} seconds ago`
  }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  }

  const days = Math.floor(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

// Function to process comments recursively
function processComments(commentData, depth = 0, maxDepth = 3) {
  if (!commentData || commentData.kind !== 't1' || !commentData.data) {
    return null
  }

  // Skip stickied comments
  if (commentData.data.stickied) {
    return null
  }

  const comment = {
    author: commentData.data.author || '[deleted]',
    body: decodeHtmlEntities(commentData.data.body || '[deleted]'),
    score: commentData.data.score || 0,
    time_ago: formatTimeAgo(commentData.data.created_utc),
    id: commentData.data.id,
    replies: [],
  }

  // Process replies if they exist and we haven't reached max depth
  if (
    depth < maxDepth &&
    commentData.data.replies &&
    commentData.data.replies.data &&
    commentData.data.replies.data.children
  ) {
    comment.replies = commentData.data.replies.data.children
      .map(child => processComments(child, depth + 1, maxDepth))
      .filter(reply => reply !== null)
  }

  return comment
}
