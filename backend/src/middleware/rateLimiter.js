import rateLimit from 'express-rate-limit';

// Strict limiter for authentication (login/register) to prevent brute force
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 login/register attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please try again after 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

// Limiter for AI analysis endpoint to prevent quota draining
export const aiAnalysisLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30, // Limit each IP to 30 AI inspections per 10 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'AI analysis request limit reached. Please wait a few minutes before submitting more images.',
    code: 'AI_RATE_LIMIT_EXCEEDED'
  }
});

// General API rate limiter
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP. Please try again later.',
    code: 'API_RATE_LIMIT_EXCEEDED'
  }
});
