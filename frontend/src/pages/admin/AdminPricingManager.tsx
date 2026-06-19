import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import {
    CreditCard, Edit2, Loader2, Save, Shield, HelpCircle,
    Lock, Unlock, Clock, BookOpen, Info, Plus, Trash2, Layers, Calendar
} from 'lucide-react';
import '@/styles/admin/AddQuestion.css';
import api from '@/api/axios';

interface Plan {
    id: number;
    name: string;
    price: string;
    duration_days: number;
    description: string;
    level_name: string | null;
    scope: 'PAPER_WISE' | 'GROUP_WISE' | null;
    billing_cycle: 'MONTHLY' | 'ATTEMPT_WISE' | null;
    plan_type: 'QUESTIONS' | 'FULL_COURSE';
    free_questions_per_chapter: number;
    category_specific: number | null;
    course_specific: number | null;
    level_specific: number | null;
    subject_specific: number | null;
    video_access: boolean;
    notes_access: boolean;
    question_bank_access: boolean;
    mock_test_access: boolean;
    ai_assistant_access: boolean;
    live_class_access: boolean;
    download_permission: boolean;
    purchase_start_date?: string | null;
    purchase_end_date?: string | null;
    fixed_expiry_date?: string | null;
}

type DurationUnit = 'days' | 'months' | 'years';

const toDays = (value: number, unit: DurationUnit): number => {
    if (unit === 'months') return Math.round(value * 30);
    if (unit === 'years') return Math.round(value * 365);
    return value;
};

const fromDays = (days: number): { value: number; unit: DurationUnit } => {
    if (days >= 365 && days % 365 === 0) return { value: days / 365, unit: 'years' };
    if (days >= 30 && days % 30 === 0) return { value: days / 30, unit: 'months' };
    return { value: days, unit: 'days' };
};

const formatDuration = (days: number) => {
    const { value, unit } = fromDays(days);
    return `${value} ${unit.charAt(0).toUpperCase() + unit.slice(1)}${value !== 1 ? '' : ''}`;
};

const formatToDatetimeLocal = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().slice(0, 16);
    } catch {
        return '';
    }
};

