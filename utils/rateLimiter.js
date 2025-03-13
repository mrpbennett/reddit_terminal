/**
 * Simple rate limiter utility for Reddit API calls
 */

// Singleton for tracking API requests across endpoints
class RedditRateLimiter {
  constructor() {
    this.lastRequestTime = 0
    this.requestCount = 0
    this.resetTime = Date.now() + 60000 // Reset counter every minute
    this.maxRequestsPerMinute = 30 // More conservative: 30 requests per minute
    this.minRequestInterval = 2000 // Min 2 seconds between requests
    this.requestQueue = []
    this.isProcessing = false
  }

  async limit() {
    const now = Date.now()

    // Reset counter if we've passed the reset time
    if (now > this.resetTime) {
      this.requestCount = 0
      this.resetTime = now + 60000
    }

    // Check if we need to enforce time between requests
    const timeSinceLastRequest = now - this.lastRequestTime
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest
      console.log(`Rate limiter: Waiting ${waitTime}ms between requests`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }

    // Check if we're approaching the rate limit
    if (this.requestCount >= this.maxRequestsPerMinute * 0.8) {
      const waitTime = Math.max(5000, this.minRequestInterval * 3)
      console.log(
        `Rate limit approaching (${this.requestCount}/${this.maxRequestsPerMinute}), waiting ${waitTime}ms`,
      )
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }

    // If we've hit the maximum, wait until the next reset period
    if (this.requestCount >= this.maxRequestsPerMinute) {
      const timeToReset = this.resetTime - now
      console.log(`Rate limit reached, waiting ${timeToReset}ms until reset`)
      await new Promise(resolve => setTimeout(resolve, timeToReset + 1000)) // Add 1s buffer
      this.requestCount = 0
      this.resetTime = Date.now() + 60000
    }

    // Update tracking
    this.lastRequestTime = Date.now()
    this.requestCount++

    return true
  }
}

// Export singleton instance
const rateLimiter = new RedditRateLimiter()
export default rateLimiter
