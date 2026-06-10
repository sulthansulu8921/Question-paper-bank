import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { 
    Search, Loader2, UserCheck, UserX, Shield, User, CreditCard, 
    Activity, Calendar, CheckCircle2, XCircle, Eye, Tag, Clock, Trash2
} from 'lucide-react';
import AdminModal from '@/components/admin/AdminModal';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';
import '@/styles/admin/QuestionManagement.css';

const AdminUserManager = () => {
    const [activeTab, setActiveTab] = useState<'users' | 'subscriptions' | 'payments' | 'payment_status'>('users');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSubjectId, setSelectedSubjectId] = useState<number | 'all'>('all');
    const [unpaidOnly, setUnpaidOnly] = useState(false);
    const [historyUser, setHistoryUser] = useState<any | null>(null);
    
    // Manual subscription action state
    const [extendingSub, setExtendingSub] = useState<any | null>(null);
    const [extendDays, setExtendDays] = useState<number>(30);
    const [isActionPending, setIsActionPending] = useState(false);

    const [confirmPrivilege, setConfirmPrivilege] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ open: false, title: '', message: '', onConfirm: () => {} });

    const [grantAdminOpen, setGrantAdminOpen] = useState(false);
    const [grantAdminEmail, setGrantAdminEmail] = useState('');
    
    const queryClient = useQueryClient();

    // Fetch platform users
    const { data: users = [], isLoading: isUsersLoading } = useQuery({
        queryKey: ['admin-users'],
        queryFn: async () => (await api.get('/auth/users/')).data
    });

    // Fetch platform subscriptions
    const { data: subscriptions = [], isLoading: isSubsLoading } = useQuery({
        queryKey: ['admin-subscriptions'],
        queryFn: async () => (await api.get('/subscriptions/my-subscriptions/?all=true')).data
    });

    // Fetch platform payments
    const { data: payments = [], isLoading: isPaymentsLoading } = useQuery({
        queryKey: ['admin-payments'],
        queryFn: async () => (await api.get('/subscriptions/payments/?all=true')).data
    });

    // Fetch courses / subjects to filter by paper
    const { data: subjects = [] } = useQuery({
        queryKey: ['admin-subjects'],
        queryFn: async () => (await api.get('/courses/subjects/')).data
    });

    const toggleStaffMutation = useMutation({
        mutationFn: ({ id, is_staff }: { id: number; is_staff: boolean }) =>
            api.patch(`/auth/users/${id}/`, { is_staff }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    });

    const deleteUserMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/auth/users/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            alert('User deleted successfully.');
        },
        onError: (err: any) => {
            alert(err.response?.data?.error || 'Failed to delete user.');
        }
    });

    const grantAdminMutation = useMutation({
        mutationFn: (email: string) => api.post('/auth/users/grant-admin/', { email }),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            setGrantAdminOpen(false);
            setGrantAdminEmail('');
            alert(data.data.message || 'Admin privileges granted successfully.');
        },
        onError: (err: any) => {
            alert(err.response?.data?.error || 'Failed to grant admin privileges.');
        }
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

    const maskEmail = (email?: string) => {
        return email || '—';
    };

    // Calculate user subscription status for a paper
    const checkSubjectPayment = (userId: number, subId: number | 'all') => {
        const userSubs = subscriptions.filter((s: any) => s.user === userId && s.is_active && new Date(s.end_date) >= new Date());
        if (userSubs.length === 0) return { paid: false, detail: 'No active subscription' };
        
        if (subId === 'all') {
            return { paid: true, detail: userSubs[0].plan_name || 'Active Premium' };
        }

        // Find sub that covers this subject
        const match = userSubs.find((s: any) => {
            // Paper-wise matching
            if (s.subject === subId) return true;
            // Group-wise matching
            if (s.group === 'ALL') return true;
            
            // Check if the subject belongs to the group of subscription
            const targetSubject = subjects.find((subj: any) => subj.id === subId);
            if (targetSubject && s.group) {
                if (s.group === 'GROUP_1' && targetSubject.group === 1) return true;
                if (s.group === 'GROUP_2' && targetSubject.group === 2) return true;
            }
            return false;
        });

        if (match) {
            return { paid: true, detail: match.plan_name || 'Active Premium' };
        }
        return { paid: false, detail: 'Not subscribed to this paper' };
    };

    // Manual Subscription Actions
    const handleSuspend = async (subId: number) => {
        setIsActionPending(true);
        try {
            await api.post(`/subscriptions/my-subscriptions/${subId}/suspend/`);
            queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
            alert('Subscription suspended successfully.');
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to suspend subscription.');
        } finally {
            setIsActionPending(false);
        }
    };

    const handleActivate = async (subId: number) => {
        setIsActionPending(true);
        try {
            await api.post(`/subscriptions/my-subscriptions/${subId}/activate/`);
            queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
            alert('Subscription activated successfully.');
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to activate subscription.');
        } finally {
            setIsActionPending(false);
        }
    };

    const handleRefund = async (subId: number) => {
        setIsActionPending(true);
        try {
            await api.post(`/subscriptions/my-subscriptions/${subId}/refund/`);
            queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
            queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
            alert('Subscription successfully refunded and marked inactive.');
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to refund subscription.');
        } finally {
            setIsActionPending(false);
        }
    };

    const handleExtendSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!extendingSub) return;
        setIsActionPending(true);
        try {
            await api.post(`/subscriptions/my-subscriptions/${extendingSub.id}/extend/`, {
                days: extendDays
            });
            queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
            setExtendingSub(null);
            alert('Subscription extended successfully.');
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to extend subscription.');
        } finally {
            setIsActionPending(false);
        }
    };

    return (
        <div className="qm-container px-6 py-6 font-sans">
            {/* Header */}
            <div className="qm-header flex justify-between items-center mb-6">
                <div>
                    <h1 className="page-title text-xl font-bold text-slate-800">User & Subscription Management</h1>
                    <p className="page-subtitle text-xs text-slate-500">Track registered platform users, active student plans, and manual transaction logs.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="attempt-tag bg-blue-50 text-blue-700 font-bold px-3 py-1 rounded-full text-xs font-sans">
                        {users.length} Users
                    </span>
                    <span className="attempt-tag bg-teal-50 text-teal-700 font-bold px-3 py-1 rounded-full text-xs font-sans">
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
                <button
                    onClick={() => { setActiveTab('payment_status'); setSearchTerm(''); }}
                    className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${activeTab === 'payment_status' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    <UserX size={14} className="text-red-500" /> Payment Status by Paper
                </button>
            </div>

            {/* Card Content */}
            <div className="qm-table-card bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="table-toolbar p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="search-box relative flex items-center w-full md:max-w-md">
                        <Search size={18} className="absolute left-3 text-slate-400" />
                        <input
                            type="text"
                            placeholder={
                                activeTab === 'users' ? "Search users by name or email..." :
                                activeTab === 'subscriptions' ? "Search subscriptions by email or plan..." :
                                activeTab === 'payment_status' ? "Search students by name or email..." :
                                "Search payments by email or transaction ID..."
                            }
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {activeTab === 'users' && (
                        <button
                            onClick={() => setGrantAdminOpen(true)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm w-full md:w-auto justify-center"
                        >
                            <Shield size={14} />
                            <span>Grant Admin Access</span>
                        </button>
                    )}

                    {activeTab === 'payment_status' && (
                        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-slate-600 whitespace-nowrap">Filter Paper/Subject:</label>
                                <select 
                                    className="border border-slate-200 rounded-lg p-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white max-w-xs"
                                    value={selectedSubjectId}
                                    onChange={(e) => setSelectedSubjectId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                >
                                    <option value="all">Any Active Premium Plan</option>
                                    {subjects.map((sub: any) => (
                                        <option key={sub.id} value={sub.id}>
                                            {sub.level_name || 'Intermediate'} - {sub.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-600">
                                <input 
                                    type="checkbox" 
                                    checked={unpaidOnly} 
                                    onChange={(e) => setUnpaidOnly(e.target.checked)} 
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                                />
                                Show Unpaid Students Only
                            </label>
                        </div>
                    )}
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
                                                        className="w-9 h-9 rounded-full shadow-sm"
                                                    />
                                                    <span className="font-bold text-slate-800">{u.first_name} {u.last_name}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm font-semibold text-slate-600">{u.is_staff ? u.email : maskEmail(u.email)}</td>
                                            <td className="p-4 text-sm font-semibold text-slate-500">{u.mobile_number || '—'}</td>
                                            <td className="p-4">
                                                {u.is_staff ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 uppercase">
                                                        <Shield size={12} /> Admin
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-100 uppercase">
                                                        <User size={12} /> Student
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2.5 h-2.5 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                                                    <span className="font-bold text-slate-700">{u.is_active ? 'Active' : 'Inactive'}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end items-center gap-2">
                                                    <button 
                                                        onClick={() => setHistoryUser(u)}
                                                        className="p-1.5 border border-slate-200 rounded text-slate-500 hover:text-blue-600 hover:bg-slate-50"
                                                        title="View History"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    <button
                                                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${u.is_staff ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-blue-200 text-blue-600 hover:bg-blue-50'}`}
                                                        title={u.is_staff ? 'Remove Admin privileges' : 'Grant Admin privileges'}
                                                        onClick={() => setConfirmPrivilege({
                                                            open: true,
                                                            title: u.is_staff ? 'Remove Admin Privileges' : 'Grant Admin Privileges',
                                                            message: u.is_staff
                                                                ? `Remove admin privileges from ${u.email}? They will no longer be able to access the admin panel.`
                                                                : `Grant admin privileges to ${u.email}? They will have full access to the admin panel.`,
                                                            onConfirm: () => {
                                                                toggleStaffMutation.mutate({ id: u.id, is_staff: !u.is_staff });
                                                                setConfirmPrivilege(prev => ({ ...prev, open: false }));
                                                            }
                                                        })}
                                                    >
                                                        {u.is_staff ? <UserX size={14} className="inline mr-1" /> : <UserCheck size={14} className="inline mr-1" />}
                                                        {u.is_staff ? 'Demote' : 'Make Admin'}
                                                    </button>
                                                    <button
                                                        className="p-1.5 border border-red-200 rounded text-red-500 hover:text-red-700 hover:bg-red-50"
                                                        title="Delete User"
                                                        onClick={() => setConfirmPrivilege({
                                                            open: true,
                                                            title: 'Delete User Account',
                                                            message: `Are you sure you want to permanently delete user account ${u.email}? This action is irreversible.`,
                                                            onConfirm: () => {
                                                                deleteUserMutation.mutate(u.id);
                                                                setConfirmPrivilege(prev => ({ ...prev, open: false }));
                                                            }
                                                        })}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
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
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isSubsLoading ? (
                                    <tr>
                                        <td colSpan={6} className="text-center p-10">
                                            <Loader2 className="animate-spin mx-auto text-blue-600" />
                                        </td>
                                    </tr>
                                ) : filteredSubs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center p-10 text-slate-400 font-semibold text-sm">
                                            No active subscriptions found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredSubs.map((s: any) => {
                                        const isExpired = new Date(s.end_date) < new Date();
                                        const isActive = s.is_active && !isExpired;

                                        return (
                                            <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-4 text-sm font-bold text-slate-800">{maskEmail(s.user_email) || `User #${s.user}`}</td>
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
                                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-green-50 text-green-700 border border-green-200">
                                                            Active
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-50 text-red-700 border border-red-200">
                                                            Expired / Inactive
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end items-center gap-2">
                                                        <button
                                                            onClick={() => setExtendingSub(s)}
                                                            className="px-2.5 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 text-[10px] font-black uppercase hover:bg-indigo-50 flex items-center gap-1.5"
                                                            title="Extend Subscription"
                                                            disabled={isActionPending}
                                                        >
                                                            <Clock size={12} />
                                                            <span>Extend</span>
                                                        </button>

                                                        {isActive ? (
                                                            <button
                                                                onClick={() => setConfirmPrivilege({
                                                                    open: true,
                                                                    title: 'Suspend Access',
                                                                    message: `Are you sure you want to suspend subscription access for ${s.user_email}?`,
                                                                    onConfirm: () => {
                                                                        handleSuspend(s.id);
                                                                        setConfirmPrivilege(prev => ({ ...prev, open: false }));
                                                                    }
                                                                })}
                                                                className="px-2.5 py-1.5 rounded-lg border border-amber-200 text-amber-600 text-[10px] font-black uppercase hover:bg-amber-50 flex items-center gap-1.5"
                                                                title="Suspend Subscription"
                                                                disabled={isActionPending}
                                                            >
                                                                <XCircle size={12} />
                                                                <span>Suspend</span>
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleActivate(s.id)}
                                                                className="px-2.5 py-1.5 rounded-lg border border-green-200 text-green-600 text-[10px] font-black uppercase hover:bg-green-50 flex items-center gap-1.5"
                                                                title="Activate Subscription"
                                                                disabled={isActionPending}
                                                            >
                                                                <CheckCircle2 size={12} />
                                                                <span>Activate</span>
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={() => setConfirmPrivilege({
                                                                open: true,
                                                                title: 'Refund & Cancel Subscription',
                                                                message: `WARNING: This will suspend access and mark the latest processed payment for ${s.user_email} as FAILED. Proceed?`,
                                                                onConfirm: () => {
                                                                    handleRefund(s.id);
                                                                    setConfirmPrivilege(prev => ({ ...prev, open: false }));
                                                                }
                                                            })}
                                                            className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 text-[10px] font-black uppercase hover:bg-red-50 flex items-center gap-1.5"
                                                            title="Refund Subscription"
                                                            disabled={isActionPending}
                                                        >
                                                            <XCircle size={12} />
                                                            <span>Refund</span>
                                                        </button>
                                                    </div>
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
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Base Price</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Coupon</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Discount</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Amount Paid</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date & Time</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isPaymentsLoading ? (
                                    <tr>
                                        <td colSpan={8} className="text-center p-10">
                                            <Loader2 className="animate-spin mx-auto text-blue-600" />
                                        </td>
                                    </tr>
                                ) : filteredPayments.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="text-center p-10 text-slate-400 font-semibold text-sm">
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
                                                <td className="p-4 text-sm font-bold text-slate-800">{maskEmail(p.user_email) || `User #${p.user}`}</td>
                                                <td className="p-4 text-xs font-mono font-bold text-slate-600">{p.transaction_id || '—'}</td>
                                                <td className="p-4 text-sm font-semibold text-slate-500">
                                                    {p.original_amount ? `₹${parseFloat(p.original_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                                                </td>
                                                <td className="p-4">
                                                    {p.coupon_code ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-100 text-[10px] uppercase">
                                                            <Tag size={10} /> {p.coupon_code}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400">—</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-sm font-bold text-green-600">
                                                    {p.discount_amount && parseFloat(p.discount_amount) > 0 ? (
                                                        `-₹${parseFloat(p.discount_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                    ) : (
                                                        <span className="text-slate-400">—</span>
                                                    )}
                                                </td>
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

                    {activeTab === 'payment_status' && (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-100/50 border-b border-slate-200">
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Student</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Selected Paper Status</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Active Plan Info</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isUsersLoading || isSubsLoading ? (
                                    <tr>
                                        <td colSpan={5} className="text-center p-10">
                                            <Loader2 className="animate-spin mx-auto text-blue-600" />
                                        </td>
                                    </tr>
                                ) : (() => {
                                    // Process student users with payment statuses
                                    const studentUsers = users.filter((u: any) => !u.is_staff && (
                                        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        u.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        u.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
                                    ));

                                    const studentsWithStatus = studentUsers.map((u: any) => {
                                        const statusInfo = checkSubjectPayment(u.id, selectedSubjectId);
                                        return { ...u, ...statusInfo };
                                    });

                                    // Filter based on unpaid checkbox
                                    const displayedStudents = unpaidOnly 
                                        ? studentsWithStatus.filter((s: any) => !s.paid) 
                                        : studentsWithStatus;

                                    if (displayedStudents.length === 0) {
                                        return (
                                            <tr>
                                                <td colSpan={5} className="text-center p-10 text-slate-400 font-semibold text-sm">
                                                    No students found matching filters.
                                                </td>
                                            </tr>
                                        );
                                    }

                                    return displayedStudents.map((s: any) => (
                                        <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(s.first_name + ' ' + s.last_name)}&background=3F51B5&color=fff&size=36`}
                                                        alt=""
                                                        className="w-9 h-9 rounded-full shadow-sm"
                                                    />
                                                    <span className="font-bold text-slate-800">{s.first_name} {s.last_name}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm font-semibold text-slate-600">{maskEmail(s.email)}</td>
                                            <td className="p-4">
                                                {s.paid ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                                                        <CheckCircle2 size={12} /> Paid
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-200">
                                                        <XCircle size={12} /> Unpaid
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-xs font-semibold text-slate-500">
                                                {s.detail}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button 
                                                    onClick={() => setHistoryUser(s)}
                                                    className="secondary-btn flex-center gap-xs font-bold text-[11px] px-2.5 py-1.5 ml-auto border border-slate-200 rounded text-slate-700 hover:bg-slate-50"
                                                >
                                                    <Eye size={12} />
                                                    <span>History & Log</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ));
                                })()}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* History Detail Modal */}
            {historyUser && (
                <AdminModal
                    open={!!historyUser}
                    onClose={() => setHistoryUser(null)}
                    title={`Student Account Profile: ${historyUser.first_name} ${historyUser.last_name}`}
                    footer={
                        <button type="button" className="secondary-btn text-xs font-bold" onClick={() => setHistoryUser(null)}>
                            Close Report
                        </button>
                    }
                >
                    <div className="space-y-6">
                        {/* Profile Info */}
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/50 flex flex-col md:flex-row gap-4 items-start">
                            <img
                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(historyUser.first_name + ' ' + historyUser.last_name)}&background=3F51B5&color=fff&size=54`}
                                alt=""
                                className="w-14 h-14 rounded-full border border-slate-200 shadow-sm shrink-0"
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 w-full">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800">{historyUser.first_name} {historyUser.last_name}</h4>
                                    <p className="text-xs font-semibold text-slate-500">{historyUser.email}</p>
                                    <p className="text-xs text-slate-400 mt-1 font-bold">Mobile: {historyUser.mobile_number || '—'}</p>
                                </div>
                                <div className="text-xs space-y-1">
                                    <p className="text-slate-500 font-semibold">
                                        Role: <span className="font-bold text-slate-700">{historyUser.is_staff ? 'Admin' : 'Student'}</span>
                                    </p>
                                    <p className="text-slate-500 font-semibold">
                                        Status: <span className={`font-bold ${historyUser.is_active ? 'text-green-600' : 'text-red-500'}`}>{historyUser.is_active ? 'Active' : 'Inactive'}</span>
                                    </p>
                                    <p className="text-slate-500 font-semibold">
                                        Joined: <span className="font-bold text-slate-700">{formatDate(historyUser.date_joined)}</span>
                                    </p>
                                    <p className="text-slate-500 font-semibold">
                                        Last Login: <span className="font-bold text-slate-700">{formatDate(historyUser.last_login)}</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Subscription History */}
                        <div>
                            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Subscription History</h3>
                            <div className="border border-slate-100 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                                        <tr>
                                            <th className="p-2">Plan</th>
                                            <th className="p-2">Period</th>
                                            <th className="p-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {subscriptions.filter((s: any) => s.user === historyUser.id).length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="p-4 text-center text-slate-400">No subscriptions loaded.</td>
                                            </tr>
                                        ) : (
                                            subscriptions.filter((s: any) => s.user === historyUser.id).map((s: any) => {
                                                const expired = new Date(s.end_date) < new Date();
                                                const active = s.is_active && !expired;
                                                return (
                                                    <tr key={s.id}>
                                                        <td className="p-2 font-bold text-slate-700">{s.plan_name}</td>
                                                        <td className="p-2 font-semibold text-slate-500">{formatDate(s.start_date)} - {formatDate(s.end_date)}</td>
                                                        <td className="p-2">
                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                                                {active ? 'Active' : 'Expired'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Payment Transactions */}
                        <div>
                            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Payment Logs & Failed Attempts</h3>
                            <div className="border border-slate-100 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                                        <tr>
                                            <th className="p-2">Transaction ID / Detail</th>
                                            <th className="p-2">Coupon</th>
                                            <th className="p-2">Amount</th>
                                            <th className="p-2">Date</th>
                                            <th className="p-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {payments.filter((p: any) => p.user === historyUser.id).length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="p-4 text-center text-slate-400">No payment history found.</td>
                                            </tr>
                                        ) : (
                                            payments.filter((p: any) => p.user === historyUser.id).map((p: any) => (
                                                <tr key={p.id} className={p.status === 'FAILED' ? 'bg-red-50/30' : ''}>
                                                    <td className="p-2">
                                                        <span className={`font-mono font-bold block ${p.status === 'FAILED' ? 'text-red-700' : 'text-slate-600'}`}>
                                                            {p.transaction_id}
                                                        </span>
                                                        {p.plan_name && (
                                                            <span className="text-[10px] text-slate-400 font-semibold">Plan: {p.plan_name}</span>
                                                        )}
                                                    </td>
                                                    <td className="p-2">
                                                        {p.coupon_code ? (
                                                            <span className="inline-flex items-center gap-0.5 px-1 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-100 text-[9px] uppercase">
                                                                <Tag size={8} /> {p.coupon_code}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400">—</span>
                                                        )}
                                                    </td>
                                                    <td className="p-2 font-black text-slate-800">
                                                        ₹{parseFloat(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                                                        {p.discount_amount && parseFloat(p.discount_amount) > 0 && (
                                                            <div className="text-[9px] text-green-600 font-bold" title={`Original: ₹${p.original_amount}`}>
                                                                (-₹{parseFloat(p.discount_amount).toFixed(0)})
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-2 font-semibold text-slate-500">{formatDate(p.created_at)}</td>
                                                    <td className="p-2">
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                                            p.status === 'SUCCESS' ? 'bg-green-50 text-green-700 border border-green-200' :
                                                            p.status === 'FAILED' ? 'bg-red-50 text-red-700 border border-red-200' :
                                                            'bg-amber-50 text-amber-700 border border-amber-200'
                                                        }`}>
                                                            {p.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </AdminModal>
            )}

            {/* Extend Subscription Modal */}
            {extendingSub && (
                <AdminModal
                    open={!!extendingSub}
                    onClose={() => setExtendingSub(null)}
                    title="Manual Subscription Extension"
                    footer={
                        <div className="flex gap-2 justify-end w-full">
                            <button
                                type="button"
                                className="secondary-btn text-xs font-bold"
                                onClick={() => setExtendingSub(null)}
                                disabled={isActionPending}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="extend-form"
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-50"
                                disabled={isActionPending}
                            >
                                {isActionPending ? <Loader2 size={12} className="animate-spin" /> : 'Confirm Extension'}
                            </button>
                        </div>
                    }
                >
                    <form id="extend-form" onSubmit={handleExtendSubmit} className="space-y-4">
                        <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center gap-3">
                            <Clock className="text-indigo-600 shrink-0" size={24} />
                            <div>
                                <h4 className="text-xs font-black text-slate-800 uppercase">Extend Subscription</h4>
                                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                                    Adding custom billing duration for: <strong>{extendingSub.user_email}</strong>
                                </p>
                            </div>
                        </div>

                        <div className="form-group space-y-1">
                            <label className="text-xs font-bold text-slate-700">Days to Extend</label>
                            <input
                                type="number"
                                required
                                min="1"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-100 font-bold text-sm bg-white"
                                value={extendDays}
                                onChange={(e) => setExtendDays(parseInt(e.target.value) || 0)}
                            />
                            <p className="text-[10px] text-slate-400 font-semibold">The subscription end date will be shifted forward by this number of days.</p>
                        </div>
                    </form>
                </AdminModal>
            )}

            {/* Grant Admin Access Modal */}
            {grantAdminOpen && (
                <AdminModal
                    open={grantAdminOpen}
                    onClose={() => { setGrantAdminOpen(false); setGrantAdminEmail(''); }}
                    title="Grant Admin Privileges"
                    footer={
                        <div className="flex gap-2 justify-end w-full">
                            <button
                                type="button"
                                className="secondary-btn text-xs font-bold"
                                onClick={() => { setGrantAdminOpen(false); setGrantAdminEmail(''); }}
                                disabled={grantAdminMutation.isPending}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="grant-admin-form"
                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-50"
                                disabled={grantAdminMutation.isPending}
                            >
                                {grantAdminMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Grant Privileges'}
                            </button>
                        </div>
                    }
                >
                    <form 
                        id="grant-admin-form" 
                        onSubmit={(e) => {
                            e.preventDefault();
                            grantAdminMutation.mutate(grantAdminEmail);
                        }} 
                        className="space-y-4"
                    >
                        <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-center gap-3">
                            <Shield className="text-blue-600 shrink-0" size={24} />
                            <div>
                                <h4 className="text-xs font-black text-slate-800 uppercase">Administrator Role</h4>
                                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                                    Promoting the selected registered user to full Administrator status.
                                </p>
                            </div>
                        </div>

                        <div className="form-group space-y-1">
                            <label className="text-xs font-bold text-slate-700">User Email Address</label>
                            <input
                                type="email"
                                required
                                placeholder="enter-email@qbankpro.com"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-100 font-bold text-sm bg-white"
                                value={grantAdminEmail}
                                onChange={(e) => setGrantAdminEmail(e.target.value)}
                            />
                            <p className="text-[10px] text-slate-400 font-semibold">The user must already be registered on the platform to be promoted to administrator.</p>
                        </div>
                    </form>
                </AdminModal>
            )}

            <AdminConfirmModal
                open={confirmPrivilege.open}
                onClose={() => setConfirmPrivilege(prev => ({ ...prev, open: false }))}
                onConfirm={confirmPrivilege.onConfirm}
                title={confirmPrivilege.title}
                message={confirmPrivilege.message}
            />
        </div>
    );
};

export default AdminUserManager;
