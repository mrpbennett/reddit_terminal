export default async function handler(req, res) {
  const {permalink} = req.query

  if (!permalink) {
    return res.status(400).json({error: 'Permalink is required'})
  }

  try {
    // Reddit's JSON API - add .json to the permalink URL
    const url = `${permalink}.json`

    // Replace axios with fetch
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Reddit Terminal/1.0)',
      },
    })

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

    // Format post details
    const post = {
      title: postData.title || 'Untitled Post',
      author: postData.author || '[deleted]',
      selftext: postData.selftext || '',
      selftext_html: postData.selftext_html || '',
      score: postData.score,
      subreddit: `r/${postData.subreddit}`,
      created_utc: postData.created_utc,
      url: postData.url,
      is_self: postData.is_self,
      comments: [],
    }

    // Format comments (excluding stickied comments and announcements)
    post.comments = commentsData
      .filter(
        child => child.kind === 't1' && child.data && !child.data.stickied,
      )
      .map(child => {
        const comment = child.data
        return {
          author: comment.author || '[deleted]',
          body: comment.body || '[deleted]',
          score: comment.score || 0,
          time_ago: formatTimeAgo(comment.created_utc),
          id: comment.id,
        }
      })
      .slice(0, 50) // Limit to 50 top-level comments

    res.status(200).json(post)
  } catch (error) {
    console.error('Error fetching post details:', error)
    return res.status(500).json({
      error: 'Failed to fetch post details',
      message: error.message,
    })
  }
}

// Function to format time ago string
function formatTimeAgo(timestamp) {
  if (!timestamp) return 'unknown time'

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
