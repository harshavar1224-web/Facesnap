import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Share2, Heart, ArrowLeft, Image as ImageIcon, Video, FolderOpen, Play, Mail, X, Loader2 } from 'lucide-react';

const PersonalGallery = () => {
    const { eventId } = useParams();
    const [activeTab, setActiveTab] = useState('photos');
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailInput, setEmailInput] = useState('');
    const [emailSending, setEmailSending] = useState(false);
    const [emailPreview, setEmailPreview] = useState(null);

    // Matched Media from backend API via Processing page
    const [matchedPhotos, setMatchedPhotos] = useState([]);
    const [matchedVideos, setMatchedVideos] = useState([]);

    useEffect(() => {
        const storedMatches = localStorage.getItem('matchedMedia');
        if (storedMatches) {
            try {
                const parsed = JSON.parse(storedMatches);

                // Partition by type
                const photos = parsed.filter(m => m.media_type === 'photo');

                // Flatten videos by their timeline moments
                let videos = [];
                parsed.filter(m => m.media_type === 'video').forEach(vid => {
                    if (vid.video_matches && vid.video_matches.length > 0) {
                        vid.video_matches.forEach((match, idx) => {
                            videos.push({
                                ...vid,
                                _id: `${vid._id}_${idx}`, // Unique ID for flattening
                                parent_vid: vid._id,
                                match_timestamp: match.timestamp,
                                match_thumbnail: match.thumbnail
                            });
                        });
                    } else {
                        videos.push(vid);
                    }
                });

                setMatchedPhotos(photos);
                setMatchedVideos(videos);

            } catch (err) {
                console.error("Localstorage parsing err", err);
            }
        }
    }, [eventId]);

    // Format helper
    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Handle single download
    const handleDownload = (url) => {
        // A simple anchor download for now
        const a = document.createElement('a');
        a.href = `/api${url}`; // We proxy the backend path
        a.download = url.split('/').pop() || 'media';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const renderMediaGrid = (items, type) => {
        if (items.length === 0) {
            return (
                <div className="w-full flex flex-col items-center justify-center p-12 text-slate-400 opacity-60">
                    <FolderOpen size={48} className="mb-4" />
                    <p>No {type} found containing your face.</p>
                </div>
            );
        }

        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8"
            >
                {items.map((media, i) => (
                    <motion.div
                        key={media._id || i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="glass-card overflow-hidden group relative aspect-[4/3] shadow-lg rounded-2xl border border-white/10 bg-slate-800"
                    >
                        {type === 'photos' ? (
                            <img src={`/api${media.url}`} alt={`Match ${i}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                        ) : (
                            media.match_thumbnail ? (
                                <img src={`/api${media.match_thumbnail}`} alt={`Match ${i}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                            ) : (
                                <video src={`/api${media.url}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" controls={false} />
                            )
                        )}

                        {/* Media Type Overlay */}
                        <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md rounded-lg p-2 text-white/90">
                            {type === 'photos' ? <ImageIcon size={16} /> : <Video size={16} />}
                        </div>

                        {/* Timestamp Overlay for Videos */}
                        {type === 'videos' && media.match_timestamp !== undefined && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-md rounded-xl p-3 text-center pointer-events-none group-hover:opacity-0 transition-opacity whitespace-nowrap">
                                <p className="text-white/80 text-xs uppercase tracking-wider mb-0.5">You appear at</p>
                                <p className="text-2xl font-bold text-green-400">{formatTime(media.match_timestamp)}</p>
                            </div>
                        )}

                        {/* Gradient overlay on hover */}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                            <div className="flex justify-between items-center transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                <div className="flex gap-3">
                                    <button className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-colors">
                                        <Heart size={18} className="text-white" />
                                    </button>
                                </div>
                                {type === 'videos' && media.match_timestamp !== undefined ? (
                                    <button onClick={() => window.open(`/api${media.url}#t=${media.match_timestamp}`, '_blank')} className="btn-accent py-2 px-4 shadow-[0_0_15px_rgba(91,140,255,0.4)] flex items-center gap-2 text-sm z-10 transition-transform hover:scale-105">
                                        <Play size={16} fill="white" /> Play from {formatTime(media.match_timestamp)}
                                    </button>
                                ) : (
                                    <button onClick={() => handleDownload(media.url)} className="btn-primary py-2 px-4 shadow-[0_0_15px_rgba(91,140,255,0.4)] flex items-center gap-2 text-sm z-10">
                                        <Download size={16} /> Save
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </motion.div>
        );
    };

    const handleDownloadAll = async () => {
        const allMedia = [...matchedPhotos, ...matchedVideos];
        if (allMedia.length === 0) return;

        const mediaIds = allMedia.map(m => m._id);

        try {
            // Give immediate feedback
            alert("Preparing your ZIP file... This may take a few seconds.");

            const res = await fetch('/api/download-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mediaIds })
            });

            if (!res.ok) throw new Error("Failed to generate ZIP");

            // Convert to blob and download
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `MediaClub_Memories.zip`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert("Error downloading files: " + err.message);
        }
    };

    const handleSendEmail = async (e) => {
        e.preventDefault();
        if (!emailInput) return;
        setEmailSending(true);
        try {
            const res = await fetch('/api/send-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: emailInput,
                    eventName: "Media Club Event",
                    galleryLink: window.location.href,
                    photoCount: matchedPhotos.length,
                    videoCount: matchedVideos.length
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setEmailPreview(data.previewUrl);
            } else {
                alert("Error sending email: " + (data.error || 'Unknown error'));
            }
        } catch (err) {
            console.error(err);
            alert("Failed to send email");
        } finally {
            setEmailSending(false);
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto py-8">
            <div className="w-full mb-6">
                <Link to="/events" className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors inline-block w-fit">
                    <ArrowLeft size={16} /> Back to Events
                </Link>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6 border-b border-white/10 pb-8">
                <div>
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 mb-2"
                    >
                        <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse shadow-[0_0_10px_#4ade80]"></div>
                        <span className="text-green-400 font-medium tracking-wide text-sm shadow-text">Match Success</span>
                    </motion.div>
                    <h1 className="text-4xl font-bold text-white tracking-tight mb-2">Your Captured Moments</h1>
                    <p className="text-slate-400 font-light">We found {matchedPhotos.length} photos and {matchedVideos.length} videos containing your face.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <motion.button
                        onClick={() => setIsEmailModalOpen(true)}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-button flex items-center justify-center gap-2 whitespace-nowrap px-4 py-2"
                        title="Email a link to these moments"
                    >
                        <Mail size={18} />
                        Email Link
                    </motion.button>

                    <motion.button
                        onClick={handleDownloadAll}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="btn-accent flex items-center justify-center gap-2 whitespace-nowrap px-6 py-2"
                        title="Download ZIP archive of all matching media"
                    >
                        <Download size={20} />
                        Download All (ZIP)
                    </motion.button>
                </div>
            </div>

            {/* Tabs Container */}
            <div className="glass-card p-1.5 inline-flex gap-2 rounded-xl mb-6 shadow-inner relative">
                <button
                    onClick={() => setActiveTab('photos')}
                    className={`relative px-6 py-2.5 rounded-lg text-sm font-medium transition-colors z-10 ${activeTab === 'photos' ? 'text-white' : 'text-slate-400 hover:text-white'}`}
                >
                    Photos ({matchedPhotos.length})
                    {activeTab === 'photos' && (
                        <motion.div layoutId="activeTab" className="absolute inset-0 bg-white/10 backdrop-blur-md rounded-lg -z-10 border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('videos')}
                    className={`relative px-6 py-2.5 rounded-lg text-sm font-medium transition-colors z-10 ${activeTab === 'videos' ? 'text-white' : 'text-slate-400 hover:text-white'}`}
                >
                    Videos ({matchedVideos.length})
                    {activeTab === 'videos' && (
                        <motion.div layoutId="activeTab" className="absolute inset-0 bg-white/10 backdrop-blur-md rounded-lg -z-10 border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]" />
                    )}
                </button>
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'photos'
                    ? renderMediaGrid(matchedPhotos, 'photos')
                    : renderMediaGrid(matchedVideos, 'videos')}
            </AnimatePresence>

            {/* Email Notification Modal */}
            <AnimatePresence>
                {isEmailModalOpen && (
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
                            <button onClick={() => { setIsEmailModalOpen(false); setEmailPreview(null); setEmailInput(''); }} className="absolute top-4 right-4 text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>

                            <h2 className="text-2xl font-bold text-white mb-2">Send Event Highlights</h2>
                            <p className="text-slate-400 text-sm mb-6">Receive an email with a secure link to your matched media.</p>

                            {emailPreview ? (
                                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                                    <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                                        <Mail className="text-green-400" size={24} />
                                    </div>
                                    <h3 className="text-green-400 font-medium mb-2">Email Sent Successfully!</h3>
                                    <p className="text-slate-300 text-sm mb-4">A link to your gallery has been sent to {emailInput}</p>
                                    <a
                                        href={emailPreview}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-block text-blue-400 hover:text-blue-300 underline text-sm"
                                    >
                                        View Ethereal Email Preview (Dev Mode)
                                    </a>
                                </div>
                            ) : (
                                <form onSubmit={handleSendEmail} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Email Address</label>
                                        <input
                                            required
                                            type="email"
                                            value={emailInput}
                                            onChange={e => setEmailInput(e.target.value)}
                                            className="glass-input"
                                            placeholder="you@example.com"
                                        />
                                    </div>
                                    <button type="submit" disabled={emailSending} className="btn-primary w-full mt-6 flex justify-center py-3">
                                        {emailSending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Email Link'}
                                    </button>
                                </form>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PersonalGallery;
