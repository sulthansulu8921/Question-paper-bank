import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import { 
    Search, Loader2, UserX, Shield, User, CreditCard, 
    Activity, Calendar, CheckCircle2, XCircle, Eye, Tag, Clock, Trash2, Plus
} from 'lucide-react';
import AdminModal from '@/components/admin/AdminModal';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';
import '@/styles/admin/QuestionManagement.css';

const ROLE_EXPLANATIONS: Record<string, string> = {
    SUPER_ADMIN: 'Full system control. Access to user accounts, coupons, payments, pricing plans, and system settings.',
    QUESTION_ADMIN: 'Access to question banks, model test papers, suggested answers, study notes, templates, and student sessions.',
    COURSE_ADMIN: 'Access to qualifications, global levels, course progression, subjects, chapters, and topics.',
    INSTITUTION_ADMIN: 'Access to local institution portal, batch assignments, and regional student profiles.',
    INSTRUCTOR: 'Limited administrative access. Can manage classroom discussions, live lectures, and basic classroom helper tools.',
};

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
    const [grantAdminRole, setGrantAdminRole] = useState('SUPER_ADMIN');

    const [editRoleUser, setEditRoleUser] = useState<any | null>(null);
    const [selectedRole, setSelectedRole] = useState('SUPER_ADMIN');

    // Custom actions for suspend/activate and override password
    const [resetPasswordUser, setResetPasswordUser] = useState<any | null>(null);
    const [newPassword, setNewPassword] = useState('');

    const [addSubOpen, setAddSubOpen] = useState(false);
    const [subUserId, setSubUserId] = useState('');
    const [subPlanId, setSubPlanId] = useState('');
    const [subLevelId, setSubLevelId] = useState('');
    const [subSubjectId, setSubSubjectId] = useState('');
    const [subGroup, setSubGroup] = useState('');
    const [subAttempt, setSubAttempt] = useState('');
    const [subMonth, setSubMonth] = useState('');
    const [subYear, setSubYear] = useState(new Date().getFullYear().toString());
    const [subStartDate, setSubStartDate] = useState('');
    const [subEndDate, setSubEndDate] = useState('');

    const { data: levels = [] } = useQuery({
        queryKey: ['admin-levels'],
        queryFn: async () => (await api.get('/courses/levels/')).data
    });

    const { data: plans = [] } = useQuery({
        queryKey: ['admin-plans'],
        queryFn: async () => (await api.get('/subscriptions/plans/')).data
    });

    const handlePlanSelectChange = (planIdStr: string) => {
        setSubPlanId(planIdStr);
        if (!planIdStr) return;
        const plan = plans.find((p: any) => p.id === parseInt(planIdStr));
        if (plan) {
            setSubLevelId(plan.level_specific ? plan.level_specific.toString() : '');
            setSubSubjectId(plan.subject_specific ? plan.subject_specific.toString() : '');
            setSubGroup(plan.scope === 'GROUP_WISE' ? 'GROUP_1' : '');

            const now = new Date();
            const startISO = now.toISOString().slice(0, 16);
            const end = new Date(now.getTime() + (plan.duration_days || 30) * 24 * 60 * 60 * 1000);
            const endISO = end.toISOString().slice(0, 16);

            setSubStartDate(startISO);
            setSubEndDate(endISO);
            setSubAttempt('');
        }
    };
    const getAdminSubExpiryDateStr = () => {
        if (!subPlanId) return 'No Plan Selected';
        const plan = plans.find((p: any) => p.id === parseInt(subPlanId));
        if (!plan) return 'No Plan Selected';

        const start = subStartDate ? new Date(subStartDate) : new Date();
        const billingCycle = plan.billing_cycle;
        const attempt = subAttempt;
        const month = subMonth;
        const yearVal = parseInt(subYear) || start.getFullYear();

        const monthsMap: Record<string, number> = {
            january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
            july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
        };

        let targetMonth: number | null = null;
        if (billingCycle === 'ATTEMPT_WISE' && attempt) {
            targetMonth = monthsMap[attempt.toLowerCase()];
        } else if (month) {
            targetMonth = monthsMap[month.toLowerCase()];
        }

        let end: Date;
        if (targetMonth !== null && targetMonth !== undefined) {
            end = new Date(yearVal, targetMonth + 1, 0, 23, 59, 59);
            if (end < start) {
                end = new Date(yearVal + 1, targetMonth + 1, 0, 23, 59, 59);
            }
            return end.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) + ` (End of ${attempt || month} Attempt/Month)`;
        } else {
            const duration = plan.duration_days || 30;
            end = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);
            return end.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) + ` (${duration} Days Duration)`;
        }
    };

    useEffect(() => {
        if (!subPlanId) return;
        const plan = plans.find((p: any) => p.id === parseInt(subPlanId));
        if (!plan) return;

        const start = subStartDate ? new Date(subStartDate) : new Date();
        const billingCycle = plan.billing_cycle;
        const attempt = subAttempt;
        const month = subMonth;
        const yearVal = parseInt(subYear) || start.getFullYear();

        const monthsMap: Record<string, number> = {
            january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
            july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
        };

        let targetMonth: number | null = null;
        if (billingCycle === 'ATTEMPT_WISE' && attempt) {
            targetMonth = monthsMap[attempt.toLowerCase()];
        } else if (month) {
            targetMonth = monthsMap[month.toLowerCase()];
        }

        let end: Date;
        if (targetMonth !== null && targetMonth !== undefined) {
            end = new Date(yearVal, targetMonth + 1, 0, 23, 59, 59);
            if (end < start) {
                end = new Date(yearVal + 1, targetMonth + 1, 0, 23, 59, 59);
            }
        } else {
            const duration = plan.duration_days || 30;
            end = new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);
        }

        const localISO = new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setSubEndDate(localISO);
    }, [subPlanId, subStartDate, subAttempt, subMonth, subYear, plans]);


    const handleAddSubSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subUserId || !subPlanId) {
            alert('Student user and subscription plan are required.');
            return;
        }
        setIsActionPending(true);
        try {
            const payload: any = {
                user: parseInt(subUserId),
                plan_id: parseInt(subPlanId),
                level_id: subLevelId ? parseInt(subLevelId) : null,
                subject_id: subSubjectId ? parseInt(subSubjectId) : null,
                group: subGroup || null,
                exam_attempt: subAttempt || null,
                calendar_month: subMonth || null,
                year: subYear ? parseInt(subYear) : null,
            };
            if (subStartDate) {
                payload.start_date = new Date(subStartDate).toISOString();
            }
            if (subEndDate) {
                payload.end_date = new Date(subEndDate).toISOString();
            }
            await api.post('/subscriptions/my-subscriptions/', payload);
            queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
            queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
            setAddSubOpen(false);
            setSubUserId('');
            setSubPlanId('');
            setSubLevelId('');
            setSubSubjectId('');
            setSubGroup('');
            setSubAttempt('');
            setSubMonth('');
            setSubYear(new Date().getFullYear().toString());
            setSubStartDate('');
            setSubEndDate('');
            alert('Subscription assigned successfully.');
        } catch (err: any) {
            alert(err.response?.data?.error || err.response?.data?.detail || 'Failed to assign subscription.');
        } finally {
            setIsActionPending(false);
        }
    };

    const handleToggleUserActive = async (user: any) => {
        setIsActionPending(true);
        const action = user.is_active ? 'suspend' : 'activate';
        try {
            await api.post(`/auth/users/${user.id}/${action}/`);
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            alert(`User ${user.email} successfully ${action}d.`);
        } catch (err: any) {
            alert(err.response?.data?.error || `Failed to ${action} user.`);
        } finally {
            setIsActionPending(false);
        }
    };

    const handleResetPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetPasswordUser || !newPassword) return;
        setIsActionPending(true);
        try {
            await api.post(`/auth/users/${resetPasswordUser.id}/reset-password/`, {
                password: newPassword
            });
            setResetPasswordUser(null);
            setNewPassword('');
            alert('Password reset successfully.');
        } catch (err: any) {
            alert(err.response?.data?.error || 'Failed to reset password.');
        } finally {
            setIsActionPending(false);
        }
    };
    
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
        mutationFn: ({ email, role }: { email: string; role: string }) => 
            api.post('/auth/users/grant-admin/', { email, role }),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            setGrantAdminOpen(false);
            setGrantAdminEmail('');
            setGrantAdminRole('SUPER_ADMIN');
            alert(data.data.message || 'Admin privileges granted successfully.');
        },
        onError: (err: any) => {
            alert(err.response?.data?.error || 'Failed to grant admin privileges.');
        }
    });

    const updateRoleMutation = useMutation({
        mutationFn: ({ id, role }: { id: number; role: string }) =>
            api.patch(`/auth/users/${id}/`, { role }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            setEditRoleUser(null);
            alert('User role updated successfully.');
        },
        onError: (err: any) => {
            alert(err.response?.data?.error || 'Failed to update user role.');
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

                    {activeTab === 'subscriptions' && (
                        <button
                            onClick={() => setAddSubOpen(true)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm w-full md:w-auto justify-center"
                        >
                            <Plus size={14} />
                            <span>Add Subscription</span>
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
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Selected Course</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Mobile</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isUsersLoading ? (
                                    <tr>
                                        <td colSpan={7} className="text-center p-10">
                                            <Loader2 className="animate-spin mx-auto text-blue-600" />
                                        </td>
                                    </tr>
                                ) : filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center p-10 text-slate-400 font-semibold text-sm">
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
                                            <td className="p-4 text-sm font-bold text-slate-700">
                                                {u.selected_course_name ? (
                                                    <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-100 text-xs">
                                                        {u.selected_course_name}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-semibold text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-sm font-semibold text-slate-500">{u.mobile_number || '—'}</td>
                                            <td className="p-4">
                                                {u.is_staff ? (
                                                    u.role === 'SUPER_ADMIN' ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 uppercase">
                                                            <Shield size={12} /> Full Admin
                                                        </span>
                                                    ) : u.role === 'QUESTION_ADMIN' ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100 uppercase">
                                                            <Shield size={12} /> Question Admin
                                                        </span>
                                                    ) : u.role === 'COURSE_ADMIN' ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase">
                                                            <Shield size={12} /> Course Admin
                                                        </span>
                                                    ) : u.role === 'INSTITUTION_ADMIN' ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase">
                                                            <Shield size={12} /> Inst Admin
                                                        </span>
                                                    ) : u.role === 'INSTRUCTOR' ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-100 uppercase">
                                                            <Shield size={12} /> Instructor
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 uppercase">
                                                            <Shield size={12} /> Admin
                                                        </span>
                                                    )
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
                                                <div className="flex justify-end items-center gap-2 flex-wrap">
                                                    <button 
                                                        onClick={() => setHistoryUser(u)}
                                                        className="p-1.5 border border-slate-200 rounded text-slate-500 hover:text-blue-600 hover:bg-slate-50"
                                                        title="View History & Logs"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={() => setResetPasswordUser(u)}
                                                        className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50"
                                                        title="Reset Password"
                                                    >
                                                        Reset PW
                                                    </button>
                                                    <button 
                                                        onClick={() => handleToggleUserActive(u)}
                                                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold hover:bg-slate-50 ${u.is_active ? 'border-amber-200 text-amber-600' : 'border-emerald-200 text-emerald-600'}`}
                                                        title={u.is_active ? 'Suspend User' : 'Activate User'}
                                                    >
                                                        {u.is_active ? 'Suspend' : 'Activate'}
                                                    </button>
                                                    {u.is_staff && (
                                                        <button
                                                            onClick={() => {
                                                                setEditRoleUser(u);
                                                                setSelectedRole(u.role || 'SUPER_ADMIN');
                                                            }}
                                                            className="px-2.5 py-1.5 rounded-lg border border-purple-200 text-purple-600 text-xs font-bold hover:bg-purple-50"
                                                            title="Change Admin Role"
                                                        >
                                                            Edit Role
                                                        </button>
                                                    )}
                                                    <button
                                                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all ${u.is_staff ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-blue-200 text-blue-600 hover:bg-blue-50'}`}
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
                                                        {u.is_staff ? 'Demote' : 'Admin'}
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
                                                    <div className="flex flex-col gap-1">
                                                        <span className="px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-100 text-xs w-fit">
                                                            {s.plan_name || `Plan #${s.plan}`}
                                                        </span>
                                                        {s.plan_duration && (
                                                            <span className="text-[10px] text-slate-400 font-semibold">
                                                                Duration: {s.plan_billing_cycle === 'ATTEMPT_WISE' ? Math.max(1, Math.ceil((new Date(s.end_date).getTime() - new Date(s.start_date).getTime()) / (1000 * 60 * 60 * 24))) : s.plan_duration} Days
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-sm font-semibold text-slate-500">
                                                    <span className="flex items-center gap-1.5"><Calendar size={13} /> {formatDate(s.start_date)}</span>
                                                </td>
                                                <td className="p-4 text-sm font-semibold text-slate-500">
                                                    <span className="flex items-center gap-1.5"><Calendar size={13} /> {formatDate(s.end_date)}</span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-col gap-1">
                                                        {isActive ? (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-green-50 text-green-700 border border-green-200 w-fit">
                                                                Active
                                                             </span>
                                                        ) : (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-50 text-red-700 border border-red-200 w-fit">
                                                                Expired / Inactive
                                                            </span>
                                                        )}
                                                        {isActive && typeof s.days_remaining === 'number' && (
                                                            <span className="text-[10px] text-slate-400 font-semibold">
                                                                {s.days_remaining} days left
                                                            </span>
                                                        )}
                                                    </div>
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
                                    {!historyUser.is_staff && (
                                        <p className="text-slate-500 font-semibold">
                                            Selected Course: <span className="font-bold text-blue-600">{historyUser.selected_course_name || 'None Selected'}</span>
                                        </p>
                                    )}
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
                            grantAdminMutation.mutate({ email: grantAdminEmail, role: grantAdminRole });
                        }} 
                        className="space-y-4"
                    >
                        <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-center gap-3">
                            <Shield className="text-blue-600 shrink-0" size={24} />
                            <div>
                                <h4 className="text-xs font-black text-slate-800 uppercase">Administrator Role</h4>
                                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                                    Promoting the selected registered user to an administrative role with specific permissions.
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

                        <div className="form-group space-y-1">
                            <label className="text-xs font-bold text-slate-700">Access Level / Role</label>
                            <select
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-100 font-bold text-sm bg-white"
                                value={grantAdminRole}
                                onChange={(e) => setGrantAdminRole(e.target.value)}
                            >
                                <option value="SUPER_ADMIN">Full Administrator (Super Admin)</option>
                                <option value="QUESTION_ADMIN">Question Paper Admin</option>
                                <option value="COURSE_ADMIN">Course & Subject Admin</option>
                                <option value="INSTITUTION_ADMIN">Institution Admin</option>
                                <option value="INSTRUCTOR">Instructor</option>
                            </select>
                            <p className="text-[10px] text-slate-400 font-semibold">Select the appropriate permissions tier for this staff member.</p>

                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl mt-3">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Permissions Summary</span>
                                <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                                    {ROLE_EXPLANATIONS[grantAdminRole] || 'No summary available.'}
                                </p>
                            </div>
                        </div>
                    </form>
                </AdminModal>
            )}

            {/* Reset Password Modal */}
            {resetPasswordUser && (
                <AdminModal
                    open={!!resetPasswordUser}
                    onClose={() => { setResetPasswordUser(null); setNewPassword(''); }}
                    title="Reset Student Password"
                    footer={
                        <div className="flex gap-2 justify-end w-full">
                            <button
                                type="button"
                                className="secondary-btn text-xs font-bold"
                                onClick={() => { setResetPasswordUser(null); setNewPassword(''); }}
                                disabled={isActionPending}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="reset-password-form"
                                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-50"
                                disabled={isActionPending}
                            >
                                {isActionPending ? <Loader2 size={12} className="animate-spin" /> : 'Reset Password'}
                            </button>
                        </div>
                    }
                >
                    <form id="reset-password-form" onSubmit={handleResetPasswordSubmit} className="space-y-4">
                        <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-2xl flex items-center gap-3">
                            <Shield className="text-rose-600 shrink-0" size={24} />
                            <div>
                                <h4 className="text-xs font-black text-slate-800 uppercase">Override User Password</h4>
                                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                                    Setting a new password for: <strong>{resetPasswordUser.email}</strong>
                                </p>
                            </div>
                        </div>

                        <div className="form-group space-y-1">
                            <label className="text-xs font-bold text-slate-700">New Password</label>
                            <input
                                type="password"
                                required
                                minLength={6}
                                placeholder="Enter secure new password"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-rose-100 font-bold text-sm bg-white"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                        </div>
                    </form>
                </AdminModal>
            )}

            {/* Edit Admin Role Modal */}
            {editRoleUser && (
                <AdminModal
                    open={!!editRoleUser}
                    onClose={() => { setEditRoleUser(null); setSelectedRole('SUPER_ADMIN'); }}
                    title="Change Administrator Role"
                    footer={
                        <div className="flex gap-2 justify-end w-full">
                            <button
                                type="button"
                                className="secondary-btn text-xs font-bold"
                                onClick={() => { setEditRoleUser(null); setSelectedRole('SUPER_ADMIN'); }}
                                disabled={updateRoleMutation.isPending}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="edit-role-form"
                                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-50"
                                disabled={updateRoleMutation.isPending}
                            >
                                {updateRoleMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Update Role'}
                            </button>
                        </div>
                    }
                >
                    <form 
                        id="edit-role-form" 
                        onSubmit={(e) => {
                            e.preventDefault();
                            updateRoleMutation.mutate({ id: editRoleUser.id, role: selectedRole });
                        }} 
                        className="space-y-4"
                    >
                        <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-2xl flex items-center gap-3">
                            <Shield className="text-purple-600 shrink-0" size={24} />
                            <div>
                                <h4 className="text-xs font-black text-slate-800 uppercase">Change Access Level</h4>
                                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                                    Updating administrative role for: <strong>{editRoleUser.email}</strong>
                                </p>
                            </div>
                        </div>

                        <div className="form-group space-y-1">
                            <label className="text-xs font-bold text-slate-700">Access Level / Role</label>
                            <select
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-purple-100 font-bold text-sm bg-white"
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                            >
                                <option value="SUPER_ADMIN">Full Administrator (Super Admin)</option>
                                <option value="QUESTION_ADMIN">Question Paper Admin</option>
                                <option value="COURSE_ADMIN">Course & Subject Admin</option>
                                <option value="INSTITUTION_ADMIN">Institution Admin</option>
                                <option value="INSTRUCTOR">Instructor</option>
                            </select>

                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl mt-3">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Permissions Summary</span>
                                <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                                    {ROLE_EXPLANATIONS[selectedRole] || 'No summary available.'}
                                </p>
                            </div>
                        </div>
                    </form>
                </AdminModal>
            )}

            {/* Manual Subscription Modal */}
            {addSubOpen && (
                <AdminModal
                    open={addSubOpen}
                    onClose={() => setAddSubOpen(false)}
                    title="Assign Manual Subscription"
                    footer={
                        <div className="flex gap-2 justify-end w-full">
                            <button
                                type="button"
                                className="secondary-btn text-xs font-bold"
                                onClick={() => setAddSubOpen(false)}
                                disabled={isActionPending}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="add-subscription-form"
                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-50"
                                disabled={isActionPending}
                            >
                                {isActionPending ? <Loader2 size={12} className="animate-spin" /> : 'Assign Plan'}
                            </button>
                        </div>
                    }
                >
                    <form id="add-subscription-form" onSubmit={handleAddSubSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                        <div className="form-group space-y-1">
                            <label className="text-xs font-bold text-slate-700">Select Student</label>
                            <select
                                required
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-100 font-bold text-sm bg-white"
                                value={subUserId}
                                onChange={(e) => setSubUserId(e.target.value)}
                            >
                                <option value="">-- Choose Student --</option>
                                {users.filter((u: any) => !u.is_staff && !u.is_superuser).map((u: any) => (
                                    <option key={u.id} value={u.id}>
                                        {u.email} ({u.first_name || 'No Name'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group space-y-1">
                            <label className="text-xs font-bold text-slate-700">Select Subscription Plan</label>
                            <select
                                required
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-100 font-bold text-sm bg-white"
                                value={subPlanId}
                                onChange={(e) => handlePlanSelectChange(e.target.value)}
                            >
                                <option value="">-- Choose Plan --</option>
                                {plans.map((p: any) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} - ₹{p.price} {p.billing_cycle === 'ATTEMPT_WISE' ? '(Attempt Wise)' : `(${p.duration_days} days)`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="form-group space-y-1">
                                <label className="text-xs font-bold text-slate-700">Target Level</label>
                                <select
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-100 font-bold text-sm bg-white"
                                    value={subLevelId}
                                    onChange={(e) => setSubLevelId(e.target.value)}
                                >
                                    <option value="">-- All Levels --</option>
                                    {levels.map((l: any) => (
                                        <option key={l.id} value={l.id}>{l.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group space-y-1">
                                <label className="text-xs font-bold text-slate-700">Target Subject</label>
                                <select
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-100 font-bold text-sm bg-white"
                                    value={subSubjectId}
                                    onChange={(e) => setSubSubjectId(e.target.value)}
                                >
                                    <option value="">-- All Subjects --</option>
                                    {subjects.filter((s: any) => !subLevelId || s.level === parseInt(subLevelId)).map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="form-group space-y-1">
                                <label className="text-xs font-bold text-slate-700">Group Override</label>
                                <select
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-100 font-bold text-sm bg-white"
                                    value={subGroup}
                                    onChange={(e) => setSubGroup(e.target.value)}
                                >
                                    <option value="">-- None --</option>
                                    <option value="GROUP_1">Group 1</option>
                                    <option value="GROUP_2">Group 2</option>
                                    <option value="ALL">All Groups</option>
                                </select>
                            </div>

                            <div className="form-group space-y-1">
                                <label className="text-xs font-bold text-slate-700">Attempt Month Override</label>
                                <select
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-100 font-bold text-sm bg-white"
                                    value={subAttempt}
                                    onChange={(e) => setSubAttempt(e.target.value)}
                                >
                                    <option value="">-- None --</option>
                                    {['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'].map(m => (
                                        <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="form-group space-y-1">
                                <label className="text-xs font-bold text-slate-700">Calendar Month</label>
                                <select
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-100 font-bold text-sm bg-white"
                                    value={subMonth}
                                    onChange={(e) => setSubMonth(e.target.value)}
                                >
                                    <option value="">-- None --</option>
                                    {['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'].map(m => (
                                        <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group space-y-1">
                                <label className="text-xs font-bold text-slate-700">Year</label>
                                <input
                                    type="number"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-100 font-bold text-sm bg-white"
                                    value={subYear}
                                    onChange={(e) => setSubYear(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="form-group space-y-1">
                                <label className="text-xs font-bold text-slate-700">Custom Start Date</label>
                                <input
                                    type="datetime-local"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-100 font-bold text-sm bg-white"
                                    value={subStartDate}
                                    onChange={(e) => setSubStartDate(e.target.value)}
                                />
                            </div>

                            <div className="form-group space-y-1">
                                <label className="text-xs font-bold text-slate-700">Custom End Date</label>
                                <input
                                    type="datetime-local"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-100 font-bold text-sm bg-white"
                                    value={subEndDate}
                                    onChange={(e) => setSubEndDate(e.target.value)}
                                />
                            </div>
                        </div>

                        {subPlanId && (
                            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-1.5 text-left">
                                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 block">Computed Plan Expiry</span>
                                <div className="text-sm font-black text-indigo-900">
                                    {getAdminSubExpiryDateStr()}
                                </div>
                                <p className="text-[10px] text-indigo-500 font-semibold leading-relaxed">
                                    This date dynamically calculates standard duration or rollover rules. You can manually adjust the "Custom End Date" input above if needed.
                                </p>
                            </div>
                        )}
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
