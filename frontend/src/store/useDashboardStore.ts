import { create } from 'zustand';
import api from '../api/axios';

interface DashboardState {
    stats: any | null;
    streak: any | null;
    achievements: any[];
    quote: any | null;
    exams: any[];
    assignments: any[];
    mockTests: any[];
    activityLogs: any[];
    leaderboard: any[];
    loading: boolean;
    error: string | null;

    fetchDashboardData: () => Promise<void>;
    recordStudyActivity: () => Promise<void>;
    addExam: (title: string, date: string, description?: string) => Promise<void>;
    deleteExam: (id: number) => Promise<void>;
    addAssignment: (title: string, due_date: string) => Promise<void>;
    toggleAssignment: (id: number, status: string) => Promise<void>;
    deleteAssignment: (id: number) => Promise<void>;
    addMockTest: (title: string, score: number, total_marks: number, date: string) => Promise<void>;
    deleteMockTest: (id: number) => Promise<void>;
    updateStudyHours: (hours: number) => Promise<void>;
    fetchLeaderboard: () => Promise<void>;
    adminAction: (userId: number, action: string, amount?: number) => Promise<any>;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
    stats: JSON.parse(localStorage.getItem('qubook_stats') || 'null'),
    streak: JSON.parse(localStorage.getItem('qubook_streak') || 'null'),
    achievements: JSON.parse(localStorage.getItem('qubook_achievements') || '[]'),
    quote: JSON.parse(localStorage.getItem('qubook_quote') || 'null'),
    exams: JSON.parse(localStorage.getItem('qubook_exams') || '[]'),
    assignments: JSON.parse(localStorage.getItem('qubook_assignments') || '[]'),
    mockTests: JSON.parse(localStorage.getItem('qubook_mock_tests') || '[]'),
    activityLogs: JSON.parse(localStorage.getItem('qubook_activity_logs') || '[]'),
    leaderboard: [],
    loading: false,
    error: null,

    fetchDashboardData: async () => {
        set({ loading: true, error: null });
        try {
            const [statsRes, streakRes, achRes, quoteRes, examsRes, assignRes, mockRes, logsRes] = await Promise.all([
                api.get('/gamification/stats/'),
                api.get('/gamification/streak/'),
                api.get('/gamification/achievements/'),
                api.get('/gamification/quote/'),
                api.get('/gamification/exams/'),
                api.get('/gamification/assignments/'),
                api.get('/gamification/mock-tests/'),
                api.get('/gamification/activity/'),
            ]);

            localStorage.setItem('qubook_stats', JSON.stringify(statsRes.data));
            localStorage.setItem('qubook_streak', JSON.stringify(streakRes.data));
            localStorage.setItem('qubook_achievements', JSON.stringify(achRes.data));
            localStorage.setItem('qubook_quote', JSON.stringify(quoteRes.data));
            localStorage.setItem('qubook_exams', JSON.stringify(examsRes.data));
            localStorage.setItem('qubook_assignments', JSON.stringify(assignRes.data));
            localStorage.setItem('qubook_mock_tests', JSON.stringify(mockRes.data));
            localStorage.setItem('qubook_activity_logs', JSON.stringify(logsRes.data));

            set({
                stats: statsRes.data,
                streak: streakRes.data,
                achievements: achRes.data,
                quote: quoteRes.data,
                exams: examsRes.data,
                assignments: assignRes.data,
                mockTests: mockRes.data,
                activityLogs: logsRes.data,
                loading: false
            });
        } catch (err: any) {
            console.error("Failed to load dashboard data from API, using offline cache if available", err);
            set({ loading: false, error: "Offline Mode: Showing cached data." });
        }
    },

    recordStudyActivity: async () => {
        try {
            const res = await api.post('/gamification/streak/');
            set({ streak: res.data });
            localStorage.setItem('qubook_streak', JSON.stringify(res.data));
            
            // Refresh stats since study activity rewards XP/Coins
            const statsRes = await api.get('/gamification/stats/');
            set({ stats: statsRes.data });
            localStorage.setItem('qubook_stats', JSON.stringify(statsRes.data));
        } catch (err) {
            console.error("Failed to record streak activity", err);
        }
    },

