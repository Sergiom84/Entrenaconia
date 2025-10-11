/**
 * API Configuration
 * Centralized configuration for all API-related settings
 */

const ENV = import.meta.env.MODE || 'development';

const config = {
  development: {
    API_BASE_URL: '/api',
    API_TIMEOUT: 10000,
    MAX_RETRIES: 2,
    RETRY_DELAY: 1000,
    TOKEN_REFRESH_THRESHOLD: 5 * 60 * 1000, // 5 minutes before expiry
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
    INACTIVITY_TIMEOUT: 15 * 60 * 1000, // 15 minutes
  },
  production: {
    API_BASE_URL: '/api',
    API_TIMEOUT: 15000,
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000,
    TOKEN_REFRESH_THRESHOLD: 5 * 60 * 1000,
    SESSION_TIMEOUT: 60 * 60 * 1000, // 1 hour
    INACTIVITY_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  },
  test: {
    API_BASE_URL: '/api',
    API_TIMEOUT: 5000,
    MAX_RETRIES: 0,
    RETRY_DELAY: 0,
    TOKEN_REFRESH_THRESHOLD: 5 * 60 * 1000,
    SESSION_TIMEOUT: 30 * 60 * 1000,
    INACTIVITY_TIMEOUT: 15 * 60 * 1000,
  }
};

// Export current environment config
export default config[ENV];

// Export specific endpoints
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    REGISTER: '/auth/register',
    VERIFY: '/auth/verify',
    RESET_PASSWORD: '/auth/reset-password'
  },

  // User endpoints
  USER: {
    PROFILE: '/users/profile',
    UPDATE_PROFILE: '/users/profile',
    PREFERENCES: '/users/preferences'
  },

  // Session endpoints
  SESSION: {
    VALIDATE: '/session/validate',
    HEARTBEAT: '/session/heartbeat'
  }
};

// Token storage keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER_DATA: 'userData',
  SESSION_ID: 'sessionId',
  LAST_ACTIVITY: 'lastActivity',

  // Legacy keys for backward compatibility
  LEGACY_TOKEN: 'token',
  LEGACY_AUTH_TOKEN: 'authToken',
  LEGACY_USER: 'user'
};

// Rate limiting configuration
export const RATE_LIMIT = {
  LOGIN_ATTEMPTS: 5,
  LOGIN_WINDOW: 15 * 60 * 1000, // 15 minutes
  LOCKOUT_DURATION: 30 * 60 * 1000 // 30 minutes
};