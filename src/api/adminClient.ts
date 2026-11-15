import axios from 'axios';
import { recordLoginAttempt } from '../services/adminSecurityService';
import { clearAdminSession, isTokenExpired } from '../utils/authSession';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const adminClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

adminClient.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('adminToken');
    if (token) {
      if (isTokenExpired(token)) {
        const currentUser = sessionStorage.getItem('adminName') || 'Unknown Counsel';
        const currentRole = sessionStorage.getItem('adminRole') || undefined;
        recordLoginAttempt({
          username: currentUser,
          resolvedRole: currentRole,
          status: 'SESSION_EXPIRED',
          reason: 'JWT expiration timestamp elapsed before API call',
        });
        clearAdminSession();
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(new Error('Session expired. Please sign in again.'));
      }
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

adminClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        const currentUser = sessionStorage.getItem('adminName') || 'Unknown Counsel';
        const currentRole = sessionStorage.getItem('adminRole') || undefined;
        recordLoginAttempt({
          username: currentUser,
          resolvedRole: currentRole,
          status: 'SESSION_EXPIRED',
          reason: 'Gateway returned HTTP 401 Unauthorized',
        });
        clearAdminSession();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
