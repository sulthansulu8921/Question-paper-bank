import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import {
    CreditCard, Edit2, Loader2, Save, Shield, HelpCircle,
    Lock, Unlock, Clock, BookOpen, Info
} from 'lucide-react';
import '@/styles/admin/AddQuestion.css';
import api from '@/api/axios';

interface Plan {
    id: number;
    name: string;
    price: string;
    duration_days: number;
    description: string;
    level_name: 'FOUNDATION' | 'INTERMEDIATE' | 'FINAL' | null;
    scope: 'PAPER_WISE' | 'GROUP_WISE' | null;
    billing_cycle: 'MONTHLY' | 'ATTEMPT_WISE' | null;
    free_questions_per_chapter: number;
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

    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
    const [editPrice, setEditPrice] = useState('');
    const [editDurationValue, setEditDurationValue] = useState<number>(30);
    const [editDurationUnit, setEditDurationUnit] = useState<DurationUnit>('days');
    const [editDescription, setEditDescription] = useState('');
    const [editFreeQuestions, setEditFreeQuestions] = useState<number>(3);
    const [freeQMode, setFreeQMode] = useState<'limited' | 'unlimited' | 'none'>('limited');

    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const isAuthorized = !!user?.is_superuser;

    const fetchPlans = async () => {
        if (!isAuthorized) return;
        setIsLoading(true);
        try {
            const res = await api.get('/subscriptions/plans/');
            setPlans(res.data);
        } catch (err) {
            console.error('Failed to fetch pricing plans:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchPlans(); }, [user]);

    const handleSelectPlan = (plan: Plan) => {
        setSelectedPlan(plan);
        setEditPrice(plan.price);
        const { value, unit } = fromDays(plan.duration_days);
        setEditDurationValue(value);
        setEditDurationUnit(unit);
        setEditDescription(plan.description || '');
        const fqc = plan.free_questions_per_chapter ?? 3;
        setEditFreeQuestions(fqc === -1 ? 3 : fqc === 0 ? 0 : fqc);
        setFreeQMode(fqc === -1 ? 'unlimited' : fqc === 0 ? 'none' : 'limited');
        setErrorMsg('');
        setSuccessMsg('');
    };

    const getEffectiveFreeQ = () => {
        if (freeQMode === 'unlimited') return -1;
        if (freeQMode === 'none') return 0;
        return editFreeQuestions;
    };

    const handleUpdatePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlan || !isAuthorized) return;
        setErrorMsg('');
        setSuccessMsg('');

        const numericPrice = parseFloat(editPrice);
        if (isNaN(numericPrice) || numericPrice < 0) {
            setErrorMsg('Please enter a valid price.');
            return;
        }

        const totalDays = toDays(editDurationValue, editDurationUnit);
        if (totalDays < 1) {
            setErrorMsg('Duration must be at least 1 day.');
            return;
        }

        setIsSaving(true);
        try {
            const res = await api.patch(`/subscriptions/plans/${selectedPlan.id}/`, {
                price: numericPrice.toFixed(2),
                duration_days: totalDays,
                description: editDescription.trim(),
                free_questions_per_chapter: getEffectiveFreeQ(),
            });
            setSuccessMsg(`Plan "${res.data.name}" updated successfully!`);
            const updatedPlan = res.data;
            setPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
            setSelectedPlan(updatedPlan);
        } catch (err: any) {
            setErrorMsg(err.response?.data?.error || err.response?.data?.detail || 'Failed to save pricing changes.');
        } finally {
            setIsSaving(false);
        }
    };

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
                                        <th style={{ padding: '0.75rem 1rem' }}>Plan</th>
                                        <th style={{ padding: '0.75rem 1rem' }}>Tags</th>
                                        <th style={{ padding: '0.75rem 1rem' }}>Duration</th>
                                        <th style={{ padding: '0.75rem 1rem' }}>Access Limit</th>
                                        <th style={{ padding: '0.75rem 1rem' }}>Price</th>
                                        <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Edit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {plans.map((plan) => {
                                        const badge = getAccessBadge(plan.free_questions_per_chapter ?? 3);
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
                                                    <div style={{ fontWeight: 800, color: '#1E293B', fontSize: '0.875rem' }}>{plan.name}</div>
                                                    <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.2rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {plan.description || 'No description'}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.875rem 1rem' }}>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                                        {plan.level_name && <span style={{ fontSize: '0.62rem', fontWeight: 800, background: '#EEF2FF', color: '#4F46E5', padding: '0.15rem 0.45rem', borderRadius: '0.3rem', border: '1px solid #C7D2FE' }}>{plan.level_name}</span>}
                                                        {plan.scope && <span style={{ fontSize: '0.62rem', fontWeight: 800, background: '#ECFDF5', color: '#059669', padding: '0.15rem 0.45rem', borderRadius: '0.3rem', border: '1px solid #A7F3D0' }}>{plan.scope.replace('_', ' ')}</span>}
                                                        {plan.billing_cycle && <span style={{ fontSize: '0.62rem', fontWeight: 800, background: '#FFF7ED', color: '#D97706', padding: '0.15rem 0.45rem', borderRadius: '0.3rem', border: '1px solid #FED7AA' }}>{plan.billing_cycle.replace('_', ' ')}</span>}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.875rem 1rem', fontWeight: 700, color: '#334155', fontSize: '0.85rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                        <Clock size={13} style={{ color: '#94A3B8' }} />
                                                        {formatDuration(plan.duration_days)}
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>{plan.duration_days} days total</div>
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

                {/* Edit Sidebar */}
                <div className="form-sidebar flex flex-col gap-4">
                    <div className="form-section card" style={{ padding: '1.5rem' }}>
                        {selectedPlan ? (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <Edit2 size={18} className="text-primary" />
                                    <h3 className="section-title" style={{ margin: 0, fontSize: '1.1rem' }}>Edit Plan</h3>
                                </div>
                                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', marginBottom: '1.25rem' }}>
                                    Editing: <strong style={{ color: '#475569' }}>{selectedPlan.name}</strong>
                                </p>

                                <form onSubmit={handleUpdatePlan} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

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
                                    </div>

                                    {/* Question Access Control */}
                                    <div className="form-group">
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

                                    <button
                                        type="submit"
                                        className="primary-btn flex-center gap-sm"
                                        disabled={isSaving}
                                        style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
                                    >
                                        {isSaving ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} /><span>Save Plan Changes</span></>}
                                    </button>
                                </form>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94A3B8' }}>
                                <HelpCircle size={36} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>Select a Plan to Edit</p>
                                <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Click any row in the table to load its parameters here.</p>
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
