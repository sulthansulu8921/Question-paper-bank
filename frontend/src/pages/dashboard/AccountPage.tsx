import { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { User, Mail, Shield, Award, Calendar, ExternalLink, Loader2, Edit3, Check } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AccountPage() {
    const user = useAuthStore((state) => state.user);
    const updateProfile = useAuthStore((state) => state.updateProfile);

    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [fullName, setFullName] = useState(user?.full_name || 'Student User');

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

    return (
        <div className="space-y-8 pb-20 max-w-4xl">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-black text-gray-900 tracking-tight">Account Overview</h1>
                <p className="text-gray-400 font-bold text-sm mt-2 uppercase tracking-widest">Manage your personal details and academic profile.</p>
            </div>

            {/* Main Details Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden"
            >
                {/* Banner */}
                <div className="h-32 bg-gradient-to-r from-primary to-accent relative">
                    <div className="absolute inset-0 bg-white/10 mix-blend-overlay" />
                </div>

                <div className="px-10 pb-10 relative">
                    {/* Floating Avatar */}
                    <div className="absolute -top-12 left-10 w-24 h-24 bg-white rounded-3xl p-2 shadow-xl transition-all">
                        <div className="w-full h-full bg-gradient-to-tr from-primary to-accent rounded-2xl flex items-center justify-center">
                            <span className="text-3xl font-black text-white">{initials}</span>
                        </div>
                    </div>

                    <div className="pt-16 pb-8 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex-1 mr-4">
                            {isEditing ? (
                                <input
                                    autoFocus
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="text-3xl font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 w-full focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all font-sans"
                                />
                            ) : (
                                <h2 className="text-3xl font-black text-slate-900">{user?.full_name || 'Student User'}</h2>
                            )}
                            <div className="flex items-center gap-3 mt-3">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-success/10 text-success text-[10px] font-black uppercase tracking-widest rounded-lg">
                                    <Shield size={12} /> Verified
                                </span>
                                <span className="text-sm font-bold text-slate-400">{user?.email || 'student@example.com'}</span>
                            </div>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className={`px-6 py-3 rounded-xl text-xs flex items-center gap-2 font-black uppercase tracking-widest shadow-md transition-all ${isEditing ? 'bg-success text-white hover:bg-success/90' : 'bg-slate-900 text-white hover:bg-primary'}`}
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : isEditing ? <Check size={16} /> : <Edit3 size={16} />}
                            {isEditing ? 'Save Changes' : 'Edit Profile'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8">
                        <div>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Personal Details</h3>
                            <div className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center shrink-0">
                                        <User size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Full Name</p>
                                        <p className="text-sm font-black text-slate-900">{user?.full_name || 'Student User'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center shrink-0">
                                        <Mail size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email Address</p>
                                        <p className="text-sm font-black text-slate-900">{user?.email || 'student@example.com'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Academic Plan</h3>
                            <div className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center shrink-0">
                                        <Award size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Tier</p>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-black text-slate-900">{user?.subscription_tier?.toUpperCase() || 'FREE ACCOUNT'}</p>
                                            <a href="#" className="text-[10px] text-primary font-black uppercase tracking-widest hover:underline flex items-center gap-1">Upgrade <ExternalLink size={10} /></a>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 bg-primary/5 text-primary rounded-xl flex items-center justify-center shrink-0">
                                        <Calendar size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Member Since</p>
                                        <p className="text-sm font-black text-slate-900">May 2026</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
