import { useState } from 'react';
import { Mail, Lock, ArrowRight, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '@/styles/admin/Login.css';

const AdminLogin = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        // Simulate API call
        setTimeout(() => {
            setIsLoading(false);
            navigate('/admin');
        }, 1500);
    };

    return (
        <div className="login-container">
            {/* Decorative Blur Orbs */}
            <div className="orb orb-1"></div>
            <div className="orb orb-2"></div>

            <div className="login-wrapper">
                <div className="login-left">
                    <div className="illustration-container">
                        <div className="glass-card mockup-card-1">
                            <div className="mock-line" style={{ width: '60%' }}></div>
                            <div className="mock-line" style={{ width: '80%' }}></div>
                            <div className="mock-line" style={{ width: '40%' }}></div>
                        </div>
                        <div className="glass-card mockup-card-2">
                            <div className="mock-graph">
                                <div className="m-bar h-1"></div>
                                <div className="m-bar h-2"></div>
                                <div className="m-bar h-3"></div>
                            </div>
                        </div>
                        <div className="glass-card mockup-card-3">
                            <BookOpen size={48} className="mock-icon" />
                        </div>
                    </div>
                    <div className="illustration-text">
                        <h2>Manage Knowledge Visually</h2>
                        <p>The premium portal for educators to manage, analyze, and deploy question banks with absolute ease.</p>
                    </div>
                </div>

                <div className="login-right">
                    <div className="login-form-box">
                        <div className="brand-header">
                            <div className="logo-box">Q</div>
                            <h2>QBank Pro Admin</h2>
                        </div>

                        <p className="login-subtitle">Please enter your credentials to access the dashboard.</p>

                        <form onSubmit={handleLogin} className="login-form">
                            <div className="input-group">
                                <label>Email Address</label>
                                <div className="input-with-icon">
                                    <Mail size={18} className="input-icon" />
                                    <input type="email" placeholder="admin@qbankpro.com" required />
                                </div>
                            </div>

                            <div className="input-group">
                                <label>Password</label>
                                <div className="input-with-icon">
                                    <Lock size={18} className="input-icon" />
                                    <input type="password" placeholder="••••••••" required />
                                </div>
                            </div>

                            <div className="form-actions-row">
                                <label className="remember-me">
                                    <input type="checkbox" />
                                    <span>Remember me</span>
                                </label>
                                <a href="#" className="forgot-password">Forgot password?</a>
                            </div>

                            <button type="submit" className={`submit-btn ${isLoading ? 'loading' : ''}`} disabled={isLoading}>
                                {isLoading ? (
                                    <span className="loader"></span>
                                ) : (
                                    <>
                                        <span>Sign In to Dashboard</span>
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;
