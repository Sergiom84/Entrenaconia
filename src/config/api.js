const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: `${API_BASE_URL}/api/auth/login`,
    REGISTER: `${API_BASE_URL}/api/auth/register`,
    LOGOUT: `${API_BASE_URL}/api/auth/logout`,
    SESSIONS: `${API_BASE_URL}/api/auth/sessions`,
    SESSIONS_HISTORY: `${API_BASE_URL}/api/auth/sessions/history`,
    SESSIONS_STATS: `${API_BASE_URL}/api/auth/sessions/stats`,
    LOGOUT_ALL: `${API_BASE_URL}/api/auth/sessions/logout-all`
  },
  USER: {
    PROFILE: `${API_BASE_URL}/api/users/profile`,
    UPDATE_PROFILE: `${API_BASE_URL}/api/users/profile`
  },
  ROUTINES: {
    ACTIVE_PLAN: `${API_BASE_URL}/api/routines/active-plan`,
    SESSIONS: `${API_BASE_URL}/api/routines/sessions`,
    CONFIRM_PLAN: `${API_BASE_URL}/api/routines/confirm-plan`
  },
  METHODOLOGIES: {
    GENERATE: `${API_BASE_URL}/api/methodologie/generate`,
    LIST: `${API_BASE_URL}/api/methodologie/list`
  },
  HOME_TRAINING: {
    GENERATE: `${API_BASE_URL}/api/home-training/generate`,
    SESSIONS: `${API_BASE_URL}/api/home-training/sessions`
  }
};

export const API_CONFIG = {
  TIMEOUT: 10000,
  HEADERS: {
    'Content-Type': 'application/json'
  }
};

export default API_ENDPOINTS;