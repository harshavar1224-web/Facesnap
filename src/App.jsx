import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import EventSelection from './pages/EventSelection';
import FaceScan from './pages/FaceScan';
import Processing from './pages/Processing';
import PersonalGallery from './pages/PersonalGallery';
import AdminDashboard from './pages/AdminDashboard';
import MediaUpload from './pages/MediaUpload';
import { Camera } from 'lucide-react';

import AdminLogin from './pages/AdminLogin';

function App() {
  return (
    <Router>
      <div className="min-h-screen text-slate-100 flex flex-col font-sans overflow-x-hidden">
        {/* Simple Navbar */}
        <nav className="w-full glass-card !rounded-none !border-t-0 !border-l-0 !border-r-0 py-4 px-6 md:px-12 flex justify-between items-center z-50 sticky top-0 bg-slate-900/40">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-lg">
              <Camera size={20} className="text-white" />
            </div>
            <span className="font-bold text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">MediaClub</span>
          </Link>
          <div className="flex gap-6 items-center">
            <Link to="/events" className="text-sm font-medium hover:text-primary transition-colors hover:glow">Events</Link>
            <Link to="/admin" className="text-sm font-medium text-slate-300 hover:text-white transition-colors glass-button px-4 py-2">Host Login</Link>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 w-full flex flex-col items-center p-4 py-12 md:p-12 relative">
          {/* Background Decorative Elements */}
          <div className="absolute top-20 left-10 w-64 h-64 bg-primary/20 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/20 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/events" element={<EventSelection />} />
            <Route path="/scan/:eventId" element={<FaceScan />} />
            <Route path="/processing" element={<Processing />} />
            <Route path="/gallery/:eventId" element={<PersonalGallery />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/upload/:eventId" element={<MediaUpload />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
