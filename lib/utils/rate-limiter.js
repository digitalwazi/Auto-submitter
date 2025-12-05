// Rate limiter to avoid getting blocked

class RateLimiter {
    constructor(minDelay = 1000, maxDelay = 3000) {
        this.minDelay = minDelay
        this.maxDelay = maxDelay
        this.lastRequest = 0
    }

    async wait() {
        const now = Date.now()
        const timeSinceLastRequest = now - this.lastRequest
        const randomDelay = Math.floor(Math.random() * (this.maxDelay - this.minDelay + 1)) + this.minDelay

        if (timeSinceLastRequest < randomDelay) {
            const waitTime = randomDelay - timeSinceLastRequest
            await new Promise(resolve => setTimeout(resolve, waitTime))
        }

        this.lastRequest = Date.now()
    }

    setDelay(min, max) {
        this.minDelay = min
        this.maxDelay = max
    }
}

export default RateLimiter
