import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Webcam from 'react-webcam';
import { motion } from 'framer-motion';
import { Camera, ShieldAlert, ArrowLeft, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const FaceScan = () => {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const webcamRef = useRef(null);
    const [capturedImg, setCapturedImg] = useState(null);

    // Contact info state
    const [hasContact, setHasContact] = useState(false);
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    // Liveness states
    const [livenessStatus, setLivenessStatus] = useState('loading'); // loading, blink, head, passed, failed
    const [statusMessage, setStatusMessage] = useState("Initializing Security Modules...");

    // Model ref
    const faceLandmarkerRef = useRef(null);
    const requestRef = useRef(null);
    const lastVideoTimeRef = useRef(-1);

    // Load MediaPipe Model
    useEffect(() => {
        let isActive = true;
        const initializeModel = async () => {
            try {
                const filesetResolver = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
                );

                const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                        delegate: "GPU"
                    },
                    outputFaceBlendshapes: true,
                    runningMode: "VIDEO",
                    numFaces: 1
                });

                if (isActive) {
                    faceLandmarkerRef.current = landmarker;
                    setLivenessStatus('blink');
                    setStatusMessage("Step 1: Please blink to verify you are real");
                }
            } catch (err) {
                console.error("Failed to load MediaPipe model:", err);
                if (isActive) {
                    setLivenessStatus('failed');
                    setStatusMessage("Failed to load liveness detector.");
                }
            }
        };

        initializeModel();

        return () => {
            isActive = false;
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            if (faceLandmarkerRef.current) {
                faceLandmarkerRef.current.close().catch(console.error);
            }
        };
    }, []);

    // Liveness Processing Loop
    const processFrame = useCallback(() => {
        if (!webcamRef.current || !webcamRef.current.video || !faceLandmarkerRef.current) {
            requestRef.current = requestAnimationFrame(processFrame);
            return;
        }

        const video = webcamRef.current.video;
        if (video.readyState !== 4) {
            requestRef.current = requestAnimationFrame(processFrame);
            return;
        }

        let startTimeMs = performance.now();
        if (lastVideoTimeRef.current !== video.currentTime) {
            lastVideoTimeRef.current = video.currentTime;

            // Detect faces
            const results = faceLandmarkerRef.current.detectForVideo(video, startTimeMs);

            // If we have a face and blendshapes
            if (results && results.faceBlendshapes && results.faceBlendshapes.length > 0) {
                const blendshapes = results.faceBlendshapes[0].categories;

                setLivenessStatus(currentStatus => {
                    // Check Blink
                    if (currentStatus === 'blink') {
                        const leftBlink = blendshapes.find(b => b.categoryName === 'eyeBlinkLeft')?.score || 0;
                        const rightBlink = blendshapes.find(b => b.categoryName === 'eyeBlinkRight')?.score || 0;

                        // Threshold for blink is usually around 0.4 - 0.5
                        if (leftBlink > 0.45 && rightBlink > 0.45) {
                            setStatusMessage("Step 2: Turn your head slightly left or right");
                            return 'head';
                        }
                    }

                    // Check Head Turn
                    if (currentStatus === 'head') {
                        const eyeLookLeft = blendshapes.find(b => b.categoryName === 'eyeLookOutLeft')?.score || 0;
                        const eyeLookRight = blendshapes.find(b => b.categoryName === 'eyeLookOutRight')?.score || 0;

                        // When head turns, lookOUT values shift depending on rotation (or we could use facial landmarks, but blendshapes for look out are an OK proxy for head yaw if they turn their head without keeping eyes fixed). 
                        // Alternatively, we use the raw landmarks to check yaw.
                        const landmarks = results.faceLandmarks[0];
                        const noseTip = landmarks[1].x;
                        const leftCheek = landmarks[234].x;
                        const rightCheek = landmarks[454].x;

                        // Face width
                        const faceWidth = rightCheek - leftCheek;
                        // Nose position relative to face width (from left. normally ~0.5)
                        const noseRatio = (noseTip - leftCheek) / faceWidth;

                        // If noseRatio drops below 0.35 (turned one way) or exceeds 0.65 (turned other way)
                        if (noseRatio < 0.38 || noseRatio > 0.62) {
                            setStatusMessage("Verification Passed! You may now capture.");
                            return 'passed';
                        }
                    }

                    return currentStatus;
                });
            }
        }

        requestRef.current = requestAnimationFrame(processFrame);
    }, []);

    // Start processing when status changes to 'blink'
    useEffect(() => {
        if (livenessStatus === 'blink') {
            requestRef.current = requestAnimationFrame(processFrame);
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [livenessStatus, processFrame]);

    const capture = useCallback(() => {
        if (livenessStatus !== 'passed') {
            alert("Please complete liveness verification first.");
            return;
        }

        const imageSrc = webcamRef.current.getScreenshot();
        setCapturedImg(imageSrc);

        // Store local session info
        localStorage.setItem('scannedFaceURI', imageSrc);
        localStorage.setItem('scannedEmail', email);
        if (phone) localStorage.setItem('scannedPhone', phone);

        // Tiny delay for visual feedback before navigating
        setTimeout(() => {
            navigate(`/processing?eventId=${eventId}`);
        }, 500);
    }, [webcamRef, navigate, eventId, livenessStatus, email, phone]);

    const handleContactSubmit = (e) => {
        e.preventDefault();
        if (email) setHasContact(true);
    };

    if (!hasContact) {
        return (
            <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center py-6 min-h-[70vh]">
                <div className="w-full mb-6">
                    <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors">
                        <ArrowLeft size={16} /> Back
                    </button>
                </div>
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card w-full p-8 flex flex-col relative shadow-2xl"
                >
                    <h2 className="text-3xl font-bold text-white mb-2">Let's Get Your Photos</h2>
                    <p className="text-slate-400 font-light mb-8">Enter your details so we can notify you the moment your new photos drop.</p>

                    <form onSubmit={handleContactSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Email Address <span className="text-primary">*</span></label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="glass-input"
                                placeholder="you@university.edu"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">WhatsApp / Phone Number (Optional)</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                className="glass-input"
                                placeholder="+1 234 567 8900"
                            />
                        </div>

                        <button type="submit" className="btn-primary w-full py-4 text-lg">
                            Continue to Face Scan
                        </button>
                    </form>
                </motion.div>
            </div>
        );
    }

    const renderLivenessIndicator = () => {
        if (livenessStatus === 'loading') {
            return (
                <div className="flex items-center gap-2 text-yellow-400 bg-yellow-500/10 px-4 py-2 rounded-full border border-yellow-500/20 mb-4 animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-medium">{statusMessage}</span>
                </div>
            );
        }
        if (livenessStatus === 'failed') {
            return (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20 mb-4">
                    <XCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">{statusMessage}</span>
                </div>
            );
        }
        if (livenessStatus === 'passed') {
            return (
                <div className="flex items-center gap-2 text-green-400 bg-green-500/10 px-4 py-2 rounded-full border border-green-500/20 mb-4">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-medium">{statusMessage}</span>
                </div>
            );
        }

        // Active checking states (blink / head)
        return (
            <div className="flex items-center gap-3 text-primary-200 bg-primary/10 px-5 py-3 rounded-full border border-primary/20 mb-4">
                <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </div>
                <span className="text-sm font-medium">{statusMessage}</span>
            </div>
        );
    };

    return (
        <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center py-6 min-h-[70vh]">

            <div className="w-full mb-6">
                <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors">
                    <ArrowLeft size={16} /> Back
                </button>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card w-full p-8 flex flex-col items-center justify-center relative shadow-2xl overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[60px] rounded-full pointer-events-none"></div>

                <h2 className="text-3xl font-bold text-white mb-2">Secure Verification</h2>
                <p className="text-slate-400 font-light text-center mb-6 max-w-md">Prove you are a real person to unlock your moments.</p>

                {renderLivenessIndicator()}

                <div className="relative w-full max-w-sm aspect-[3/4] rounded-2xl overflow-hidden shadow-inner border border-white/20 mb-8 bg-slate-800">
                    {/* Camera Feed */}
                    {!capturedImg ? (
                        <>
                            <Webcam
                                audio={false}
                                ref={webcamRef}
                                screenshotFormat="image/jpeg"
                                className="w-full h-full object-cover transform scale-x-[-1]"
                                videoConstraints={{ facingMode: "user" }}
                            />

                            {/* Face Scanning Overlay Frame */}
                            <div className="absolute inset-0 pointer-events-none p-6">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 1, duration: 1 }}
                                    className={`w-full h-full border-2 border-dashed rounded-[40px] flex flex-col relative overflow-hidden transition-colors duration-500
                                        ${livenessStatus === 'passed' ? 'border-green-400/80 shadow-[inset_0_0_20px_rgba(74,222,128,0.2)]' : 'border-primary/60'}
                                    `}
                                >
                                    {livenessStatus !== 'passed' && (
                                        <motion.div
                                            animate={{ y: ["0%", "100%", "0%"] }}
                                            transition={{ duration: 3, ease: "linear", repeat: Infinity }}
                                            className="w-full h-[2px] bg-primary/80 absolute top-0 shadow-[0_0_10px_#5B8CFF]"
                                        />
                                    )}
                                </motion.div>
                            </div>
                        </>
                    ) : (
                        <img src={capturedImg} alt="Captured" className="w-full h-full object-cover" />
                    )}
                </div>

                <div className="flex flex-col items-center gap-4 w-full">
                    <button
                        onClick={capture}
                        disabled={!!capturedImg || livenessStatus !== 'passed'}
                        className={`w-full max-w-sm flex items-center justify-center gap-3 py-4 text-lg relative overflow-hidden group transition-all font-medium rounded-xl shadow-lg
                            ${livenessStatus === 'passed' && !capturedImg
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-[1.02] active:scale-95'
                                : 'bg-slate-700/50 text-slate-400 cursor-not-allowed border border-white/5'
                            }
                        `}
                    >
                        {!capturedImg ? (
                            <>
                                <Camera className="w-6 h-6" />
                                <span>{livenessStatus === 'passed' ? 'Capture Face' : 'Awaiting Check'}</span>
                            </>
                        ) : (
                            <span>Processing...</span>
                        )}
                    </button>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-light mt-2">
                        <ShieldAlert className="w-4 h-4" />
                        <span>Protected by anti-spoofing liveness detection.</span>
                    </div>
                </div>

            </motion.div>
        </div>
    );
};

export default FaceScan;
