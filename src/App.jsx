import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShieldAlert, Users, CheckCircle, 
  Settings, LogOut, Lock, Activity, AlertCircle, X, TrendingUp,
  BarChart3, EyeOff, Eye, StopCircle, Upload, Clipboard, Check, Trash2
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, getDocs, 
  onSnapshot, writeBatch, updateDoc, increment, deleteDoc 
} from 'firebase/firestore';

// --- ROBUST FIREBASE INITIALIZATION ---
const defaultFirebaseConfig = {
  apiKey: "AIzaSyDeZzE7CnTar7ImNvVgcTAKmC5GztOlEd0",
  authDomain: "ccssc-voting-app.firebaseapp.com",
  projectId: "ccssc-voting-app",
  storageBucket: "ccssc-voting-app.firebasestorage.app",
  messagingSenderId: "404338605727",
  appId: "1:404338605727:web:1d30d962913a6832c56caa",
  measurementId: "G-0NCJ42D4SZ"
};

let firebaseConfig = defaultFirebaseConfig;
try {
  if (typeof __firebase_config !== 'undefined') {
    firebaseConfig = JSON.parse(__firebase_config);
  }
} catch (error) {
  console.warn("Using default Firebase Config. Custom config parsing failed.");
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ccssc-voting-system';

// --- SECURE UTILS & FALLBACKS ---
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

const hashPassword = async (password) => {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    console.warn("SubtleCrypto not available. Using fallback hash.");
  }
  return btoa(password); // Fallback for sandboxed HTTP iframes
};

// --- CONSTANTS ---
const CORE_POSITIONS = ["President", "Vice President", "Secretary", "Treasurer", "Auditor", "Project Manager"];
const POSITION_ORDER = {
  "President": 1, "Vice President": 2, "Secretary": 3, "Treasurer": 4,
  "Auditor": 5, "Project Manager": 6, "Grade Level Representative": 7, "Strand Representative": 8
};

const TAB_CATEGORIES = [
  { id: 'jhs_g7', label: 'JHS Grade 7', council: 'JHS', level: '7', type: 'grade' },
  { id: 'jhs_g8', label: 'JHS Grade 8', council: 'JHS', level: '8', type: 'grade' },
  { id: 'jhs_g9', label: 'JHS Grade 9', council: 'JHS', level: '9', type: 'grade' },
  { id: 'jhs_g10', label: 'JHS Grade 10', council: 'JHS', level: '10', type: 'grade' },
  { id: 'shs_abm', label: 'SHS ABM Strand', council: 'SHS', level: 'ABM', type: 'strand' },
  { id: 'shs_stem', label: 'SHS STEM Strand', council: 'SHS', level: 'STEM', type: 'strand' },
  { id: 'shs_humss', label: 'SHS HUMSS Strand', council: 'SHS', level: 'HUMSS', type: 'strand' },
];

const getCouncilPositions = (council) => {
  const core = [...CORE_POSITIONS];
  if (council === 'JHS') {
    return [...core, "Grade 7 Representative", "Grade 8 Representative", "Grade 9 Representative", "Grade 10 Representative"];
  } else {
    return [...core, "ABM Representative", "STEM Representative", "HUMSS Representative"];
  }
};

// --- ERROR BOUNDARY TO PREVENT WHITE SCREENS ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-red-600 bg-red-50 min-h-screen font-sans">
          <h1 className="text-3xl font-black mb-4 flex items-center gap-2"><AlertCircle/> Critical Error Render Failed</h1>
          <p className="mb-4 text-sm text-slate-700">The application encountered an unexpected runtime environment error.</p>
          <pre className="text-xs bg-white p-4 border border-red-200 rounded-lg shadow-sm overflow-auto text-slate-800 font-mono">
            {this.state.error?.stack || this.state.error?.toString()}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- TOAST NOTIFICATION COMPONENT ---
