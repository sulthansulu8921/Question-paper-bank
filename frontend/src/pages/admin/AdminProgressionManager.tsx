import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/axios';
import {
    Plus, Edit, Trash2, Save, Loader2, GitPullRequest,
    Check, X, RefreshCw, Zap, BarChart3, ShieldAlert
} from 'lucide-react';
import AdminModal from '@/components/admin/AdminModal';
import AdminConfirmModal from '@/components/admin/AdminConfirmModal';
import { useAdminToast, getApiErrorMessage } from '@/components/admin/useAdminToast';
import '@/styles/admin/QuestionManagement.css';

const emptyPathForm = {
    current_level: '',
    next_level: '',
    upgrade_type: 'MANUAL',
    price: '0.00',
    button_text: 'Pay & Upgrade',
    is_active: true,
};

const emptyRuleForm = {
    min_score: 0,
    attendance_requirement: 0,
    mock_test_completion: false,
    assignment_completion: false,
    manual_approval_required: true,
};

const emptyTemplateForm = {
    name: '',
    channel: 'EMAIL',
    subject: '',
    body: '',
    is_active: true,
};

export default function AdminProgressionManager() {
    const queryClient = useQueryClient();
    const { show, Toast } = useAdminToast();
    const [activeTab, setActiveTab] = useState<'paths' | 'requests' | 'notifications' | 'analytics'>('paths');

    // Modals
    const [pathModalOpen, setPathModalOpen] = useState(false);
    const [editingPathId, setEditingPathId] = useState<number | null>(null);
    const [pathForm, setPathForm] = useState(emptyPathForm);
    const [ruleForm, setRuleForm] = useState(emptyRuleForm);

    const [templateModalOpen, setTemplateModalOpen] = useState(false);
    const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
    const [templateForm, setTemplateForm] = useState(emptyTemplateForm);

    // Force/Revert form states
    const [forceUserId, setForceUserId] = useState('');
    const [forcePathId, setForcePathId] = useState('');
    const [actionType, setActionType] = useState<'FORCE' | 'REVERT'>('FORCE');

    const [confirmDelete, setConfirmDelete] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ open: false, title: '', message: '', onConfirm: () => { } });



    const { data: levels = [] } = useQuery({
        queryKey: ['admin-progression-levels'],
        queryFn: async () => {
            const res = await api.get('/courses/levels/');
            return res.data || [];
        }
    });

    const { data: paths = [], isLoading: isPathsLoading } = useQuery({
        queryKey: ['admin-progression-paths'],
        queryFn: async () => {
            const res = await api.get('/courses/progression-paths/');
            return res.data || [];
        }
    });

    const { data: requests = [], isLoading: isRequestsLoading } = useQuery({
        queryKey: ['admin-progression-requests'],
        queryFn: async () => {
            const res = await api.get('/courses/upgrade-requests/');
            return res.data || [];
        }
    });

    const { data: templates = [], isLoading: isTemplatesLoading } = useQuery({
        queryKey: ['admin-progression-templates'],
        queryFn: async () => {
            const res = await api.get('/courses/notification-templates/');
            return res.data || [];
        }
    });

    const { data: analytics, isLoading: isAnalyticsLoading } = useQuery({
        queryKey: ['admin-progression-analytics'],
        queryFn: async () => {
            const res = await api.get('/courses/progression-analytics/');
            return res.data;
        }
    });

    const { data: auditLogs = [] } = useQuery({
        queryKey: ['admin-audit-logs'],
        queryFn: async () => {
            const res = await api.get('/courses/audit-logs/');
            return res.data.results || res.data || [];
        }
    });

    const { data: allUsers = [] } = useQuery({
        queryKey: ['admin-all-users'],
        queryFn: async () => {
            const res = await api.get('/authentication/users/');
            return res.data.results || res.data || [];
        }
    });

    // CRUD Mutations
    const savePathMutation = useMutation({
        mutationFn: async () => {
            if (editingPathId) {
                // Update path
                await api.put(`/courses/progression-paths/${editingPathId}/`, pathForm);
                // Find rule and update
                const pObj = paths.find((p: any) => p.id === editingPathId);
                if (pObj?.eligibility_rule?.id) {
                    await api.put(`/courses/eligibility-rules/${pObj.eligibility_rule.id}/`, {
                        ...ruleForm,
                        upgrade_path: editingPathId
                    });
                }
            } else {
                // Create path
                const res = await api.post('/courses/progression-paths/', pathForm);
                const newPath = res.data;
                // Create eligibility rule
                await api.post('/courses/eligibility-rules/', {
                    ...ruleForm,
                    upgrade_path: newPath.id
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-progression-paths'] });
            setPathModalOpen(false);
            show('Progression path saved successfully.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to save progression path.'), 'error'),
    });

    const deletePathMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/courses/progression-paths/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-progression-paths'] });
            show('Progression path deleted.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to delete path.'), 'error'),
    });

    const requestActionMutation = useMutation({
        mutationFn: ({ id, action }: { id: number; action: 'approve' | 'reject' }) =>
            api.post(`/courses/upgrade-requests/${id}/${action}/`),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['admin-progression-requests'] });
            queryClient.invalidateQueries({ queryKey: ['admin-progression-analytics'] });
            queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
            show(`Upgrade request successfully ${variables.action}d.`);
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to update request.'), 'error'),
    });

    const forceActionMutation = useMutation({
        mutationFn: (payload: any) => {
            const url = actionType === 'FORCE' ? '/courses/upgrade-requests/force/' : '/courses/upgrade-requests/revert/';
            return api.post(url, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-progression-requests'] });
            queryClient.invalidateQueries({ queryKey: ['admin-progression-analytics'] });
            queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
            setForceUserId('');
            setForcePathId('');
            show(`Successfully processed progression update.`);
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to execute update.'), 'error'),
    });

    const saveTemplateMutation = useMutation({
        mutationFn: (data: any) => {
            if (editingTemplateId) {
                return api.put(`/courses/notification-templates/${editingTemplateId}/`, data);
            }
            return api.post('/courses/notification-templates/', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-progression-templates'] });
            setTemplateModalOpen(false);
            show('Notification template saved.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to save template.'), 'error'),
    });

    const deleteTemplateMutation = useMutation({
        mutationFn: (id: number) => api.delete(`/courses/notification-templates/${id}/`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-progression-templates'] });
            show('Notification template deleted.');
        },
        onError: (e) => show(getApiErrorMessage(e, 'Failed to delete template.'), 'error'),
    });

    // Helper functions
    const openAddPath = () => {
        setEditingPathId(null);
        setPathForm(emptyPathForm);
        setRuleForm(emptyRuleForm);
        setPathModalOpen(true);
    };

    const openEditPath = (path: any) => {
        setEditingPathId(path.id);
        setPathForm({
            current_level: path.current_level || '',
            next_level: path.next_level || '',
            upgrade_type: path.upgrade_type || 'MANUAL',
            price: path.price || '0.00',
            button_text: path.button_text || 'Pay & Upgrade',
            is_active: path.is_active ?? true,
        });
        if (path.eligibility_rule) {
            setRuleForm({
                min_score: path.eligibility_rule.min_score || 0,
                attendance_requirement: path.eligibility_rule.attendance_requirement || 0,
                mock_test_completion: path.eligibility_rule.mock_test_completion || false,
                assignment_completion: path.eligibility_rule.assignment_completion || false,
                manual_approval_required: path.eligibility_rule.manual_approval_required ?? true,
            });
        } else {
            setRuleForm(emptyRuleForm);
        }
        setPathModalOpen(true);
    };

    const openAddTemplate = () => {
        setEditingTemplateId(null);
        setTemplateForm(emptyTemplateForm);
        setTemplateModalOpen(true);
    };

    const openEditTemplate = (tmpl: any) => {
        setEditingTemplateId(tmpl.id);
        setTemplateForm({
            name: tmpl.name || '',
            channel: tmpl.channel || 'EMAIL',
            subject: tmpl.subject || '',
            body: tmpl.body || '',
            is_active: tmpl.is_active ?? true,
        });
        setTemplateModalOpen(true);
    };

    return (
        <div className="qm-container px-6 py-6">
            {Toast}

            {/* Header */}
            <div className="qm-header flex justify-between items-center mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <GitPullRequest size={18} className="text-violet-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-violet-600">
                            Course Flow & Progression Control
                        </span>
                    </div>
                    <h1 className="page-title text-xl font-bold text-slate-800">Progression & Upgrades</h1>
                    <p className="page-subtitle text-xs text-slate-500">
                        Define automated/manual level routes, setup eligibility barriers, process student upgrade requests, and evaluate retention.
                    </p>
                </div>
                <div>
                    {activeTab === 'paths' && (
                        <button type="button" onClick={openAddPath} className="primary-btn flex-center gap-sm text-xs font-bold bg-violet-600 hover:bg-violet-700">
                            <Plus size={16} />
                            <span>Add Progression Path</span>
                        </button>
                    )}
                    {activeTab === 'notifications' && (
                        <button type="button" onClick={openAddTemplate} className="primary-btn flex-center gap-sm text-xs font-bold bg-violet-600 hover:bg-violet-700">
                            <Plus size={16} />
                            <span>Add Template</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Tab switchers */}
            <div className="flex gap-4 mb-6 border-b border-slate-100">
                <button
                    onClick={() => setActiveTab('paths')}
                    className={`pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'paths' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Progression Paths
                </button>
                <button
                    onClick={() => setActiveTab('requests')}
                    className={`pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'requests' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Upgrade Requests Workflow
                </button>
                <button
                    onClick={() => setActiveTab('notifications')}
                    className={`pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'notifications' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Notification Templates
                </button>
                <button
                    onClick={() => setActiveTab('analytics')}
                    className={`pb-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'analytics' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Progression Analytics
                </button>
            </div>

            {/* TAB 1: Progression Paths */}
            {activeTab === 'paths' && (
                <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
                    <table className="data-table w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                            <tr>
                                <th className="p-4">Current Level</th>
                                <th className="p-4">Next Level Target</th>
                                <th className="p-4">Workflow Mode</th>
                                <th className="p-4">Upgrade Price</th>
                                <th className="p-4">Button Callout</th>
                                <th className="p-4">Eligibility Barriers</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isPathsLoading && (
                                <tr>
                                    <td colSpan={7} className="text-center p-8">
                                        <Loader2 className="animate-spin mx-auto text-primary" />
                                    </td>
                                </tr>
                            )}
                            {!isPathsLoading && paths.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="text-center p-8 text-slate-400">
                                        No progression paths constructed yet.
                                    </td>
                                </tr>
                            )}
                            {paths.map((p: any) => (
                                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                    <td className="p-4 font-bold text-slate-800">{p.current_level_name}</td>
                                    <td className="p-4 font-bold text-violet-600">{p.next_level_name}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${p.upgrade_type === 'AUTOMATIC' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                                            {p.upgrade_type}
                                        </span>
                                    </td>
                                    <td className="p-4 font-bold text-slate-700">${p.price}</td>
                                    <td className="p-4 text-xs font-semibold text-slate-500">{p.button_text}</td>
                                    <td className="p-4 text-xs text-slate-500">
                                        {p.eligibility_rule ? (
                                            <div className="space-y-0.5">
                                                {p.eligibility_rule.min_score > 0 && <div>• Min Score: {p.eligibility_rule.min_score}%</div>}
                                                {p.eligibility_rule.attendance_requirement > 0 && <div>• Attendance: {p.eligibility_rule.attendance_requirement}%</div>}
                                                {p.eligibility_rule.mock_test_completion && <div>• Mocks Required</div>}
                                                {p.eligibility_rule.assignment_completion && <div>• Assignments Required</div>}
                                                {p.eligibility_rule.manual_approval_required && <div>• Admin Approval Required</div>}
                                                {!p.eligibility_rule.min_score && !p.eligibility_rule.attendance_requirement && !p.eligibility_rule.mock_test_completion && !p.eligibility_rule.assignment_completion && !p.eligibility_rule.manual_approval_required && <div>No barriers (Open Upgrade)</div>}
                                            </div>
                                        ) : '—'}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => openEditPath(p)} className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors">
                                                <Edit size={14} />
                                            </button>
                                            <button
                                                onClick={() => setConfirmDelete({
                                                    open: true,
                                                    title: 'Delete Path',
                                                    message: `Are you sure you want to delete this level route?`,
                                                    onConfirm: () => {
                                                        deletePathMutation.mutate(p.id);
                                                        setConfirmDelete(prev => ({ ...prev, open: false }));
                                                    }
                                                })}
                                                className="p-1.5 border border-red-100 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TAB 2: Upgrade Requests Workflow */}
            {activeTab === 'requests' && (
                <div className="space-y-8">
                    {/* Active Requests List */}
                    <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Pending Upgrade Requests</h3>
                        </div>
                        <table className="data-table w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                                <tr>
                                    <th className="p-4">Student Email</th>
                                    <th className="p-4">Requested Path Route</th>
                                    <th className="p-4">Pricing</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Date</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isRequestsLoading && (
                                    <tr>
                                        <td colSpan={6} className="text-center p-8">
                                            <Loader2 className="animate-spin mx-auto text-primary" />
                                        </td>
                                    </tr>
                                )}
                                {!isRequestsLoading && requests.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center p-8 text-slate-400">
                                            No student upgrade requests pending.
                                        </td>
                                    </tr>
                                )}
                                {requests.map((r: any) => (
                                    <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                        <td className="p-4 font-bold text-slate-800">{r.user_email}</td>
                                        <td className="p-4 text-xs font-semibold text-slate-600">
                                            {r.upgrade_path_detail?.current_level_name} → <span className="font-bold text-violet-600">{r.upgrade_path_detail?.next_level_name}</span>
                                        </td>
                                        <td className="p-4 font-bold text-slate-700">${r.upgrade_path_detail?.price || '0.00'}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${r.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                                    r.status === 'APPROVED' || r.status === 'FORCED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                        'bg-red-50 text-red-600 border border-red-100'
                                                }`}>
                                                {r.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-xs text-slate-500">{new Date(r.requested_at).toLocaleDateString()}</td>
                                        <td className="p-4 text-right">
                                            {r.status === 'PENDING' ? (
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => requestActionMutation.mutate({ id: r.id, action: 'approve' })} className="p-1 text-emerald-600 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 rounded-lg flex items-center gap-1 text-xs px-2 py-1 font-bold">
                                                        <Check size={12} /> Approve
                                                    </button>
                                                    <button onClick={() => requestActionMutation.mutate({ id: r.id, action: 'reject' })} className="p-1 text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg flex items-center gap-1 text-xs px-2 py-1 font-bold">
                                                        <X size={12} /> Reject
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 font-medium">Processed</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Force / Revert Actions console */}
                    <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <ShieldAlert size={16} className="text-rose-500" /> Manual Override Controls
                        </h3>
                        <p className="text-xs text-slate-500 mb-6">
                            Super admins can forcefully push a student to a level or revert their progress to prior levels. This bypasses eligibility rules.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="admin-form-group">
                                <label className="text-xs font-bold text-slate-700">Override Action</label>
                                <select className="admin-form-input mt-1" value={actionType} onChange={(e) => setActionType(e.target.value as any)}>
                                    <option value="FORCE">Force Upgrade (Advance)</option>
                                    <option value="REVERT">Revert Upgrade (Demote)</option>
                                </select>
                            </div>
                            <div className="admin-form-group">
                                <label className="text-xs font-bold text-slate-700">Select Student</label>
                                <select className="admin-form-input mt-1" value={forceUserId} onChange={(e) => setForceUserId(e.target.value)}>
                                    <option value="">Choose Student Account</option>
                                    {allUsers.map((u: any) => (
                                        <option key={u.id} value={u.id}>{u.email} ({u.first_name} {u.last_name})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="admin-form-group">
                                <label className="text-xs font-bold text-slate-700">Select Path Route</label>
                                <select className="admin-form-input mt-1" value={forcePathId} onChange={(e) => setForcePathId(e.target.value)}>
                                    <option value="">Choose Path Route</option>
                                    {paths.map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.current_level_name} → {p.next_level_name}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                type="button"
                                disabled={!forceUserId || !forcePathId || forceActionMutation.isPending}
                                onClick={() => forceActionMutation.mutate({ user_id: forceUserId, path_id: forcePathId })}
                                className="primary-btn text-xs font-bold bg-slate-800 hover:bg-slate-900 flex justify-center items-center gap-1.5 h-[42px]"
                            >
                                <RefreshCw size={14} className={forceActionMutation.isPending ? 'animate-spin' : ''} />
                                Execute Override
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: Notification Templates */}
            {activeTab === 'notifications' && (
                <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
                    <table className="data-table w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                            <tr>
                                <th className="p-4">Template Name</th>
                                <th className="p-4">Notification Channel</th>
                                <th className="p-4">Subject Head</th>
                                <th className="p-4">Message body</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isTemplatesLoading && (
                                <tr>
                                    <td colSpan={6} className="text-center p-8">
                                        <Loader2 className="animate-spin mx-auto text-primary" />
                                    </td>
                                </tr>
                            )}
                            {!isTemplatesLoading && templates.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center p-8 text-slate-400">
                                        No message templates created.
                                    </td>
                                </tr>
                            )}
                            {templates.map((t: any) => (
                                <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                    <td className="p-4 font-bold text-slate-800">{t.name}</td>
                                    <td className="p-4">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-violet-50 text-violet-600 border border-violet-100">
                                            {t.channel}
                                        </span>
                                    </td>
                                    <td className="p-4 text-slate-600 font-medium">{t.subject || '—'}</td>
                                    <td className="p-4 text-xs text-slate-500 max-w-sm truncate">{t.body}</td>
                                    <td className="p-4">
                                        <span className={`w-2.5 h-2.5 rounded-full inline-block ${t.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => openEditTemplate(t)} className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors">
                                                <Edit size={14} />
                                            </button>
                                            <button
                                                onClick={() => setConfirmDelete({
                                                    open: true,
                                                    title: 'Delete Template',
                                                    message: `Are you sure you want to delete template "${t.name}"?`,
                                                    onConfirm: () => {
                                                        deleteTemplateMutation.mutate(t.id);
                                                        setConfirmDelete(prev => ({ ...prev, open: false }));
                                                    }
                                                })}
                                                className="p-1.5 border border-red-100 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TAB 4: Progression Analytics & Logs */}
            {activeTab === 'analytics' && (
                <div className="space-y-8">
                    {/* Analytics metrics grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Eligible Students</p>
                                <h3 className="text-2xl font-black text-slate-800 mt-1">{isAnalyticsLoading ? '...' : analytics?.eligible_students}</h3>
                            </div>
                            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center">
                                <Zap size={18} />
                            </div>
                        </div>
                        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Active Requests</p>
                                <h3 className="text-2xl font-black text-slate-800 mt-1">{isAnalyticsLoading ? '...' : analytics?.upgrade_requests}</h3>
                            </div>
                            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center">
                                <GitPullRequest size={18} />
                            </div>
                        </div>
                        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Completed Upgrades</p>
                                <h3 className="text-2xl font-black text-slate-800 mt-1">{isAnalyticsLoading ? '...' : analytics?.completed_upgrades}</h3>
                            </div>
                            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
                                <Check size={18} />
                            </div>
                        </div>
                        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Upgrade Revenue</p>
                                <h3 className="text-2xl font-black text-slate-800 mt-1">${isAnalyticsLoading ? '...' : analytics?.revenue_generated?.toFixed(2)}</h3>
                            </div>
                            <div className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-500 flex items-center justify-center">
                                <BarChart3 size={18} />
                            </div>
                        </div>
                    </div>

                    {/* Retention and Drop off charts mockup */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
                            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Completion Rate</h4>
                            <div className="text-3xl font-black text-slate-800 mb-2">{isAnalyticsLoading ? '...' : analytics?.completion_rate}%</div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${analytics?.completion_rate || 0}%` }}></div>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-3 font-semibold">Average rate of student progression routes completed</p>
                        </div>
                        <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
                            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Retention Rate</h4>
                            <div className="text-3xl font-black text-slate-800 mb-2">{isAnalyticsLoading ? '...' : analytics?.retention_rate}%</div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${analytics?.retention_rate || 0}%` }}></div>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-3 font-semibold">Percentage of students moving to advanced levels</p>
                        </div>
                        <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
                            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Drop-off Rate</h4>
                            <div className="text-3xl font-black text-slate-800 mb-2">{isAnalyticsLoading ? '...' : analytics?.drop_off_rate}%</div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div className="bg-rose-500 h-full rounded-full" style={{ width: `${analytics?.drop_off_rate || 0}%` }}></div>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-3 font-semibold">Average rate of inactive students at current level</p>
                        </div>
                    </div>

                    {/* Audit Logs */}
                    <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-50 bg-slate-50/50">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">System Progression Audit Log</h3>
                        </div>
                        <div className="divide-y divide-slate-50 max-h-[300px] overflow-y-auto">
                            {auditLogs.length === 0 ? (
                                <p className="text-center py-6 text-slate-400 text-xs font-semibold">No audit logs recorded yet.</p>
                            ) : (
                                auditLogs.map((log: any) => (
                                    <div key={log.id} className="p-4 flex justify-between items-center hover:bg-slate-50/20">
                                        <div className="space-y-0.5">
                                            <div className="text-xs font-bold text-slate-800">{log.action}</div>
                                            <div className="text-[11px] text-slate-500">{log.description}</div>
                                        </div>
                                        <div className="text-right text-[10px] text-slate-400 space-y-0.5">
                                            <div>{log.user_email || 'System'}</div>
                                            <div>{new Date(log.created_at).toLocaleString()}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Path Modal */}
            <AdminModal
                open={pathModalOpen}
                onClose={() => setPathModalOpen(false)}
                title={editingPathId ? 'Edit Progression Path' : 'Add Progression Path'}
                size="lg"
                footer={
                    <>
                        <button type="button" className="secondary-btn text-xs font-bold" onClick={() => setPathModalOpen(false)}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="primary-btn flex-center gap-sm text-xs font-black uppercase tracking-wider bg-violet-600 hover:bg-violet-700"
                            onClick={() => savePathMutation.mutate()}
                            disabled={savePathMutation.isPending}
                        >
                            <Save size={16} />
                            <span>Save Progression Path</span>
                        </button>
                    </>
                }
            >
                <div className="space-y-6">
                    {/* Path Route details */}
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-violet-600 mb-3">Progression Settings</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="admin-form-group">
                                <label className="text-xs font-bold text-slate-700">Current Level</label>
                                <select className="admin-form-input mt-1" value={pathForm.current_level} onChange={(e) => setPathForm({ ...pathForm, current_level: e.target.value })}>
                                    <option value="">Choose Current Level</option>
                                    {levels.map((lvl: any) => (
                                        <option key={lvl.id} value={lvl.id}>{lvl.course_name || lvl.course?.name} - {lvl.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="admin-form-group">
                                <label className="text-xs font-bold text-slate-700">Next Level Target</label>
                                <select className="admin-form-input mt-1" value={pathForm.next_level} onChange={(e) => setPathForm({ ...pathForm, next_level: e.target.value })}>
                                    <option value="">Choose Target Level</option>
                                    {levels.map((lvl: any) => (
                                        <option key={lvl.id} value={lvl.id}>{lvl.course_name || lvl.course?.name} - {lvl.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-4">
                            <div className="admin-form-group">
                                <label className="text-xs font-bold text-slate-700">Workflow Mode</label>
                                <select className="admin-form-input mt-1" value={pathForm.upgrade_type} onChange={(e) => setPathForm({ ...pathForm, upgrade_type: e.target.value })}>
                                    <option value="AUTOMATIC">Automatic Upgrade</option>
                                    <option value="MANUAL">Manual Request / Paid</option>
                                </select>
                            </div>
                            <div className="admin-form-group">
                                <label className="text-xs font-bold text-slate-700">Upgrade Price</label>
                                <input type="number" className="admin-form-input mt-1" value={pathForm.price} onChange={(e) => setPathForm({ ...pathForm, price: e.target.value })} />
                            </div>
                            <div className="admin-form-group">
                                <label className="text-xs font-bold text-slate-700">Button Callout Text</label>
                                <input className="admin-form-input mt-1" value={pathForm.button_text} onChange={(e) => setPathForm({ ...pathForm, button_text: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    {/* Eligibility Barriers */}
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-violet-600 mb-3">Eligibility Barriers</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="admin-form-group">
                                <label className="text-xs font-bold text-slate-700">Minimum Score Requirement (%)</label>
                                <input type="number" className="admin-form-input mt-1" value={ruleForm.min_score} onChange={(e) => setRuleForm({ ...ruleForm, min_score: parseInt(e.target.value) || 0 })} />
                            </div>
                            <div className="admin-form-group">
                                <label className="text-xs font-bold text-slate-700">Attendance Requirement (%)</label>
                                <input type="number" className="admin-form-input mt-1" value={ruleForm.attendance_requirement} onChange={(e) => setRuleForm({ ...ruleForm, attendance_requirement: parseInt(e.target.value) || 0 })} />
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 mt-4">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 select-none cursor-pointer">
                                <input type="checkbox" checked={ruleForm.mock_test_completion} onChange={(e) => setRuleForm({ ...ruleForm, mock_test_completion: e.target.checked })} />
                                Require Mock Test Completion
                            </label>
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 select-none cursor-pointer">
                                <input type="checkbox" checked={ruleForm.assignment_completion} onChange={(e) => setRuleForm({ ...ruleForm, assignment_completion: e.target.checked })} />
                                Require Assignment Completion
                            </label>
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 select-none cursor-pointer">
                                <input type="checkbox" checked={ruleForm.manual_approval_required} onChange={(e) => setRuleForm({ ...ruleForm, manual_approval_required: e.target.checked })} />
                                Require Manual Admin Approval
                            </label>
                        </div>
                    </div>
                </div>
            </AdminModal>

            {/* Template Modal */}
            <AdminModal
                open={templateModalOpen}
                onClose={() => setTemplateModalOpen(false)}
                title={editingTemplateId ? 'Edit Notification Template' : 'Add Notification Template'}
                size="md"
                footer={
                    <>
                        <button type="button" className="secondary-btn text-xs font-bold" onClick={() => setTemplateModalOpen(false)}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="primary-btn flex-center gap-sm text-xs font-black uppercase tracking-wider bg-violet-600 hover:bg-violet-700"
                            onClick={() => saveTemplateMutation.mutate(templateForm)}
                            disabled={saveTemplateMutation.isPending}
                        >
                            <Save size={16} />
                            <span>Save Template</span>
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Template Name</label>
                        <input className="admin-form-input mt-1" value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="e.g. Upgrade Approved Template" />
                    </div>
                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Notification Channel</label>
                        <select className="admin-form-input mt-1" value={templateForm.channel} onChange={(e) => setTemplateForm({ ...templateForm, channel: e.target.value })}>
                            <option value="EMAIL">Email</option>
                            <option value="SMS">SMS</option>
                            <option value="PUSH">Push Notification</option>
                            <option value="WHATSAPP">WhatsApp</option>
                        </select>
                    </div>
                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Subject Head (For Emails)</label>
                        <input className="admin-form-input mt-1" value={templateForm.subject} onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })} placeholder="Email Subject line" />
                    </div>
                    <div className="admin-form-group">
                        <label className="text-xs font-bold text-slate-700">Message Body Template</label>
                        <textarea className="admin-form-input mt-1 min-h-[120px]" value={templateForm.body} onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })} placeholder="Write message body here..." />
                    </div>
                </div>
            </AdminModal>

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
