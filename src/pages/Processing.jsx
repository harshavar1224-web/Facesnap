import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScanFace, AlertTriangle, ArrowLeft } from 'lucide-react';

const Processing = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const eventId = searchParams.get('eventId');
    const [error, setError] = useState(null);

    useEffect(() => {
        const processFace = async () => {
            if (!eventId) {
                setError("No Event ID provided.");
                return;
            }

            try {
                // Get the base64 URI captured from previous screen
                const faceDataURI = localStorage.getItem('scannedFaceURI');
                if (!faceDataURI) {
                    setError("No scanned face data found! Please go back and scan again.");
                    return;
                }

                // Convert base64 to a Blob
                const resBlob = await fetch(faceDataURI);
                const blob = await resBlob.blob();

                // Prepare FormData for the backend AI
                const formData = new FormData();
                formData.append('face', blob, 'face_scan.jpg');

                const email = localStorage.getItem('scannedEmail');
                const phone = localStorage.getItem('scannedPhone');
                if (email) formData.append('email', email);
                if (phone) formData.append('phone', phone);

                // Fetch to Express API
                const apiRes = await fetch(`/api/scan/${eventId}`, {
                    method: 'POST',
                    body: formData
                });

                const data = await apiRes.json();

                if (!apiRes.ok) throw new Error(data.error || "Unknown error parsing face");

                // Process successful matches! Target Gallery
                localStorage.setItem('matchedMedia', JSON.stringify(data.matches || []));

                // Add a small delay so user isn't startled by 10ms flash of this screen
                setTimeout(() => {
                    navigate(`/gallery/${eventId}`);
                }, 1000);

            } catch (err) {
                console.error("Scanning Error:", err);
                setError(err.message);
            }
        };

        processFace();

    }, [navigate, eventId]);

    return (
        <div className="w-full max-w-md mx-auto min-h-[60vh] flex flex-col items-center justify-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card p-12 flex flex-col items-center text-center w-full"
            >
                {error ? (
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="w-20 h-20 bg-red-500/20 backdrop-blur-md rounded-full flex items-center justify-center border border-red-500/30">
                            <AlertTriangle className="w-10 h-10 text-red-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-white">Oops! Something went wrong.</h3>
                        <p className="text-slate-400 font-light mb-4">{error}</p>
                        <button
                            onClick={() => navigate(-1)}
                            className="bg-white/10 hover:bg-white/20 transition-colors border border-white/20 rounded-xl px-6 py-2 flex items-center gap-2 text-white"
                        >
                            <ArrowLeft size={16} /> Try Again
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="relative mb-8">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                className="w-24 h-24 rounded-full border-t-2 border-r-2 border-primary absolute -inset-2"
                            />
                            <motion.div
                                animate={{ rotate: -360 }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                className="w-24 h-24 rounded-full border-b-2 border-l-2 border-accent absolute -inset-2"
                            />
                            <div className="w-20 h-20 bg-slate-800/50 backdrop-blur-md rounded-full flex items-center justify-center shadow-inner">
                                <ScanFace className="w-10 h-10 text-primary" />
                            </div>
                        </div>

                        <h3 className="text-2xl font-bold text-white mb-3">Analyzing AI Features</h3>
                        <p className="text-slate-400 font-light mb-6">Comparing your facial embedding...</p>

                        <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-primary to-accent"
                                animate={{ x: ["-100%", "100%"] }}
                                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                            />
                        </div>
                    </>
                )}
            </motion.div>
        </div>
    );
};

export default Processing;
