import {useEffect, useState} from 'react'
import ReactMarkdown from 'react-markdown'

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

// Function to make external links safe
const linkRenderer = ({href, children}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="text-amber-500 hover:underline"
  >
    {children}
  </a>
)

// Comment component that recursively renders itself and its replies
const Comment = ({comment, depth = 0}) => {
  const maxDepth = 5 // Prevent excessive nesting
  const indentSize = 20 // Indent size for nested comments

  return (
    <div className="font-mono text-xs mb-3">
      {/* Comment content with simple indentation */}
      <div
        className="relative"
        style={{
          marginLeft: depth * indentSize,
        }}
      >
        {/* Comment content */}
        <div className="bg-gray-800 rounded p-3 border-l-2 border-gray-700">
          <div className="text-gray-400 mb-2 flex justify-between items-center">
            <span className="font-bold text-amber-500">{comment.author}</span>
            <span className="text-xs">
              {comment.time_ago || 'unknown time'}
            </span>
          </div>
          <div className="text-white markdown-body">
            <ReactMarkdown
              components={{
                a: linkRenderer,
                p: ({node, ...props}) => <p className="mb-1" {...props} />,
              }}
            >
              {comment.body}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      {/* Render replies if they exist and we're not at max depth */}
      {comment.replies && comment.replies.length > 0 && depth < maxDepth && (
        <div className="mt-2">
          {comment.replies.map((reply, i) => (
            <Comment key={reply.id || i} comment={reply} depth={depth + 1} />
          ))}
        </div>
      )}

      {/* Show a "more replies" indicator if we've hit max depth but there are more */}
      {comment.replies && comment.replies.length > 0 && depth >= maxDepth && (
        <div
          className="mt-2 p-2 bg-gray-800 rounded text-gray-400 text-xs italic"
          style={{marginLeft: (depth + 1) * indentSize}}
        >
          {comment.replies.length} more{' '}
          {comment.replies.length === 1 ? 'reply' : 'replies'} ↓
        </div>
      )}
    </div>
  )
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
  // Add last click tracking to prevent rapid clicks
  const [lastClickTime, setLastClickTime] = useState(0)
  const CLICK_COOLDOWN = 3000 // 3 seconds cooldown between clicks

  // Update the main data fetching function to also implement rate limiting
  useEffect(() => {
    const fetchData = async (retryCount = 0) => {
      const MAX_RETRIES = 3
      const RETRY_DELAY = 3000 // 3 seconds

      try {
        setLoading(true)
        // Make sure this path is correct - it should match what's in your API route
        const response = await fetch('/api/subreddits')

        console.log('response', response)

        // Handle rate limiting
        if (response.status === 429 && retryCount < MAX_RETRIES) {
          console.log(
            `Rate limit reached. Retrying in ${RETRY_DELAY / 1000} seconds...`,
          )
          // Wait and then retry
          setTimeout(() => fetchData(retryCount + 1), RETRY_DELAY)
          return
        }

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
            comments: post.comments,
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

  // Updated function to fetch post details with better retry logic
  const fetchPostDetails = async (permalink, retryCount = 0) => {
    const MAX_RETRIES = 5 // Increase max retries
    const RETRY_DELAY = 5000 // Increase delay to 5 seconds

    try {
      setLoadingComments(true)
      setError(null) // Clear any previous errors

      console.log('Fetching post details for:', permalink)
      const response = await fetch(
        `/api/post-details?permalink=${encodeURIComponent(permalink)}`,
      )

      console.log('Response status:', response.status)

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter =
          parseInt(response.headers.get('Retry-After'), 10) * 1000 ||
          RETRY_DELAY

        if (retryCount < MAX_RETRIES) {
          const waitTime = Math.max(retryAfter, RETRY_DELAY * (retryCount + 1))
          setError(
            `Rate limit reached. Retrying in ${Math.ceil(
              waitTime / 1000,
            )} seconds...`,
          )
          // Wait and then retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, waitTime))
          return fetchPostDetails(permalink, retryCount + 1)
        } else {
          throw new Error('Rate limit exceeded. Please try again later.')
        }
      }

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

  // Updated function to handle post click with cooldown
  const handlePostClick = (e, permalink) => {
    e.preventDefault()

    const now = Date.now()
    if (now - lastClickTime < CLICK_COOLDOWN) {
      console.log(
        `Click cooldown active. Please wait ${
          CLICK_COOLDOWN / 1000
        }s between clicks.`,
      )
      setError(`Please wait a moment before clicking another post.`)
      return
    }

    setLastClickTime(now)
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
                <div className="col-span-5">TITLE</div>
                <div className="col-span-2 text-center">COMMENTS</div>
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
                        <div className="col-span-5 text-white font-medium truncate">
                          <a
                            href={post.permalink}
                            onClick={e => handlePostClick(e, post.permalink)}
                            className="hover:underline"
                          >
                            {post.title}
                          </a>
                        </div>
                        <div className="col-span-2 text-gray-500 text-center">
                          {post.comments}
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
                    <a
                      href={selectedPost.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
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
                    <div className="text-white font-mono text-sm mt-2 markdown-body">
                      {selectedPost.selftext ? (
                        <ReactMarkdown
                          components={{
                            a: linkRenderer,
                            // Style other elements as needed
                            p: ({node, ...props}) => (
                              <p className="mb-2" {...props} />
                            ),
                            h1: ({node, ...props}) => (
                              <h1
                                className="text-xl font-bold mb-2"
                                {...props}
                              />
                            ),
                            h2: ({node, ...props}) => (
                              <h2
                                className="text-lg font-bold mb-2"
                                {...props}
                              />
                            ),
                            ul: ({node, ...props}) => (
                              <ul className="list-disc pl-5 mb-2" {...props} />
                            ),
                            ol: ({node, ...props}) => (
                              <ol
                                className="list-decimal pl-5 mb-2"
                                {...props}
                              />
                            ),
                            blockquote: ({node, ...props}) => (
                              <blockquote
                                className="border-l-4 border-gray-500 pl-2 italic my-2"
                                {...props}
                              />
                            ),
                            code: ({node, ...props}) => (
                              <code
                                className="bg-gray-800 px-1 rounded"
                                {...props}
                              />
                            ),
                            pre: ({node, ...props}) => (
                              <pre
                                className="bg-gray-800 p-2 rounded my-2 overflow-x-auto"
                                {...props}
                              />
                            ),
                          }}
                        >
                          {selectedPost.selftext}
                        </ReactMarkdown>
                      ) : (
                        'No text content available'
                      )}
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
                    <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                      {selectedPost.comments.map((comment, i) => (
                        <Comment
                          key={comment.id || i}
                          comment={comment}
                          depth={0}
                        />
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
