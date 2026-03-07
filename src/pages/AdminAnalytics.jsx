import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, DownloadCloud, Image as ImageIcon, Scan, Loader2, Database } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';

const AdminAnalytics = () => {
    const [analytics, setAnalytics] = useState(null);
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReports = async () => {
            try {
                const [anRes, stRes] = await Promise.all([
                    fetch('/api/admin/analytics', { credentials: 'include' }),
                    fetch('/api/admin/events/stats', { credentials: 'include' })
                ]);
                const anData = await anRes.json();
                const stData = await stRes.json();

                if (anRes.ok) setAnalytics(anData.analytics);
                if (stRes.ok) setStats(stData.stats);
            } catch (err) {
                console.error("Fetch analytics failed", err);
            } finally {
                setLoading(false);
            }
        };

        fetchReports();
    }, []);

    if (loading || !analytics) {
        return (
            <div className="w-full flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
                <p>Compiling Reports...</p>
            </div>
        );
    }

    const chartData = stats.slice(0, 10).map(s => ({
        name: s.name.length > 15 ? s.name.substring(0, 15) + '...' : s.name,
        Downloads: s.downloads,
        Scans: s.scans,
        Uploads: s.photos + s.videos
    })).reverse();

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
        >
            {/* Top Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                {[
                    { label: 'Events', value: analytics.totalEvents, icon: <Database className="w-5 h-5 text-purple-400" /> },
                    { label: 'Media Items', value: analytics.totalMedia, icon: <ImageIcon className="w-5 h-5 text-blue-400" /> },
                    { label: 'Face Scans', value: analytics.totalScans, icon: <Scan className="w-5 h-5 text-green-400" /> },
                    { label: 'Downloads', value: analytics.totalDownloads, icon: <DownloadCloud className="w-5 h-5 text-pink-400" /> },
                    { label: 'Admins', value: analytics.totalAdmins, icon: <Users className="w-5 h-5 text-orange-400" /> },
                ].map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        key={i}
                        className="glass-card p-4 flex flex-col items-center justify-center text-center shadow-lg border-t border-white/10"
                    >
                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/5 flex items-center justify-center mb-3">
                            {stat.icon}
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-1 shadow-sm">{stat.value}</h3>
                        <p className="text-xs text-slate-400 uppercase tracking-wider">{stat.label}</p>
                    </motion.div>
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="glass-card p-6 shadow-xl">
                    <h3 className="text-lg font-bold text-white mb-6">Activity by Event (Scans vs Downloads)</h3>
                    <div className="h-64 w-full text-xs">
                        {stats.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" tick={{ fill: 'rgba(255,255,255,0.4)' }} />
                                    <YAxis stroke="rgba(255,255,255,0.4)" tick={{ fill: 'rgba(255,255,255,0.4)' }} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                                    />
                                    <Bar dataKey="Scans" fill="#4ade80" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Downloads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-500">No data available</div>
                        )}
                    </div>
                </div>

                <div className="glass-card p-6 shadow-xl">
                    <h3 className="text-lg font-bold text-white mb-6">Upload Volume (Photos + Videos)</h3>
                    <div className="h-64 w-full text-xs">
                        {stats.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorUploads" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" tick={{ fill: 'rgba(255,255,255,0.4)' }} />
                                    <YAxis stroke="rgba(255,255,255,0.4)" tick={{ fill: 'rgba(255,255,255,0.4)' }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                                    />
                                    <Area type="monotone" dataKey="Uploads" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorUploads)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-500">No data available</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="glass-card overflow-hidden shadow-lg border border-white/10">
                <div className="p-6 border-b border-white/10 bg-slate-800/50">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><Database size={18} /> Event Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="text-xs uppercase bg-slate-800/80 text-slate-400 border-b border-white/5">
                            <tr>
                                <th scope="col" className="px-6 py-4 rounded-tl-lg font-medium tracking-wider">Event Name</th>
                                <th scope="col" className="px-6 py-4 font-medium tracking-wider">Date Created</th>
                                <th scope="col" className="px-6 py-4 font-medium tracking-wider text-right">Uploads</th>
                                <th scope="col" className="px-6 py-4 font-medium tracking-wider text-right">Participants</th>
                                <th scope="col" className="px-6 py-4 font-medium tracking-wider text-right">Face Scans</th>
                                <th scope="col" className="px-6 py-4 font-medium tracking-wider text-right">Downloads</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 bg-slate-900/40">
                            {stats.map((row) => (
                                <tr key={row._id} className="hover:bg-slate-800/60 transition-colors">
                                    <td className="px-6 py-4 font-medium text-white">{row.name}</td>
                                    <td className="px-6 py-4 text-slate-400">{new Date(row.createdAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="bg-slate-800 px-2 py-1 rounded text-xs border border-white/5">{row.photos + row.videos}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="bg-purple-500/10 text-purple-400 px-2 py-1 rounded text-xs border border-purple-500/20">{row.participants || 0}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="bg-green-500/10 text-green-400 px-2 py-1 rounded text-xs border border-green-500/20">{row.scans}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded text-xs border border-blue-500/20">{row.downloads}</span>
                                    </td>
                                </tr>
                            ))}
                            {stats.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                                        No event data available yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </motion.div>
    );
};

export default AdminAnalytics;
