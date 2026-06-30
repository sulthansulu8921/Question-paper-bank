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
        const data = response.data;
        if (
            data !== null &&
            typeof data === 'object' &&
            !Array.isArray(data) &&
            Array.isArray(data.results) &&
            'count' in data
        ) {
            const results = data.results;
            // Attach DRF pagination metadata as custom properties on the array object
            Object.defineProperties(results, {
                count: { value: data.count, writable: true, enumerable: false },
                next: { value: data.next, writable: true, enumerable: false },
                previous: { value: data.previous, writable: true, enumerable: false },
                locked_count: { value: data.locked_count ?? 0, writable: true, enumerable: false },
                access_limit: { value: data.access_limit ?? -1, writable: true, enumerable: false },
                has_full_access: { value: data.has_full_access ?? true, writable: true, enumerable: false }
            });
            response.data = results;
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
                console.warn("Unauthorized request detected (401). Auto-logout is disabled per configuration to prevent losing unsaved work.");
            }
        }
        return Promise.reject(error);
    }
);

export default api;
