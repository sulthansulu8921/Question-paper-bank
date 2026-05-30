import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { Search, Loader2, UserCheck, UserX, Shield, User, CreditCard, Activity, Calendar } from 'lucide-react';
import '@/styles/admin/QuestionManagement.css';

const AdminUserManager = () => {
    const [activeTab, setActiveTab] = useState<'users' | 'subscriptions' | 'payments'>('users');
    const [searchTerm, setSearchTerm] = useState('');
    const queryClient = useQueryClient();

    // Fetch platform users
    const { data: users = [], isLoading: isUsersLoading } = useQuery({
        queryKey: ['admin-users'],
        queryFn: async () => (await api.get('/auth/users/')).data
    });

    // Fetch platform subscriptions
    const { data: subscriptions = [], isLoading: isSubsLoading } = useQuery({
        queryKey: ['admin-subscriptions'],
        queryFn: async () => (await api.get('/subscriptions/my-subscriptions/')).data
    });

    // Fetch platform payments
    const { data: payments = [], isLoading: isPaymentsLoading } = useQuery({
        queryKey: ['admin-payments'],
        queryFn: async () => (await api.get('/subscriptions/payments/')).data
    });

    const toggleStaffMutation = useMutation({
        mutationFn: ({ id, is_staff }: { id: number; is_staff: boolean }) =>
            api.patch(`/auth/users/${id}/`, { is_staff }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    });

    // Filtering logic
    const filteredUsers = users.filter((u: any) =>
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredSubs = subscriptions.filter((s: any) =>
        s.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.plan_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredPayments = payments.filter((p: any) =>
        p.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="qm-container px-6 py-6">
            {/* Header */}
            <div className="qm-header flex justify-between items-center mb-6">
                <div>
                    <h1 className="page-title text-xl font-bold text-slate-800">User & Payment Management</h1>
                    <p className="page-subtitle text-xs text-slate-500">Track registered platform users, user subscriptions, and payment transaction logs.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="attempt-tag bg-blue-50 text-blue-700 font-bold px-3 py-1 rounded-full text-xs">
                        {users.length} Users
                    </span>
                    <span className="attempt-tag bg-teal-50 text-teal-700 font-bold px-3 py-1 rounded-full text-xs">
                        {payments.length} Payments
                    </span>
                </div>
            </div>

            {/* Tab Selectors */}
            <div className="flex bg-slate-100 p-1.5 rounded-xl mb-6 border border-slate-200 w-fit">
                <button
                    onClick={() => { setActiveTab('users'); setSearchTerm(''); }}
                    className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    <User size={14} /> Platform Users
                </button>
                <button
                    onClick={() => { setActiveTab('subscriptions'); setSearchTerm(''); }}
                    className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${activeTab === 'subscriptions' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    <Activity size={14} /> Active Subscriptions ({subscriptions.length})
                </button>
                <button
                    onClick={() => { setActiveTab('payments'); setSearchTerm(''); }}
                    className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${activeTab === 'payments' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    <CreditCard size={14} /> Payments & Transactions ({payments.length})
                </button>
            </div>

            {/* Card Content */}
            <div className="qm-table-card bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="table-toolbar p-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="search-box relative flex items-center">
                        <Search size={18} className="absolute left-3 text-slate-400" />
                        <input
                            type="text"
                            placeholder={
                                activeTab === 'users' ? "Search users by name or email..." :
                                activeTab === 'subscriptions' ? "Search subscriptions by email or plan..." :
                                "Search payments by email or transaction ID..."
                            }
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="table-wrapper overflow-x-auto">
                    {activeTab === 'users' && (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-100/50 border-b border-slate-200">
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Mobile</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isUsersLoading ? (
                                    <tr>
                                        <td colSpan={6} className="text-center p-10">
                                            <Loader2 className="animate-spin mx-auto text-blue-600" />
                                        </td>
                                    </tr>
                                ) : filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center p-10 text-slate-400 font-semibold text-sm">
                                            No matching users found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map((u: any) => (
                                        <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(u.first_name + ' ' + u.last_name)}&background=3F51B5&color=fff&size=36`}
                                                        alt=""
                                                        className="w-9 h-9 rounded-full"
                                                    />
                                                    <span className="font-bold text-slate-800">{u.first_name} {u.last_name}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm font-semibold text-slate-600">{u.email}</td>
                                            <td className="p-4 text-sm font-semibold text-slate-500">{u.mobile_number || '—'}</td>
                                            <td className="p-4">
                                                {u.is_staff ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                                        <Shield size={12} /> Admin
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-50 text-slate-500 border border-slate-100">
                                                        <User size={12} /> Student
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2.5 h-2.5 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                                                    <span className="font-semibold text-slate-700">{u.is_active ? 'Active' : 'Inactive'}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${u.is_staff ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-blue-200 text-blue-600 hover:bg-blue-50'}`}
                                                    title={u.is_staff ? 'Remove Admin privileges' : 'Grant Admin privileges'}
                                                    onClick={() => {
                                                        if (window.confirm(u.is_staff ? 'Remove admin privileges?' : 'Grant admin privileges?'))
                                                            toggleStaffMutation.mutate({ id: u.id, is_staff: !u.is_staff })
                                                    }}
                                                >
                                                    {u.is_staff ? <UserX size={14} className="inline mr-1" /> : <UserCheck size={14} className="inline mr-1" />}
                                                    {u.is_staff ? 'Demote' : 'Make Admin'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}

                    {activeTab === 'subscriptions' && (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-100/50 border-b border-slate-200">
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Subscriber Email</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Subscription Plan</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Start Date</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">End Date</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isSubsLoading ? (
                                    <tr>
                                        <td colSpan={5} className="text-center p-10">
                                            <Loader2 className="animate-spin mx-auto text-blue-600" />
                                        </td>
                                    </tr>
                                ) : filteredSubs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center p-10 text-slate-400 font-semibold text-sm">
                                            No active subscriptions found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredSubs.map((s: any) => {
                                        const isExpired = new Date(s.end_date) < new Date();
                                        const isActive = s.is_active && !isExpired;

                                        return (
                                            <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-4 text-sm font-bold text-slate-800">{s.user_email || `User #${s.user}`}</td>
                                                <td className="p-4 text-sm font-semibold text-slate-700">
                                                    <span className="px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-100 text-xs">
                                                        {s.plan_name || `Plan #${s.plan}`}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm font-semibold text-slate-500">
                                                    <span className="flex items-center gap-1.5"><Calendar size={13} /> {formatDate(s.start_date)}</span>
                                                </td>
                                                <td className="p-4 text-sm font-semibold text-slate-500">
                                                    <span className="flex items-center gap-1.5"><Calendar size={13} /> {formatDate(s.end_date)}</span>
                                                </td>
                                                <td className="p-4">
                                                    {isActive ? (
                                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase bg-green-50 text-green-700 border border-green-200">
                                                            Active
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase bg-red-50 text-red-700 border border-red-200">
                                                            Expired / Inactive
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    )}

                    {activeTab === 'payments' && (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-100/50 border-b border-slate-200">
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">User Email</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Transaction ID</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Amount Paid</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date & Time</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isPaymentsLoading ? (
                                    <tr>
                                        <td colSpan={5} className="text-center p-10">
                                            <Loader2 className="animate-spin mx-auto text-blue-600" />
                                        </td>
                                    </tr>
                                ) : filteredPayments.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center p-10 text-slate-400 font-semibold text-sm">
                                            No payment records found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPayments.map((p: any) => {
                                        let statusStyle = "bg-amber-50 text-amber-700 border-amber-200";
                                        if (p.status === 'SUCCESS') statusStyle = "bg-green-50 text-green-700 border-green-200";
                                        if (p.status === 'FAILED') statusStyle = "bg-red-50 text-red-700 border-red-200";

                                        return (
                                            <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-4 text-sm font-bold text-slate-800">{p.user_email || `User #${p.user}`}</td>
                                                <td className="p-4 text-xs font-mono font-bold text-slate-600">{p.transaction_id || '—'}</td>
                                                <td className="p-4 text-sm font-black text-slate-900">₹{parseFloat(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                                <td className="p-4 text-sm font-semibold text-slate-500">
                                                    <span className="flex items-center gap-1.5"><Calendar size={13} /> {formatDate(p.created_at)}</span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase border ${statusStyle}`}>
                                                        {p.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminUserManager;
