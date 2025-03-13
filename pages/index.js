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
  if (!timeValue) {
    return 0
  }

  try {
    // If it's already a timestamp
    if (typeof timeValue === 'number') {
      return timeValue
    }

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

        if (unit.includes('second')) {
          return now.getTime() - value * 1000
        }
        if (unit.includes('minute')) {
          return now.getTime() - value * 60 * 1000
        }
        if (unit.includes('hour')) {
          return now.getTime() - value * 60 * 60 * 1000
        }
        if (unit.includes('day')) {
          return now.getTime() - value * 24 * 60 * 60 * 1000
        }
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
  // New state for selected post and comments
  const [selectedPost, setSelectedPost] = useState(null)
  const [loadingComments, setLoadingComments] = useState(false)

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

  // Function to fetch post details and comments
  const fetchPostDetails = async permalink => {
    try {
      setLoadingComments(true)
      setError(null) // Clear any previous errors

      console.log('Fetching post details for:', permalink)
      const response = await fetch(
        `/api/post-details?permalink=${encodeURIComponent(permalink)}`,
      )

      console.log('Response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          `HTTP error! Status: ${response.status}. ${errorData.error || ''}`,
        )
      }

      const data = await response.json()
      console.log('Received post details:', data)
      setSelectedPost(data)
    } catch (err) {
      console.error('Error fetching post details:', err)
      setError(`Failed to load post details: ${err.message}`)
      setSelectedPost(null) // Clear any partial data
    } finally {
      setLoadingComments(false)
    }
  }

  // Function to handle post click
  const handlePostClick = (e, permalink) => {
    e.preventDefault()
    fetchPostDetails(permalink)
  }

  // Function to close the selected post panel
  const closePostDetails = () => {
    setSelectedPost(null)
  }

  // Format the lastUpdated time only on client
  const formattedLastUpdated =
    isClient && lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : null

  console.log(selectedPost)

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="px-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-amber-500 font-mono text-2xl font-bold">
            REDDIT TERMINAL
          </h1>

          <div className="text-gray-600 font-mono text-xs mt-2">
            Last Update @{' '}
            {isClient && formattedLastUpdated ? formattedLastUpdated : 'N/A'}
          </div>
        </div>

        {loading && <p className="text-amber-500 font-mono">Loading data...</p>}
        {error && <p className="text-red-500 font-mono">{error}</p>}

        <div className="flex">
          {/* Posts list column - make it take only part of the screen when a post is selected */}
          <div
            className={`overflow-x-auto ${selectedPost ? 'w-1/2' : 'w-full'}`}
          >
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
                            onClick={e => handlePostClick(e, post.permalink)}
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

          {/* Post details and comments panel */}
          {selectedPost && (
            <div
              className="w-1/2 pl-4 overflow-y-auto"
              style={{maxHeight: 'calc(100vh - 150px)'}}
            >
              <div className="bg-gray-900 border border-gray-700 rounded">
                {/* Post detail header */}
                <div className="bg-gray-800 p-3 flex justify-between items-center">
                  <h2 className="text-amber-500 font-mono font-bold text-lg truncate">
                    <a href={selectedPost.url} className="hover:underline">
                      {selectedPost.title}
                    </a>
                  </h2>
                  <button
                    onClick={closePostDetails}
                    className="text-gray-500 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                {/* Post content */}
                <div className="p-3 border-b border-gray-700">
                  <div className="flex justify-between text-xs text-gray-500 font-mono mb-2">
                    <span>{selectedPost.subreddit}</span>
                    <span>Posted by {selectedPost.author}</span>
                  </div>

                  {loadingComments ? (
                    <p className="text-amber-500 font-mono text-center py-4">
                      Loading content...
                    </p>
                  ) : (
                    <div className="text-white font-mono text-sm whitespace-pre-wrap mt-2">
                      {selectedPost.selftext || 'No text content available'}
                    </div>
                  )}
                </div>

                {/* Comments section */}
                <div className="p-2">
                  <h3 className="text-gray-400 font-mono text-xs mb-2 border-b border-gray-700 pb-1">
                    COMMENTS
                  </h3>

                  {loadingComments ? (
                    <p className="text-amber-500 font-mono text-center py-4">
                      Loading comments...
                    </p>
                  ) : selectedPost.comments &&
                    selectedPost.comments.length > 0 ? (
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {selectedPost.comments.map((comment, i) => (
                        <div
                          key={i}
                          className="font-mono text-xs border-l-2 border-gray-700 pl-2"
                        >
                          <div className="text-gray-500 mb-1">
                            {comment.author} •{' '}
                            {comment.time_ago || 'unknown time'}
                          </div>
                          <div className="text-white whitespace-pre-wrap">
                            {comment.body}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 font-mono text-center py-2">
                      No comments available
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="text-gray-600 font-mono text-xs mt-2">
          Press F1-HELP | F2-REFRESH | F3-FILTER | Last Cache Update:{' '}
          {isClient && formattedLastUpdated ? formattedLastUpdated : 'N/A'}
        </div>
      </div>
    </div>
  )
}
