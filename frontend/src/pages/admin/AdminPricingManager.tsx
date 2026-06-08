import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { CreditCard, Edit2, Loader2, Save, Shield, HelpCircle } from 'lucide-react';
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
}

export default function AdminPricingManager() {
    const user = useAuthStore((s) => s.user);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Selected plan for editing
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
    const [editPrice, setEditPrice] = useState('');
    const [editDuration, setEditDuration] = useState<number>(30);
    const [editDescription, setEditDescription] = useState('');
    
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

    useEffect(() => {
        fetchPlans();
    }, [user]);

    const handleSelectPlan = (plan: Plan) => {
        setSelectedPlan(plan);
        setEditPrice(plan.price);
        setEditDuration(plan.duration_days);
        setEditDescription(plan.description || '');
        setErrorMsg('');
        setSuccessMsg('');
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

        if (editDuration < 1) {
            setErrorMsg('Duration must be at least 1 day.');
            return;
        }

        setIsSaving(true);
        try {
            const res = await api.patch(`/subscriptions/plans/${selectedPlan.id}/`, {
                price: numericPrice.toFixed(2),
                duration_days: editDuration,
                description: editDescription.trim(),
            });
            
            setSuccessMsg(`Plan "${res.data.name}" updated successfully!`);
            
            // Refresh list and update active selected plan
            const updatedPlan = res.data;
            setPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
            setSelectedPlan(updatedPlan);
        } catch (err: any) {
            console.error('Failed to update plan:', err);
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
                    <h1 className="page-title">Subscription Pricing Manager</h1>
                    <p className="page-subtitle">Configure pricing tiers, attempt scopes, and billing cycle durations for all subscription courses.</p>
                </div>
            </div>

            <div className="form-grid" style={{ gridTemplateColumns: '1fr 380px', gap: '2rem' }}>
                {/* Main panel: List of active plans */}
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
                            <p style={{ fontSize: '0.875rem' }}>Contact systems administrator to initialize plans database.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        <th style={{ padding: '1rem' }}>Plan Details</th>
                                        <th style={{ padding: '1rem' }}>Parameters</th>
                                        <th style={{ padding: '1rem' }}>Duration</th>
                                        <th style={{ padding: '1rem' }}>Price</th>
                                        <th style={{ padding: '1rem', textAlign: 'center' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {plans.map((plan) => (
                                        <tr 
                                            key={plan.id} 
                                            onClick={() => handleSelectPlan(plan)}
                                            style={{ 
                                                borderBottom: '1px solid #F1F5F9', 
                                                transition: 'all 0.2s', 
                                                cursor: 'pointer',
                                                background: selectedPlan?.id === plan.id ? '#F8FAFC' : 'transparent' 
                                            }}
                                            className="hover:bg-slate-50"
                                        >
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontWeight: 800, color: '#1E293B', fontSize: '0.9rem' }}>{plan.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {plan.description || 'No description provided.'}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                                    {plan.level_name && (
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#EEF2FF', color: '#4F46E5', padding: '0.2rem 0.5rem', borderRadius: '0.35rem', border: '1px solid #C7D2FE' }}>
                                                            {plan.level_name}
                                                        </span>
                                                    )}
                                                    {plan.scope && (
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#ECFDF5', color: '#059669', padding: '0.2rem 0.5rem', borderRadius: '0.35rem', border: '1px solid #A7F3D0' }}>
                                                            {plan.scope.replace('_', ' ')}
                                                        </span>
                                                    )}
                                                    {plan.billing_cycle && (
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#FFF7ED', color: '#D97706', padding: '0.2rem 0.5rem', borderRadius: '0.35rem', border: '1px solid #FED7AA' }}>
                                                            {plan.billing_cycle.replace('_', ' ')}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem', fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>
                                                {plan.duration_days} Days
                                            </td>
                                            <td style={{ padding: '1rem', fontWeight: 800, color: '#6366F1', fontSize: '1rem' }}>
                                                ₹{parseFloat(plan.price).toFixed(2)}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSelectPlan(plan);
                                                    }}
                                                    className="secondary-btn"
                                                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                                >
                                                    <Edit2 size={12} />
                                                    <span>Edit</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Sidebar: Edit Subscription Plan details form */}
                <div className="form-sidebar flex flex-col gap-6">
                    <div className="form-section card" style={{ padding: '1.5rem' }}>
                        {selectedPlan ? (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                                    <Edit2 size={18} className="text-primary" />
                                    <h3 className="section-title" style={{ margin: 0, fontSize: '1.125rem' }}>Edit Plan Details</h3>
                                </div>
                                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', marginTop: '-0.75rem', marginBottom: '1.25rem' }}>
                                    Editing parameters for: <strong>{selectedPlan.name}</strong>
                                </p>

                                <form onSubmit={handleUpdatePlan} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <div className="form-group">
                                        <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>Plan Price (INR)</label>
                                        <div style={{ position: 'relative' }}>
                                            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#64748B', fontSize: '0.9rem' }}>₹</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                required
                                                className="form-input"
                                                style={{ paddingLeft: '2rem' }}
                                                value={editPrice}
                                                onChange={(e) => setEditPrice(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>Duration (Days)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            required
                                            className="form-input"
                                            value={editDuration}
                                            onChange={(e) => setEditDuration(parseInt(e.target.value) || 0)}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>Description</label>
                                        <textarea
                                            className="form-input"
                                            style={{ minHeight: '80px', resize: 'vertical' }}
                                            placeholder="Write tier highlights..."
                                            value={editDescription}
                                            onChange={(e) => setEditDescription(e.target.value)}
                                        />
                                    </div>

                                    {errorMsg && (
                                        <p style={{ fontSize: '0.75rem', color: '#EF4444', fontWeight: 600, margin: 0 }}>
                                            ✗ {errorMsg}
                                        </p>
                                    )}

                                    {successMsg && (
                                        <p style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600, margin: 0 }}>
                                            ✓ {successMsg}
                                        </p>
                                    )}

                                    <button
                                        type="submit"
                                        className="primary-btn flex-center gap-sm"
                                        disabled={isSaving}
                                        style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
                                    >
                                        {isSaving ? (
                                            <Loader2 className="animate-spin" size={16} />
                                        ) : (
                                            <>
                                                <Save size={16} />
                                                <span>Save Pricing Changes</span>
                                            </>
                                        )}
                                    </button>
                                </form>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94A3B8' }}>
                                <HelpCircle size={36} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>Select a Plan to Edit</p>
                                <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Click any row in the table to load parameters here for updates.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
