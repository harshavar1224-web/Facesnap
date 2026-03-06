import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, ChevronRight, Search, Loader2 } from 'lucide-react';

const EventSelection = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                setLoading(true);
                const res = await fetch('/api/events');
                const data = await res.json();

                if (!res.ok) throw new Error(data.error || "Failed to fetch events");

                setEvents(data.events || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchEvents();
    }, []);

    const filteredEvents = events.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.location.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="w-full max-w-6xl mx-auto py-8 min-h-[70vh]">

            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4"
            >
                <div>
                    <h1 className="text-4xl font-bold text-white tracking-tight mb-2">Select an Event</h1>
                    <p className="text-slate-400 font-light">Choose the event to find your photos and videos.</p>
                </div>

                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search events..."
                        className="glass-input pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </motion.div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                    <p className="text-slate-400">Loading events...</p>
                </div>
            ) : error ? (
                <div className="glass-card p-6 text-center text-red-400 border border-red-500/30">
                    {error}
                </div>
            ) : filteredEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-50">
                    <Calendar className="w-12 h-12 text-slate-400 mb-4" />
                    <p className="text-slate-400">No events found.</p>
                </div>
            ) : (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                    {filteredEvents.map((evt, i) => (
                        <motion.div
                            key={evt._id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 * i }}
                        >
                            <Link to={`/scan/${evt._id}`} className="block h-full">
                                <div className="glass-card group hover:border-primary/50 transition-all duration-300 overflow-hidden h-full flex flex-col">
                                    <div className={`h-40 w-full relative overflow-hidden`} style={{ background: evt.cover_image?.includes('http') ? `url(${evt.cover_image}) center/cover` : evt.cover_image || '#475569' }}>
                                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-500"></div>
                                    </div>

                                    <div className="p-6 flex-1 flex flex-col">
                                        <h3 className="text-xl font-bold text-white mb-4 group-hover:text-primary transition-colors">{evt.name}</h3>

                                        <div className="space-y-2 mb-6 mt-auto">
                                            <div className="flex items-center text-sm text-slate-300 gap-2 font-light">
                                                <Calendar className="w-4 h-4 text-primary" />
                                                {new Date(evt.date).toLocaleDateString()}
                                            </div>
                                            <div className="flex items-center text-sm text-slate-300 gap-2 font-light">
                                                <MapPin className="w-4 h-4 text-accent" />
                                                {evt.location}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between text-sm font-medium pt-4 border-t border-white/10">
                                            <span className="text-slate-300 group-hover:text-white transition-colors">Find Photos</span>
                                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                                                <ChevronRight className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </motion.div>
            )}

        </div>
    );
};

export default EventSelection;
