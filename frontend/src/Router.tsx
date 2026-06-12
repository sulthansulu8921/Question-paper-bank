import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import PortalHomePage from '@/pages/PortalHomePage';
import AboutPage from '@/pages/AboutPage';
import ContactPage from '@/pages/ContactPage';
import AuthPage from '@/pages/auth/AuthPage';
import ComingSoonPage from '@/pages/ComingSoonPage';
import DashboardLayout from '@/layouts/DashboardLayout';
import DashboardHome from '@/pages/dashboard/DashboardHome';
import PaperViewer from '@/pages/dashboard/PaperViewer';
import AdminLayout from '@/layouts/AdminLayout';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminQuestionBank from '@/pages/admin/AdminQuestionBank';
import AdminCourseManager from '@/pages/admin/AdminCourseManager';
import AdminAnalytics from '@/pages/admin/AdminAnalytics';
import AddQuestion from '@/pages/admin/AddQuestion';
import AdminSubjectManager from '@/pages/admin/AdminSubjectManager';
import AdminPaperManager from '@/pages/admin/AdminPaperManager';
import AdminAnswerManager from '@/pages/admin/AdminAnswerManager';
import AdminNotesManager from '@/pages/admin/AdminNotesManager';
import AdminUserManager from '@/pages/admin/AdminUserManager';
import AdminSettings from '@/pages/admin/AdminSettings';
import AdminMasterDatabase from '@/pages/admin/AdminMasterDatabase';
import AdminCouponManager from '@/pages/admin/AdminCouponManager';
import AdminPricingManager from '@/pages/admin/AdminPricingManager';
import AdminPaymentManager from '@/pages/admin/AdminPaymentManager';
import DashboardComingSoon from '@/pages/dashboard/DashboardComingSoon';
import NotesPage from '@/pages/dashboard/NotesPage';
import CourseSelection from '@/pages/dashboard/CourseSelection';
import CourseDetailPage from '@/pages/dashboard/CourseDetailPage';

import QuestionPapersHub from '@/pages/dashboard/QuestionPapersHub';
import SavedQuestionsPage from '@/pages/dashboard/SavedQuestionsPage';
import AccountPage from '@/pages/dashboard/AccountPage';
import SettingsPage from '@/pages/dashboard/SettingsPage';
import SubscriptionPage from '@/pages/dashboard/SubscriptionPage';
import AssistantPage from '@/pages/dashboard/AssistantPage';
import AnalyticsPage from '@/pages/dashboard/AnalyticsPage';
import LeaderboardPage from '@/pages/dashboard/LeaderboardPage';
import AdminGamification from '@/pages/admin/AdminGamification';
import { useAuthStore } from '@/store/useAuthStore';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const token = useAuthStore((state) => state.token);
    if (!token) return <Navigate to="/auth?tab=login" replace />;
    return children;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
    const token = useAuthStore((state) => state.token);
    const user = useAuthStore((state) => state.user);
    if (!token) return <Navigate to="/auth?tab=login" replace />;

    // Only accessible if logged in user is explicitly a staff member
    if (user && !user.is_staff) return <Navigate to="/dashboard" replace />;

    return children;
};

const SuperAdminRoute = ({ children }: { children: React.ReactNode }) => {
    const token = useAuthStore((state) => state.token);
    const user = useAuthStore((state) => state.user);
    if (!token) return <Navigate to="/auth?tab=login" replace />;

    // Only accessible if logged in user is explicitly a staff member
    if (user && !user.is_staff) return <Navigate to="/dashboard" replace />;

    // Only superusers can access this route
    if (user && !user.is_superuser) return <Navigate to="/admin/questions" replace />;

    return children;
};

export default function AppRouter() {
    const hydrate = useAuthStore((state) => state.hydrate);
    const isHydrating = useAuthStore((state) => state.isHydrating);

    useEffect(() => {
        hydrate();
    }, [hydrate]);

    if (isHydrating) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-[#F8FAFC]">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<PortalHomePage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/coming-soon" element={<ComingSoonPage />} />
                <Route path="/auth" element={<AuthPage />} />

                {/* Legacy redirects */}
                <Route path="/login" element={<Navigate to="/auth?tab=login" replace />} />
                <Route path="/register" element={<Navigate to="/auth?tab=register" replace />} />

                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <DashboardLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route index element={<DashboardHome />} />
                    <Route path="account" element={<AccountPage />} />
                    <Route path="courses" element={<CourseSelection />} />
                    <Route path="courses/:id" element={<CourseDetailPage />} />
                    <Route path="papers" element={<QuestionPapersHub />} />
                    <Route path="papers/subject/:id" element={<PaperViewer />} />
                    <Route path="notes" element={<NotesPage />} />
                    <Route path="downloads" element={<DashboardComingSoon title="Downloads" />} />
                    <Route path="saved" element={<SavedQuestionsPage />} />
                    <Route path="subscription" element={<SubscriptionPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="assistant" element={<AssistantPage />} />
                    <Route path="analytics" element={<AnalyticsPage />} />
                    <Route path="leaderboard" element={<LeaderboardPage />} />
                </Route>

                <Route
                    path="/admin"
                    element={
                        <AdminRoute>
                            <AdminLayout />
                        </AdminRoute>
                    }
                >
                    <Route index element={<SuperAdminRoute><AdminDashboard /></SuperAdminRoute>} />
                    <Route path="master" element={<AdminMasterDatabase />} />
                    <Route path="courses" element={<AdminCourseManager />} />
                    <Route path="questions" element={<AdminQuestionBank />} />
                    <Route path="subjects" element={<AdminSubjectManager />} />
                    <Route path="papers" element={<AdminPaperManager />} />
                    <Route path="answers" element={<AdminAnswerManager />} />
                    <Route path="notes" element={<AdminNotesManager />} />
                    <Route path="questions/new" element={<AddQuestion />} />
                    <Route path="questions/:id/edit" element={<AddQuestion />} />
                    <Route path="analytics" element={<SuperAdminRoute><AdminAnalytics /></SuperAdminRoute>} />
                    <Route path="users" element={<SuperAdminRoute><AdminUserManager /></SuperAdminRoute>} />
                    <Route path="settings" element={<AdminSettings />} />
                    <Route path="coupons" element={<SuperAdminRoute><AdminCouponManager /></SuperAdminRoute>} />
                    <Route path="pricing" element={<SuperAdminRoute><AdminPricingManager /></SuperAdminRoute>} />
                    <Route path="payments" element={<SuperAdminRoute><AdminPaymentManager /></SuperAdminRoute>} />
                    <Route path="gamification" element={<AdminGamification />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
