// Rate limiting with optional persistent storage via Supabase
// Falls back to in-memory if Supabase is not configured or fails

import { createClient } from '@supabase/supabase-js';

const rateLimitStore = new Map();
const emailSubmissionStore = new Map();

// Check if persistent rate limiting is available
function getSupabaseClient() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    return createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }
  return null;
}

// Clean up old entries periodically (for in-memory fallback)
setInterval(() => {
  const now = Date.now();

  // Clean rate limit store (entries older than 1 minute)
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.windowStart > 60000) {
      rateLimitStore.delete(key);
    }
  }

  // Clean email submission store (entries older than 24 hours)
  for (const [key, data] of emailSubmissionStore.entries()) {
    if (now - data.windowStart > 24 * 60 * 60 * 1000) {
      emailSubmissionStore.delete(key);
    }
  }
}, 60000); // Clean every minute

/**
 * Get client IP from request
 * Handles Vercel's x-forwarded-for header
 */
export function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for can be comma-separated, take the first one
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

/**
 * Rate limit by IP address with optional persistent storage
 * @param {string} ip - Client IP address
 * @param {string} endpoint - Endpoint identifier (e.g., 'chat', 'leads')
 * @param {number} maxRequests - Max requests per window
 * @param {number} windowMs - Window size in milliseconds (default: 60000 = 1 minute)
 * @returns {Promise<{ allowed: boolean, remaining: number, resetIn: number }>}
 */
export async function checkRateLimitPersistent(ip, endpoint, maxRequests, windowMs = 60000) {
  const supabase = getSupabaseClient();
  const key = `${ip}:${endpoint}`;
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  if (supabase) {
    try {
      // Count requests in the current window from persistent storage
      const { count, error } = await supabase
        .from('rate_limits')
        .select('*', { count: 'exact', head: true })
        .eq('key', key)
        .eq('endpoint', endpoint)
        .gte('created_at', windowStart.toISOString());

      if (error) throw error;

      const currentCount = count || 0;

      // Insert new rate limit entry
      await supabase.from('rate_limits').insert({
        key,
        endpoint,
        created_at: now.toISOString()
      });

      const remaining = Math.max(0, maxRequests - currentCount - 1);
      const resetIn = Math.ceil(windowMs / 1000);

      return {
        allowed: currentCount < maxRequests,
        remaining,
        resetIn
      };
    } catch (error) {
      console.error('Persistent rate limit error, falling back to in-memory:', error);
      // Fall back to in-memory
    }
  }

  // In-memory fallback
  return checkRateLimit(ip, endpoint, maxRequests, windowMs);
}

/**
 * Rate limit by IP address (in-memory only, synchronous)
 * @param {string} ip - Client IP address
 * @param {string} endpoint - Endpoint identifier (e.g., 'chat', 'leads')
 * @param {number} maxRequests - Max requests per window
 * @param {number} windowMs - Window size in milliseconds (default: 60000 = 1 minute)
 * @returns {{ allowed: boolean, remaining: number, resetIn: number }}
 */
export function checkRateLimit(ip, endpoint, maxRequests, windowMs = 60000) {
  const key = `${ip}:${endpoint}`;
  const now = Date.now();

  let data = rateLimitStore.get(key);

  if (!data || now - data.windowStart > windowMs) {
    // New window
    data = { windowStart: now, count: 0 };
  }

  data.count++;
  rateLimitStore.set(key, data);

  const remaining = Math.max(0, maxRequests - data.count);
  const resetIn = Math.ceil((data.windowStart + windowMs - now) / 1000);

  return {
    allowed: data.count <= maxRequests,
    remaining,
    resetIn
  };
}

/**
 * Rate limit lead submissions by email address with optional persistent storage
 * @param {string} email - Email address (lowercased)
 * @param {number} maxPerDay - Max submissions per day (default: 3)
 * @returns {Promise<{ allowed: boolean, remaining: number }>}
 */
export async function checkEmailRateLimitPersistent(email, maxPerDay = 3) {
  const supabase = getSupabaseClient();
  const key = `email:${email.toLowerCase()}`;
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const windowStart = new Date(now.getTime() - dayMs);

  if (supabase) {
    try {
      const { count, error } = await supabase
        .from('rate_limits')
        .select('*', { count: 'exact', head: true })
        .eq('key', key)
        .eq('endpoint', 'email_submission')
        .gte('created_at', windowStart.toISOString());

      if (error) throw error;

      const currentCount = count || 0;

      // Insert new entry
      await supabase.from('rate_limits').insert({
        key,
        endpoint: 'email_submission',
        created_at: now.toISOString()
      });

      return {
        allowed: currentCount < maxPerDay,
        remaining: Math.max(0, maxPerDay - currentCount - 1)
      };
    } catch (error) {
      console.error('Persistent email rate limit error, falling back to in-memory:', error);
    }
  }

  return checkEmailRateLimit(email, maxPerDay);
}

/**
 * Rate limit lead submissions by email address (in-memory)
 * @param {string} email - Email address (lowercased)
 * @param {number} maxPerDay - Max submissions per day (default: 3)
 * @returns {{ allowed: boolean, remaining: number }}
 */
export function checkEmailRateLimit(email, maxPerDay = 3) {
  const key = email.toLowerCase();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  let data = emailSubmissionStore.get(key);

  if (!data || now - data.windowStart > dayMs) {
    // New day window
    data = { windowStart: now, count: 0 };
  }

  data.count++;
  emailSubmissionStore.set(key, data);

  return {
    allowed: data.count <= maxPerDay,
    remaining: Math.max(0, maxPerDay - data.count)
  };
}

/**
 * Create rate limit response headers
 * @param {number} remaining - Remaining requests
 * @param {number} resetIn - Seconds until reset
 * @returns {Object} Headers object
 */
export function rateLimitHeaders(remaining, resetIn) {
  return {
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(resetIn),
    'Retry-After': String(resetIn)
  };
}

/**
 * Middleware-style rate limiter for Vercel serverless
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {string} endpoint - Endpoint identifier
 * @param {number} maxRequests - Max requests per minute
 * @returns {boolean} - Returns true if request should continue, false if rate limited
 */
export function rateLimit(req, res, endpoint, maxRequests) {
  const ip = getClientIP(req);
  const result = checkRateLimit(ip, endpoint, maxRequests);

  if (!result.allowed) {
    const headers = rateLimitHeaders(result.remaining, result.resetIn);
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded. Please try again in ${result.resetIn} seconds.`,
      retryAfter: result.resetIn
    });
    return false;
  }

  return true;
}

/**
 * Check for honeypot field (bot detection)
 * @param {Object} body - Request body
 * @param {string} fieldName - Honeypot field name (default: 'website')
 * @returns {boolean} - Returns true if likely a bot
 */
export function isLikelyBot(body, fieldName = 'website') {
  // If honeypot field is filled, it's likely a bot
  if (body[fieldName] && body[fieldName].trim() !== '') {
    return true;
  }
  return false;
}

export default {
  getClientIP,
  checkRateLimit,
  checkRateLimitPersistent,
  checkEmailRateLimit,
  checkEmailRateLimitPersistent,
  rateLimitHeaders,
  rateLimit,
  isLikelyBot
};
