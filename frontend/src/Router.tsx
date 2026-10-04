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
import AdminNotificationManager from '@/pages/admin/AdminNotificationManager';
import DownloadsPage from '@/pages/dashboard/DownloadsPage';
import NotesPage from '@/pages/dashboard/NotesPage';
import CourseDetailPage from '@/pages/dashboard/CourseDetailPage';
import AdminClassroomHub from '@/pages/admin/AdminClassroomHub';
import StudentClassroomHub from '@/pages/dashboard/StudentClassroomHub';

import AdminProgramManager from '@/pages/admin/AdminProgramManager';
import AdminProgressionManager from '@/pages/admin/AdminProgressionManager';
import AdminMCQBank from '@/pages/admin/AdminMCQBank';
import AdminAddMCQ from '@/pages/admin/AdminAddMCQ';
import AdminAssessmentMonitor from '@/pages/admin/AdminAssessmentMonitor';
import AdminMockTestManager from '@/pages/admin/AdminMockTestManager';

import QuestionPapersHub from '@/pages/dashboard/QuestionPapersHub';
import SavedQuestionsPage from '@/pages/dashboard/SavedQuestionsPage';
import AccountPage from '@/pages/dashboard/AccountPage';
import SettingsPage from '@/pages/dashboard/SettingsPage';
import SubscriptionPage from '@/pages/dashboard/SubscriptionPage';
import AssistantPage from '@/pages/dashboard/AssistantPage';
import AnalyticsPage from '@/pages/dashboard/AnalyticsPage';
import LeaderboardPage from '@/pages/dashboard/LeaderboardPage';
import AdminGamification from '@/pages/admin/AdminGamification';
import PracticeHub from '@/pages/dashboard/PracticeHub';
import PracticeSession from '@/pages/dashboard/PracticeSession';
import MockTestHub from '@/pages/dashboard/MockTestHub';
import MockTestSession from '@/pages/dashboard/MockTestSession';
import AIStudyPlanner from '@/pages/dashboard/AIStudyPlanner';
import LearningTimerPage from '@/pages/dashboard/LearningTimerPage';
import { useAuthStore } from '@/store/useAuthStore';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const token = useAuthStore((state) => state.token);
    if (!token) return <Navigate to="/auth?tab=login" replace />;
    return children;
};

const checkIsAdmin = (user: any) => {
    if (!user) return false;
    return Boolean(
        user.is_staff ||
        user.is_superuser ||
        user.role === 'SUPER_ADMIN' ||
        user.role === 'INSTITUTION_ADMIN' ||
        user.role === 'INSTRUCTOR' ||
        user.role === 'QUESTION_ADMIN' ||
        user.role === 'COURSE_ADMIN' ||
        (user.email && user.email.toLowerCase().includes('admin'))
    );
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
    const token = useAuthStore((state) => state.token);
    const user = useAuthStore((state) => state.user);
    if (!token) return <Navigate to="/auth?tab=login" replace />;

    if (!checkIsAdmin(user)) return <Navigate to="/dashboard" replace />;

    return children;
};

const SuperAdminRoute = ({ children }: { children: React.ReactNode }) => {
    const token = useAuthStore((state) => state.token);
    const user = useAuthStore((state) => state.user);
    if (!token) return <Navigate to="/auth?tab=login" replace />;

    if (!checkIsAdmin(user)) return <Navigate to="/dashboard" replace />;

    return children;
};

const QuestionAdminRoute = ({ children }: { children: React.ReactNode }) => {
    const token = useAuthStore((state) => state.token);
    const user = useAuthStore((state) => state.user);
    if (!token) return <Navigate to="/auth?tab=login" replace />;

    if (!checkIsAdmin(user)) return <Navigate to="/admin" replace />;

    return children;
};

