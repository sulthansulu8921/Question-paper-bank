import { useQuery } from '@tanstack/react-query';
import api from '@/api/axios';
import { useAuthStore } from '@/store/useAuthStore';

interface SubscriptionPlan {
    video_access: boolean;
    notes_access: boolean;
    question_bank_access: boolean;
    mock_test_access: boolean;
    ai_assistant_access: boolean;
    live_class_access: boolean;
    download_permission: boolean;
    free_questions_per_chapter: number;
}

interface ActiveSubscription {
    id: number;
    plan: number;
    plan_name: string;
    plan_scope: string;
    plan_billing_cycle: string;
    plan_duration: number;
    start_date: string;
    end_date: string;
    is_active: boolean;
    days_remaining: number;
    level_title?: string;
    subject_name?: string;
    group?: string;
    plan_details?: SubscriptionPlan;
}

export interface SubscriptionAccessFlags {
    isLoading: boolean;
    hasActiveSubscription: boolean;
    hasVideoAccess: boolean;
    hasNotesAccess: boolean;
    hasMockTestAccess: boolean;
    hasLiveClassAccess: boolean;
    hasAIAccess: boolean;
    hasDownloadAccess: boolean;
    hasQuestionBankAccess: boolean;
    freeQuestionsPerChapter: number;
    activeSubscriptions: ActiveSubscription[];
    expiringSubscriptions: ActiveSubscription[]; // expires in ≤ 7 days
    daysUntilExpiry: number | null;
    aiCredits: number;
}

export function useSubscriptionAccess(): SubscriptionAccessFlags {
    const user = useAuthStore((s) => s.user);

    const { data: subscriptions = [], isLoading } = useQuery<ActiveSubscription[]>({
        queryKey: ['my-subscriptions-access', user?.id],
        queryFn: async () => {
            const res = (await api.get('/subscriptions/my-subscriptions/')).data;
            return Array.isArray(res) ? res : (res.results ?? []);
        },
        enabled: !!user && !user.is_staff,
        staleTime: 60_000,
    });

    // Staff / admin always has full access
    if (user?.is_staff || user?.is_superuser || user?.role === 'SUPER_ADMIN' || user?.role === 'INSTITUTION_ADMIN' || user?.role === 'INSTRUCTOR') {
        return {
            isLoading: false,
            hasActiveSubscription: true,
            hasVideoAccess: true,
            hasNotesAccess: true,
            hasMockTestAccess: true,
            hasLiveClassAccess: true,
            hasAIAccess: true,
            hasDownloadAccess: true,
            hasQuestionBankAccess: true,
            freeQuestionsPerChapter: -1,
            activeSubscriptions: [],
            expiringSubscriptions: [],
            daysUntilExpiry: null,
            aiCredits: 999999,
        };
    }

    const activeSubs = subscriptions.filter((s) => s.is_active && s.days_remaining > 0);
    const hasActiveSubscription = activeSubs.length > 0;

    // Aggregate access flags across all active subscriptions (OR logic — any active plan granting access is enough)
    const hasVideoAccess = hasActiveSubscription && activeSubs.some((s) => s.plan_details ? s.plan_details.video_access : true);
    const hasNotesAccess = hasActiveSubscription && activeSubs.some((s) => s.plan_details ? s.plan_details.notes_access : true);
    const hasMockTestAccess = hasActiveSubscription && activeSubs.some((s) => s.plan_details ? s.plan_details.mock_test_access : true);
    const hasLiveClassAccess = hasActiveSubscription && activeSubs.some((s) => s.plan_details ? s.plan_details.live_class_access : true);
    const hasAIAccess = 
        (user && (user.ai_credits ?? 0) > 0) || 
        (hasActiveSubscription && activeSubs.some((s) => s.plan_details ? s.plan_details.ai_assistant_access : true));
    const hasDownloadAccess = hasActiveSubscription && activeSubs.some((s) => s.plan_details ? s.plan_details.download_permission : true);
    const hasQuestionBankAccess = hasActiveSubscription && activeSubs.some((s) => s.plan_details ? s.plan_details.question_bank_access : true);

    const freeQuestionsPerChapter = (() => {
        if (!hasActiveSubscription) return 3;
        const limits = activeSubs.map((s) => s.plan_details ? s.plan_details.free_questions_per_chapter : -1);
        if (limits.includes(-1)) return -1;
        return Math.max(...limits, 0);
    })();

    const expiringSubscriptions = activeSubs.filter((s) => s.days_remaining <= 7);

    const daysUntilExpiry = activeSubs.length > 0
        ? Math.min(...activeSubs.map((s) => s.days_remaining))
        : null;


    return {
        isLoading,
        hasActiveSubscription,
        hasVideoAccess,
        hasNotesAccess,
        hasMockTestAccess,
        hasLiveClassAccess,
        hasAIAccess,
        hasDownloadAccess,
        hasQuestionBankAccess,
        freeQuestionsPerChapter,
        activeSubscriptions: activeSubs,
        expiringSubscriptions,
        daysUntilExpiry,
        aiCredits: user?.ai_credits ?? 0,
    };
}