const getAccessBadge = (limit: number) => {
    if (limit === -1) return { label: 'Unlimited', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', icon: <Unlock size={11} /> };
    if (limit === 0) return { label: 'No Access', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: <Lock size={11} /> };
    return { label: `${limit} Q/Chapter`, color: '#D97706', bg: '#FFF7ED', border: '#FED7AA', icon: <Lock size={11} /> };
};

export default function AdminPricingManager() {
    const user = useAuthStore((s) => s.user);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Metadata for options
    const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
    const [courses, setCourses] = useState<{ id: number; name: string; category: number | null }[]>([]);
    const [levels, setLevels] = useState<{ id: number; name: string; course: number }[]>([]);
    const [subjects, setSubjects] = useState<{ id: number; name: string; level: number }[]>([]);

    // Mode toggles
    const [isCreateMode, setIsCreateMode] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

    // Form inputs
    const [editName, setEditName] = useState('');
    const [editPrice, setEditPrice] = useState('');
    const [editDurationValue, setEditDurationValue] = useState<number>(30);
    const [editDurationUnit, setEditDurationUnit] = useState<DurationUnit>('days');
    const [editDescription, setEditDescription] = useState('');
    const [editFreeQuestions, setEditFreeQuestions] = useState<number>(3);
    const [freeQMode, setFreeQMode] = useState<'limited' | 'unlimited' | 'none'>('limited');
    
    const [editScope, setEditScope] = useState<string>('');
    const [editBillingCycle, setEditBillingCycle] = useState<string>('');
    const [editPlanType, setEditPlanType] = useState<'QUESTIONS' | 'FULL_COURSE'>('FULL_COURSE');
    
    // Dynamic targets
    const [editCategorySpecific, setEditCategorySpecific] = useState<string>('');
    const [editCourseSpecific, setEditCourseSpecific] = useState<string>('');
    const [editLevelSpecific, setEditLevelSpecific] = useState<string>('');
    const [editSubjectSpecific, setEditSubjectSpecific] = useState<string>('');

    // Granular feature gating
    const [editVideoAccess, setEditVideoAccess] = useState(true);
    const [editNotesAccess, setEditNotesAccess] = useState(true);
    const [editQuestionBankAccess, setEditQuestionBankAccess] = useState(true);
    const [editMockTestAccess, setEditMockTestAccess] = useState(true);
    const [editAIAssistantAccess, setEditAIAssistantAccess] = useState(true);
    const [editLiveClassAccess, setEditLiveClassAccess] = useState(true);
    const [editDownloadPermission, setEditDownloadPermission] = useState(true);

    const [editPurchaseStartDate, setEditPurchaseStartDate] = useState('');
    const [editPurchaseEndDate, setEditPurchaseEndDate] = useState('');
    const [editFixedExpiryDate, setEditFixedExpiryDate] = useState('');

    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const isAuthorized = !!(user?.is_superuser || user?.is_staff || user?.role === 'SUPER_ADMIN' || user?.role === 'INSTITUTION_ADMIN' || user?.role === 'INSTRUCTOR');

    const fetchPlans = async () => {
        if (!isAuthorized) return;
        setIsLoading(true);
        try {
            const res = await api.get('/subscriptions/plans/');
            setPlans(Array.isArray(res.data) ? res.data : (res.data.results || []));
        } catch (err) {
            console.error('Failed to fetch pricing plans:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMetadata = async () => {
        if (!isAuthorized) return;
        try {
            const [catRes, courseRes, levelRes, subRes] = await Promise.all([
                api.get('/courses/categories/'),
                api.get('/courses/courses/'),
                api.get('/courses/levels/'),
                api.get('/courses/subjects/')
            ]);
            setCategories(Array.isArray(catRes.data) ? catRes.data : (catRes.data.results || []));
            setCourses(Array.isArray(courseRes.data) ? courseRes.data : (courseRes.data.results || []));
            setLevels(Array.isArray(levelRes.data) ? levelRes.data : (levelRes.data.results || []));
            setSubjects(Array.isArray(subRes.data) ? subRes.data : (subRes.data.results || []));
        } catch (err) {
            console.error('Failed to fetch metadata:', err);
        }
    };


    useEffect(() => {
        fetchPlans();
        fetchMetadata();
    }, [user]);

    const handleSelectPlan = (plan: Plan) => {
        setIsCreateMode(false);
        setSelectedPlan(plan);
        setEditName(plan.name);
        setEditPrice(plan.price);
        const { value, unit } = fromDays(plan.duration_days);
        setEditDurationValue(value);
        setEditDurationUnit(unit);
        setEditDescription(plan.description || '');
        const fqc = plan.free_questions_per_chapter ?? 3;
        setEditFreeQuestions(fqc === -1 ? 3 : fqc === 0 ? 0 : fqc);
        setFreeQMode(fqc === -1 ? 'unlimited' : fqc === 0 ? 'none' : 'limited');
        setEditScope(plan.scope || '');
        setEditBillingCycle(plan.billing_cycle || '');
        setEditPlanType(plan.plan_type || 'FULL_COURSE');
        setEditCategorySpecific(plan.category_specific ? plan.category_specific.toString() : '');
        setEditCourseSpecific(plan.course_specific ? plan.course_specific.toString() : '');
        setEditLevelSpecific(plan.level_specific ? plan.level_specific.toString() : '');
        setEditSubjectSpecific(plan.subject_specific ? plan.subject_specific.toString() : '');
        
        setEditVideoAccess(plan.video_access !== false);
        setEditNotesAccess(plan.notes_access !== false);
        setEditQuestionBankAccess(plan.question_bank_access !== false);
        setEditMockTestAccess(plan.mock_test_access !== false);
        setEditAIAssistantAccess(plan.ai_assistant_access !== false);
        setEditLiveClassAccess(plan.live_class_access !== false);
        setEditDownloadPermission(plan.download_permission !== false);

        setEditPurchaseStartDate(formatToDatetimeLocal(plan.purchase_start_date));
        setEditPurchaseEndDate(formatToDatetimeLocal(plan.purchase_end_date));
        setEditFixedExpiryDate(formatToDatetimeLocal(plan.fixed_expiry_date));

        setErrorMsg('');
        setSuccessMsg('');
    };

    const handleInitCreatePlan = () => {
        setIsCreateMode(true);
        setSelectedPlan(null);
        setEditName('');
        setEditPrice('0.00');
        setEditDurationValue(30);
        setEditDurationUnit('days');
        setEditDescription('');
        setEditFreeQuestions(3);
        setFreeQMode('limited');
        setEditScope('');
        setEditBillingCycle('');
        setEditPlanType('FULL_COURSE');
        setEditCategorySpecific('');
        setEditCourseSpecific('');
        setEditLevelSpecific('');
        setEditSubjectSpecific('');

        setEditVideoAccess(true);
        setEditNotesAccess(true);
        setEditQuestionBankAccess(true);
        setEditMockTestAccess(true);
        setEditAIAssistantAccess(true);
        setEditLiveClassAccess(true);
        setEditDownloadPermission(true);

        setEditPurchaseStartDate('');
        setEditPurchaseEndDate('');
        setEditFixedExpiryDate('');

        setErrorMsg('');
        setSuccessMsg('');
    };

    const getEffectiveFreeQ = () => {
        if (freeQMode === 'unlimited') return -1;
        if (freeQMode === 'none') return 0;
        return editFreeQuestions;
    };

    const handleSubmitPlan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAuthorized) return;
        setErrorMsg('');
        setSuccessMsg('');

        const numericPrice = parseFloat(editPrice);
        if (isNaN(numericPrice) || numericPrice < 0) {
            setErrorMsg('Please enter a valid price.');
            return;
        }

        const totalDays = editBillingCycle === 'ATTEMPT_WISE' ? 1 : toDays(editDurationValue, editDurationUnit);
        if (totalDays < 1) {
            setErrorMsg('Duration must be at least 1 day.');
            return;
        }

        if (!editName.trim()) {
            setErrorMsg('Plan name is required.');
            return;
        }

        const payload = {
            name: editName.trim(),
            price: numericPrice.toFixed(2),
            duration_days: totalDays,
            description: editDescription.trim(),
            free_questions_per_chapter: getEffectiveFreeQ(),
            scope: editScope || null,
            billing_cycle: editBillingCycle || null,
            plan_type: editPlanType,
            category_specific: editCategorySpecific ? parseInt(editCategorySpecific) : null,
            course_specific: editCourseSpecific ? parseInt(editCourseSpecific) : null,
            level_specific: editLevelSpecific ? parseInt(editLevelSpecific) : null,
            subject_specific: editSubjectSpecific ? parseInt(editSubjectSpecific) : null,
            video_access: editVideoAccess,
            notes_access: editNotesAccess,
            question_bank_access: editQuestionBankAccess,
            mock_test_access: editMockTestAccess,
            ai_assistant_access: editAIAssistantAccess,
            live_class_access: editLiveClassAccess,
            download_permission: editDownloadPermission,
            purchase_start_date: editPurchaseStartDate ? new Date(editPurchaseStartDate).toISOString() : null,
            purchase_end_date: editPurchaseEndDate ? new Date(editPurchaseEndDate).toISOString() : null,
            fixed_expiry_date: editFixedExpiryDate ? new Date(editFixedExpiryDate).toISOString() : null,
        };


        setIsSaving(true);
        try {
            if (isCreateMode) {
                const res = await api.post('/subscriptions/plans/', payload);
                setSuccessMsg(`Plan "${res.data.name}" created successfully!`);
                setPlans(prev => [...prev, res.data]);
                setIsCreateMode(false);
                setSelectedPlan(res.data);
            } else if (selectedPlan) {
                const res = await api.patch(`/subscriptions/plans/${selectedPlan.id}/`, payload);
                setSuccessMsg(`Plan "${res.data.name}" updated successfully!`);
                setPlans(prev => prev.map(p => p.id === res.data.id ? res.data : p));
                setSelectedPlan(res.data);
            }
        } catch (err: any) {
            setErrorMsg(err.response?.data?.error || err.response?.data?.detail || 'Failed to save pricing changes.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeletePlan = async () => {
        if (!selectedPlan || !isAuthorized) return;
        if (!window.confirm(`Are you sure you want to delete the plan "${selectedPlan.name}"?`)) return;

        setErrorMsg('');
        setSuccessMsg('');
        setIsSaving(true);
        try {
            await api.delete(`/subscriptions/plans/${selectedPlan.id}/`);
            setSuccessMsg(`Plan "${selectedPlan.name}" deleted successfully!`);
            setPlans(prev => prev.filter(p => p.id !== selectedPlan.id));
            setSelectedPlan(null);
        } catch (err: any) {
            setErrorMsg(err.response?.data?.error || err.response?.data?.detail || 'Failed to delete plan.');
        } finally {
            setIsSaving(false);
        }
    };

    // Filter metadata helper lists to avoid mismatched selections
    const filteredCourses = editCategorySpecific
        ? courses.filter(c => c.category === parseInt(editCategorySpecific))
        : courses;

    const filteredLevels = editCourseSpecific
        ? levels.filter(l => l.course === parseInt(editCourseSpecific))
        : levels;

    const filteredSubjects = editLevelSpecific
        ? subjects.filter(s => s.level === parseInt(editLevelSpecific))
        : subjects;

    if (!isAuthorized) {
        return (
            <div className="add-q-container flex flex-col items-center justify-center text-center" style={{ minHeight: '60vh', padding: '3rem' }}>
                <div style={{ display: 'inline-flex', padding: '1.5rem', borderRadius: '2rem', background: 'rgba(239, 68, 68, 0.05)', color: 'rgb(239, 68, 68)', marginBottom: '1.5rem' }}>
                    <Shield size={64} />
                </div>
                <h1 className="page-title text-2xl font-black text-gray-900 mb-2">Access Denied</h1>
                <p className="text-gray-400 font-medium max-w-md mx-auto leading-relaxed">
                    Only administrators have authorization to access pricing configurations.
                </p>
            </div>
        );
    }

    return (
        <div className="add-q-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Subscription & Access Manager</h1>
                    <p className="page-subtitle">Configure pricing tiers, durations, question access limits, and billing cycles for all subscription plans.</p>
                </div>
                <button 
                    onClick={handleInitCreatePlan} 
                    className="primary-btn flex-center gap-xs"
                    style={{ padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                    <Plus size={16} /> <span>Create New Plan</span>
                </button>
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                {[
                    { icon: <CreditCard size={20} />, label: 'Total Plans', value: plans.length, color: '#6366F1', bg: '#EEF2FF' },
                    { icon: <Clock size={20} />, label: 'Avg Duration', value: plans.length ? `${Math.round(plans.reduce((a, p) => a + p.duration_days, 0) / plans.length)}d` : '—', color: '#0891B2', bg: '#ECFEFF' },
                    { icon: <BookOpen size={20} />, label: 'Unlimited Plans', value: plans.filter(p => p.free_questions_per_chapter === -1).length, color: '#059669', bg: '#ECFDF5' },
                ].map((c, i) => (
                    <div key={i} className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: c.bg, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {c.icon}
                        </div>
                        <div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1E293B', lineHeight: 1 }}>{c.value}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, marginTop: 2 }}>{c.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="form-grid" style={{ gridTemplateColumns: '1fr 420px', gap: '2rem' }}>
                {/* Plans Table */}
                <div className="form-main card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', color: '#6366F1', justifyContent: 'center' }}>
                            <CreditCard size={20} />
                        </div>
                        <h2 className="section-title" style={{ margin: 0 }}>Available Subscription Tiers</h2>
                    </div>

                    {isLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                            <Loader2 className="animate-spin text-primary" size={32} />
                        </div>
                    ) : plans.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem 1rem', border: '2px dashed #E2E8F0', borderRadius: '1.5rem', color: '#94A3B8' }}>
                            <CreditCard size={40} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                            <p style={{ fontWeight: 600 }}>No subscription plans found.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #F1F5F9', color: '#64748B', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        <th style={{ padding: '0.75rem 1rem' }}>Plan Details</th>
                                        <th style={{ padding: '0.75rem 1rem' }}>Target Level / Scope</th>
                                        <th style={{ padding: '0.75rem 1rem' }}>Duration</th>
                                        <th style={{ padding: '0.75rem 1rem' }}>Access Limit</th>
                                        <th style={{ padding: '0.75rem 1rem' }}>Price</th>
                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Edit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {plans.map((plan) => {
                                        const badge = getAccessBadge(plan.free_questions_per_chapter ?? 3);
                                        
                                        // Resolve dynamic target labels
                                        const categoryName = categories.find(c => c.id === plan.category_specific)?.name;
                                        const courseName = courses.find(c => c.id === plan.course_specific)?.name;
                                        const levelName = levels.find(l => l.id === plan.level_specific)?.name;
                                        const subjectName = subjects.find(s => s.id === plan.subject_specific)?.name;

                                        return (
                                            <tr
                                                key={plan.id}
                                                onClick={() => handleSelectPlan(plan)}
                                                style={{
                                                    borderBottom: '1px solid #F1F5F9',
                                                    transition: 'all 0.15s',
                                                    cursor: 'pointer',
                                                    background: selectedPlan?.id === plan.id ? '#F8FAFF' : 'transparent',
                                                    borderLeft: selectedPlan?.id === plan.id ? '3px solid #6366F1' : '3px solid transparent',
                                                }}
                                            >
                                                <td style={{ padding: '0.875rem 1rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <div style={{ fontWeight: 800, color: '#1E293B', fontSize: '0.875rem' }}>{plan.name}</div>
                                                        <span style={{ fontSize: '0.6rem', fontWeight: 800, background: plan.plan_type === 'QUESTIONS' ? '#FEF2F2' : '#ECFDF5', color: plan.plan_type === 'QUESTIONS' ? '#EF4444' : '#10B981', padding: '0.1rem 0.35rem', borderRadius: '0.25rem' }}>
                                                            {plan.plan_type === 'QUESTIONS' ? 'Q-Only' : 'Full Course'}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.2rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {plan.description || 'No description'}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.875rem 1rem' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                                                        {categoryName && <span style={{ fontSize: '0.62rem', fontWeight: 800, background: '#EEF2FF', color: '#4F46E5', padding: '0.15rem 0.45rem', borderRadius: '0.3rem', border: '1px solid #C7D2FE' }}>Category: {categoryName}</span>}
                                                        {courseName && <span style={{ fontSize: '0.62rem', fontWeight: 800, background: '#EFF6FF', color: '#2563EB', padding: '0.15rem 0.45rem', borderRadius: '0.3rem', border: '1px solid #BFDBFE' }}>Course: {courseName}</span>}
                                                        {levelName && <span style={{ fontSize: '0.62rem', fontWeight: 800, background: '#F5F3FF', color: '#7C3AED', padding: '0.15rem 0.45rem', borderRadius: '0.3rem', border: '1px solid #DDD6FE' }}>Level: {levelName}</span>}
                                                        {subjectName && <span style={{ fontSize: '0.62rem', fontWeight: 800, background: '#ECFDF5', color: '#059669', padding: '0.15rem 0.45rem', borderRadius: '0.3rem', border: '1px solid #A7F3D0' }}>Subject: {subjectName}</span>}
                                                        {!categoryName && !courseName && !levelName && !subjectName && plan.level_name && (
                                                            <span style={{ fontSize: '0.62rem', fontWeight: 800, background: '#F8FAFC', color: '#64748B', padding: '0.15rem 0.45rem', borderRadius: '0.3rem', border: '1px solid #E2E8F0' }}>Level (Legacy): {plan.level_name}</span>
                                                        )}
                                                        <div style={{ display: 'flex', gap: '0.2rem', marginTop: '0.1rem' }}>
                                                            {plan.scope && <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#64748B' }}>Scope: {plan.scope.replace('_', ' ')}</span>}
                                                            {plan.billing_cycle && <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#64748B' }}>• Cycle: {plan.billing_cycle.replace('_', ' ')}</span>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.875rem 1rem', fontWeight: 700, color: '#334155', fontSize: '0.85rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                        <Clock size={13} style={{ color: '#94A3B8' }} />
                                                        {plan.billing_cycle === 'ATTEMPT_WISE' ? 'Attempt-Based' : formatDuration(plan.duration_days)}
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                                                        {plan.billing_cycle === 'ATTEMPT_WISE' ? 'Ends on attempt date' : `${plan.duration_days} days total`}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.875rem 1rem' }}>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                                        fontSize: '0.7rem', fontWeight: 800,
                                                        background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                                                        padding: '0.25rem 0.55rem', borderRadius: '0.4rem'
                                                    }}>
                                                        {badge.icon} {badge.label}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.875rem 1rem', fontWeight: 800, color: '#6366F1', fontSize: '1rem' }}>
                                                    ₹{parseFloat(plan.price).toFixed(2)}
                                                </td>
                                                <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleSelectPlan(plan); }}
                                                        className="secondary-btn"
                                                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                                    >
                                                        <Edit2 size={11} /><span>Edit</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Edit/Create Sidebar */}
                <div className="form-sidebar flex flex-col gap-4">
                    <div className="form-section card" style={{ padding: '1.5rem' }}>
                        {selectedPlan || isCreateMode ? (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {isCreateMode ? <Plus size={18} className="text-primary" /> : <Edit2 size={18} className="text-primary" />}
                                        <h3 className="section-title" style={{ margin: 0, fontSize: '1.1rem' }}>
                                            {isCreateMode ? 'Create New Plan' : 'Edit Plan'}
                                        </h3>
                                    </div>
                                    {!isCreateMode && (
                                        <button 
                                            onClick={handleInitCreatePlan}
                                            className="secondary-btn"
                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.68rem' }}
                                        >
                                            + New
                                        </button>
                                    )}
                                </div>
                                {isCreateMode ? (
                                    <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', marginBottom: '1.25rem' }}>
                                        Configure parameters for a new subscription tier
                                    </p>
                                ) : (
                                    <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', marginBottom: '1.25rem' }}>
                                        Editing: <strong style={{ color: '#475569' }}>{selectedPlan?.name}</strong>
                                    </p>
                                )}

                                <form onSubmit={handleSubmitPlan} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    
                                    {/* Name */}
                                    <div className="form-group">
                                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem', display: 'block' }}>Plan Name</label>
                                        <input
                                            type="text" required className="form-input"
                                            placeholder="e.g. Monthly Premium, KEAM Full Access"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                        />
                                    </div>

                                    {/* Price */}
                                    <div className="form-group">
                                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem', display: 'block' }}>Plan Price (INR)</label>
                                        <div style={{ position: 'relative' }}>
                                            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#64748B' }}>₹</span>
                                            <input
                                                type="number" step="0.01" min="0" required className="form-input"
                                                style={{ paddingLeft: '2rem' }}
                                                value={editPrice}
                                                onChange={(e) => setEditPrice(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Duration picker */}
                                    <div className="form-group">
                                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem', display: 'block' }}>
                                            Subscription Duration
                                        </label>
                                        {editBillingCycle === 'ATTEMPT_WISE' ? (
                                            <div style={{ padding: '0.75rem 1rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '0.75rem', fontSize: '0.75rem', color: '#16A34A', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Calendar size={16} />
                                                <span>Aligned with Attempt Month (Dynamic Duration)</span>
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <input
                                                        type="number" min="1" required className="form-input"
                                                        style={{ flex: 1 }}
                                                        value={editDurationValue}
                                                        onChange={(e) => setEditDurationValue(parseInt(e.target.value) || 1)}
                                                    />
                                                    <select
                                                        className="form-input"
                                                        style={{ flex: '0 0 auto', width: '120px' }}
                                                        value={editDurationUnit}
                                                        onChange={(e) => setEditDurationUnit(e.target.value as DurationUnit)}
                                                    >
                                                        <option value="days">Days</option>
                                                        <option value="months">Months</option>
                                                        <option value="years">Years</option>
                                                    </select>
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                    <Clock size={11} />
                                                    = {toDays(editDurationValue, editDurationUnit)} days total
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Scope & Billing Cycle & Plan Type */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                                        <div className="form-group">
                                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem', display: 'block' }}>Access Scope</label>
                                            <select 
                                                className="form-input" 
                                                style={{ fontSize: '0.75rem', padding: '0.4rem' }}
                                                value={editScope} 
                                                onChange={(e) => setEditScope(e.target.value)}
                                            >
                                                <option value="">Course Wise</option>
                                                <option value="PAPER_WISE">Paper Wise</option>
                                                <option value="GROUP_WISE">Group Wise</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem', display: 'block' }}>Billing Cycle</label>
                                            <select 
                                                className="form-input" 
                                                style={{ fontSize: '0.75rem', padding: '0.4rem' }}
                                                value={editBillingCycle} 
                                                onChange={(e) => setEditBillingCycle(e.target.value)}
                                            >
                                                <option value="">Days Count</option>
                                                <option value="MONTHLY">Monthly</option>
                                                <option value="ATTEMPT_WISE">Attempt Wise</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem', display: 'block' }}>Plan Type</label>
                                            <select 
                                                className="form-input" 
                                                style={{ fontSize: '0.75rem', padding: '0.4rem' }}
                                                value={editPlanType} 
                                                onChange={(e) => setEditPlanType(e.target.value as 'QUESTIONS' | 'FULL_COURSE')}
                                            >
                                                <option value="FULL_COURSE">Full Course</option>
                                                <option value="QUESTIONS">Questions Only</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Dynamic targets divider */}
                                    <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '1rem', marginTop: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                                            <Layers size={14} style={{ color: '#6366F1' }} />
                                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155' }}>Target Options (Advanced)</span>
                                        </div>

                                        {/* Category Selection */}
                                        <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: '0.25rem', display: 'block' }}>Category (Stream)</label>
                                            <select
                                                className="form-input"
                                                value={editCategorySpecific}
                                                onChange={(e) => {
                                                    setEditCategorySpecific(e.target.value);
                                                    setEditCourseSpecific('');
                                                    setEditLevelSpecific('');
                                                    setEditSubjectSpecific('');
                                                }}
                                            >
                                                <option value="">All Streams / Global</option>
                                                {categories.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Course Selection */}
                                        <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: '0.25rem', display: 'block' }}>Specific Course</label>
                                            <select
                                                className="form-input"
                                                value={editCourseSpecific}
                                                onChange={(e) => {
                                                    setEditCourseSpecific(e.target.value);
                                                    setEditLevelSpecific('');
                                                    setEditSubjectSpecific('');
                                                }}
                                            >
                                                <option value="">All Courses</option>
                                                {filteredCourses.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Level Selection */}
                                        <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: '0.25rem', display: 'block' }}>Specific Level</label>
                                            <select
                                                className="form-input"
                                                value={editLevelSpecific}
                                                onChange={(e) => {
                                                    setEditLevelSpecific(e.target.value);
                                                    setEditSubjectSpecific('');
                                                }}
                                            >
                                                <option value="">All Levels</option>
                                                {filteredLevels.map(l => (
                                                    <option key={l.id} value={l.id}>{l.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Subject Selection */}
                                        <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: '0.25rem', display: 'block' }}>Specific Subject</label>
                                            <select
                                                className="form-input"
                                                value={editSubjectSpecific}
                                                onChange={(e) => setEditSubjectSpecific(e.target.value)}
                                            >
                                                <option value="">All Subjects</option>
                                                {filteredSubjects.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Question Access Control */}
                                    <div className="form-group" style={{ borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <Lock size={14} /> Question Access Limit
                                        </label>
                                        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
                                            {[
                                                { key: 'limited', label: '🔢 Limited', color: '#D97706' },
                                                { key: 'unlimited', label: '✅ Unlimited', color: '#059669' },
                                                { key: 'none', label: '🚫 No Access', color: '#DC2626' },
                                            ].map((opt) => (
                                                <button
                                                    key={opt.key} type="button"
                                                    onClick={() => setFreeQMode(opt.key as any)}
                                                    style={{
                                                        flex: 1, padding: '0.4rem 0.3rem', borderRadius: '0.5rem',
                                                        fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', border: '2px solid',
                                                        borderColor: freeQMode === opt.key ? opt.color : '#E2E8F0',
                                                        background: freeQMode === opt.key ? `${opt.color}10` : '#F8FAFC',
                                                        color: freeQMode === opt.key ? opt.color : '#94A3B8',
                                                        transition: 'all 0.15s',
                                                    }}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>

                                        {freeQMode === 'limited' && (
                                            <div>
                                                <input
                                                    type="number" min="1" max="1000" className="form-input"
                                                    value={editFreeQuestions}
                                                    onChange={(e) => setEditFreeQuestions(parseInt(e.target.value) || 1)}
                                                />
                                                <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                    <Info size={11} />
                                                    Students will see first {editFreeQuestions} question{editFreeQuestions !== 1 ? 's' : ''} per chapter
                                                </div>
                                            </div>
                                        )}
                                        {freeQMode === 'unlimited' && (
                                            <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.6rem', background: '#ECFDF5', borderRadius: '0.4rem' }}>
                                                <Unlock size={12} /> Students can see all questions in every chapter
                                            </div>
                                        )}
                                        {freeQMode === 'none' && (
                                            <div style={{ fontSize: '0.72rem', color: '#DC2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.6rem', background: '#FEF2F2', borderRadius: '0.4rem' }}>
                                                <Lock size={12} /> Students on this plan cannot see any questions
                                            </div>
                                        )}
                                    </div>

                                    {/* Granular Feature Gating */}
                                    <div className="form-group" style={{ borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <Shield size={14} /> Granular Access Permissions
                                        </label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem 1rem' }}>
                                            {[
                                                { key: 'video', label: '🎥 Video Access', state: editVideoAccess, setter: setEditVideoAccess },
                                                { key: 'notes', label: '📚 Notes Access', state: editNotesAccess, setter: setEditNotesAccess },
                                                { key: 'qbank', label: '❓ Question Bank Access', state: editQuestionBankAccess, setter: setEditQuestionBankAccess },
                                                { key: 'mock', label: '📝 Mock Test Access', state: editMockTestAccess, setter: setEditMockTestAccess },
                                                { key: 'ai', label: '✨ AI Assistant Access', state: editAIAssistantAccess, setter: setEditAIAssistantAccess },
                                                { key: 'live', label: '💻 Live Class Access', state: editLiveClassAccess, setter: setEditLiveClassAccess },
                                                { key: 'download', label: '📥 Download Permission', state: editDownloadPermission, setter: setEditDownloadPermission },
                                            ].map((feature) => (
                                                <label key={feature.key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={feature.state}
                                                        onChange={(e) => feature.setter(e.target.checked)}
                                                        style={{ width: 15, height: 15, accentColor: '#4F46E5', cursor: 'pointer' }}
                                                    />
                                                    <span>{feature.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Date configurations */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: '#F8FAFC', borderRadius: '1rem', border: '1px solid #E2E8F0' }}>
                                        <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Date Configurations (Optional)</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: '0.25rem', display: 'block' }}>Purchase Start</label>
                                                <input
                                                    type="datetime-local" className="form-input"
                                                    value={editPurchaseStartDate}
                                                    onChange={(e) => setEditPurchaseStartDate(e.target.value)}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: '0.25rem', display: 'block' }}>Purchase End</label>
                                                <input
                                                    type="datetime-local" className="form-input"
                                                    value={editPurchaseEndDate}
                                                    onChange={(e) => setEditPurchaseEndDate(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: '0.25rem', display: 'block' }}>Fixed Expiry Date</label>
                                            <input
                                                type="datetime-local" className="form-input"
                                                value={editFixedExpiryDate}
                                                onChange={(e) => setEditFixedExpiryDate(e.target.value)}
                                            />
                                            <span style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.25rem', display: 'block' }}>If set, all purchased subscriptions expire exactly on this date instead of dynamic calculation.</span>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div className="form-group">
                                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem', display: 'block' }}>Description</label>
                                        <textarea
                                            className="form-input"
                                            style={{ minHeight: '72px', resize: 'vertical' }}
                                            placeholder="Write tier highlights..."
                                            value={editDescription}
                                            onChange={(e) => setEditDescription(e.target.value)}
                                        />
                                    </div>

                                    {errorMsg && <p style={{ fontSize: '0.75rem', color: '#EF4444', fontWeight: 600, margin: 0 }}>✗ {errorMsg}</p>}
                                    {successMsg && <p style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600, margin: 0 }}>✓ {successMsg}</p>}

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <button
                                            type="submit"
                                            className="primary-btn flex-center gap-sm"
                                            disabled={isSaving}
                                            style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                                        >
                                            {isSaving ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} /><span>{isCreateMode ? 'Create Plan' : 'Save Plan Changes'}</span></>}
                                        </button>

                                        {!isCreateMode && (
                                            <button
                                                type="button"
                                                onClick={handleDeletePlan}
                                                disabled={isSaving}
                                                className="secondary-btn"
                                                style={{ width: '100%', padding: '0.75rem', borderColor: '#EF4444', color: '#EF4444', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.35rem', transition: 'all 0.15s' }}
                                            >
                                                <Trash2 size={16} /> <span>Delete Plan</span>
                                            </button>
                                        )}
                                    </div>
                                </form>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94A3B8' }}>
                                <HelpCircle size={36} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>Select a Plan to Edit</p>
                                <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Click any row in the table or click "Create New Plan" to configure new plans.</p>
                            </div>
                        )}
                    </div>

                    {/* Security info card */}
                    <div className="card" style={{ padding: '1.25rem', background: 'rgba(99,102,241,0.03)', border: '1px solid rgba(99,102,241,0.12)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <Shield size={16} style={{ color: '#6366F1' }} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155' }}>Security Enforcement</span>
                        </div>
                        <ul style={{ margin: 0, padding: '0 0 0 1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {[
                                'Question limits enforced server-side — clients never receive locked questions',
                                'Subscription expiry checked on every API request',
                                'Admin / staff always bypass access restrictions',
                                'Plan changes take effect immediately on next API call',
                            ].map((item, i) => (
                                <li key={i} style={{ fontSize: '0.7rem', color: '#64748B', lineHeight: 1.5 }}>{item}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
