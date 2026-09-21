import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { ApiResponse } from '@codecollab/shared';

// Standard error response for rate-limited requests
const rateLimitResponse = (message: string): ApiResponse => ({
  success: false,
  message,
  error: 'RATE_LIMITED',
  timestamp: new Date().toISOString(),
});

/**
 * Strict Rate Limiter for Auth Routes (Login, Register)
 * Prevents credential stuffing & brute force attacks.
 */
export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Too many authentication attempts. Please try again after 15 minutes.'),
});

/**
 * Refresh Token Rate Limiter
 * Protects token rotation and prevents spam token issuance.
 */
export const refreshRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Too many token refresh requests. Please wait before refreshing again.'),
});

/**
 * Strict Rate Limiter for Code Submissions & Runs
 * Protects compute resources & external code runner services.
 */
export const submissionRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Code execution rate limit exceeded. Please wait a minute before submitting again.'),
});

/**
 * Moderate Rate Limiter for REST Room Chat Messages
 * Prevents chat spam and database flooding.
 */
export const chatRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Message rate limit exceeded. Please slow down your messages.'),
});

/**
 * Rate Limiter for Analytics & Leaderboard Queries
 * Protects heavy database aggregations and prevents resource starvation.
 */
export const analyticsRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Analytics query rate limit exceeded. Please wait a moment.'),
});

/**
 * Strict Rate Limiter for External Codeforces Imports
 * Prevents API abuse and third-party throttling.
 */
export const importRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Problem import rate limit exceeded. Please try again later.'),
});

/**
 * Relaxed General Rate Limiter for Standard API Endpoints
 */
export const generalRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitResponse('Too many requests. Please try again later.'),
});