    addExam: async (title, date, description = "") => {
        try {
            const res = await api.post('/gamification/exams/', { title, date, description });
            const newExams = [...get().exams, res.data];
            set({ exams: newExams });
            localStorage.setItem('qubook_exams', JSON.stringify(newExams));
        } catch (err) {
            console.error("Failed to add exam", err);
        }
    },

    deleteExam: async (id) => {
        try {
            await api.delete(`/gamification/exams/${id}/`);
            const filtered = get().exams.filter(e => e.id !== id);
            set({ exams: filtered });
            localStorage.setItem('qubook_exams', JSON.stringify(filtered));
        } catch (err) {
            console.error("Failed to delete exam", err);
        }
    },

    addAssignment: async (title, due_date) => {
        try {
            const res = await api.post('/gamification/assignments/', { title, due_date });
            const newAssigns = [...get().assignments, res.data];
            set({ assignments: newAssigns });
            localStorage.setItem('qubook_assignments', JSON.stringify(newAssigns));
        } catch (err) {
            console.error("Failed to add assignment", err);
        }
    },

    toggleAssignment: async (id, status) => {
        try {
            const res = await api.patch(`/gamification/assignments/${id}/`, { status });
            const updated = get().assignments.map(a => a.id === id ? res.data : a);
            set({ assignments: updated });
            localStorage.setItem('qubook_assignments', JSON.stringify(updated));
        } catch (err) {
            console.error("Failed to toggle assignment", err);
        }
    },

    deleteAssignment: async (id) => {
        try {
            await api.delete(`/gamification/assignments/${id}/`);
            const filtered = get().assignments.filter(a => a.id !== id);
            set({ assignments: filtered });
            localStorage.setItem('qubook_assignments', JSON.stringify(filtered));
        } catch (err) {
            console.error("Failed to delete assignment", err);
        }
    },

    addMockTest: async (title, score, total_marks, date) => {
        try {
            const res = await api.post('/gamification/mock-tests/', { title, score, total_marks, date });
            const newTests = [...get().mockTests, res.data];
            set({ mockTests: newTests });
            localStorage.setItem('qubook_mock_tests', JSON.stringify(newTests));
            
            // Refresh stats to capture new XP/level/averages
            const statsRes = await api.get('/gamification/stats/');
            set({ stats: statsRes.data });
            localStorage.setItem('qubook_stats', JSON.stringify(statsRes.data));
        } catch (err) {
            console.error("Failed to add mock test", err);
        }
    },

    deleteMockTest: async (id) => {
        try {
            await api.delete(`/gamification/mock-tests/${id}/`);
            const filtered = get().mockTests.filter(t => t.id !== id);
            set({ mockTests: filtered });
            localStorage.setItem('qubook_mock_tests', JSON.stringify(filtered));
        } catch (err) {
            console.error("Failed to delete mock test", err);
        }
    },

    updateStudyHours: async (hours) => {
        try {
            const res = await api.patch('/gamification/stats/', { add_study_hours: hours });
            set({ stats: res.data });
            localStorage.setItem('qubook_stats', JSON.stringify(res.data));
        } catch (err) {
            console.error("Failed to update study hours", err);
        }
    },

    fetchLeaderboard: async () => {
        try {
            const res = await api.get('/gamification/leaderboard/');
            set({ leaderboard: res.data });
        } catch (err) {
            console.error("Failed to fetch leaderboard", err);
        }
    },

    adminAction: async (userId, action, amount = 0) => {
        try {
            const res = await api.post('/gamification/admin-action/', { user_id: userId, action, amount });
            return res.data;
        } catch (err) {
            console.error("Failed to execute admin gamification action", err);
            throw err;
        }
    }
}));
