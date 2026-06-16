import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { Tag, Plus, Trash2, CheckCircle, XCircle, Shield, Loader2 } from 'lucide-react';
import '@/styles/admin/AddQuestion.css'; // Reuses page layouts and variables
import api from '@/api/axios';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';

interface Coupon {
    id: number;
    code: string;
    discount_percent: number;
    restricted_email?: string | null;
    restricted_course?: number | null;
    restricted_course_name?: string | null;
    is_active: boolean;
    created_at: string;
}

export default function AdminCouponManager() {
    const user = useAuthStore((s) => s.user);
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [courses, setCourses] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Form fields
    const [code, setCode] = useState('');
    const [discountPercent, setDiscountPercent] = useState<number>(10);
    const [restrictedEmail, setRestrictedEmail] = useState('');
    const [restrictedCourse, setRestrictedCourse] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const [confirmDelete, setConfirmDelete] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ open: false, title: '', message: '', onConfirm: () => {} });

    const isAuthorized = !!user?.is_superuser;

    const fetchCoupons = async () => {
        if (!isAuthorized) return;
        setIsLoading(true);
        try {
            const res = await api.get('/subscriptions/coupons/');
            setCoupons(res.data);
        } catch (err) {
            console.error('Failed to fetch coupons:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchCourses = async () => {
        try {
            const res = await api.get('/courses/courses/');
            setCourses(res.data);
        } catch (err) {
            console.error('Failed to fetch courses:', err);
        }
    };

    useEffect(() => {
        fetchCoupons();
        fetchCourses();
    }, [user]);

    const handleCreateCoupon = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAuthorized) return;
        
        setErrorMsg('');
        setSuccessMsg('');

        if (!code.trim()) {
            setErrorMsg('Coupon code is required.');
            return;
        }

        if (discountPercent < 1 || discountPercent > 100) {
            setErrorMsg('Discount percent must be between 1 and 100.');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await api.post('/subscriptions/coupons/', {
                code: code.trim().toUpperCase(),
                discount_percent: discountPercent,
                restricted_email: restrictedEmail.trim() ? restrictedEmail.trim() : null,
                restricted_course: restrictedCourse ? parseInt(restrictedCourse, 10) : null,
                is_active: true
            });
            setSuccessMsg(`Coupon ${res.data.code} created successfully!`);
            setCode('');
            setDiscountPercent(10);
            setRestrictedEmail('');
            setRestrictedCourse('');
            fetchCoupons();
        } catch (err: any) {
            setErrorMsg(err.response?.data?.error || err.response?.data?.detail || 'Failed to create coupon.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleActive = async (coupon: Coupon) => {
        if (!isAuthorized) return;
        try {
            await api.patch(`/subscriptions/coupons/${coupon.id}/`, {
                is_active: !coupon.is_active
            });
            fetchCoupons();
        } catch (err) {
            console.error('Failed to update coupon status:', err);
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
                    Only administrators have authorization to access coupon configurations.
                </p>
            </div>
        );
    }

    return (
        <div className="add-q-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Coupons Management</h1>
                    <p className="page-subtitle">Create and manage coupon codes for user subscription discounts.</p>
                </div>
            </div>

            <div className="form-grid" style={{ gridTemplateColumns: '1fr 380px', gap: '2rem' }}>
                {/* Main section: List of coupons */}
                <div className="form-main card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(79, 70, 229, 0.1)', display: 'flex', alignItems: 'center', justifySelf: 'center', color: '#4F46E5', justifyContent: 'center' }}>
                            <Tag size={20} />
                        </div>
                        <h2 className="section-title" style={{ margin: 0 }}>Active Coupon Codes</h2>
                    </div>

                    {isLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                            <Loader2 className="animate-spin text-primary" size={32} />
                        </div>
                    ) : coupons.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem 1rem', border: '2px dashed #E2E8F0', borderRadius: '1.5rem', color: '#94A3B8' }}>
                            <Tag size={40} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                            <p style={{ fontWeight: 600 }}>No coupons created yet.</p>
                            <p style={{ fontSize: '0.875rem' }}>Use the sidebar panel to generate your first discount code.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        <th style={{ padding: '1rem' }}>Code</th>
                                        <th style={{ padding: '1rem' }}>Discount</th>
                                        <th style={{ padding: '1rem' }}>Restricted Email</th>
                                        <th style={{ padding: '1rem' }}>Restricted Course</th>
                                        <th style={{ padding: '1rem', textAlign: 'center' }}>Status</th>
                                        <th style={{ padding: '1rem', textAlign: 'center' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {coupons.map((coupon) => (
                                        <tr key={coupon.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.2s' }}>
                                            <td style={{ padding: '1rem', fontWeight: 800 }}>
                                                <span style={{ background: '#EEF2FF', color: '#4F46E5', padding: '0.35rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.875rem', border: '1px dashed #C7D2FE' }}>
                                                    {coupon.code}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', fontWeight: 700, color: '#1E293B' }}>
                                                {coupon.discount_percent}% Off
                                            </td>
                                            <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                                                {coupon.restricted_email ? (
                                                    <span style={{ fontWeight: 600, color: '#475569', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.25rem 0.5rem', borderRadius: '0.375rem' }}>
                                                        {coupon.restricted_email}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Public (Anyone)</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                                                {coupon.restricted_course_name ? (
                                                    <span style={{ fontWeight: 600, color: '#4F46E5', background: '#EEF2FF', border: '1px solid #C7D2FE', padding: '0.25rem 0.5rem', borderRadius: '0.375rem' }}>
                                                        {coupon.restricted_course_name}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Public (All)</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => handleToggleActive(coupon)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, fontSize: '0.875rem', color: coupon.is_active ? '#10B981' : '#EF4444' }}
                                                >
                                                    {coupon.is_active ? (
                                                        <>
                                                            <CheckCircle size={16} />
                                                            <span>Active</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <XCircle size={16} />
                                                            <span>Inactive</span>
                                                        </>
                                                    )}
                                                </button>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => setConfirmDelete({
                                                        open: true,
                                                        title: 'Delete Coupon',
                                                        message: `Are you sure you want to delete the coupon code "${coupon.code}"? This action cannot be undone.`,
                                                        onConfirm: async () => {
                                                            try {
                                                                await api.delete(`/subscriptions/coupons/${coupon.id}/`);
                                                                fetchCoupons();
                                                            } catch (err) {
                                                                console.error('Failed to delete coupon:', err);
                                                            }
                                                            setConfirmDelete(prev => ({ ...prev, open: false }));
                                                        }
                                                    })}
                                                    style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '0.5rem', borderRadius: '0.5rem', transition: 'background 0.2s' }}
                                                    onMouseEnter={(e) => (e.currentTarget.style.background = '#FEE2E2')}
                                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Sidebar section: Create new coupon form */}
                <div className="form-sidebar flex flex-col gap-6">
                    <div className="form-section card" style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                            <Plus size={20} className="text-primary" />
                            <h3 className="section-title" style={{ margin: 0, fontSize: '1.125rem' }}>Generate Coupon</h3>
                        </div>

                        <form onSubmit={handleCreateCoupon} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div className="form-group">
                                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>Coupon Code</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. STUDY15"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    style={{ textTransform: 'uppercase' }}
                                />
                            </div>

                            <div className="form-group">
                                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>Discount Percentage (%)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    className="form-input"
                                    placeholder="10"
                                    value={discountPercent}
                                    onChange={(e) => setDiscountPercent(parseInt(e.target.value) || 0)}
                                />
                            </div>

                            <div className="form-group">
                                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>Restricted Email (Optional)</label>
                                <input
                                    type="email"
                                    className="form-input"
                                    placeholder="e.g. user@example.com"
                                    value={restrictedEmail}
                                    onChange={(e) => setRestrictedEmail(e.target.value)}
                                />
                                <p style={{ fontSize: '0.6875rem', color: '#94A3B8', marginTop: '0.25rem', fontWeight: 500 }}>
                                    If specified, only the user with this email ID can use this coupon.
                                </p>
                            </div>

                            <div className="form-group">
                                <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>Restricted Course (Optional)</label>
                                <select
                                    className="form-input"
                                    value={restrictedCourse}
                                    onChange={(e) => setRestrictedCourse(e.target.value)}
                                    style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #E2E8F0', outline: 'none', background: '#FFF' }}
                                >
                                    <option value="">Public (All Courses)</option>
                                    {courses.map((course) => (
                                        <option key={course.id} value={course.id}>
                                            {course.name}
                                        </option>
                                    ))}
                                </select>
                                <p style={{ fontSize: '0.6875rem', color: '#94A3B8', marginTop: '0.25rem', fontWeight: 500 }}>
                                    If specified, this coupon can only be applied to subscriptions in the selected course.
                                </p>
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
                                disabled={isSubmitting}
                                style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
                            >
                                {isSubmitting ? (
                                    <Loader2 className="animate-spin" size={16} />
                                ) : (
                                    <>
                                        <Plus size={16} />
                                        <span>Create Coupon</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
            <AdminConfirmModal
                                open={confirmDelete.open}
                                onClose={() => setConfirmDelete(prev => ({ ...prev, open: false }))}
                                onConfirm={confirmDelete.onConfirm}
                                title={confirmDelete.title}
                                message={confirmDelete.message}
                            />
        </div>
    );
}
