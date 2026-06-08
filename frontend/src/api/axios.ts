import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
});

api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => {
        // Transparently unwrap DRF paginated responses into plain arrays.
        // A paginated response has shape: { count, next, previous, results: [...] }
        // This runs on every GET response so all 40+ queryFns across the app
        // keep working without any per-file changes.
        const data = response.data;
        if (
            data !== null &&
            typeof data === 'object' &&
            !Array.isArray(data) &&
            Array.isArray(data.results) &&
            'count' in data
        ) {
            response.data = data.results;
        }
        return response;
    },
    (error) => {
        if (error.response && error.response.status === 401) {
            const url = error.config?.url || '';
            const isAuthEndpoint = url.includes('/auth/login/') ||
                                   url.includes('/auth/google/') ||
                                   url.includes('/auth/register/') ||
                                   url.includes('/auth/forgot-password/');
            if (!isAuthEndpoint) {
                useAuthStore.getState().logout();
                window.location.href = '/auth?tab=login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
