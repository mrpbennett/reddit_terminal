import {useEffect, useState} from 'react'

// Custom hook to prevent hydration mismatch
function useClientOnly() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  return isClient
}

// Helper function to parse various time formats
function parseTimeValue(timeValue) {
  if (!timeValue) return 0

  try {
    // If it's already a timestamp
    if (typeof timeValue === 'number') return timeValue

    // If it's an ISO string
    if (timeValue.includes('T') && timeValue.includes('Z')) {
      return new Date(timeValue).getTime()
    }

    // If it's a relative time string like "2 hours ago"
    if (typeof timeValue === 'string' && timeValue.includes('ago')) {
      const now = new Date()
      const timeMatch = timeValue.match(/(\d+)\s+(\w+)\s+ago/i)

      if (timeMatch) {
        const value = parseInt(timeMatch[1], 10)
        const unit = timeMatch[2].toLowerCase()

        if (unit.includes('second')) return now.getTime() - value * 1000
        if (unit.includes('minute')) return now.getTime() - value * 60 * 1000
        if (unit.includes('hour')) return now.getTime() - value * 60 * 60 * 1000
        if (unit.includes('day'))
          return now.getTime() - value * 24 * 60 * 60 * 1000
      }
    }

    // Default fallback - try direct Date parsing
    return new Date(timeValue).getTime()
  } catch (e) {
    console.error('Failed to parse time:', timeValue, e)
    return 0
  }
}

export default function Home() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const isClient = useClientOnly()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        // Make sure this path is correct - it should match what's in your API route
        const response = await fetch('/api/subreddits')

        console.log('response', response)

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`)
        }
        const data = await response.json()

        console.log('Received posts data:', data.posts)

        // Store raw data first and parse timestamps for sorting
        const formattedPosts = data.posts.map(post => {
          const timestamp = parseTimeValue(post.time_ago)

          return {
            timeRaw: post.time_ago,
            time: post.time_ago,
            timestamp: timestamp,
            subreddit: `r/${post.subreddit}`,
            title: post.title,
            author: post.author,
            permalink: post.permalink,
          }
        })

        console.log(
          'Formatted posts with timestamps:',
          formattedPosts.map(p => ({
            time: p.time,
            timestamp: p.timestamp,
            title: p.title.substring(0, 20),
          })),
        )

        // Sort posts by timestamp (newest first)
        const sortedPosts = formattedPosts.sort((a, b) => {
          return b.timestamp - a.timestamp
        })

        console.log(
          'Sorted posts:',
          sortedPosts.map(p => ({
            time: p.time,
            timestamp: p.timestamp,
            title: p.title.substring(0, 20),
          })),
        )

        setPosts(sortedPosts)
        setLastUpdated(data.lastUpdated) // Store raw timestamp
        setError(null)
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Failed to load posts. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    // Only fetch on the client-side
    if (isClient) {
      fetchData()

      // Set up polling every 60 seconds
      const intervalId = setInterval(fetchData, 60000)

      // Clean up interval on component unmount
      return () => clearInterval(intervalId)
    }
  }, [isClient])

  // Format the lastUpdated time only on client
  const formattedLastUpdated =
    isClient && lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : null

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-amber-500 font-mono text-2xl font-bold">
            REDDIT TERMINAL
          </h1>
          {/* {isClient && formattedLastUpdated && (
            <p className="text-gray-500 font-mono text-xs">
              Last updated: {formattedLastUpdated}
            </p>
          )} */}

          <div className="text-gray-600 font-mono text-xs mt-2">
            Last Update @{' '}
            {isClient && formattedLastUpdated ? formattedLastUpdated : 'N/A'}
          </div>
        </div>

        {loading && <p className="text-amber-500 font-mono">Loading data...</p>}
        {error && <p className="text-red-500 font-mono">{error}</p>}

        <div className="overflow-x-auto">
          <div className="bg-gray-900 border border-gray-700 rounded">
            {/* Header */}
            <div className="grid grid-cols-12 bg-gray-800 text-xs font-mono font-bold text-gray-400 p-2">
              <div className="col-span-1">TIME</div>
              <div className="col-span-2">SUBREDDIT</div>
              <div className="col-span-7">TITLE</div>
              <div className="col-span-2">AUTHOR</div>
            </div>

            {/* Data rows */}
            <div className="divide-y divide-gray-800">
              {isClient && posts.length > 0
                ? posts.map((post, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-12 p-2 text-sm font-mono hover:bg-gray-800 transition-colors"
                    >
                      <div className="col-span-1 text-gray-500">
                        {post.time}
                      </div>
                      <div className="col-span-2 text-amber-500">
                        {post.subreddit}
                      </div>
                      <div className="col-span-7 text-white font-medium truncate">
                        <a
                          href={post.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {post.title}
                        </a>
                      </div>
                      <div className="col-span-2 text-gray-500">
                        {post.author}
                      </div>
                    </div>
                  ))
                : !loading && (
                    <div className="p-4 text-center text-gray-500 font-mono">
                      No posts available
                    </div>
                  )}
            </div>
          </div>
        </div>

        <div className="text-gray-600 font-mono text-xs mt-2">
          Press F1-HELP | F2-REFRESH | F3-FILTER | Last Cache Update:{' '}
          {isClient && formattedLastUpdated ? formattedLastUpdated : 'N/A'}
        </div>
      </div>
    </div>
  )
}
