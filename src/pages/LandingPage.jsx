import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScanFace, Image as ImageIcon, ShieldCheck, Zap } from 'lucide-react';

const LandingPage = () => {
    const features = [
        { icon: <Zap className="text-primary w-6 h-6" />, title: "Lightning Fast", desc: "Find your photos instantly using AI face detection." },
        { icon: <ShieldCheck className="text-primary w-6 h-6" />, title: "Private & Secure", desc: "We only match your face, no raw biometrics stored." },
        { icon: <ImageIcon className="text-primary w-6 h-6" />, title: "High Quality", desc: "Download the original uncompressed media files." }
    ];

    return (
        <div className="w-full flex flex-col items-center max-w-5xl mx-auto space-y-20 py-10">

            {/* Hero Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full glass-card p-8 md:p-16 text-center shadow-2xl relative overflow-hidden flex flex-col items-center"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -z-10 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/10 rounded-full blur-[80px] -z-10 pointer-events-none"></div>

                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="bg-white/10 text-primary-200 border border-white/20 px-4 py-1.5 rounded-full inline-flex items-center gap-2 text-sm font-medium mb-8 backdrop-blur-md shadow-inner"
                >
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                    </span>
                    Next-Gen AI Photo Retrieval
                </motion.div>

                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 text-white drop-shadow-md leading-tight">
                    Find your memories <br /> in <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">seconds.</span>
                </h1>

                <p className="text-lg md:text-xl text-slate-300 mb-10 max-w-2xl mx-auto font-light">
                    No more scrolling through hundreds of event photos. Just scan your face, and our AI will instantly find every photo and video you're in.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link to="/events" className="btn-primary flex items-center justify-center gap-2 text-lg px-8 py-4">
                        <ScanFace size={24} />
                        Scan Face Now
                    </Link>
                    <Link to="/events" className="glass-button flex items-center justify-center gap-2 text-lg px-8 py-4 text-white">
                        Browse Events
                    </Link>
                </div>
            </motion.div>

            {/* Features Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                {features.map((feature, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + (i * 0.1), duration: 0.5 }}
                        className="glass-card p-8 flex flex-col items-center text-center hover:bg-white/10 transition-colors"
                    >
                        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-inner">
                            {feature.icon}
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                        <p className="text-slate-400 font-light text-sm">{feature.desc}</p>
                    </motion.div>
                ))}
            </div>

        </div>
    );
};

export default LandingPage;
