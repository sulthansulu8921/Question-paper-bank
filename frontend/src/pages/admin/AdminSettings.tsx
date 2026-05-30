import { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { Save, User, Bell, Shield, Database, Loader2 } from 'lucide-react';
import '@/styles/admin/AddQuestion.css';
import api from '@/api/axios';

const AdminSettings = () => {
    const user = useAuthStore(s => s.user);
    const updateProfile = useAuthStore(s => s.updateProfile);

    const [profileData, setProfileData] = useState({
        first_name: user?.first_name || '',
        last_name: user?.last_name || '',
        email: user?.email || '',
        mobile_number: user?.mobile_number || '',
    });
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [profileSaved, setProfileSaved] = useState(false);

    const handleSaveProfile = async () => {
        setIsSavingProfile(true);
        await updateProfile(profileData);
        setIsSavingProfile(false);
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 3000);
    };

    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [pwStatus, setPwStatus] = useState('');

    const handleChangePassword = async () => {
        try {
            await api.post('/auth/change-password/', { old_password: oldPassword, new_password: newPassword });
            setPwStatus('success');
        } catch {
            setPwStatus('error');
        }
        setTimeout(() => setPwStatus(''), 4000);
    };

    return (
        <div className="add-q-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Admin Settings</h1>
                    <p className="page-subtitle">Manage your account, security, and platform preferences.</p>
                </div>
            </div>

            <div className="form-grid" style={{ gridTemplateColumns: '1fr 380px' }}>
                <div className="form-main" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Profile Section */}
                    <div className="form-section card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary-light)' }}>
                                <User size={20} />
                            </div>
                            <h3 className="section-title" style={{ margin: 0 }}>Profile Information</h3>
                        </div>
                        <div className="grid-2-col">
                            <div className="form-group">
                                <label>First Name</label>
                                <input className="form-input" value={profileData.first_name} onChange={e => setProfileData({ ...profileData, first_name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Last Name</label>
                                <input className="form-input" value={profileData.last_name} onChange={e => setProfileData({ ...profileData, last_name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Email Address</label>
                                <input className="form-input" value={profileData.email} onChange={e => setProfileData({ ...profileData, email: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Mobile Number</label>
                                <input className="form-input" value={profileData.mobile_number} onChange={e => setProfileData({ ...profileData, mobile_number: e.target.value })} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                            <button className="primary-btn flex-center gap-sm" onClick={handleSaveProfile} disabled={isSavingProfile}>
                                {isSavingProfile ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                <span>{profileSaved ? '✓ Saved!' : 'Save Profile'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Password Section */}
                    <div className="form-section card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-danger)' }}>
                                <Shield size={20} />
                            </div>
                            <h3 className="section-title" style={{ margin: 0 }}>Change Password</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 420 }}>
                            <div className="form-group">
                                <label>Current Password</label>
                                <input type="password" className="form-input" value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>New Password</label>
                                <input type="password" className="form-input" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                            </div>
                        </div>
                        {pwStatus === 'success' && <p style={{ color: 'var(--color-success)', marginTop: '0.75rem', fontWeight: 600 }}>✓ Password changed successfully.</p>}
                        {pwStatus === 'error' && <p style={{ color: 'var(--color-danger)', marginTop: '0.75rem', fontWeight: 600 }}>✗ Current password is incorrect.</p>}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                            <button className="secondary-btn flex-center gap-sm" onClick={handleChangePassword} disabled={!oldPassword || !newPassword}>
                                <Shield size={18} /><span>Update Password</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="form-sidebar">
                    {/* Platform Info */}
                    <div className="form-section card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)' }}>
                                <Database size={20} />
                            </div>
                            <h3 className="section-title" style={{ margin: 0 }}>Platform Info</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                <span style={{ color: 'var(--color-text-muted)' }}>Admin Role</span>
                                <span style={{ fontWeight: 700, color: 'var(--color-primary-light)' }}>{user?.is_staff ? 'Super Admin' : 'Staff'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                <span style={{ color: 'var(--color-text-muted)' }}>Username</span>
                                <span style={{ fontWeight: 700 }}>{user?.username}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                <span style={{ color: 'var(--color-text-muted)' }}>Platform</span>
                                <span style={{ fontWeight: 700 }}>Study Partner v2.0</span>
                            </div>
                        </div>
                    </div>

                    {/* Notifications Section */}
                    <div className="form-section card" style={{ marginTop: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-warning)' }}>
                                <Bell size={20} />
                            </div>
                            <h3 className="section-title" style={{ margin: 0 }}>Notifications</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Email Alerts</span>
                                <input type="checkbox" defaultChecked style={{ width: 18, height: 18 }} />
                            </label>
                            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>New Feedbacks</span>
                                <input type="checkbox" defaultChecked style={{ width: 18, height: 18 }} />
                            </label>
                            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>New Registrations</span>
                                <input type="checkbox" style={{ width: 18, height: 18 }} />
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminSettings;