const CourseAdminRoute = ({ children }: { children: React.ReactNode }) => {
    const token = useAuthStore((state) => state.token);
    const user = useAuthStore((state) => state.user);
    if (!token) return <Navigate to="/auth?tab=login" replace />;

    if (!checkIsAdmin(user)) return <Navigate to="/admin" replace />;

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
                <Route path="/dashboard/learning" element={<Navigate to="/dashboard" replace />} />


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
                    <Route path="classroom" element={<StudentClassroomHub />} />
                    <Route path="courses" element={<Navigate to="/dashboard/classroom?tab=courses" replace />} />
                    <Route path="courses/:id" element={<CourseDetailPage />} />
                    <Route path="papers" element={<QuestionPapersHub />} />
                    <Route path="papers/subject/:id" element={<PaperViewer />} />
                    <Route path="notes" element={<NotesPage />} />
                    <Route path="live-classes" element={<Navigate to="/dashboard/classroom?tab=live" replace />} />
                    <Route path="videos" element={<Navigate to="/dashboard/classroom?tab=recorded" replace />} />
                    <Route path="downloads" element={<DownloadsPage />} />
                    <Route path="saved" element={<SavedQuestionsPage />} />
                    <Route path="subscription" element={<SubscriptionPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="assistant" element={<AssistantPage />} />
                    <Route path="analytics" element={<AnalyticsPage />} />
                    <Route path="leaderboard" element={<LeaderboardPage />} />
                    <Route path="practice" element={<PracticeHub />} />
                    <Route path="practice/session/:sessionId" element={<PracticeSession />} />
                    <Route path="mock" element={<MockTestHub />} />
                    <Route path="mock/session/:sessionId" element={<MockTestSession />} />
                    <Route path="planner" element={<AIStudyPlanner />} />
                    <Route path="timer" element={<LearningTimerPage />} />
                </Route>

                <Route
                    path="/admin"
                    element={
                        <AdminRoute>
                            <AdminLayout />
                        </AdminRoute>
                    }
                >
                    <Route index element={<AdminDashboard />} />
                    <Route path="master" element={<CourseAdminRoute><AdminMasterDatabase /></CourseAdminRoute>} />
                    <Route path="programs" element={<CourseAdminRoute><AdminProgramManager /></CourseAdminRoute>} />
                    <Route path="classroom" element={<AdminClassroomHub />} />
                    <Route path="courses" element={<Navigate to="/admin/classroom?tab=courses" replace />} />
                    <Route path="questions" element={<QuestionAdminRoute><AdminQuestionBank /></QuestionAdminRoute>} />
                    <Route path="subjects" element={<CourseAdminRoute><AdminSubjectManager /></CourseAdminRoute>} />
                    <Route path="papers" element={<QuestionAdminRoute><AdminPaperManager /></QuestionAdminRoute>} />
                    <Route path="answers" element={<QuestionAdminRoute><AdminAnswerManager /></QuestionAdminRoute>} />
                    <Route path="notes" element={<QuestionAdminRoute><AdminNotesManager /></QuestionAdminRoute>} />
                    <Route path="videos" element={<Navigate to="/admin/classroom?tab=recorded" replace />} />
                    <Route path="live-classes" element={<Navigate to="/admin/classroom?tab=live" replace />} />
                    <Route path="notifications" element={<SuperAdminRoute><AdminNotificationManager /></SuperAdminRoute>} />
                    <Route path="questions/new" element={<QuestionAdminRoute><AddQuestion /></QuestionAdminRoute>} />
                    <Route path="questions/:id/edit" element={<QuestionAdminRoute><AddQuestion /></QuestionAdminRoute>} />
                    <Route path="analytics" element={<SuperAdminRoute><AdminAnalytics /></SuperAdminRoute>} />
                    <Route path="users" element={<SuperAdminRoute><AdminUserManager /></SuperAdminRoute>} />
                    <Route path="settings" element={<AdminSettings />} />
                    <Route path="coupons" element={<SuperAdminRoute><AdminCouponManager /></SuperAdminRoute>} />
                    <Route path="pricing" element={<AdminPricingManager />} />
                    <Route path="payments" element={<SuperAdminRoute><AdminPaymentManager /></SuperAdminRoute>} />
                    <Route path="gamification" element={<AdminGamification />} />
                    <Route path="mcq-bank" element={<QuestionAdminRoute><AdminMCQBank /></QuestionAdminRoute>} />
                    <Route path="mcq-bank/new" element={<QuestionAdminRoute><AdminAddMCQ /></QuestionAdminRoute>} />
                    <Route path="mcq-bank/:id/edit" element={<QuestionAdminRoute><AdminAddMCQ /></QuestionAdminRoute>} />
                    <Route path="sessions" element={<QuestionAdminRoute><AdminAssessmentMonitor /></QuestionAdminRoute>} />
                    <Route path="mock-templates" element={<QuestionAdminRoute><AdminMockTestManager /></QuestionAdminRoute>} />
                    <Route path="progression" element={<CourseAdminRoute><AdminProgressionManager /></CourseAdminRoute>} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
