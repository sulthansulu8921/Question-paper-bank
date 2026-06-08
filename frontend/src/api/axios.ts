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
    (response) => response,
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
