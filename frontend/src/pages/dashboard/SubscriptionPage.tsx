import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { useAuthStore } from '@/store/useAuthStore';
import {
    CheckCircle, Sparkles,
    Loader2, AlertCircle, HelpCircle, ArrowRight,
    BookOpen, Layers, Tag, Calendar, Award, CreditCard, Download
} from 'lucide-react';

interface Plan {
    id: number;
    name: string;
    price: string;
    duration_days: number;
    description: string;
    level_name: 'FOUNDATION' | 'INTERMEDIATE' | 'FINAL';
    scope: 'PAPER_WISE' | 'GROUP_WISE';
    billing_cycle: 'MONTHLY' | 'ATTEMPT_WISE';
}

interface LevelDB {
    id: number;
    name: string;
    course: number;
}

interface SubjectDB {
    id: number;
    name: string;
    course: number;
    level: number;
}

interface CourseDB {
    id: number;
    name: string;
    course: number;
}

export default function SubscriptionPage() {
    const user = useAuthStore((state) => state.user);
    const hydrate = useAuthStore((state) => state.hydrate);
    const queryClient = useQueryClient();

    // Configurator steps state
    const [selectedLevel, setSelectedLevel] = useState<'FOUNDATION' | 'INTERMEDIATE' | 'FINAL'>('INTERMEDIATE');
    const [selectedScope, setSelectedScope] = useState<'PAPER_WISE' | 'GROUP_WISE'>('GROUP_WISE');
    const [selectedCycle, setSelectedCycle] = useState<'MONTHLY' | 'ATTEMPT_WISE'>('ATTEMPT_WISE');

    // Details selection
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
    const [selectedMockSubject, setSelectedMockSubject] = useState<string>('');
    const [selectedGroup, setSelectedGroup] = useState<'GROUP_1' | 'GROUP_2' | 'ALL'>('ALL');
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [selectedAttempt, setSelectedAttempt] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    // Coupon state
    const [couponCodeInput, setCouponCodeInput] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPercent: number } | null>(null);
    const [couponError, setCouponError] = useState('');
    const [couponSuccess, setCouponSuccess] = useState('');
    const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

    // Checkout / Processing state
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [paymentError, setPaymentError] = useState('');
    const [downloadingId, setDownloadingId] = useState<number | null>(null);

    // Fetch plans
    const { data: plans = [], isLoading: plansLoading } = useQuery<Plan[]>({
        queryKey: ['subscription-plans'],
        queryFn: async () => (await api.get('/subscriptions/plans/')).data,
    });

    // Fetch user payment history
    const { data: paymentHistory = [], isLoading: paymentsLoading } = useQuery<any[]>({
        queryKey: ['user-payments'],
        queryFn: async () => {
            const res = (await api.get('/subscriptions/payments/')).data;
            return Array.isArray(res) ? res : (res.results ?? []);
        },
    });

    const handleDownloadInvoice = async (paymentId: number, transactionId: string) => {
        setDownloadingId(paymentId);
        try {
            const response = await api.get(`/subscriptions/payments/${paymentId}/download_invoice/`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `invoice_${transactionId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Invoice download failed:', error);
            alert('Unable to download tax invoice. Please try again.');
        } finally {
            setDownloadingId(null);
        }
    };

    // Fetch backend syllabus metadata
    const { data: courses = [] } = useQuery<CourseDB[]>({
        queryKey: ['courses-list'],
        queryFn: async () => (await api.get('/courses/courses/')).data,
    });

    const { data: levels = [] } = useQuery<LevelDB[]>({
        queryKey: ['levels-list'],
        queryFn: async () => (await api.get('/courses/levels/')).data,
    });

    const { data: subjects = [] } = useQuery<SubjectDB[]>({
        queryKey: ['subjects-list'],
        queryFn: async () => (await api.get('/courses/subjects/')).data,
    });

    // Map level selection to database levels
    const getActiveLevelDb = () => {
        const queryTerm = selectedLevel === 'FOUNDATION' ? 'foundation' : selectedLevel === 'INTERMEDIATE' ? 'intermediate' : 'final';
        return levels.find(l => l.name.toLowerCase().includes(queryTerm)) || null;
    };

    // Map level selection to database course
    const getActiveCourseDb = () => {
        const queryTerm = selectedLevel === 'FOUNDATION' ? 'foundation' : selectedLevel === 'INTERMEDIATE' ? 'intermediate' : 'final';
        return courses.find(c => c.name.toLowerCase().includes(queryTerm)) || null;
    };

    // Filtered subjects for current level
    const levelDb = getActiveLevelDb();
    const courseDb = getActiveCourseDb();
    const filteredSubjects = subjects.filter(s => {
        if (levelDb) return s.level === levelDb.id;
        if (courseDb) return s.course === courseDb.id;
        return false;
    });

    // Mock subjects fallback when backend database is empty for Foundation/Final
    const mockSubjectsMap = {
        FOUNDATION: [
            { code: 'MOCK_F1', name: 'Paper 1: Accounting' },
            { code: 'MOCK_F2', name: 'Paper 2: Business Laws' },
            { code: 'MOCK_F3', name: 'Paper 3: Quantitative Aptitude' },
            { code: 'MOCK_F4', name: 'Paper 4: Business Economics' }
        ],
        FINAL: [
            { code: 'MOCK_FN1', name: 'Paper 1: Financial Reporting' },
            { code: 'MOCK_FN2', name: 'Paper 2: Advanced Financial Management' },
            { code: 'MOCK_FN3', name: 'Paper 3: Advanced Auditing & Professional Ethics' },
            { code: 'MOCK_FN4', name: 'Paper 4: Direct Tax Laws & International Taxation' },
            { code: 'MOCK_FN5', name: 'Paper 5: Indirect Tax Laws' }
        ],
        INTERMEDIATE: []
    };

    const hasNoDatabaseSubjects = filteredSubjects.length === 0;
    const currentMockSubjects = mockSubjectsMap[selectedLevel] || [];

    // Set defaults when config changes
    useEffect(() => {
        setSelectedSubjectId('');
        setSelectedMockSubject('');
        setCouponCodeInput('');
        setAppliedCoupon(null);
        setCouponSuccess('');
        setCouponError('');

        if (selectedCycle === 'MONTHLY') {
            const currentMonthName = calendarMonths[new Date().getMonth()];
            setSelectedMonth(currentMonthName);
            setSelectedAttempt('');
        } else {
            setSelectedAttempt(selectedLevel === 'FINAL' ? 'May' : 'January');
            setSelectedMonth('');
        }
    }, [selectedLevel, selectedScope, selectedCycle]);

    // Active matching plan
    const matchingPlan = plans.find(p =>
        p.level_name === selectedLevel &&
        p.scope === selectedScope &&
        p.billing_cycle === selectedCycle
    );

    // Cost Breakdown Calculation (GST 18%)
    const basePrice = matchingPlan ? parseFloat(matchingPlan.price) : 0;
    const discountAmount = appliedCoupon ? roundToTwo((basePrice * appliedCoupon.discountPercent) / 100) : 0;
    const subtotal = Math.max(0, basePrice - discountAmount);
    const gstAmount = roundToTwo(subtotal * 0.18);
    const finalPrice = roundToTwo(subtotal + gstAmount);

    function roundToTwo(num: number) {
        return Math.round((num + Number.EPSILON) * 100) / 100;
    }

    // Coupon verification
    const handleApplyCoupon = async () => {
        if (!couponCodeInput.trim()) return;
        setCouponError('');
        setCouponSuccess('');
        setIsValidatingCoupon(true);

        try {
            const res = await api.post('/subscriptions/coupons/validate/', {
                code: couponCodeInput.trim()
            });

            if (res.data.valid) {
                setAppliedCoupon({
                    code: res.data.code,
                    discountPercent: res.data.discount_percent
                });
                setCouponSuccess(`Applied: ${res.data.code} (${res.data.discount_percent}% Discount)`);
            } else {
                setCouponError(res.data.error || 'Invalid coupon code');
                setAppliedCoupon(null);
            }
        } catch (err: any) {
            setCouponError(err.response?.data?.error || 'Coupon validation failed');
            setAppliedCoupon(null);
        } finally {
            setIsValidatingCoupon(false);
        }
    };

    const handleRemoveCoupon = () => {
        setAppliedCoupon(null);
        setCouponCodeInput('');
        setCouponSuccess('');
        setCouponError('');
    };

    // Razorpay checkout initiator
    const handleCheckout = async () => {
        if (!matchingPlan) return;

        // Validation of selection
        if (selectedScope === 'PAPER_WISE') {
            if (hasNoDatabaseSubjects && !selectedMockSubject) {
                alert('Please select a subject to subscribe.');
                return;
            }
            if (!hasNoDatabaseSubjects && !selectedSubjectId) {
                alert('Please select a subject to subscribe.');
                return;
            }
        }

        setIsProcessing(true);
        setPaymentError('');

        try {
            // 1. Create order on backend
            const orderRes = await api.post('/subscriptions/payments/create_order/', {
                plan_id: matchingPlan.id,
                coupon_code: appliedCoupon?.code || null
            });

            const { order_id, amount, currency, razorpay_key_id, is_sandbox } = orderRes.data;

            const checkoutPayload = {
                plan_id: matchingPlan.id,
                level_id: levelDb?.id || null,
                subject_id: selectedSubjectId ? parseInt(selectedSubjectId) : null,
                group: selectedScope === 'GROUP_WISE' ? selectedGroup : null,
                calendar_month: selectedCycle === 'MONTHLY' ? selectedMonth : null,
                exam_attempt: selectedCycle === 'ATTEMPT_WISE' ? selectedAttempt : null,
                year: selectedYear,
                coupon_code: appliedCoupon?.code || null
            };

            // 2. Open Razorpay Checkout or auto-verify if Sandbox Mode is active
            if (is_sandbox) {
                // Auto verify Sandbox Mode
                await api.post('/subscriptions/payments/verify_payment/', {
                    razorpay_order_id: order_id,
                    razorpay_payment_id: `pay_mock_${Math.random().toString(36).substring(7).toUpperCase()}`,
                    razorpay_signature: 'sandbox_mock_signature',
                    ...checkoutPayload
                });

                setPaymentSuccess(true);
                await hydrate();
                queryClient.invalidateQueries({ queryKey: ['user-subscriptions'] });
                queryClient.invalidateQueries({ queryKey: ['user-payments'] });
                setTimeout(() => {
                    setPaymentSuccess(false);
                    setIsProcessing(false);
                    handleRemoveCoupon();
                }, 3000);
            } else {
                // Real Razorpay modal
                const options = {
                    key: razorpay_key_id,
                    amount: amount,
                    currency: currency,
                    name: "Qubook.in",
                    description: matchingPlan.name,
                    order_id: order_id,
                    handler: async function (response: any) {
                        try {
                            await api.post('/subscriptions/payments/verify_payment/', {
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                ...checkoutPayload
                            });
                            setPaymentSuccess(true);
                            await hydrate();
                            queryClient.invalidateQueries({ queryKey: ['user-subscriptions'] });
                            queryClient.invalidateQueries({ queryKey: ['user-payments'] });
                            setTimeout(() => {
                                setPaymentSuccess(false);
                                setIsProcessing(false);
                                handleRemoveCoupon();
                            }, 3000);
                        } catch (err: any) {
                            const errorMsg = err.response?.data?.error || 'Verification of signature failed.';
                            setPaymentError(errorMsg);
                            setIsProcessing(false);
                            // Log failed payment on the backend
                            try {
                                await api.post('/subscriptions/payments/record_failed/', {
                                    plan_id: matchingPlan.id,
                                    coupon_code: appliedCoupon?.code || null,
                                    error_description: errorMsg,
                                    transaction_id: response.razorpay_payment_id
                                });
                                queryClient.invalidateQueries({ queryKey: ['user-payments'] });
                            } catch (e) {
                                console.error('Failed to log failed payment:', e);
                            }
                        }
                    },
                    prefill: {
                        name: `${user?.first_name || ''} ${user?.last_name || ''}`,
                        email: user?.email || '',
                        contact: user?.mobile_number || ''
                    },
                    theme: {
                        color: "#4F46E5"
                    },
                    modal: {
                        ondismiss: async function () {
                            setIsProcessing(false);
                            // Log user cancelled checkout
                            try {
                                await api.post('/subscriptions/payments/record_failed/', {
                                    plan_id: matchingPlan.id,
                                    coupon_code: appliedCoupon?.code || null,
                                    error_description: 'Checkout modal dismissed by user'
                                });
                                queryClient.invalidateQueries({ queryKey: ['user-payments'] });
                            } catch (e) {
                                console.error('Failed to log cancelled payment:', e);
                            }
                        }
                    }
                };
                const rzp = new (window as any).Razorpay(options);
                rzp.open();
            }

        } catch (err: any) {
            const errorMsg = err.response?.data?.error || 'Unable to initialize checkout. Please try again.';
            setPaymentError(errorMsg);
            setIsProcessing(false);
            // Log failed payment on the backend
            try {
                await api.post('/subscriptions/payments/record_failed/', {
                    plan_id: matchingPlan.id,
                    coupon_code: appliedCoupon?.code || null,
                    error_description: errorMsg
                });
                queryClient.invalidateQueries({ queryKey: ['user-payments'] });
            } catch (e) {
                console.error('Failed to log failed payment:', e);
            }
        }
    };

    const calendarMonths = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const attemptsMap = {
        FOUNDATION: ['January', 'May', 'September'],
        INTERMEDIATE: ['January', 'May', 'September'],
        FINAL: ['May', 'November']
    };

    const currentAttempts = attemptsMap[selectedLevel] || [];

    const faqs = [
        { q: "How do Monthly and Attempt-wise cycles differ?", a: "Monthly plans give you access for exactly 30 days from the purchase date. Attempt-wise plans keep your subscription active until the end of the exam month for that attempt cycle (e.g. access is sustained until May 31 for the May attempt)." },
        { q: "Can I subscribe to multiple subjects?", a: "Absolutely! The system maintains separate active plans per subject/group. Purchasing a plan for a new subject adds it alongside your existing active subject access." },
        { q: "Are prices inclusive of GST?", a: "No, a standard 18% GST (Goods and Services Tax) is calculated at the payment checkout screen according to Indian Tax Rules. A tax invoice is automatically generated for your records." }
    ];

    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
                        Subscription
                    </span>
                    <h1 className="text-3xl font-black text-text-primary mt-3">Subscription Planner</h1>
                    <p className="text-text-secondary font-semibold text-sm mt-1">Design your custom study plan based on exam levels, groups, and billing cycles.</p>
                </div>

                {/* Current Active Plan Widget */}
                <div className="bg-card px-6 py-4 rounded-2xl border border-border shadow-sm flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${user?.subscription_tier && user.subscription_tier !== 'Free Account' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-bg text-text-secondary border border-border'}`}>
                        <Sparkles size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Active Plan</p>
                        <p className="text-xs font-black text-text-primary mt-0.5" style={{ maxWidth: '240px', wordBreak: 'break-word' }}>
                            {user?.subscription_tier?.toUpperCase() || 'FREE ACCOUNT'}
                        </p>
                    </div>
                </div>
            </div>

            {plansLoading ? (
                <div className="min-h-[50vh] w-full flex items-center justify-center">
                    <Loader2 className="animate-spin text-primary" size={36} />
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* LEFT PANEL: CONFIGURATION CONTROLS */}
                        <div className="lg:col-span-2 space-y-6">

                            {/* Step 1: Course Level */}
                            <div className="bg-card rounded-3xl p-6 border border-border shadow-sm space-y-4">
                                <div className="flex items-center gap-2">
                                    <Award className="text-primary" size={20} />
                                    <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">1. Course Level</h3>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    {(['FOUNDATION', 'INTERMEDIATE', 'FINAL'] as const).map((lvl) => (
                                        <button
                                            key={lvl}
                                            onClick={() => setSelectedLevel(lvl)}
                                            className={`py-3.5 px-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border ${selectedLevel === lvl
                                                    ? 'bg-primary text-white border-primary shadow-lg shadow-primary/10 scale-[1.02]'
                                                    : 'bg-bg text-text-secondary border-border hover:bg-bg-secondary'
                                                }`}
                                        >
                                            CA {lvl.charAt(0) + lvl.slice(1).toLowerCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {selectedLevel !== 'INTERMEDIATE' ? (
                                <div className="bg-card rounded-[2rem] p-8 border border-border shadow-sm text-center py-16 space-y-6 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 to-orange-500" />
                                    <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-[1.25rem] flex items-center justify-center mx-auto border border-amber-500/20">
                                        <Sparkles size={32} />
                                    </div>
                                    <div className="max-w-md mx-auto space-y-3">
                                        <h3 className="text-xl font-black text-text-primary uppercase tracking-wider">CA {selectedLevel.charAt(0) + selectedLevel.slice(1).toLowerCase()} Coming Soon</h3>
                                        <p className="text-xs text-text-muted font-bold leading-relaxed">
                                            We are currently finalizing the exam question papers, suggested answers, and handwritten study notes for CA {selectedLevel.charAt(0) + selectedLevel.slice(1).toLowerCase()}. 
                                            This course level will be active for subscription very shortly!
                                        </p>
                                    </div>
                                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-600 rounded-xl text-[10px] font-black uppercase tracking-wider border border-amber-500/20">
                                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                        Under Development
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Step 2: Plan Scope */}
                                    <div className="bg-card rounded-3xl p-6 border border-border shadow-sm space-y-4">
                                        <div className="flex items-center gap-2">
                                            <Layers className="text-primary" size={20} />
                                            <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">2. Plan Scope</h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                onClick={() => setSelectedScope('PAPER_WISE')}
                                                className={`p-5 rounded-2xl text-left transition-all border flex flex-col justify-between ${selectedScope === 'PAPER_WISE'
                                                        ? 'border-primary bg-primary/5 ring-2 ring-primary/10'
                                                        : 'border-border bg-bg hover:bg-bg-secondary'
                                                    }`}
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-4 ${selectedScope === 'PAPER_WISE' ? 'bg-primary text-white' : 'bg-bg text-text-muted'}`}>
                                                    <BookOpen size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-text-primary uppercase">Paper-Wise Access</p>
                                                    <p className="text-[10px] text-text-muted font-bold mt-1">Unlock study materials, mock tests and solutions for a single specific paper.</p>
                                                </div>
                                            </button>
                                            <button
                                                onClick={() => setSelectedScope('GROUP_WISE')}
                                                className={`p-5 rounded-2xl text-left transition-all border flex flex-col justify-between ${selectedScope === 'GROUP_WISE'
                                                        ? 'border-primary bg-primary/5 ring-2 ring-primary/10'
                                                        : 'border-border bg-bg hover:bg-bg-secondary'
                                                    }`}
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-4 ${selectedScope === 'GROUP_WISE' ? 'bg-primary text-white' : 'bg-bg text-text-muted'}`}>
                                                    <Layers size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-text-primary uppercase">Group-Wise Access</p>
                                                    <p className="text-[10px] text-text-muted font-bold mt-1">Unlock the whole course or a specific group (e.g. Group 1 / Group 2) of papers.</p>
                                                </div>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Step 3: Billing Cycle */}
                                    <div className="bg-card rounded-3xl p-6 border border-border shadow-sm space-y-4">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="text-primary" size={20} />
                                            <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">3. Billing Cycle</h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                onClick={() => setSelectedCycle('ATTEMPT_WISE')}
                                                className={`p-5 rounded-2xl text-left transition-all border flex flex-col justify-between ${selectedCycle === 'ATTEMPT_WISE'
                                                        ? 'border-primary bg-primary/5 ring-2 ring-primary/10'
                                                        : 'border-border bg-bg hover:bg-bg-secondary'
                                                    }`}
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-4 ${selectedCycle === 'ATTEMPT_WISE' ? 'bg-primary text-white' : 'bg-bg text-text-muted'}`}>
                                                    <Award size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-text-primary uppercase">Attempt-Wise Billing</p>
                                                    <p className="text-[10px] text-text-muted font-bold mt-1">Pay once per exam attempt. Stay active until the end of the attempt exam month.</p>
                                                </div>
                                            </button>
                                            <button
                                                onClick={() => setSelectedCycle('MONTHLY')}
                                                className={`p-5 rounded-2xl text-left transition-all border flex flex-col justify-between ${selectedCycle === 'MONTHLY'
                                                        ? 'border-primary bg-primary/5 ring-2 ring-primary/10'
                                                        : 'border-border bg-bg hover:bg-bg-secondary'
                                                    }`}
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-4 ${selectedCycle === 'MONTHLY' ? 'bg-primary text-white' : 'bg-bg text-text-muted'}`}>
                                                    <Calendar size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-text-primary uppercase">Monthly Billing</p>
                                                    <p className="text-[10px] text-text-muted font-bold mt-1">Pay for exactly 30 days. Access starts immediately and stays active for a full 30-day duration.</p>
                                                </div>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Step 4: Specific Choices (Subject / Group Selection) */}
                                    <div className="bg-card rounded-3xl p-6 border border-border shadow-sm space-y-4">
                                        <div className="flex items-center gap-2">
                                            <BookOpen className="text-primary" size={20} />
                                            <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">4. Subject / Group Selection</h3>
                                        </div>

                                        {selectedScope === 'PAPER_WISE' ? (
                                            <div className="space-y-2">
                                                <label className="block text-[10px] font-black text-text-muted uppercase tracking-wider">Select Academic Paper</label>
                                                {hasNoDatabaseSubjects ? (
                                                    <select
                                                        value={selectedMockSubject}
                                                        onChange={(e) => setSelectedMockSubject(e.target.value)}
                                                        className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-4 focus:ring-primary/10 bg-bg text-xs font-bold text-text-primary"
                                                    >
                                                        <option value="">Select a Paper...</option>
                                                        {currentMockSubjects.map(sub => (
                                                            <option key={sub.code} value={sub.name}>{sub.name}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <select
                                                        value={selectedSubjectId}
                                                        onChange={(e) => setSelectedSubjectId(e.target.value)}
                                                        className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-4 focus:ring-primary/10 bg-bg text-xs font-bold text-text-primary"
                                                    >
                                                        <option value="">Select a Paper...</option>
                                                        {filteredSubjects.map(sub => (
                                                            <option key={sub.id} value={sub.id}>{sub.name}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <label className="block text-[10px] font-black text-text-muted uppercase tracking-wider">Select Group Scope</label>
                                                <div className="grid grid-cols-3 gap-3">
                                                    {(selectedLevel as string) === 'FOUNDATION' ? (
                                                        <>
                                                            <button
                                                                onClick={() => setSelectedGroup('ALL')}
                                                                className="py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider border bg-primary text-white border-primary"
                                                            >
                                                                Whole Course
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {(['GROUP_1', 'GROUP_2', 'ALL'] as const).map(grp => (
                                                                <button
                                                                    key={grp}
                                                                    onClick={() => setSelectedGroup(grp)}
                                                                    className={`py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${selectedGroup === grp
                                                                            ? 'bg-primary text-white border-primary'
                                                                            : 'bg-bg text-text-secondary border-border'
                                                                        }`}
                                                                >
                                                                    {grp === 'ALL' ? 'Both Groups' : grp.replace('_', ' ')}
                                                                </button>
                                                            ))}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Step 5: Period (Month / Attempt Selection) */}
                                    <div className="bg-card rounded-3xl p-6 border border-border shadow-sm space-y-4">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="text-primary" size={20} />
                                            <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">5. Target Period</h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {selectedCycle === 'MONTHLY' ? (
                                                <div className="md:col-span-2 space-y-2">
                                                    <label className="block text-[10px] font-black text-text-muted uppercase tracking-wider">Access Duration</label>
                                                    <div className="w-full px-4 py-3 bg-primary/10 border border-primary/20 rounded-xl text-xs font-black text-primary flex items-center gap-2 h-[46px]">
                                                        <CheckCircle size={14} className="text-primary shrink-0" />
                                                        <span>30 Days (Active Immediately)</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="md:col-span-2 space-y-2">
                                                    <label className="block text-[10px] font-black text-text-muted uppercase tracking-wider">Exam Attempt Month</label>
                                                    <select
                                                        value={selectedAttempt}
                                                        onChange={(e) => setSelectedAttempt(e.target.value)}
                                                        className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-4 focus:ring-primary/10 bg-bg text-xs font-bold text-text-primary"
                                                    >
                                                        {currentAttempts.map(att => (
                                                            <option key={att} value={att}>{att}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                <label className="block text-[10px] font-black text-text-muted uppercase tracking-wider">Year</label>
                                                <select
                                                    value={selectedYear}
                                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                                    className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-4 focus:ring-primary/10 bg-bg text-xs font-bold text-text-primary"
                                                >
                                                    <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                                                    <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* RIGHT PANEL: BILLING & CHECKOUT SUMMARY */}
                        <div className="space-y-6">
                            <div className="bg-card rounded-3xl border border-border shadow-lg p-6 space-y-6 relative overflow-hidden">
                                {/* Accent line */}
                                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-accent" />

                                <div>
                                    <h3 className="text-md font-black text-text-primary">Summary & Billing Panel</h3>
                                    <p className="text-[10px] text-text-muted font-bold mt-1">Review plan choices and tax calculation.</p>
                                </div>

                                {selectedLevel !== 'INTERMEDIATE' ? (
                                    <div className="text-center py-8 text-text-muted space-y-3">
                                        <AlertCircle className="mx-auto text-amber-500 animate-pulse" size={32} />
                                        <div className="space-y-1">
                                            <p className="text-xs font-black uppercase text-text-primary">CA {selectedLevel.charAt(0) + selectedLevel.slice(1).toLowerCase()} Plan</p>
                                            <p className="text-[10px] text-text-muted font-bold leading-relaxed">
                                                This course is coming soon. Billing and subscriptions are not active for this level yet.
                                            </p>
                                        </div>
                                    </div>
                                ) : matchingPlan ? (
                                    <div className="space-y-4">
                                        {/* Breakdown details */}
                                        <div className="bg-bg rounded-2xl p-4 border border-border text-xs font-semibold text-text-secondary space-y-2.5">
                                            <div className="flex justify-between">
                                                <span className="text-text-muted">Course Level</span>
                                                <span className="font-bold text-text-primary">CA {selectedLevel.charAt(0) + selectedLevel.slice(1).toLowerCase()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-text-muted">Billing Type</span>
                                                <span className="font-bold text-text-primary">{selectedCycle === 'MONTHLY' ? 'Monthly Subscription' : 'Attempt Wise'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-text-muted">Plan Type</span>
                                                <span className="font-bold text-text-primary">{selectedScope === 'PAPER_WISE' ? 'Paper Wise' : 'Group Wise'}</span>
                                            </div>

                                            {selectedScope === 'PAPER_WISE' ? (
                                                <div className="flex justify-between border-t border-border pt-2">
                                                    <span className="text-primary">Selected Paper</span>
                                                    <span className="font-black text-primary-hover max-w-[150px] text-right truncate">
                                                        {hasNoDatabaseSubjects
                                                            ? (selectedMockSubject || 'Not selected')
                                                            : (filteredSubjects.find(s => s.id.toString() === selectedSubjectId)?.name || 'Not selected')
                                                        }
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="flex justify-between border-t border-border pt-2">
                                                    <span className="text-primary">Selected Group</span>
                                                    <span className="font-black text-primary-hover">
                                                        {(selectedLevel as string) === 'FOUNDATION' ? 'Whole Course' : selectedGroup === 'ALL' ? 'Both Groups' : selectedGroup.replace('_', ' ')}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="flex justify-between border-t border-border pt-2">
                                                <span className="text-text-muted">Selected Attempt</span>
                                                <span className="font-bold text-text-primary">
                                                    {selectedCycle === 'MONTHLY' ? '30 Days Duration' : `${selectedAttempt} ${selectedYear}`}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Coupon application area */}
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-black text-text-muted uppercase tracking-wider">Coupon Code</label>

                                            {appliedCoupon ? (
                                                <div className="flex items-center justify-between p-3.5 bg-green-500/10 border border-green-500/20 rounded-xl text-xs font-bold text-green-600">
                                                    <div className="flex items-center gap-2">
                                                        <Tag size={16} />
                                                        <span>{appliedCoupon.code} ({appliedCoupon.discountPercent}% Off)</span>
                                                    </div>
                                                    <button
                                                        onClick={handleRemoveCoupon}
                                                        className="text-text-muted hover:text-red-500 font-extrabold text-sm px-1.5"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="SAVE50"
                                                        value={couponCodeInput}
                                                        onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                                                        className="flex-1 px-3 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-4 focus:ring-primary/10 text-xs font-bold uppercase bg-bg text-text-primary"
                                                    />
                                                    <button
                                                        onClick={handleApplyCoupon}
                                                        disabled={isValidatingCoupon || !couponCodeInput.trim()}
                                                        className="px-4 py-2.5 bg-primary text-white rounded-xl text-xs font-black uppercase hover:bg-primary-hover disabled:opacity-50 transition-colors"
                                                    >
                                                        {isValidatingCoupon ? <Loader2 size={14} className="animate-spin" /> : 'Apply'}
                                                    </button>
                                                </div>
                                            )}
                                            {couponError && <p className="text-[10px] text-red-500 font-bold">✗ {couponError}</p>}
                                            {couponSuccess && <p className="text-[10px] text-green-600 font-bold">✓ {couponSuccess}</p>}
                                        </div>

                                        {/* Cost breakdown */}
                                        <div className="border-t border-border pt-4 space-y-2">
                                            <div className="flex justify-between text-xs font-semibold text-text-secondary">
                                                <span>Price (Excl. Tax)</span>
                                                <span>₹{basePrice.toFixed(2)}</span>
                                            </div>
                                            {appliedCoupon && (
                                                <div className="flex justify-between text-xs font-semibold text-green-600">
                                                    <span>Discount ({appliedCoupon.discountPercent}%)</span>
                                                    <span>-₹{discountAmount.toFixed(2)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between text-xs font-semibold text-text-secondary border-b border-border pb-2">
                                                <span>GST (18%)</span>
                                                <span>₹{gstAmount.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-baseline pt-2">
                                                <span className="text-sm font-black text-text-primary">Final Amount</span>
                                                <span className="text-2xl font-black text-primary">₹{finalPrice.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        {paymentError && (
                                            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-xl text-[11px] font-bold flex items-center gap-2">
                                                <AlertCircle size={14} />
                                                <span>{paymentError}</span>
                                            </div>
                                        )}

                                        {paymentSuccess ? (
                                            <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-600 rounded-xl text-xs font-black flex items-center gap-2 justify-center">
                                                <CheckCircle size={16} />
                                                <span>Payment Success! Access Granted.</span>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={handleCheckout}
                                                disabled={isProcessing}
                                                className="w-full py-4 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-primary-hover shadow-xl shadow-primary/10 transition-all flex items-center justify-center gap-2 mt-4 hover:scale-[1.02] disabled:opacity-80"
                                            >
                                                {isProcessing ? (
                                                    <>
                                                        <Loader2 className="animate-spin" size={14} />
                                                        <span>PROCESSING PAYMENT...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>PROCEED TO PURCHASE</span>
                                                        <ArrowRight size={14} />
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-text-muted">
                                        <AlertCircle className="mx-auto mb-2" size={24} />
                                        <p className="text-xs font-semibold">No plan matching this configuration was found.</p>
                                    </div>
                                )}
                            </div>

                            {/* FAQs Accordion */}
                            <div className="bg-card rounded-3xl border border-border p-6 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <HelpCircle className="text-primary" size={20} />
                                    <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">Subscription FAQs</h3>
                                </div>
                                <div className="space-y-4">
                                    {faqs.map((faq, i) => (
                                        <div key={i} className="space-y-1">
                                            <h4 className="text-[11px] font-black text-text-primary uppercase tracking-wide">{faq.q}</h4>
                                            <p className="text-[11px] text-text-secondary font-semibold leading-relaxed">{faq.a}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Payment History */}
                    <div className="bg-card rounded-3xl border border-border p-6 md:p-8 shadow-sm space-y-6 mt-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                                    <CreditCard size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-text-primary uppercase tracking-wider">Payment History</h3>
                                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-0.5">Manage and download your tax invoices.</p>
                                </div>
                            </div>
                        </div>

                        {paymentsLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="animate-spin text-primary" size={24} />
                            </div>
                        ) : paymentHistory.length === 0 ? (
                            <div className="text-center py-8 border border-dashed border-border rounded-2xl">
                                <p className="text-xs text-text-secondary font-semibold">No transactions found.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-border text-[10px] font-black text-text-muted uppercase tracking-wider">
                                            <th className="pb-4 font-black">Plan</th>
                                            <th className="pb-4 font-black">Transaction ID</th>
                                            <th className="pb-4 font-black">Amount</th>
                                            <th className="pb-4 font-black">Date</th>
                                            <th className="pb-4 font-black text-center">Status</th>
                                            <th className="pb-4 font-black text-right">Invoice</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {paymentHistory.map((pay: any) => (
                                            <tr key={pay.id} className="text-text-secondary">
                                                <td className="py-4 font-black text-text-primary">{pay.plan_name}</td>
                                                <td className="py-4 font-mono text-[10px] font-bold">{pay.transaction_id}</td>
                                                <td className="py-4 font-black text-primary">₹{parseFloat(pay.amount).toFixed(2)}</td>
                                                <td className="py-4 font-bold text-[11px]">{new Date(pay.created_at).toLocaleDateString(undefined, { timeZone: 'UTC' })}</td>
                                                <td className="py-4 text-center">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${pay.status === 'SUCCESS'
                                                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                                            : pay.status === 'FAILED'
                                                                ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                                                                : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                                        }`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${pay.status === 'SUCCESS' ? 'bg-emerald-500' : pay.status === 'FAILED' ? 'bg-red-500' : 'bg-amber-500'
                                                            }`} />
                                                        {pay.status}
                                                    </span>
                                                </td>
                                                <td className="py-4 text-right">
                                                    {pay.status === 'SUCCESS' ? (
                                                        <button
                                                            onClick={() => handleDownloadInvoice(pay.id, pay.transaction_id)}
                                                            disabled={downloadingId === pay.id}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg border border-border hover:border-primary hover:text-primary rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all disabled:opacity-50"
                                                        >
                                                            {downloadingId === pay.id ? (
                                                                <Loader2 className="animate-spin" size={12} />
                                                            ) : (
                                                                <Download size={12} />
                                                            )}
                                                            <span>Invoice</span>
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

