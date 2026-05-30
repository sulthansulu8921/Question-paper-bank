import { useState, useCallback } from 'react';
import '@/styles/admin/Modal.css';

export function useAdminToast() {
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const show = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    }, []);

    const Toast = toast ? (
        <div className={`admin-toast admin-toast-${toast.type}`}>
            {toast.type === 'success' ? '✓ ' : '✗ '}
            {toast.message}
        </div>
    ) : null;

    return { show, Toast };
}

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong.') {
    const err = error as { response?: { data?: Record<string, unknown> } };
    const data = err?.response?.data;
    if (!data) return fallback;
    if (typeof data.detail === 'string') return data.detail;
    if (typeof data.error === 'string') return data.error;
    const firstKey = Object.keys(data)[0];
    if (firstKey) {
        const val = data[firstKey];
        if (Array.isArray(val)) return `${firstKey}: ${val[0]}`;
        if (typeof val === 'string') return val;
    }
    return fallback;
}
