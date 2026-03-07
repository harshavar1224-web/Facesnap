import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Mail, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';

const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const API_URL = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${API_URL}/api/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                if (data.token) {
                    localStorage.setItem('admin_token', data.token);
                }
                // User is authenticated via HTTP-only simple cookie, jump to dashboard.
                navigate('/admin');
            } else {
                setError(data.error || 'Invalid credentials');
            }
        } catch (err) {
            setError(err.message || 'Server connection failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto min-h-[70vh] flex flex-col items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full glass-card p-8 md:p-10 shadow-2xl relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-[50px] pointer-events-none"></div>

                <div className="w-16 h-16 bg-slate-800 border border-white/10 rounded-2xl flex items-center justify-center mb-6 shadow-inner relative">
                    <Lock className="w-8 h-8 text-white relative z-10" />
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
                </div>

                <h1 className="text-3xl font-bold text-white mb-2">Admin Host Login</h1>
                <p className="text-slate-400 font-light mb-8">Secure access for Media Club members.</p>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl mb-6 flex items-start gap-3 backdrop-blur-sm"
                    >
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
                        <span className="text-sm">{error}</span>
                    </motion.div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2 ml-1">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="glass-input pl-12 h-14"
                                placeholder="host@mediaclub.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2 ml-1">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="glass-input pl-12 h-14"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full h-14 mt-4 flex items-center justify-center gap-2 group relative overflow-hidden"
                    >
                        {loading ? (
                            <Loader2 className="w-6 h-6 animate-spin text-white" />
                        ) : (
                            <>
                                <span className="text-lg font-medium relative z-10">Sign In</span>
                                <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none"></div>
                    </button>

                    <p className="text-xs text-center text-slate-500 mt-6 !mb-0 font-light">
                        Protected by AES-256 encryption. Unauthorized access is prohibited.
                    </p>
                </form>
            </motion.div>
        </div>
    );
}

export default AdminLogin;
