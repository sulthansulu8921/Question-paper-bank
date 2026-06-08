import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/axios';
import { useAuthStore } from '@/store/useAuthStore';
import { 
    Search, 
    Loader2, 
    Calendar, 
    XCircle, 
    AlertCircle, 
    Eye, 
    Tag, 
    Download, 
    DollarSign, 
    Percent, 
    TrendingUp,
    User,
    Phone,
    Mail,
    FileText,
    Shield
} from 'lucide-react';
import AdminModal from '@/components/admin/AdminModal';
import '@/styles/admin/QuestionManagement.css';

interface Payment {
    id: number;
    user: number;
    user_email: string;
    user_name: string;
    user_mobile: string;
    plan: number | null;
    plan_name: string | null;
    plan_price: string | null;
    plan_duration: number | null;
    amount: string;
    transaction_id: string | null;
    status: 'SUCCESS' | 'PENDING' | 'FAILED';
    created_at: string;
    coupon_code: string | null;
    discount_amount: string;
    original_amount: string | null;
}

export default function AdminPaymentManager() {
    const user = useAuthStore((s) => s.user);
    const isAuthorized = !!user?.is_superuser;

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

    // Fetch payments list
    const { data: payments = [], isLoading, error } = useQuery<Payment[]>({
        queryKey: ['admin-payments-history'],
        queryFn: async () => (await api.get('/subscriptions/payments/')).data,
        refetchInterval: 30000 // Refetch every 30 seconds for live updates
    });

    // Formatting date helper
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const maskEmail = (email?: string) => {
        if (!email) return '—';
        const parts = email.split('@');
        if (parts.length !== 2) return email;
        const [name, domain] = parts;
        return `${name.slice(0, Math.min(2, name.length))}***@${domain}`;
    };

    // Calculate metrics
    const successfulPayments = payments.filter(p => p.status === 'SUCCESS');
    const totalCollected = successfulPayments.reduce((acc, p) => acc + parseFloat(p.amount), 0);
    const totalDiscount = successfulPayments.reduce((acc, p) => acc + parseFloat(p.discount_amount), 0);
    const totalTransactionsCount = payments.length;
    const failedTransactionsCount = payments.filter(p => p.status === 'FAILED').length;

    // Filter payments
    const filteredPayments = payments.filter(p => {
        const matchesSearch = 
            p.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.coupon_code?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    // Export CSV Helper
    const handleExportCSV = () => {
        const headers = ['Transaction ID', 'User Name', 'User Email', 'Mobile', 'Fee Type', 'Original Amount', 'Coupon Code', 'Discount Amount', 'Amount Paid', 'Status', 'Date'];
        const rows = filteredPayments.map(p => [
            p.transaction_id || '—',
            p.user_name || '—',
            p.user_email || '—',
            p.user_mobile || '—',
            p.plan_name || '—',
            p.original_amount ? `Rs. ${p.original_amount}` : '—',
            p.coupon_code || '—',
            p.discount_amount ? `Rs. ${p.discount_amount}` : '0',
            `Rs. ${p.amount}`,
            p.status,
            formatDate(p.created_at)
        ]);

        const csvContent = [headers, ...rows].map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `payment_history_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!isAuthorized) {
        return (
            <div className="qm-container flex flex-col items-center justify-center text-center font-sans" style={{ minHeight: '60vh', padding: '3rem' }}>
                <div style={{ display: 'inline-flex', padding: '1.5rem', borderRadius: '2rem', background: 'rgba(239, 68, 68, 0.05)', color: 'rgb(239, 68, 68)', marginBottom: '1.5rem' }}>
                    <Shield size={64} />
                </div>
                <h1 className="page-title text-2xl font-black text-gray-900 mb-2">Access Denied</h1>
                <p className="text-slate-400 font-medium max-w-md mx-auto leading-relaxed">
                    Only administrators have authorization to access transaction ledgers.
                </p>
            </div>
        );
    }

    return (
        <div className="qm-container px-6 py-6 font-sans">
            {/* Header */}
            <div className="qm-header flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <div className="flex items-center gap-2 text-accent mb-1">
                        <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Financial Ledger</span>
                    </div>
                    <h1 className="page-title text-3xl font-black text-slate-800 tracking-tight">Payment & Transaction History</h1>
                    <p className="page-subtitle text-xs font-semibold text-slate-500 mt-1">
                        Review overall platform revenue, details of custom subscriptions fee types, coupon discounts, and download full spreadsheets.
                    </p>
                </div>
                <button
                    onClick={handleExportCSV}
                    disabled={payments.length === 0}
                    className="primary-btn flex items-center gap-2 font-bold text-xs uppercase tracking-wider bg-indigo-600 text-white px-5 py-3 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/10 transition-all disabled:opacity-50"
                >
                    <Download size={16} />
                    <span>Export Spreadsheet</span>
                </button>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Total Revenue</p>
                        <h3 className="text-xl font-black text-slate-800 mt-0.5">
                            ₹{totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Percent size={24} />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Coupons Off Total</p>
                        <h3 className="text-xl font-black text-slate-800 mt-0.5">
                            ₹{totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Successful Sales</p>
                        <h3 className="text-xl font-black text-slate-800 mt-0.5">
                            {successfulPayments.length} / {totalTransactionsCount}
                        </h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                        <XCircle size={24} />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Failed Attempts</p>
                        <h3 className="text-xl font-black text-slate-800 mt-0.5">
                            {failedTransactionsCount}
                        </h3>
                    </div>
                </div>
            </div>

            {/* Table & Filtering */}
            <div className="qm-table-card bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="search-box relative flex items-center w-full md:max-w-md">
                        <Search size={18} className="absolute left-3 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by student, email, transaction ID, or coupon..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-500 whitespace-nowrap">Payment Status:</label>
                        <select
                            className="border border-slate-200 rounded-lg p-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="SUCCESS">Success Only</option>
                            <option value="PENDING">Pending Only</option>
                            <option value="FAILED">Failed Only</option>
                        </select>
                    </div>
                </div>

                <div className="table-wrapper overflow-x-auto">
                    {isLoading ? (
                        <div className="text-center p-20">
                            <Loader2 className="animate-spin mx-auto text-indigo-600" size={32} />
                            <p className="text-xs text-slate-400 font-bold mt-2">Loading transactions...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center p-20">
                            <AlertCircle className="mx-auto text-red-500" size={32} />
                            <p className="text-sm text-slate-700 font-bold mt-2">Failed to load payment history</p>
                        </div>
                    ) : filteredPayments.length === 0 ? (
                        <div className="text-center p-20 text-slate-400 font-semibold text-sm">
                            No payment transactions matching your criteria found.
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Student User</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Transaction Details</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Fee Type</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Pricing details</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Coupon Savings</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Total Paid</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider text-center">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredPayments.map((p) => {
                                    let statusBadge = "bg-amber-50 text-amber-700 border-amber-200";
                                    if (p.status === 'SUCCESS') statusBadge = "bg-emerald-50 text-emerald-700 border-emerald-200";
                                    if (p.status === 'FAILED') statusBadge = "bg-rose-50 text-rose-700 border-rose-200";

                                    return (
                                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                            {/* User profile details */}
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(p.user_name || p.user_email)}&background=4F46E5&color=fff&size=36`}
                                                        alt=""
                                                        className="w-9 h-9 rounded-full shadow-sm"
                                                    />
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-sm">{p.user_name || '—'}</p>
                                                        <p className="text-[11px] font-semibold text-slate-400">{maskEmail(p.user_email)}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Transaction details */}
                                            <td className="p-4">
                                                <p className="text-xs font-mono font-black text-slate-600">{p.transaction_id || '—'}</p>
                                                <p className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mt-0.5">
                                                    <Calendar size={11} /> {formatDate(p.created_at)}
                                                </p>
                                            </td>

                                            {/* Plan type */}
                                            <td className="p-4">
                                                <span className="px-2.5 py-1 rounded-lg bg-indigo-50/50 text-indigo-700 font-bold border border-indigo-100/50 text-xs">
                                                    {p.plan_name || 'Subscription Plan'}
                                                </span>
                                            </td>

                                            {/* Pricing details */}
                                            <td className="p-4 text-xs font-bold text-slate-500">
                                                {p.original_amount ? `₹${parseFloat(p.original_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                                            </td>

                                            {/* Coupon detail */}
                                            <td className="p-4">
                                                {p.coupon_code ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-black border border-amber-100 text-[9px] uppercase w-fit">
                                                            <Tag size={10} /> {p.coupon_code}
                                                        </span>
                                                        {parseFloat(p.discount_amount) > 0 && (
                                                            <span className="text-[11px] font-bold text-green-600">
                                                                -₹{parseFloat(p.discount_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>

                                            {/* Final Paid */}
                                            <td className="p-4 text-sm font-black text-slate-900">
                                                ₹{parseFloat(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>

                                            {/* Status badge */}
                                            <td className="p-4">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${statusBadge}`}>
                                                    {p.status}
                                                </span>
                                            </td>

                                            {/* Details Button */}
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => setSelectedPayment(p)}
                                                    className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-all"
                                                    title="View Transaction Invoice"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Invoice Detail Modal ("all typen advs model") */}
            {selectedPayment && (
                <AdminModal
                    open={!!selectedPayment}
                    onClose={() => setSelectedPayment(null)}
                    title="Transaction Invoice Details"
                    size="md"
                    footer={
                        <button 
                            type="button" 
                            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-all" 
                            onClick={() => setSelectedPayment(null)}
                        >
                            Close Details
                        </button>
                    }
                >
                    <div className="space-y-6 p-1">
                        {/* Transaction Receipt Header */}
                        <div className="p-5 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-2xl shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
                            <div className="flex justify-between items-start relative z-10">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Transaction Receipt</p>
                                    <h4 className="text-xl font-black mt-1">{selectedPayment.plan_name || 'System Premium'}</h4>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${
                                    selectedPayment.status === 'SUCCESS' 
                                        ? 'bg-emerald-500/20 text-emerald-100 border-emerald-400/30' 
                                        : selectedPayment.status === 'FAILED' 
                                            ? 'bg-rose-500/20 text-rose-100 border-rose-400/30' 
                                            : 'bg-amber-500/20 text-amber-100 border-amber-400/30'
                                }`}>
                                    {selectedPayment.status}
                                </span>
                            </div>
                            <div className="mt-6 border-t border-white/10 pt-4 flex justify-between text-xs relative z-10">
                                <div>
                                    <p className="text-indigo-200 font-bold">Transaction ID</p>
                                    <p className="font-mono font-bold mt-0.5">{selectedPayment.transaction_id || '—'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-indigo-200 font-bold">Date & Time</p>
                                    <p className="font-bold mt-0.5">{formatDate(selectedPayment.created_at)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Customer / Student Profile Details */}
                        <div>
                            <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Student Profile Info</h5>
                            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                        <User size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Full Name</p>
                                        <p className="text-sm font-bold text-slate-700">{selectedPayment.user_name || '—'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                        <Mail size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Email Address</p>
                                        <p className="text-sm font-semibold text-slate-700">{maskEmail(selectedPayment.user_email)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                        <Phone size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mobile Number</p>
                                        <p className="text-sm font-semibold text-slate-700">{selectedPayment.user_mobile || '—'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Subscription details */}
                        <div>
                            <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Plan / Fee Description</h5>
                            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                        <FileText size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Fee Type</p>
                                        <p className="text-sm font-bold text-slate-700">{selectedPayment.plan_name || '—'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                        <Calendar size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Access Duration</p>
                                        <p className="text-sm font-bold text-slate-700">{selectedPayment.plan_duration ? `${selectedPayment.plan_duration} Days` : '—'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Cost & Coupon Breakdown */}
                        <div>
                            <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Financial Breakdown</h5>
                            <div className="border border-slate-100 rounded-xl overflow-hidden">
                                <div className="p-4 space-y-2.5 text-sm font-semibold text-slate-600">
                                    <div className="flex justify-between">
                                        <span>Base Price (original)</span>
                                        <span className="text-slate-800">
                                            ₹{selectedPayment.original_amount ? parseFloat(selectedPayment.original_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                                        </span>
                                    </div>
                                    {selectedPayment.coupon_code && (
                                        <div className="flex justify-between items-center text-green-600">
                                            <span className="flex items-center gap-1">
                                                Discount Coupon 
                                                <span className="px-1.5 py-0.5 bg-green-50 text-green-700 font-black border border-green-100 text-[9px] rounded uppercase">
                                                    {selectedPayment.coupon_code}
                                                </span>
                                            </span>
                                            <span>
                                                -₹{parseFloat(selectedPayment.discount_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-between items-center">
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">Total Charged Amount</span>
                                    <span className="text-lg font-black text-slate-900">
                                        ₹{parseFloat(selectedPayment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </AdminModal>
            )}
        </div>
    );
}
