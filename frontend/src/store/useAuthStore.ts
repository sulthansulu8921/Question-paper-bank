import { create } from 'zustand'
import api from '../api/axios'

interface AuthState {
    user: any | null;
    token: string | null;
    isHydrating: boolean;
    setAuth: (user: any, token: string) => void;
    logout: () => void;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, mobile: string, email: string, password: string, otp: string, selectedCourseId?: string) => Promise<void>;
    googleLogin: (credential: string, selectedCourseId?: string) => Promise<void>;
    updateProfile: (data: any) => Promise<void>;
    hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    token: localStorage.getItem('token'),
    isHydrating: true,
    setAuth: (user, token) => {
        localStorage.setItem('token', token);
        set({ user, token, isHydrating: false });
    },
    logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null, isHydrating: false });
    },
    login: async (email, password) => {
        const response = await api.post('/auth/login/', { email, password });
        const { access } = response.data;

        // Fetch full profile info including settings
        const profileResponse = await api.get('/auth/profile/', { headers: { Authorization: `Bearer ${access}` } });

        localStorage.setItem('token', access);
        set({ user: profileResponse.data, token: access, isHydrating: false });
    },
    googleLogin: async (credential: string, selectedCourseId?: string) => {
        const response = await api.post('/auth/google/', {
            token: credential,
            selected_course: selectedCourseId ? parseInt(selectedCourseId) : undefined
        });
        const { access } = response.data;

        // Fetch full profile info including settings
        const profileResponse = await api.get('/auth/profile/', { headers: { Authorization: `Bearer ${access}` } });

        localStorage.setItem('token', access);
        set({ user: profileResponse.data, token: access, isHydrating: false });
    },
    register: async (full_name, mobile, email, password, otp, selectedCourseId) => {
        const parts = full_name.split(' ');
        const first_name = parts[0] || '';
        const last_name = parts.slice(1).join(' ') || '';
        const response = await api.post('/auth/register/', {
            first_name,
            last_name,
            mobile_number: mobile,
            email,
            password,
            otp,
            selected_course: selectedCourseId ? parseInt(selectedCourseId) : undefined
        });
        const { access } = response.data;

        // Fetch full profile info including settings
        const profileResponse = await api.get('/auth/profile/', { headers: { Authorization: `Bearer ${access}` } });

        localStorage.setItem('token', access);
        set({ user: profileResponse.data, token: access, isHydrating: false });
    },
    updateProfile: async (data: any) => {
        const { token } = get();
        if (!token) return;
        const response = await api.patch('/auth/profile/', data, {
            headers: { Authorization: `Bearer ${token}` }
        });
        set({ user: response.data });
    },
    hydrate: async () => {
        const { token } = get();
        if (!token) {
            set({ isHydrating: false });
            return;
        }
        try {
            const response = await api.get('/auth/profile/', {
                headers: { Authorization: `Bearer ${token}` }
            });
            set({ user: response.data, isHydrating: false });
        } catch (error) {
            console.error("Hydration failed", error);
            localStorage.removeItem('token');
            set({ user: null, token: null, isHydrating: false });
        }
    }
}))
