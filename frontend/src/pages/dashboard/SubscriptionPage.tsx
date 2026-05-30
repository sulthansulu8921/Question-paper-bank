import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { useAuthStore } from '@/store/useAuthStore';
import { 
    CreditCard, CheckCircle, Sparkles, ShieldCheck, 
    Loader2, Lock, AlertCircle, HelpCircle, ArrowRight, Check 
} from 'lucide-react';

interface Plan {
    id: number;
    name: string;
    price: string;
    duration_days: number;
    description: string;
}

const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.5 }
};

export default function SubscriptionPage() {
    const user = useAuthStore((state) => state.user);
    const hydrate = useAuthStore((state) => state.hydrate);
    const queryClient = useQueryClient();

    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [cardNumber, setCardNumber] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cardCvc, setCardCvc] = useState('');
    const [cardName, setCardName] = useState('');
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [paymentError, setPaymentError] = useState('');

    // Fetch subscription plans
    const { data: plans = [], isLoading } = useQuery<Plan[]>({
        queryKey: ['subscription-plans'],
        queryFn: async () => (await api.get('/subscriptions/plans/')).data,
    });

    // Subscribe mutation
    const subscribeMutation = useMutation({
        mutationFn: async (planId: number) => {
            return (await api.post('/subscriptions/my-subscriptions/', { plan_id: planId })).data;
        },
        onSuccess: async () => {
            await hydrate(); // Re-fetch user profile (includes subscription_tier)
            queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
            setPaymentSuccess(true);
            setTimeout(() => {
                setIsCheckoutOpen(false);
                setPaymentSuccess(false);
                setSelectedPlan(null);
                // Clear payment fields
                setCardNumber('');
                setCardExpiry('');
                setCardCvc('');
                setCardName('');
            }, 3000);
        },
        onError: (err: any) => {
            setPaymentError(err.response?.data?.error || 'Payment failed. Please try again.');
        }
    });

    const handleSelectPlan = (plan: Plan) => {
        setPaymentError('');
        setSelectedPlan(plan);
        setIsCheckoutOpen(true);
    };

    const handleCheckoutSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlan) return;
        setPaymentError('');
        subscribeMutation.mutate(selectedPlan.id);
    };

    // Format credit card helpers
    const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '').substring(0, 16);
        const formatted = val.replace(/(.{4})/g, '$1 ').trim();
        setCardNumber(formatted);
    };

    const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '').substring(0, 4);
        if (val.length >= 2) {
            setCardExpiry(val.substring(0, 2) + '/' + val.substring(2));
        } else {
            setCardExpiry(val);
        }
    };

    const faqs = [
        { q: "How do I access premium questions?", a: "Once your subscription is activated, premium badges will update instantly across your dashboard. Simply click on any Master Question, and the full theory or MCQ answer key will unlock automatically." },
        { q: "Can I cancel my active plan?", a: "Yes, you can cancel or change your plan at any time from your Account settings. Your premium features will remain active until the end of your billing cycle." },
        { q: "What payments do you support?", a: "We support all major Indian and international debit/credit cards, UPI transactions, NetBanking, and mobile wallets." }
    ];

    if (isLoading) {
        return (
            <div className="min-h-[70vh] w-full flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-12">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
                        Upgrade Account
                    </span>
                    <h1 className="text-3xl font-black text-slate-900 mt-3">Subscription Plans</h1>
                    <p className="text-slate-500 font-semibold text-sm mt-1">Unlock premium questions, key solutions, and master exam resources.</p>
                </div>

                {/* Current Active Plan Widget */}
                <div className="bg-white px-6 py-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${user?.subscription_tier && user.subscription_tier !== 'Free Account' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                        <Sparkles size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Plan</p>
                        <p className="text-sm font-black text-slate-900 mt-0.5">{user?.subscription_tier?.toUpperCase() || 'FREE ACCOUNT'}</p>
                    </div>
                </div>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {plans.map((plan: Plan, idx: number) => {
                    const isActive = user?.subscription_tier?.toLowerCase() === plan.name.toLowerCase();
                    const isPremium = plan.name.toLowerCase().includes('annual') || plan.name.toLowerCase().includes('pro');

                    return (
                        <motion.div
                            key={plan.id}
                            {...fadeUp}
                            transition={{ delay: idx * 0.1 }}
                            className={`relative rounded-3xl p-8 bg-white border shadow-md flex flex-col justify-between overflow-hidden group hover:shadow-xl transition-all duration-300 ${
                                isActive ? 'border-primary ring-2 ring-primary/20' : 'border-slate-100'
                            }`}
                        >
                            {/* Decorative Background Blob */}
                            <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[60px] opacity-20 -z-10 group-hover:scale-125 transition-transform duration-500 ${
                                isPremium ? 'bg-amber-500' : 'bg-primary'
                            }`} />

                            <div>
                                {/* Popular/Pro Tag */}
                                {isPremium && (
                                    <span className="absolute top-4 right-4 text-[9px] font-black text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                        PRO CHOICE
                                    </span>
                                )}

                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{plan.name}</p>
                                <div className="flex items-baseline gap-1 mt-4">
                                    <span className="text-3xl font-black text-slate-900">₹{parseFloat(plan.price).toLocaleString('en-IN')}</span>
                                    <span className="text-xs text-slate-400 font-bold">/ {plan.duration_days} Days</span>
                                </div>
                                <p className="text-slate-500 text-xs mt-3 leading-relaxed font-semibold min-h-[40px]">{plan.description}</p>

                                <hr className="my-6 border-slate-100" />

                                {/* Benefits checklist */}
                                <ul className="space-y-3">
                                    <li className="flex items-center gap-3 text-xs font-bold text-slate-700">
                                        <div className="w-5 h-5 bg-green-50 text-green-600 rounded-full flex items-center justify-center"><Check size={12} /></div>
                                        <span>Unlock solutions & tables</span>
                                    </li>
                                    <li className="flex items-center gap-3 text-xs font-bold text-slate-700">
                                        <div className="w-5 h-5 bg-green-50 text-green-600 rounded-full flex items-center justify-center"><Check size={12} /></div>
                                        <span>Unlimited practice sets</span>
                                    </li>
                                    <li className="flex items-center gap-3 text-xs font-bold text-slate-700">
                                        <div className="w-5 h-5 bg-green-50 text-green-600 rounded-full flex items-center justify-center"><Check size={12} /></div>
                                        <span>Full progress tracking</span>
                                    </li>
                                </ul>
                            </div>

                            <button
                                onClick={() => handleSelectPlan(plan)}
                                disabled={isActive}
                                className={`w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all mt-8 flex items-center justify-center gap-2 ${
                                    isActive 
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' 
                                    : 'bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95'
                                }`}
                            >
                                {isActive ? 'CURRENT ACTIVE PLAN' : 'SELECT PLAN'}
                                {!isActive && <ArrowRight size={14} />}
                            </button>
                        </motion.div>
                    );
                })}
            </div>

            {/* FAQs Accordion */}
            <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
                <div className="flex items-center gap-3">
                    <HelpCircle className="text-primary" size={24} />
                    <h2 className="text-lg font-black text-slate-900">Subscription FAQs</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-6">
                    {faqs.map((faq, i) => (
                        <div key={i} className="space-y-2">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">{faq.q}</h3>
                            <p className="text-xs text-slate-500 font-semibold leading-relaxed">{faq.a}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Checkout Dialog Overlay */}
            <AnimatePresence>
                {isCheckoutOpen && selectedPlan && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 relative"
                        >
                            {/* Header details */}
                            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selected Plan</p>
                                    <h3 className="text-md font-black text-slate-900 mt-0.5">{selectedPlan.name}</h3>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</p>
                                    <h3 className="text-md font-black text-primary mt-0.5">₹{parseFloat(selectedPlan.price).toFixed(2)}</h3>
                                </div>
                            </div>

                            {paymentSuccess ? (
                                /* Success Screen */
                                <div className="p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
                                    <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-green-200 animate-bounce">
                                        <CheckCircle size={36} />
                                    </div>
                                    <h4 className="text-lg font-black text-slate-900 mt-6">Payment Successful!</h4>
                                    <p className="text-xs text-slate-500 font-semibold mt-2">Your subscription has been activated successfully.</p>
                                </div>
                            ) : (
                                /* Checkout Form */
                                <form onSubmit={handleCheckoutSubmit} className="p-6 space-y-5">
                                    {paymentError && (
                                        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2">
                                            <AlertCircle size={16} />
                                            <span>{paymentError}</span>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Cardholder Name</label>
                                        <input
                                            required
                                            type="text"
                                            value={cardName}
                                            onChange={(e) => setCardName(e.target.value)}
                                            placeholder="John Doe"
                                            className="w-full px-4 py-3 rounded-xl border border-slate-100 focus:outline-none focus:ring-4 focus:ring-primary/10 bg-slate-50/50 text-xs font-semibold"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Card Number</label>
                                        <div className="relative">
                                            <input
                                                required
                                                type="text"
                                                value={cardNumber}
                                                onChange={handleCardNumberChange}
                                                placeholder="0000 0000 0000 0000"
                                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-100 focus:outline-none focus:ring-4 focus:ring-primary/10 bg-slate-50/50 text-xs font-semibold"
                                            />
                                            <CreditCard className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Expiry Date</label>
                                            <input
                                                required
                                                type="text"
                                                value={cardExpiry}
                                                onChange={handleExpiryChange}
                                                placeholder="MM/YY"
                                                className="w-full px-4 py-3 rounded-xl border border-slate-100 focus:outline-none focus:ring-4 focus:ring-primary/10 bg-slate-50/50 text-xs font-semibold text-center"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">CVC</label>
                                            <input
                                                required
                                                type="password"
                                                value={cardCvc}
                                                onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').substring(0, 3))}
                                                placeholder="***"
                                                className="w-full px-4 py-3 rounded-xl border border-slate-100 focus:outline-none focus:ring-4 focus:ring-primary/10 bg-slate-50/50 text-xs font-semibold text-center"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                                        <ShieldCheck size={16} className="text-green-600 flex-shrink-0" />
                                        <span>Secured mock checkout. No real money will be charged.</span>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsCheckoutOpen(false)}
                                            className="w-1/2 py-3.5 border border-slate-100 text-slate-500 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-50 transition-colors"
                                        >
                                            CANCEL
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={subscribeMutation.isPending}
                                            className="w-1/2 py-3.5 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-primary-hover shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition-all disabled:opacity-75"
                                        >
                                            {subscribeMutation.isPending ? (
                                                <Loader2 size={14} className="animate-spin" />
                                            ) : (
                                                <>
                                                    <Lock size={12} />
                                                    <span>PAY NOW</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
