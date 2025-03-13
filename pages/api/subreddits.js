export default async function handler(req, res) {
  try {
    // Try to fetch from your actual API if it's running
    try {
      const apiResponse = await fetch('http://localhost:3001/subreddits', {
        timeout: 2000, // 2 second timeout
      })

      if (apiResponse.ok) {
        const data = await apiResponse.json()

        // Ensure every post has a proper timestamp before returning
        if (data.posts && Array.isArray(data.posts)) {
          // Clean up any time formatting issues in the API response
          data.posts = data.posts.map(post => ({
            ...post,
            time_ago: post.time_ago || new Date().toISOString(),
          }))
        }

        console.log('API returned data with posts:', data.posts?.length)
        return res.status(200).json(data)
      }
    } catch (e) {
      console.log('External API unavailable, using fallback data', e)
    }

    // Current time and various times ago for mock data
    const now = new Date()
    const minutes10Ago = new Date(now - 10 * 60 * 1000)
    const minutes30Ago = new Date(now - 30 * 60 * 1000)
    const oneHourAgo = new Date(now - 60 * 60 * 1000)
    const twoHoursAgo = new Date(now - 2 * 60 * 1000)

    // Fallback mock data if API is not available
    const mockData = {
      posts: [
        {
          time_ago: now.toISOString(),
          subreddit: 'javascript',
          title: 'Most recent post - should appear first',
          author: 'system',
          permalink: 'https://reddit.com/r/javascript',
        },
        {
          time_ago: minutes10Ago.toISOString(),
          subreddit: 'nextjs',
          title: 'This post should be second - 10 min ago',
          author: 'system',
          permalink: 'https://reddit.com/r/nextjs',
        },
        {
          time_ago: minutes30Ago.toISOString(),
          subreddit: 'typescript',
          title: 'This post should be third - 30 min ago',
          author: 'system',
          permalink: 'https://reddit.com/r/typescript',
        },
        {
          time_ago: oneHourAgo.toISOString(),
          subreddit: 'reactjs',
          title: 'This post should be fourth - 1 hour ago',
          author: 'system',
          permalink: 'https://reddit.com/r/reactjs',
        },
        {
          time_ago: twoHoursAgo.toISOString(),
          subreddit: 'programming',
          title: 'This post should be last - 2 hours ago',
          author: 'system',
          permalink: 'https://reddit.com/r/programming',
        },
      ],
      lastUpdated: now.toISOString(),
    }

    console.log('Returning mock data with posts:', mockData.posts.length)
    return res.status(200).json(mockData)
  } catch (error) {
    console.error('API handler error:', error)
    return res.status(500).json({error: 'Failed to fetch data'})
  }
}
