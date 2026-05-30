import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, Lock, CreditCard, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

export default function SettingsPage() {
    const user = useAuthStore((state) => state.user);
    const updateProfile = useAuthStore((state) => state.updateProfile);

    const [emailNotifs, setEmailNotifs] = useState(true);
    const [pushNotifs, setPushNotifs] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'notifications' | 'security' | 'billing'>('notifications');

    // Initialize from backend payload
    useEffect(() => {
        if (user?.settings) {
            setEmailNotifs(user.settings.email_notifs ?? true);
            setPushNotifs(user.settings.push_notifs ?? false);
        }
    }, [user]);

    const handleSave = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            await updateProfile({
                settings: {
                    email_notifs: emailNotifs,
                    push_notifs: pushNotifs,
                }
            });
        } catch (error) {
            console.error('Failed to save settings:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8 pb-20 max-w-4xl">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-black text-gray-900 tracking-tight">Preferences</h1>
                <p className="text-gray-400 font-bold text-sm mt-2 uppercase tracking-widest">Customize your study environment and notifications.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Lateral Tabs Mockup */}
                <div className="md:col-span-1 space-y-2">
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all ${activeTab === 'notifications' ? 'bg-primary text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100'}`}
                    >
                        <span className="text-xs font-black uppercase tracking-widest">Notifications</span>
                        <Bell size={18} />
                    </button>
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all ${activeTab === 'security' ? 'bg-primary text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100'}`}
                    >
                        <span className="text-xs font-black uppercase tracking-widest">Security</span>
                        <Lock size={18} />
                    </button>
                    <button
                        onClick={() => setActiveTab('billing')}
                        className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all ${activeTab === 'billing' ? 'bg-primary text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100'}`}
                    >
                        <span className="text-xs font-black uppercase tracking-widest">Billing</span>
                        <CreditCard size={18} />
                    </button>
                </div>

                {/* Main Settings Panel */}
                <div className="md:col-span-2 space-y-6">

                    {/* Notification Preferences */}
                    {activeTab === 'notifications' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                            className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8"
                        >
                            <h3 className="text-lg font-black text-slate-900 flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                                <Bell size={20} className="text-primary" /> Notifications
                            </h3>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-black text-slate-900">Email Updates</p>
                                        <p className="text-xs font-bold text-slate-500 mt-1">Receive syllabus updates and newsletters.</p>
                                    </div>
                                    <button
                                        onClick={() => setEmailNotifs(!emailNotifs)}
                                        className={`w-14 h-8 rounded-full transition-colors flex items-center px-1 ${emailNotifs ? 'bg-success' : 'bg-slate-200'}`}
                                    >
                                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform ${emailNotifs ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-black text-slate-900">Push Notifications</p>
                                        <p className="text-xs font-bold text-slate-500 mt-1">Get alerts for new mock test uploads.</p>
                                    </div>
                                    <button
                                        onClick={() => setPushNotifs(!pushNotifs)}
                                        className={`w-14 h-8 rounded-full transition-colors flex items-center px-1 ${pushNotifs ? 'bg-success' : 'bg-slate-200'}`}
                                    >
                                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform ${pushNotifs ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Security Preferences Placeholder */}
                    {activeTab === 'security' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8"
                        >
                            <h3 className="text-lg font-black text-slate-900 flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                                <Lock size={20} className="text-primary" /> Security & Privacy
                            </h3>
                            <p className="text-sm text-slate-500 font-medium">Manage your password, two-factor authentication, and connected devices here.</p>
                            <button className="mt-6 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                                Change Password
                            </button>
                        </motion.div>
                    )}

                    {/* Billing Placeholder */}
                    {activeTab === 'billing' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8"
                        >
                            <h3 className="text-lg font-black text-slate-900 flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                                <CreditCard size={20} className="text-primary" /> Billing & Subscription
                            </h3>
                            <p className="text-sm text-slate-500 font-medium">You are currently on the <strong className="text-slate-900">{user?.subscription_tier?.toUpperCase() || 'FREE ACCOUNT'}</strong>.</p>
                            <button className="mt-6 px-6 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-md">
                                Upgrade to Premium
                            </button>
                        </motion.div>
                    )}

                    {(activeTab === 'notifications') && (
                        <div className="flex justify-end gap-4 pt-4">
                            <button className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:bg-slate-200">
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
                            >
                                {isSaving && <Loader2 size={16} className="animate-spin" />}
                                Save Changes
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
