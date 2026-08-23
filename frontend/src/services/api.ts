import axios from 'axios';

// Create an axios instance with base URL from environment variable
const api = axios.create({
  baseURL: import.meta.env.VITE_APP_API_URL || 'http://localhost:3001/api',
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle errors (optional)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 errors (token expired or invalid)
    if (error.response?.status === 401) {
      // Optionally, redirect to login page
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;