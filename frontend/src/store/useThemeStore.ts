import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    setTheme: (theme: 'light' | 'dark') => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            theme: 'light',
            toggleTheme: () => set((state) => {
                const newTheme = state.theme === 'light' ? 'dark' : 'light';
                if (newTheme === 'dark') {
                    document.documentElement.setAttribute('data-theme', 'dark');
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.removeAttribute('data-theme');
                    document.documentElement.classList.remove('dark');
                }
                return { theme: newTheme };
            }),
            setTheme: (theme) => set(() => {
                if (theme === 'dark') {
                    document.documentElement.setAttribute('data-theme', 'dark');
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.removeAttribute('data-theme');
                    document.documentElement.classList.remove('dark');
                }
                return { theme };
            }),
        }),
        {
            name: 'theme-storage',
            onRehydrateStorage: () => (state) => {
                if (state) {
                    if (state.theme === 'dark') {
                        document.documentElement.setAttribute('data-theme', 'dark');
                        document.documentElement.classList.add('dark');
                    } else {
                        document.documentElement.removeAttribute('data-theme');
                        document.documentElement.classList.remove('dark');
                    }
                }
            },
        }
    )
);

// Initialize theme immediately to prevent flashing
if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('theme-storage');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (parsed.state?.theme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
                document.documentElement.classList.add('dark');
            }
        } catch (e) {
            // Ignore parse errors
        }
    }
}
