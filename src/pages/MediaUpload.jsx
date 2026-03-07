import { useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileImage, ShieldCheck, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

const MediaUpload = () => {
    const { eventId } = useParams();
    const [isDragging, setIsDragging] = useState(false);
    const [uploadState, setUploadState] = useState('idle'); // idle -> uploading -> indexing -> complete
    const [stats, setStats] = useState({ files: 0, faces: 0 });
    const fileInputRef = useRef(null);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            startUploadProcess(Array.from(e.dataTransfer.files));
        }
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            startUploadProcess(Array.from(e.target.files));
        }
    };

    const startUploadProcess = async (files) => {
        if (uploadState !== 'idle') return;

        setUploadState('uploading');

        const formData = new FormData();
        files.forEach(f => formData.append('files', f));

        try {
            // Upload takes time...
            // the backend route does everything (upload + indexing) synchronously for now
            // To simulate the two stages, we jump to 'indexing' after 1s visually
            setTimeout(() => setUploadState('indexing'), 1000);

            const res = await fetch(`/api/upload/${eventId}`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            const data = await res.json();

            if (res.ok) {
                setStats({ files: data.files_processed, faces: data.faces_extracted });
                setUploadState('complete');
            } else {
                alert(`Upload failed: ${data.error}`);
                setUploadState('idle');
            }
        } catch (err) {
            console.error(err);
            alert("Network Error during upload");
            setUploadState('idle');
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto py-8">
            <div className="w-full mb-6">
                <Link to="/admin" className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors inline-block w-fit">
                    <ArrowLeft size={16} /> Back to Dashboard
                </Link>
            </div>

            <div className="mb-10">
                <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Upload Media</h1>
                <p className="text-slate-400 font-light">Upload photos and videos for <span className="text-white font-medium truncate inline-block max-w-[150px] align-bottom">Event {eventId.substring(0, 8)}</span>. Faces will be detected automatically.</p>
            </div>

            <input
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileSelect}
            />

            <AnimatePresence mode="wait">
                {uploadState === 'idle' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`w-full glass-card border-2 border-dashed ${isDragging ? 'border-primary bg-primary/10' : 'border-white/20'} rounded-3xl p-12 flex flex-col items-center justify-center text-center transition-colors min-h-[400px] cursor-pointer`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-6 shadow-inner border border-white/5">
                            <UploadCloud className={`w-10 h-10 ${isDragging ? 'text-primary' : 'text-slate-400'}`} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-3">Drag & Drop Files Here</h3>
                        <p className="text-slate-400 mb-8 max-w-sm">Support JPG, PNG, MP4, MOV. Bulk upload up to 50 files at once.</p>

                        <button className="btn-primary px-8 py-3 pointer-events-none">Browse Files</button>

                        <div className="flex items-center gap-6 mt-10 text-xs text-slate-500 font-light">
                            <div className="flex items-center gap-2"><ShieldCheck size={14} /> Secure Upload</div>
                            <div className="flex items-center gap-2"><FileImage size={14} /> Auto Face Indexing</div>
                        </div>
                    </motion.div>
                )}

                {uploadState !== 'idle' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-card rounded-3xl p-12 flex flex-col items-center justify-center text-center min-h-[400px]"
                    >
                        {uploadState === 'complete' ? (
                            <>
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                                    className="w-24 h-24 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(74,222,128,0.3)] border border-green-500/30"
                                >
                                    <CheckCircle2 size={48} />
                                </motion.div>
                                <h3 className="text-2xl font-bold text-white mb-2">Upload & Indexing Complete</h3>
                                <p className="text-slate-400 mb-8">Successfully processed {stats.files} files and extracted {stats.faces} face embeddings.</p>
                                <button onClick={() => { setUploadState('idle'); setStats({ files: 0, faces: 0 }) }} className="btn-accent px-8 py-3">Upload More</button>
                            </>
                        ) : (
                            <>
                                <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
                                <h3 className="text-xl font-bold text-white mb-2">
                                    {uploadState === 'uploading' ? 'Uploading Media...' : 'AI Face Indexing running...'}
                                </h3>
                                <p className="text-slate-400 mb-8 max-w-xs">{uploadState === 'uploading' ? 'Transferring files securely to server.' : 'Detecting faces and generating embeddings. This may take a minute.'}</p>

                                <div className="w-full max-w-sm bg-slate-800/80 rounded-full h-2 mb-2 overflow-hidden border border-white/5">
                                    <motion.div
                                        className="bg-primary h-full"
                                        initial={{ width: uploadState === 'uploading' ? '0%' : '50%' }}
                                        animate={{ width: uploadState === 'uploading' ? '50%' : '100%' }}
                                        transition={{ duration: 0.5, ease: "linear" }}
                                    />
                                </div>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MediaUpload;