function ToastContainer({ toasts }) {
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl animate-in slide-in-from-right fade-in pointer-events-auto border ${t.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-slate-200 text-[#16345f]'}`}>
          {t.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-500" /> : <CheckCircle className="w-5 h-5 text-green-500" />}
          <span className="font-bold text-sm tracking-wide">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

// --- MAIN APP COMPONENT ---
function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); 
  const [clickCount, setClickCount] = useState(0);
  const [showHiddenNav, setShowHiddenNav] = useState(false);
  const [systemConfig, setSystemConfig] = useState(null);
  const [toasts, setToasts] = useState([]);

  const addToast = (msg, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, 4000);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_settings', 'system_config');
    const unsubscribe = onSnapshot(configRef, async (snap) => {
      if (snap.exists()) {
        setSystemConfig(snap.data());
      } else {
        const defaultHash = await hashPassword('admin2026');
        const initialConfig = {
          adminHash: defaultHash,
          isFirstLogin: true,
          isTransmitting: false,
          transmissionStartTime: 0,
          isResultsPublic: false,
          transmittedBallotsCount: 0, 
          initialTransmittedBallotsCount: 0,
          targetTransmittedBallotsCount: 0,
          totalUploadedBallots: 0
        };
        await setDoc(configRef, initialConfig);
        setSystemConfig(initialConfig);
      }
    }, (err) => console.error("Config error: ", err));

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (clickCount >= 5) {
      setShowHiddenNav(true);
      setClickCount(0);
    }
    const timer = setTimeout(() => setClickCount(0), 1500);
    return () => clearTimeout(timer);
  }, [clickCount]);

  const safeConfig = systemConfig || {
    isFirstLogin: true, isTransmitting: false, transmissionStartTime: 0, isResultsPublic: false, adminHash: '', transmittedBallotsCount: 0, initialTransmittedBallotsCount: 0, targetTransmittedBallotsCount: 0, totalUploadedBallots: 0
  };

  const isHome = view === 'home';

  return (
    <div className="min-h-screen font-sans bg-white text-slate-900 flex flex-col">
      <ToastContainer toasts={toasts} />

      <header className={`${isHome ? 'bg-[#0f172a] border-none text-white' : 'bg-[#16345f] text-white'} p-4 md:px-8 flex items-center justify-between relative z-50 transition-colors`}>
        <div 
          className="flex items-center gap-3 cursor-pointer select-none"
          onClick={() => {
            setClickCount(c => c + 1);
            if (clickCount + 1 >= 5) addToast("Adviser security check triggered. Access panel opened.", "success");
          }}
          title="Security Protected Zone"
        >
          <div className={`w-10 h-10 border border-[#c6b26c] rounded-lg flex items-center justify-center overflow-hidden ${isHome ? 'bg-transparent' : 'bg-white p-1'}`}>
            <img 
              src="logo.png" 
              alt="Logo" 
              className="w-full h-full object-contain"
              onError={(e) => {
                e.target.onerror = null; 
                e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23c6b26c' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M22 11.08V12a10 10 0 1 1-5.93-9.14'/%3E%3Cpolyline points='22 4 12 14.01 9 11.01'/%3E%3C/svg%3E";
              }}
            />
          </div>
          <div>
            <h1 className="font-bold tracking-wider leading-tight text-white text-base md:text-lg">
              CCSSC <span className="text-[#c6b26c]">TABULATOR</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Electoral Transmission Platform 2026</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
           {!isHome && (
             <button 
               onClick={() => setView('home')}
               className="text-sm font-semibold text-slate-300 hover:text-white transition bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg"
             >
               Return Home
             </button>
           )}
        </div>
      </header>

      {showHiddenNav && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 border-t-4 border-[#c6b26c]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[#16345f]">System Access</h2>
              <button onClick={() => setShowHiddenNav(false)}><X className="text-slate-400 hover:text-red-500" /></button>
            </div>
            <div className="space-y-3">
              <button onClick={() => { setView('admin'); setShowHiddenNav(false); }} className="w-full text-left px-4 py-3 bg-slate-100 hover:bg-[#16345f] hover:text-white rounded-lg font-medium transition flex items-center gap-3">
                <ShieldAlert className="w-5 h-5" /> Adviser Portal
              </button>
              <button onClick={() => { setView('home'); setShowHiddenNav(false); }} className="w-full text-left px-4 py-3 bg-slate-100 hover:bg-[#16345f] hover:text-white rounded-lg font-medium transition flex items-center gap-3">
                <BarChart3 className="w-5 h-5" /> Public Scoreboard
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="w-full flex-1">
        {view === 'home' && <PublicDashboard config={safeConfig} user={user} />}
        {view === 'admin' && <AdminPortal config={safeConfig} addToast={addToast} user={user} />}
      </main>
    </div>
  );
}

// Wrap the app to prevent white screens on hard runtime crashes
export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

// ============================================================================
// 1. PUBLIC DASHBOARD (TALLY BOARD WITH REBUILT ANIMATION ENGINE)
// ============================================================================
function PublicDashboard({ config, user }) {
  const [candidates, setCandidates] = useState([]);
  const [ticker, setTicker] = useState(0);

  useEffect(() => {
    if (!user) return;
    const cRef = collection(db, 'artifacts', appId, 'public', 'data', 'ccssc_candidates');
    const unsub = onSnapshot(cRef, (snap) => {
      const c = [];
      snap.forEach(doc => c.push({ id: doc.id, ...doc.data() }));
      setCandidates(c);
    }, (err) => console.error("Candidates error: ", err));
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!config.isTransmitting) return;
    const interval = setInterval(() => { setTicker(t => t + 1); }, 500);
    return () => clearInterval(interval);
  }, [config.isTransmitting]);

  // Core Real-time Vote Interpolator Engine
  const displayData = useMemo(() => {
    const votes = {};
    if (!config.isTransmitting) {
      candidates.forEach(c => { votes[c.id] = c.voteCount || 0; });
      return { votes, animatedCount: config.transmittedBallotsCount || 0 };
    }

    const elapsed = Date.now() - (config.transmissionStartTime || Date.now());
    const studentBallotsTransmitted = Math.max(0, Math.floor(elapsed / 1000));

    const initialBallots = config.initialTransmittedBallotsCount || 0;
    const targetBallots = config.targetTransmittedBallotsCount || 0;
    const currentBallotsAnimated = Math.min(targetBallots, initialBallots + studentBallotsTransmitted);

    candidates.forEach(c => {
      const initial = c.initialVoteCount || 0;
      const target = c.targetVoteCount || 0;
      const diff = Math.max(0, target - initial);
      const revealed = Math.min(diff, studentBallotsTransmitted);
      votes[c.id] = initial + revealed;
    });

    return { votes, animatedCount: currentBallotsAnimated };
  }, [candidates, config.isTransmitting, config.transmissionStartTime, config.transmittedBallotsCount, config.initialTransmittedBallotsCount, config.targetTransmittedBallotsCount, config.totalUploadedBallots, ticker]);

  const totalBallots = config.totalUploadedBallots || 0;
  const transmittedBallots = displayData.animatedCount;
  const transmissionPercent = totalBallots === 0 ? 0 : Math.round((transmittedBallots / totalBallots) * 100);

  const renderCandidatesGroup = (council, virtualPosition) => {
    const positionCandidates = candidates.filter(c => {
      if (c.council !== council) return false;
      if (virtualPosition.endsWith("Representative")) {
        if (council === 'JHS') {
          const grade = parseInt(virtualPosition.split(" ")[1], 10);
          return c.position === "Grade Level Representative" && c.gradeLevel === grade;
        } else {
          const strand = virtualPosition.split(" ")[0];
          return c.position === "Strand Representative" && c.strand === strand;
        }
      }
      return c.position === virtualPosition;
    });

    if (positionCandidates.length === 0) return null;

    const totalPosVotes = positionCandidates.reduce((sum, c) => sum + (displayData.votes[c.id] || 0), 0);
    const sortedCandidates = [...positionCandidates].sort((a, b) => (displayData.votes[b.id] || 0) - (displayData.votes[a.id] || 0));
    
    const isStrandRep = council === 'SHS' && virtualPosition.endsWith("Representative");
    const allowedWinnersCount = isStrandRep ? 2 : 1;

    return (
      <div key={`${council}-${virtualPosition}`} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <h4 className="text-xl font-bold text-[#16345f] tracking-tight">{virtualPosition}</h4>
          {isStrandRep && (
            <span className="text-xs bg-amber-100 text-[#16345f] border border-[#c6b26c] font-black tracking-wider uppercase px-2 py-1 rounded">2 Winners Elected</span>
          )}
        </div>

        <div className="space-y-4">
          {sortedCandidates.map((c, index) => {
            const votes = displayData.votes[c.id] || 0;
            const isWinner = votes > 0 && index < allowedWinnersCount;
            const name = `${c.firstName} ${c.lastName}`.trim();
            const percentage = totalPosVotes === 0 ? 0 : ((votes / totalPosVotes) * 100).toFixed(1);

            return (
              <div 
                key={c.id} 
                className={`p-5 rounded-xl border transition-all duration-300 ${
                  isWinner 
                    ? 'border-emerald-500/50 bg-emerald-50/20 shadow-sm' 
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-end gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-lg text-[#16345f] leading-snug truncate">{name}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">{c.partyList || 'INDEPENDENT'}</div>
                  </div>
                  <div className="flex flex-col items-end shrink-0 select-none">
                    {isWinner ? (
                      <div className="flex items-center gap-1 text-emerald-600 font-extrabold text-[10px] tracking-widest uppercase mb-1">
                        <TrendingUp className="w-3 h-3 animate-bounce" /> {isStrandRep ? `TOP ${index + 1}` : 'LEADING'}
                      </div>
                    ) : (
                      <div className="h-4 mb-1"></div>
                    )}
                    <div className="text-3xl font-black text-[#16345f] font-mono tracking-tight leading-none">{votes}</div>
                  </div>
                </div>

                <div className="mt-1">
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isWinner ? 'bg-emerald-500' : 'bg-[#16345f]'
                      }`} 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="text-[11px] font-extrabold text-slate-400 font-mono text-right tracking-tight mt-1">
                    {percentage}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="pb-20 bg-white min-h-screen">
      <div className="bg-[#0f172a] text-white pt-10 pb-32 px-6 md:px-12 relative rounded-b-[2rem] md:rounded-b-[4rem] shadow-2xl">
        <div className="max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-amber-950/40 text-[#c6b26c] border border-amber-800/60 px-3 py-1 rounded-full text-xs font-bold tracking-widest mb-6 font-mono">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> TRANSMISSION STATUS
          </div>
          <h2 className="text-5xl md:text-7xl font-black tracking-tight mb-4 text-white">Tabulation Board</h2>
          <p className="text-slate-400 text-lg md:text-xl max-w-2xl leading-relaxed">
            Real-time verified data stream. Displaying all certified, adviser-transmitted election records.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 -mt-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard icon={<Users className="w-6 h-6 text-[#60a5fa]"/>} title="TOTAL BALLOTS CERTIFIED" value={totalBallots.toLocaleString()} />
          <MetricCard icon={<CheckCircle className="w-6 h-6 text-[#34d399]"/>} title="TRANSMITTED BALLOTS" value={transmittedBallots.toLocaleString()} />
          <MetricCard title="TRANSMISSION PROGRESS" value={`${transmissionPercent}%`} progress={transmissionPercent} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-24 space-y-24">
        {config.isResultsPublic ? (
          <>
         