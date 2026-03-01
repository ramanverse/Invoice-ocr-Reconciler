import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { LogIn, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login, googleLogin } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await login(email, password);
            toast.success('Welcome back!');
            navigate('/');
        } catch {
            toast.error('Failed to login');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            await googleLogin(credentialResponse.credential);
            toast.success('Logged in with Google!');
            navigate('/');
        } catch (err) {
            toast.error('Google login failed');
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-side-panel">
                <div className="auth-branding">
                    <div className="auth-logo-circle">
                        <LogIn size={24} color="white" />
                    </div>
                    <h2>Smart Invoice Reconciler</h2>
                    <p>
                        Experience the future of financial automation. Our AI-driven platform
                        extracts, matches, and reconciles your invoices with surgical precision.
                    </p>
                </div>
            </div>

            <div className="auth-form-panel">
                <div className="auth-card">
                    <div className="auth-header">
                        <h3>Sign In</h3>
                        <p>Welcome back! Please enter your details.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="input-group">
                            <label>Email Address</label>
                            <div className="input-wrapper">
                                <Mail size={18} />
                                <input
                                    type="email"
                                    placeholder="name@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label>Password</label>
                            <div className="input-wrapper">
                                <Lock size={18} />
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" className="auth-btn" disabled={isLoading}>
                            {isLoading ? <Loader2 className="spin" size={20} /> : 'Login to Dashboard'}
                        </button>
                    </form>

                    <div className="auth-divider">
                        <span>OR</span>
                    </div>

                    <div className="google-btn-wrapper">
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={() => toast.error('Google login failed')}
                            theme="filled_black"
                            shape="pill"
                            text="continue_with"
                            width="100%"
                        />
                    </div>

                    <div className="auth-footer">
                        <p>New to the platform? <Link to="/signup">Create an account</Link></p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
