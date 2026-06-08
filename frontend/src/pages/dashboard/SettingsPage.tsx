import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Bell, Lock, CreditCard, Loader2, User, Mail, Phone, 
    Shield, Key, Check, AlertCircle, Download,
    Calendar, ArrowRight, Eye, EyeOff
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/axios';
import { useNavigate } from 'react-router-dom';

export default function SettingsPage() {
    const user = useAuthStore((state) => state.user);
    const updateProfile = useAuthStore((state) => state.updateProfile);
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<'notifications' | 'security' | 'billing'>('notifications');

    // --- Notifications Tab States ---
    const [emailNotifs, setEmailNotifs] = useState(true);
    const [pushNotifs, setPushNotifs] = useState(false);
    const [isSavingNotifs, setIsSavingNotifs] = useState(false);
    const [notifFeedback, setNotifFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // --- Security Tab States: Profile ---
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [mobileNumber, setMobileNumber] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // --- Security Tab States: Password Change ---
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showOldPass, setShowOldPass] = useState(false);
    const [showNewPass, setShowNewPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // --- Billing Tab Queries ---
    const { data: userSubscriptions = [], isLoading: isLoadingSubs } = useQuery<any[]>({
        queryKey: ['user-subscriptions-settings'],
        queryFn: async () => (await api.get('/subscriptions/my-subscriptions/')).data,
    });

    const { data: payments = [], isLoading: isLoadingPayments } = useQuery<any[]>({
        queryKey: ['user-payments-settings'],
        queryFn: async () => (await api.get('/subscriptions/payments/')).data,
    });

    const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<number | null>(null);

    // Initialize inputs from user auth store
    useEffect(() => {
        if (user) {
            setEmailNotifs(user.settings?.email_notifs ?? true);
            setPushNotifs(user.settings?.push_notifs ?? false);
            setFirstName(user.first_name || '');
            setLastName(user.last_name || '');
            setEmail(user.email || '');
            setMobileNumber(user.mobile_number || '');
        }
    }, [user]);

    // Clear feedback messages automatically after 5 seconds
    useEffect(() => {
        if (notifFeedback) {
            const timer = setTimeout(() => setNotifFeedback(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [notifFeedback]);

    useEffect(() => {
        if (profileFeedback) {
            const timer = setTimeout(() => setProfileFeedback(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [profileFeedback]);

    useEffect(() => {
        if (passwordFeedback) {
            const timer = setTimeout(() => setPasswordFeedback(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [passwordFeedback]);

    // Handle saving Notification Toggles
    const handleSaveNotifications = async () => {
        if (isSavingNotifs) return;
        setIsSavingNotifs(true);
        setNotifFeedback(null);
        try {
            await updateProfile({
                settings: {
                    email_notifs: emailNotifs,
                    push_notifs: pushNotifs,
                }
            });
            setNotifFeedback({ type: 'success', message: 'Notification settings updated successfully.' });
        } catch (error: any) {
            console.error('Failed to save settings:', error);
            setNotifFeedback({ type: 'error', message: 'Failed to update notifications. Please try again.' });
        } finally {
            setIsSavingNotifs(false);
        }
    };

    // Handle Profile fields update
    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSavingProfile) return;
        setIsSavingProfile(true);
        setProfileFeedback(null);
        try {
            await updateProfile({
                first_name: firstName,
                last_name: lastName,
                email: email,
                mobile_number: mobileNumber
            });
            setProfileFeedback({ type: 'success', message: 'Profile details updated successfully.' });
        } catch (error: any) {
            console.error('Failed to update profile:', error);
            const errMsg = error.response?.data?.error || 'Failed to update profile details. Please try again.';
            setProfileFeedback({ type: 'error', message: errMsg });
        } finally {
            setIsSavingProfile(false);
        }
    };

    // Handle Password Change
    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isChangingPassword) return;
        if (!oldPassword || !newPassword || !confirmPassword) {
            setPasswordFeedback({ type: 'error', message: 'All password fields are required.' });
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordFeedback({ type: 'error', message: 'New passwords do not match.' });
            return;
        }
        setIsChangingPassword(true);
        setPasswordFeedback(null);
        try {
            await api.post('/auth/change-password/', {
                old_password: oldPassword,
                new_password: newPassword
            });
            setPasswordFeedback({ type: 'success', message: 'Password changed successfully!' });
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            console.error('Failed to change password:', error);
            const errMsg = error.response?.data?.error || 'Failed to change password. Make sure current password is correct.';
            setPasswordFeedback({ type: 'error', message: errMsg });
        } finally {
            setIsChangingPassword(false);
        }
    };

    // Handle invoice download
    const handleDownloadInvoice = async (paymentId: number, transactionId: string) => {
        setDownloadingInvoiceId(paymentId);
        try {
            const response = await api.get(`/subscriptions/payments/${paymentId}/download_invoice/`, {
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `invoice_${transactionId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (error) {
            console.error('Invoice download failed:', error);
            alert('Unable to download tax invoice. Please try again.');
        } finally {
            setDownloadingInvoiceId(null);
        }
    };

    return (
        <div className="space-y-10 pb-20 max-w-5xl mx-auto p-4 md:p-8">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-black text-text-primary tracking-tight">Preferences</h1>
                <p className="text-text-muted font-bold text-sm mt-2 uppercase tracking-widest">Customize your study environment and account credentials.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
                {/* Lateral Tabs Menu */}
                <div className="lg:col-span-1 space-y-2.5">
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all ${
                            activeTab === 'notifications' 
                            ? 'bg-primary text-white shadow-lg shadow-primary/25 border border-primary' 
                            : 'bg-card text-text-secondary hover:bg-bg border border-border'
                        }`}
                    >
                        <span className="text-xs font-black uppercase tracking-wider">Notifications</span>
                        <Bell size={16} />
                    </button>
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all ${
                            activeTab === 'security' 
                            ? 'bg-primary text-white shadow-lg shadow-primary/25 border border-primary' 
                            : 'bg-card text-text-secondary hover:bg-bg border border-border'
                        }`}
                    >
                        <span className="text-xs font-black uppercase tracking-wider">Security & Account</span>
                        <Lock size={16} />
                    </button>
                    <button
                        onClick={() => setActiveTab('billing')}
                        className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all ${
                            activeTab === 'billing' 
                            ? 'bg-primary text-white shadow-lg shadow-primary/25 border border-primary' 
                            : 'bg-card text-text-secondary hover:bg-bg border border-border'
                        }`}
                    >
                        <span className="text-xs font-black uppercase tracking-wider">Billing & Invoice</span>
                        <CreditCard size={16} />
                    </button>
                </div>

                {/* Main Settings Panel */}
                <div className="lg:col-span-3 space-y-8">
                    <AnimatePresence mode="wait">
                        {/* --- NOTIFICATIONS TAB --- */}
                        {activeTab === 'notifications' && (
                            <motion.div
                                key="notifications-tab"
                                initial={{ opacity: 0, y: 15 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.2 }}
                                className="bg-card rounded-[2rem] border border-border shadow-sm p-6 md:p-8 space-y-6"
                            >
                                <div className="border-b border-border pb-4">
                                    <h3 className="text-lg font-black text-text-primary flex items-center gap-3">
                                        <Bell size={20} className="text-primary" /> Notification Settings
                                    </h3>
                                    <p className="text-xs text-text-muted font-bold mt-1 uppercase tracking-wide">Manage communication channels</p>
                                </div>

                                {notifFeedback && (
                                    <div className={`p-4 rounded-xl flex items-center gap-3 text-xs font-semibold border ${
                                        notifFeedback.type === 'success' 
                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' 
                                        : 'bg-rose-500/10 border-rose-500/20 text-rose-600'
                                    }`}>
                                        {notifFeedback.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                                        <span>{notifFeedback.message}</span>
                                    </div>
                                )}

                                <div className="space-y-6">
                                    <div className="flex items-center justify-between py-2">
                                        <div>
                                            <p className="text-sm font-black text-text-primary">Email Updates</p>
                                            <p className="text-xs font-bold text-text-secondary mt-1">Receive syllabus updates, study resources and newsletters.</p>
                                        </div>
                                        <button
                                            onClick={() => setEmailNotifs(!emailNotifs)}
                                            className={`w-14 h-8 rounded-full transition-colors flex items-center px-1 shrink-0 ${emailNotifs ? 'bg-success' : 'bg-border'}`}
                                        >
                                            <div className={`w-6 h-6 bg-card rounded-full shadow-md transition-transform ${emailNotifs ? 'translate-x-6' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between py-2 border-t border-border">
                                        <div>
                                            <p className="text-sm font-black text-text-primary">Push Notifications</p>
                                            <p className="text-xs font-bold text-text-secondary mt-1">Get instant browser alerts for new mock test uploads and streak status.</p>
                                        </div>
                                        <button
                                            onClick={() => setPushNotifs(!pushNotifs)}
                                            className={`w-14 h-8 rounded-full transition-colors flex items-center px-1 shrink-0 ${pushNotifs ? 'bg-success' : 'bg-border'}`}
                                        >
                                            <div className={`w-6 h-6 bg-card rounded-full shadow-md transition-transform ${pushNotifs ? 'translate-x-6' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-4 pt-4 border-t border-border">
                                    <button 
                                        onClick={() => {
                                            setEmailNotifs(user?.settings?.email_notifs ?? true);
                                            setPushNotifs(user?.settings?.push_notifs ?? false);
                                        }}
                                        className="px-6 py-3 bg-bg text-text-primary rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:bg-bg-secondary border border-border"
                                    >
                                        Reset
                                    </button>
                                    <button
                                        onClick={handleSaveNotifications}
                                        disabled={isSavingNotifs}
                                        className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md hover:bg-primary-hover transition-all disabled:opacity-50"
                                    >
                                        {isSavingNotifs && <Loader2 size={16} className="animate-spin" />}
                                        Save Preferences
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* --- SECURITY & PROFILE TAB --- */}
                        {activeTab === 'security' && (
                            <motion.div
                                key="security-tab"
                                initial={{ opacity: 0, y: 15 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-8"
                            >
                                {/* 1. Profile details form */}
                                <div className="bg-card rounded-[2rem] border border-border shadow-sm p-6 md:p-8 space-y-6">
                                    <div className="border-b border-border pb-4">
                                        <h3 className="text-lg font-black text-text-primary flex items-center gap-3">
                                            <User size={20} className="text-primary" /> Profile Credentials
                                        </h3>
                                        <p className="text-xs text-text-muted font-bold mt-1 uppercase tracking-wide">Update personal identification details</p>
                                    </div>

                                    {profileFeedback && (
                                        <div className={`p-4 rounded-xl flex items-center gap-3 text-xs font-semibold border ${
                                            profileFeedback.type === 'success' 
                                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' 
                                            : 'bg-rose-500/10 border-rose-500/20 text-rose-600'
                                        }`}>
                                            {profileFeedback.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                                            <span>{profileFeedback.message}</span>
                                        </div>
                                    )}

                                    <form onSubmit={handleSaveProfile} className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase text-text-muted tracking-wider">First Name</label>
                                                <div className="relative">
                                                    <User className="absolute left-4 top-3 text-text-muted" size={18} />
                                                    <input
                                                        type="text"
                                                        value={firstName}
                                                        onChange={(e) => setFirstName(e.target.value)}
                                                        className="w-full pl-12 pr-4 py-3 bg-bg border border-border rounded-xl text-sm font-semibold text-text-primary focus:outline-none focus:border-primary transition-all"
                                                        placeholder="Enter first name"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase text-text-muted tracking-wider">Last Name</label>
                                                <div className="relative">
                                                    <User className="absolute left-4 top-3 text-text-muted" size={18} />
                                                    <input
                                                        type="text"
                                                        value={lastName}
                                                        onChange={(e) => setLastName(e.target.value)}
                                                        className="w-full pl-12 pr-4 py-3 bg-bg border border-border rounded-xl text-sm font-semibold text-text-primary focus:outline-none focus:border-primary transition-all"
                                                        placeholder="Enter last name"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase text-text-muted tracking-wider">Email Address</label>
                                                <div className="relative">
                                                    <Mail className="absolute left-4 top-3 text-text-muted" size={18} />
                                                    <input
                                                        type="email"
                                                        value={email}
                                                        onChange={(e) => setEmail(e.target.value)}
                                                        className="w-full pl-12 pr-4 py-3 bg-bg border border-border rounded-xl text-sm font-semibold text-text-primary focus:outline-none focus:border-primary transition-all"
                                                        placeholder="name@domain.com"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase text-text-muted tracking-wider">Mobile Number</label>
                                                <div className="relative">
                                                    <Phone className="absolute left-4 top-3 text-text-muted" size={18} />
                                                    <input
                                                        type="tel"
                                                        value={mobileNumber}
                                                        onChange={(e) => setMobileNumber(e.target.value)}
                                                        className="w-full pl-12 pr-4 py-3 bg-bg border border-border rounded-xl text-sm font-semibold text-text-primary focus:outline-none focus:border-primary transition-all"
                                                        placeholder="Enter mobile number"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-end pt-4 border-t border-border">
                                            <button
                                                type="submit"
                                                disabled={isSavingProfile}
                                                className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md hover:bg-primary-hover transition-all disabled:opacity-50"
                                            >
                                                {isSavingProfile && <Loader2 size={16} className="animate-spin" />}
                                                Save Profile Details
                                            </button>
                                        </div>
                                    </form>
                                </div>

                                {/* 2. Change password form */}
                                <div className="bg-card rounded-[2rem] border border-border shadow-sm p-6 md:p-8 space-y-6">
                                    <div className="border-b border-border pb-4">
                                        <h3 className="text-lg font-black text-text-primary flex items-center gap-3">
                                            <Key size={20} className="text-primary" /> Update Password
                                        </h3>
                                        <p className="text-xs text-text-muted font-bold mt-1 uppercase tracking-wide">Change account passcode credentials</p>
                                    </div>

                                    {passwordFeedback && (
                                        <div className={`p-4 rounded-xl flex items-center gap-3 text-xs font-semibold border ${
                                            passwordFeedback.type === 'success' 
                                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' 
                                            : 'bg-rose-500/10 border-rose-500/20 text-rose-600'
                                        }`}>
                                            {passwordFeedback.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                                            <span>{passwordFeedback.message}</span>
                                        </div>
                                    )}

                                    <form onSubmit={handleChangePassword} className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-text-muted tracking-wider">Current Password</label>
                                            <div className="relative">
                                                <Lock className="absolute left-4 top-3 text-text-muted" size={18} />
                                                <input
                                                    type={showOldPass ? "text" : "password"}
                                                    value={oldPassword}
                                                    onChange={(e) => setOldPassword(e.target.value)}
                                                    className="w-full pl-12 pr-12 py-3 bg-bg border border-border rounded-xl text-sm font-semibold text-text-primary focus:outline-none focus:border-primary transition-all"
                                                    placeholder="••••••••"
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowOldPass(!showOldPass)}
                                                    className="absolute right-4 top-3.5 text-text-muted hover:text-text-primary"
                                                >
                                                    {showOldPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase text-text-muted tracking-wider">New Password</label>
                                                <div className="relative">
                                                    <Key className="absolute left-4 top-3 text-text-muted" size={18} />
                                                    <input
                                                        type={showNewPass ? "text" : "password"}
                                                        value={newPassword}
                                                        onChange={(e) => setNewPassword(e.target.value)}
                                                        className="w-full pl-12 pr-12 py-3 bg-bg border border-border rounded-xl text-sm font-semibold text-text-primary focus:outline-none focus:border-primary transition-all"
                                                        placeholder="Min. 8 characters"
                                                        required
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowNewPass(!showNewPass)}
                                                        className="absolute right-4 top-3.5 text-text-muted hover:text-text-primary"
                                                    >
                                                        {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase text-text-muted tracking-wider">Confirm New Password</label>
                                                <div className="relative">
                                                    <Key className="absolute left-4 top-3 text-text-muted" size={18} />
                                                    <input
                                                        type={showConfirmPass ? "text" : "password"}
                                                        value={confirmPassword}
                                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                                        className="w-full pl-12 pr-12 py-3 bg-bg border border-border rounded-xl text-sm font-semibold text-text-primary focus:outline-none focus:border-primary transition-all"
                                                        placeholder="••••••••"
                                                        required
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                                                        className="absolute right-4 top-3.5 text-text-muted hover:text-text-primary"
                                                    >
                                                        {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-end pt-4 border-t border-border">
                                            <button
                                                type="submit"
                                                disabled={isChangingPassword}
                                                className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md hover:bg-primary-hover transition-all disabled:opacity-50"
                                            >
                                                {isChangingPassword && <Loader2 size={16} className="animate-spin" />}
                                                Change Password
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </motion.div>
                        )}

                        {/* --- BILLING & SUBSCRIPTIONS TAB --- */}
                        {activeTab === 'billing' && (
                            <motion.div
                                key="billing-tab"
                                initial={{ opacity: 0, y: 15 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-8"
                            >
                                {/* 1. Active access plans display */}
                                <div className="bg-card rounded-[2rem] border border-border shadow-sm p-6 md:p-8 space-y-6">
                                    <div className="border-b border-border pb-4 flex items-center justify-between">
                                        <div>
                                            <h3 className="text-lg font-black text-text-primary flex items-center gap-3">
                                                <Shield size={20} className="text-primary" /> Account Tier & Access
                                            </h3>
                                            <p className="text-xs text-text-muted font-bold mt-1 uppercase tracking-wide">Active learning plans</p>
                                        </div>
                                        <button
                                            onClick={() => navigate('/dashboard/subscription')}
                                            className="px-4 py-2 border border-primary text-primary hover:bg-primary/5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5"
                                        >
                                            Plans & Pricing <ArrowRight size={12} />
                                        </button>
                                    </div>

                                    {isLoadingSubs ? (
                                        <div className="flex items-center justify-center gap-3 py-10">
                                            <Loader2 className="animate-spin text-primary" size={24} />
                                            <span className="text-sm text-text-secondary font-bold">Retrieving subscription tiers...</span>
                                        </div>
                                    ) : userSubscriptions.filter(s => s.is_active).length === 0 ? (
                                        <div className="bg-bg/50 border border-border p-6 rounded-2xl flex flex-col items-center text-center gap-4 max-w-md mx-auto">
                                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                                                <Lock size={24} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-text-primary">Free Account Access Only</h4>
                                                <p className="text-xs text-text-muted mt-2 leading-relaxed">
                                                    You are currently accessing study notes under the free plan. Upgrade to unlock all detailed step-by-step papers, simulated mock assessments, and premium downloads.
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => navigate('/dashboard/subscription')}
                                                className="w-full py-3 bg-gradient-to-r from-teal-400 to-primary text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md shadow-primary/20 hover:scale-[1.01] transition-all"
                                            >
                                                Upgrade to Premium
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {userSubscriptions.filter(s => s.is_active).map((sub, idx) => {
                                                const endDate = new Date(sub.end_date);
                                                const diffTime = endDate.getTime() - new Date().getTime();
                                                const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

                                                return (
                                                    <div key={idx} className="bg-gradient-to-br from-card to-bg border border-border p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-black text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                                                    Active
                                                                </span>
                                                                <h4 className="text-sm font-black text-text-primary">
                                                                    {sub.level?.name || 'Course Plan'}
                                                                </h4>
                                                            </div>
                                                            <p className="text-xs text-text-secondary font-semibold">
                                                                {sub.plan?.name} • {sub.subject?.name || sub.group?.replace('_', ' ').toUpperCase() || 'All Tiers'}
                                                            </p>
                                                        </div>

                                                        <div className="flex items-center gap-6 text-right shrink-0">
                                                            <div className="space-y-0.5">
                                                                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Expiration Date</p>
                                                                <p className="text-xs font-black text-text-primary flex items-center gap-1.5 justify-end">
                                                                    <Calendar size={13} className="text-primary" />
                                                                    {endDate.toLocaleDateString(undefined, { dateStyle: 'medium' })}
                                                                </p>
                                                                <p className="text-[10px] font-bold text-primary mt-0.5">
                                                                    ({daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining)
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* 2. Payment transactions & Invoices */}
                                <div className="bg-card rounded-[2rem] border border-border shadow-sm p-6 md:p-8 space-y-6">
                                    <div>
                                        <h3 className="text-lg font-black text-text-primary flex items-center gap-3 border-b border-border pb-4">
                                            <CreditCard size={20} className="text-primary" /> Transaction History
                                        </h3>
                                        <p className="text-xs text-text-muted font-bold mt-1 uppercase tracking-wide">Manage and download your tax invoices.</p>
                                    </div>

                                    {isLoadingPayments ? (
                                        <div className="flex items-center justify-center gap-3 py-10">
                                            <Loader2 className="animate-spin text-primary" size={24} />
                                            <span className="text-sm text-text-secondary font-bold">Loading past payments...</span>
                                        </div>
                                    ) : payments.length === 0 ? (
                                        <div className="text-center py-12 border border-dashed border-border rounded-2xl space-y-2">
                                            <p className="text-xs font-black text-text-secondary">No Payment Records Found</p>
                                            <p className="text-[10px] text-text-muted">Once you make a subscription purchase, your invoices will appear here.</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs">
                                                <thead>
                                                    <tr className="border-b border-border text-text-muted font-bold uppercase tracking-wider">
                                                        <th className="pb-4">Plan Name</th>
                                                        <th className="pb-4">Transaction ID</th>
                                                        <th className="pb-4 text-center">Amount</th>
                                                        <th className="pb-4 text-center">Date</th>
                                                        <th className="pb-4 text-right">Invoice</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {payments.map((pay) => (
                                                        <tr key={pay.id} className="border-b border-border hover:bg-bg/50 transition-colors">
                                                            <td className="py-4 font-black text-text-primary">
                                                                {pay.subscription_plan_name || 'Premium Plan'}
                                                            </td>
                                                            <td className="py-4 font-semibold text-text-secondary uppercase">
                                                                {pay.transaction_id || 'N/A'}
                                                            </td>
                                                            <td className="py-4 text-center font-black text-text-primary">
                                                                ₹{parseFloat(pay.amount).toLocaleString()}
                                                            </td>
                                                            <td className="py-4 text-center font-semibold text-text-secondary">
                                                                {new Date(pay.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                                                            </td>
                                                            <td className="py-4 text-right">
                                                                <button
                                                                    onClick={() => handleDownloadInvoice(pay.id, pay.transaction_id)}
                                                                    disabled={downloadingInvoiceId === pay.id}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg hover:bg-bg-secondary border border-border text-text-primary rounded-lg text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
                                                                >
                                                                    {downloadingInvoiceId === pay.id ? (
                                                                        <Loader2 size={12} className="animate-spin text-primary" />
                                                                    ) : (
                                                                        <Download size={12} />
                                                                    )}
                                                                    <span>Invoice</span>
                                                                </button>
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
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
