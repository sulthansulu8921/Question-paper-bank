import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/axios';
import { useAuthStore } from '@/store/useAuthStore';
import { 
    User, Mail, Shield, Award, Calendar, ExternalLink, Loader2, Edit3, Check, 
    CreditCard, Download, AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';

interface Subscription {
    id: number;
    plan_name: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
    level_title: string;
    subject_name?: string;
    group?: string;
    exam_attempt?: string;
    year?: number;
}

interface PaymentRecord {
    id: number;
    plan_name: string;
    amount: string;
    base_amount: string;
    gst_amount: string;
    transaction_id: string;
    status: 'SUCCESS' | 'PENDING' | 'FAILED';
    created_at: string;
    coupon_code?: string;
    discount_amount?: string;
    original_amount?: string;
}

interface ExpiryAlert {
    id: string;
    type: 'DANGER' | 'WARNING' | 'INFO';
    title: string;
    message: string;
    days_left: number;
}

export default function AccountPage() {
    const user = useAuthStore((state) => state.user);
    const updateProfile = useAuthStore((state) => state.updateProfile);

    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [fullName, setFullName] = useState(user?.full_name || 'Student User');
    const [activeTab, setActiveTab] = useState<'profile' | 'billing'>('profile');
    const [downloadingId, setDownloadingId] = useState<number | null>(null);

    // Fetch active subscriptions
    const { data: mySubscriptions = [], isLoading: subsLoading } = useQuery<Subscription[]>({
        queryKey: ['my-subscriptions'],
        queryFn: async () => (await api.get('/subscriptions/my-subscriptions/')).data,
    });

    // Fetch payment records
    const { data: paymentHistory = [], isLoading: paymentsLoading } = useQuery<PaymentRecord[]>({
        queryKey: ['user-payments'],
        queryFn: async () => (await api.get('/subscriptions/payments/')).data,
    });

    // Fetch alerts
    const { data: alerts = [] } = useQuery<ExpiryAlert[]>({
        queryKey: ['expiry-alerts'],
        queryFn: async () => (await api.get('/subscriptions/my-subscriptions/notifications/')).data,
    });

    const initials = (isEditing ? fullName : (user?.full_name || 'Student User'))
        .split(' ').map((n: string) => n[0] || '').join('').substring(0, 2).toUpperCase() || 'US';

    const handleSave = async () => {
        if (!isEditing) {
            setIsEditing(true);
            setFullName(user?.full_name || 'Student User');
            return;
        }

        setIsSaving(true);
        try {
            await updateProfile({ full_name: fullName });
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to update profile', error);
        } finally {
            setIsSaving(false);
        }
    };

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

    return (
        <div className="space-y-8 pb-20 max-w-4xl mx-auto p-4 md:p-0">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-black text-text-primary tracking-tight">Student Dashboard</h1>
                <p className="text-text-muted font-bold text-sm mt-2 uppercase tracking-widest">Track subscriptions, payments, and view learning details.</p>
            </div>

            {/* Expiry Alerts section */}
            {alerts.length > 0 && (
                <div className="space-y-3">
                    {alerts.map((alert) => (
                        <div 
                            key={alert.id} 
                            className={`p-4 rounded-2xl border flex items-start gap-3.5 shadow-sm ${
                                alert.type === 'DANGER' 
                                ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400' 
                                : alert.type === 'WARNING' 
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' 
                                : 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
                            }`}
                        >
                            <AlertTriangle className="shrink-0 mt-0.5" size={18} />
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider">{alert.title}</h4>
                                <p className="text-xs font-medium mt-1 opacity-90">{alert.message}</p>
                                <a 
                                    href="/dashboard/subscription" 
                                    className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider mt-2 hover:underline"
                                >
                                    Renew Access Now <ExternalLink size={10} />
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Tabs Selector */}
            <div className="flex border-b border-border gap-6">
                <button
                    onClick={() => setActiveTab('profile')}
                    className={`pb-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                        activeTab === 'profile' 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-text-secondary hover:text-text-primary'
                    }`}
                >
                    Profile Details
                </button>
                <button
                    onClick={() => setActiveTab('billing')}
                    className={`pb-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'billing' 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-text-secondary hover:text-text-primary'
                    }`}
                >
                    Subscriptions & Billing
                </button>
            </div>

            {/* Tab content */}
            {activeTab === 'profile' ? (
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-[2.5rem] border border-border shadow-sm overflow-hidden"
                >
                    {/* Banner */}
                    <div className="h-32 bg-gradient-to-r from-primary to-accent relative">
                        <div className="absolute inset-0 bg-white/10 mix-blend-overlay" />
                    </div>

                    <div className="px-6 md:px-10 pb-10 relative">
                        {/* Floating Avatar */}
                        <div className="absolute -top-12 left-6 md:left-10 w-24 h-24 bg-card rounded-3xl p-2 shadow-xl transition-all">
                            <div className="w-full h-full bg-gradient-to-tr from-primary to-accent rounded-2xl flex items-center justify-center">
                                <span className="text-3xl font-black text-white">{initials}</span>
                            </div>
                        </div>

                        <div className="pt-16 pb-8 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1 mr-4">
                                {isEditing ? (
                                    <input
                                        autoFocus
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="text-3xl font-black text-text-primary bg-bg border border-border rounded-xl px-4 py-2 w-full focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all font-sans"
                                    />
                                ) : (
                                    <h2 className="text-3xl font-black text-text-primary">{user?.full_name || 'Student User'}</h2>
                                )}
                                <div className="flex items-center gap-3 mt-3">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-success/10 text-success text-[10px] font-black uppercase tracking-widest rounded-lg">
                                        <Shield size={12} /> Verified
                                    </span>
                                    <span className="text-sm font-bold text-text-muted">{user?.email || 'student@example.com'}</span>
                                </div>
                            </div>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-6 py-3 rounded-xl text-xs flex items-center gap-2 font-black uppercase tracking-widest shadow-md transition-all shrink-0 bg-primary text-white hover:bg-primary-hover"
                            >
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : isEditing ? <Check size={16} /> : <Edit3 size={16} />}
                                {isEditing ? 'Save Changes' : 'Edit Profile'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8">
                            <div>
                                <h3 className="text-xs font-black text-text-muted uppercase tracking-widest mb-6">Personal Details</h3>
                                <div className="space-y-6">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 bg-bg text-text-muted rounded-xl flex items-center justify-center shrink-0">
                                            <User size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Full Name</p>
                                            <p className="text-sm font-black text-text-primary">{user?.full_name || 'Student User'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 bg-bg text-text-muted rounded-xl flex items-center justify-center shrink-0">
                                            <Mail size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Email Address</p>
                                            <p className="text-sm font-black text-text-primary">{user?.email || 'student@example.com'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xs font-black text-text-muted uppercase tracking-widest mb-6">Academic Plan</h3>
                                <div className="space-y-6">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center shrink-0">
                                            <Award size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Current Tier</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-black text-text-primary">{user?.subscription_tier?.toUpperCase() || 'FREE ACCOUNT'}</p>
                                                <a href="/dashboard/subscription" className="text-[10px] text-primary font-black uppercase tracking-widest hover:underline flex items-center gap-1">Upgrade <ExternalLink size={10} /></a>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                                            <Calendar size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Member Since</p>
                                            <p className="text-sm font-black text-text-primary">May 2026</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-8"
                >
                    {/* ACTIVE SUBSCRIPTIONS */}
                    <div className="bg-card rounded-3xl border border-border shadow-sm p-6 md:p-8 space-y-6">
                        <div>
                            <h3 className="text-lg font-black text-text-primary">Active Subscriptions</h3>
                            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">Unlock status for CA study materials.</p>
                        </div>

                        {subsLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="animate-spin text-primary" size={24} />
                            </div>
                        ) : mySubscriptions.length === 0 ? (
                            <div className="p-8 text-center bg-bg rounded-2xl border border-border">
                                <Award className="mx-auto text-text-muted mb-2" size={32} />
                                <p className="text-xs text-text-secondary font-semibold">No active subscriptions found. Upgrade to access premium study materials.</p>
                                <a 
                                    href="/dashboard/subscription" 
                                    className="inline-block mt-4 px-6 py-2.5 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-primary-hover transition-colors"
                                >
                                    Unlock Materials
                                </a>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {mySubscriptions.map((sub) => {
                                    const diff = new Date(sub.end_date).getTime() - new Date().getTime();
                                    const daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
                                    return (
                                        <div 
                                            key={sub.id} 
                                            className={`p-5 rounded-2xl border relative overflow-hidden transition-all hover:shadow-md ${
                                                sub.is_active 
                                                ? 'bg-primary/5 border-primary/20' 
                                                : 'bg-bg border-border'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <span className="text-[9px] font-black text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                        {sub.level_title}
                                                    </span>
                                                    <h4 className="text-sm font-black text-text-primary mt-2">
                                                        {sub.subject_name || sub.group?.replace('_', ' ') || 'Full Course Access'}
                                                    </h4>
                                                    <p className="text-[10px] text-text-muted font-bold mt-1">
                                                        {sub.exam_attempt ? `${sub.exam_attempt} ${sub.year} Attempt` : '30-Day Duration Plan'}
                                                    </p>
                                                </div>
                                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                                    sub.is_active 
                                                    ? 'bg-green-500 text-white shadow-sm' 
                                                    : 'bg-border text-text-muted'
                                                }`}>
                                                    {sub.is_active ? 'Active' : 'Expired'}
                                                </span>
                                            </div>

                                            {/* Progress / Expiry info */}
                                            {sub.is_active && (
                                                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-[10px] font-bold text-text-secondary">
                                                    <span>Expires on: {new Date(sub.end_date).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'})}</span>
                                                    <span className={`${daysLeft <= 7 ? 'text-red-500 font-black' : 'text-primary'}`}>
                                                        {daysLeft === 0 ? 'Expires Today' : `${daysLeft} days left`}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* PAYMENT HISTORY */}
                    <div className="bg-card rounded-3xl border border-border shadow-sm p-6 md:p-8 space-y-6">
                        <div>
                            <h3 className="text-lg font-black text-text-primary">Payment History</h3>
                            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">Manage and download your tax invoices.</p>
                        </div>

                        {paymentsLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="animate-spin text-primary" size={24} />
                            </div>
                        ) : paymentHistory.length === 0 ? (
                            <div className="p-8 text-center bg-bg rounded-2xl border border-border">
                                <CreditCard className="mx-auto text-text-muted mb-2" size={32} />
                                <p className="text-xs text-text-secondary font-semibold">No payments processed yet.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-border text-text-muted uppercase tracking-wider font-bold">
                                            <th className="py-3 px-2">Date</th>
                                            <th className="py-3 px-2">Transaction ID</th>
                                            <th className="py-3 px-2">Plan</th>
                                            <th className="py-3 px-2 text-right">Tax (18%)</th>
                                            <th className="py-3 px-2 text-right">Amount Paid</th>
                                            <th className="py-3 px-2 text-center">Status</th>
                                            <th className="py-3 px-2 text-center">Receipt</th>
                                        </tr>
                                    </thead>
                                    <tbody className="font-semibold text-text-secondary">
                                        {paymentHistory.map((pmt) => (
                                            <tr key={pmt.id} className="border-b border-border/50 hover:bg-bg-secondary transition-colors">
                                                <td className="py-3.5 px-2">{new Date(pmt.created_at).toLocaleDateString()}</td>
                                                <td className="py-3.5 px-2 text-text-muted font-mono text-[10px]">{pmt.transaction_id}</td>
                                                <td className="py-3.5 px-2 text-text-primary font-bold">{pmt.plan_name}</td>
                                                <td className="py-3.5 px-2 text-right">₹{parseFloat(pmt.gst_amount || '0').toFixed(2)}</td>
                                                <td className="py-3.5 px-2 text-right text-primary font-black">₹{parseFloat(pmt.amount).toFixed(2)}</td>
                                                <td className="py-3.5 px-2 text-center">
                                                    <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                                        pmt.status === 'SUCCESS' 
                                                        ? 'bg-green-500/20 text-green-600 dark:text-green-400' 
                                                        : pmt.status === 'PENDING' 
                                                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' 
                                                        : 'bg-red-500/20 text-red-600 dark:text-red-400'
                                                    }`}>
                                                        {pmt.status}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-2 text-center">
                                                    {pmt.status === 'SUCCESS' ? (
                                                        <button
                                                            onClick={() => handleDownloadInvoice(pmt.id, pmt.transaction_id)}
                                                            disabled={downloadingId === pmt.id}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-bg hover:bg-primary hover:text-white rounded-lg text-text-primary font-black uppercase tracking-wider text-[9px] transition-all disabled:opacity-50 border border-border"
                                                        >
                                                            {downloadingId === pmt.id ? (
                                                                <Loader2 size={10} className="animate-spin" />
                                                            ) : (
                                                                <Download size={10} />
                                                            )}
                                                            <span>PDF</span>
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] text-text-muted">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </div>
    );
}
