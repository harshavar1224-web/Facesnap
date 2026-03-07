import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, DownloadCloud, Image as ImageIcon, ChevronRight, Activity, X, Loader2, Calendar, Film } from 'lucide-react';
import QRCode from 'react-qr-code';
import AdminAnalytics from './AdminAnalytics';

const AdminDashboard = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generatingHighlightFor, setGeneratingHighlightFor] = useState(null);
    const [selectedQR, setSelectedQR] = useState(null);
    const [viewMode, setViewMode] = useState('events'); // 'events' | 'analytics'

    // Download QR Code utility
    const downloadQR = (id) => {
        const svg = document.getElementById(`qr-${id}`)?.querySelector('svg');
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            const a = document.createElement('a');
            a.download = `MediaClub_EventQR_${id}.png`;
            a.href = canvas.toDataURL('image/png');
            a.click();
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    };

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [form, setForm] = useState({ name: '', date: '', location: '', coverImage: '', coverImageFile: null, notifications_enabled: false });

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const API_URL = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${API_URL}/api/admin/events/stats`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                },
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok) setEvents(data.stats || []);
        } catch (err) {
            console.error("Failed fetching events", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    const handleCreateEvent = async (e) => {
        e.preventDefault();
        if (!form.name || !form.date || !form.location) return;

        setIsCreating(true);
        console.log("Submitting Event Creating Request:", form);

        const formData = new FormData();
        formData.append('name', form.name);
        formData.append('date', form.date);
        formData.append('location', form.location);
        formData.append('notifications_enabled', form.notifications_enabled);

        if (form.coverImageFile) {
            formData.append('coverImage', form.coverImageFile);
        } else {
            // Use selected gradient if no file is chosen
            formData.append('coverImage', form.coverImage || 'linear-gradient(135deg, #1e293b, #0f172a)');
        }

        try {
            const API_URL = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${API_URL}/api/events`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                },
                credentials: 'include',
                body: formData
            });
            console.log("Response Status:", res.status);
            const data = await res.json();
            console.log("Response Data:", data);

            if (res.ok && data.success) {
                setForm({ name: '', date: '', location: '', coverImage: '', coverImageFile: null, notifications_enabled: false });
                setIsCreateModalOpen(false);
                fetchEvents(); // refresh list
                setViewMode('events'); // switch back to events if created
                alert("Event Created Successfully!");
            } else {
                alert("Error creating event: " + (data.error || 'Server error'));
                console.error("Event Creation Error from Server:", data.error);
            }
        } catch (err) {
            console.error("Network or parsing error during Event Creation:", err);
            alert("Network Error during event creation. See console.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleGenerateHighlight = async (eventId) => {
        if (!confirm("Generate a highlight reel for this event? This will process all ready videos and may take a few moments.")) return;
        setGeneratingHighlightFor(eventId);
        try {
            const API_URL = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${API_URL}/api/events/highlight/${eventId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
                },
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok && data.success) {
                alert(`Success! Highlight generated: ${data.url}`);
                fetchEvents();
            } else {
                alert(`Error: ${data.error || 'Failed to generate highlight'}`);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to reach server.");
        } finally {
            setGeneratingHighlightFor(null);
        }
    };

    const handleToggleNotifications = async (eventId, currentStatus) => {
        try {
            const API_URL = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${API_URL}/api/events/${eventId}/notifications`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ enabled: !currentStatus })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                fetchEvents();
            } else {
                alert("Error toggling notifications");
            }
        } catch (err) {
            console.error("Toggle Notifications Error:", err);
            alert("Network error.");
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto py-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                <div>
                    <h1 className="text-4xl font-bold text-white tracking-tight mb-2">Host Dashboard</h1>
                    <p className="text-slate-400 font-light">Manage your events, media, and track engagement.</p>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => setViewMode(viewMode === 'events' ? 'analytics' : 'events')}
                        className="glass-button flex items-center gap-2 px-6 py-3"
                    >
                        {viewMode === 'events' ? (
                            <><Activity size={18} /> View Reports</>
                        ) : (
                            <><Calendar size={18} /> Manage Events</>
                        )}
                    </button>
                    <button onClick={() => setIsCreateModalOpen(true)} className="btn-primary flex items-center gap-2 px-6 py-3">
                        <Plus size={18} /> Create Event
                    </button>
                </div>
            </div>

            {viewMode === 'analytics' ? (
                <AdminAnalytics />
            ) : (
                <div className="glass-card shadow-lg border border-white/10 overflow-hidden relative min-h-[300px]">
                    <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-800/50">
                        <h3 className="text-xl font-bold text-white flex items-center gap-3">
                            Recent Events
                        </h3>
                    </div>

                    {loading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 opacity-60 bg-slate-900/50 z-10">
                            <Loader2 className="w-8 h-8 animate-spin mb-2" /> Loading...
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {events.length === 0 && (
                                <div className="p-8 text-center text-slate-400">No events found. Create one.</div>
                            )}
                            {events.map((evt) => (
                                <div key={evt._id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center hover:bg-slate-800/60 transition-colors gap-4">
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h4 className="text-lg font-semibold text-white">{evt.name}</h4>
                                            {evt.processing && evt.processing > 0 && (
                                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-medium">
                                                    <Loader2 size={12} className="animate-spin" />
                                                    Processing {evt.processing} video(s)...
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex gap-4 text-sm text-slate-400 font-light">
                                            <span>{new Date(evt.date).toLocaleDateString()}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-600 self-center"></span>
                                            <span>Event ID: {evt._id.substring(0, 6)}...</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-600 self-center"></span>
                                            <span>{evt.photos} Photos, {evt.videos} Videos</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-600 self-center"></span>
                                            <span className="text-green-400 font-medium">Participants: {evt.participants || 0}</span>
                                        </div>
                                        <div className="mt-3 flex items-center gap-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <div className="relative">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only"
                                                        checked={evt.notifications_enabled}
                                                        onChange={() => handleToggleNotifications(evt._id, evt.notifications_enabled)}
                                                    />
                                                    <div className={`block w-10 h-6 rounded-full transition-colors ${evt.notifications_enabled ? 'bg-primary' : 'bg-slate-700'}`}></div>
                                                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${evt.notifications_enabled ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                                </div>
                                                <span className="text-xs text-slate-400">Enable attendee notifications</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 w-full md:w-auto mt-4 md:mt-0 items-center justify-end">
                                        <button
                                            onClick={() => handleGenerateHighlight(evt._id)}
                                            disabled={generatingHighlightFor === evt._id}
                                            className="glass-button px-4 py-2 text-sm text-slate-300 hover:text-white flex items-center justify-center gap-1 min-w-[140px]"
                                            title="Auto Highlight Reel"
                                        >
                                            {generatingHighlightFor === evt._id ? (
                                                <><Loader2 size={16} className="animate-spin" /> Processing...</>
                                            ) : (
                                                <><Film size={16} /> Auto-Highlight</>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => setSelectedQR(evt)}
                                            className="flex-1 md:flex-none glass-button px-4 py-2 text-sm text-white"
                                        >
                                            QR Code
                                        </button>
                                        <Link to={`/admin/upload/${evt._id}`} className="flex-1 md:flex-none btn-accent px-4 py-2 text-sm text-white flex items-center justify-center gap-2">
                                            Upload Media
                                            <ChevronRight size={16} />
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* QR Scanner Modal */}
            <AnimatePresence>
                {selectedQR && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md"
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            className="glass-card w-full max-w-sm p-8 shadow-2xl relative flex flex-col items-center bg-white"
                        >
                            <button onClick={() => setSelectedQR(null)} className="absolute top-4 right-4 text-slate-800 hover:text-black bg-slate-200/50 p-1 rounded-full">
                                <X size={20} />
                            </button>

                            <h2 className="text-2xl font-bold text-slate-900 mb-2 truncate max-w-full">{selectedQR.name}</h2>
                            <p className="text-slate-500 font-light mb-6 text-sm text-center">Scan to find your photos!</p>

                            <div className="bg-white p-4 rounded-xl shadow-inner border border-slate-100 mb-6" id={`qr-${selectedQR._id}`}>
                                <QRCode value={`${window.location.origin}/scan/${selectedQR._id}`} size={200} />
                            </div>

                            <button
                                onClick={() => downloadQR(selectedQR._id)}
                                className="w-full bg-primary hover:bg-blue-600 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                            >
                                <DownloadCloud size={18} /> Download Poster
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Create Event Modal */}
            <AnimatePresence>
                {isCreateModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            className="glass-card w-full max-w-lg p-8 shadow-2xl relative"
                        >
                            <button onClick={() => setIsCreateModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>

                            <h2 className="text-2xl font-bold text-white mb-6">Create New Event</h2>

                            <form onSubmit={handleCreateEvent} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Event Name</label>
                                    <input required type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="glass-input" placeholder="e.g. Media Workshop" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Date</label>
                                    <input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="glass-input text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Location</label>
                                    <input required type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="glass-input" placeholder="e.g. Studio Complex" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Cover Image (Optional)</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={e => setForm({ ...form, coverImageFile: e.target.files[0] })}
                                        className="glass-input text-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-blue-600 w-full"
                                    />
                                </div>
                                <div className="flex items-center gap-3 pt-2">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={form.notifications_enabled}
                                            onChange={e => setForm({ ...form, notifications_enabled: e.target.checked })}
                                        />
                                        <div className={`block w-12 h-7 rounded-full transition-colors ${form.notifications_enabled ? 'bg-primary' : 'bg-slate-700'}`}></div>
                                        <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${form.notifications_enabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                    </div>
                                    <span className="text-sm text-slate-300 font-medium">Enable Instant Notifications</span>
                                </div>

                                <button type="submit" disabled={isCreating} className="btn-primary w-full mt-6 flex justify-center py-3">
                                    {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Event'}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminDashboard;
