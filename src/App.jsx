import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShieldAlert, Users, CheckCircle, 
  Settings, LogOut, Lock, Activity, AlertCircle, X, TrendingUp,
  BarChart3, EyeOff, Eye, StopCircle, Upload, Clipboard, Check, Trash2, PieChart
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
  { id: 'jhs_g7', label: 'Grade 7', council: 'JHS', level: '7', type: 'grade' },
  { id: 'jhs_g8', label: 'Grade 8', council: 'JHS', level: '8', type: 'grade' },
  { id: 'jhs_g9', label: 'Grade 9', council: 'JHS', level: '9', type: 'grade' },
  { id: 'jhs_g10', label: 'Grade 10', council: 'JHS', level: '10', type: 'grade' },
  { id: 'shs_abm', label: 'ABM Strand', council: 'SHS', level: 'ABM', type: 'strand' },
  { id: 'shs_stem', label: 'STEM Strand', council: 'SHS', level: 'STEM', type: 'strand' },
  { id: 'shs_humss', label: 'HUMSS Strand', council: 'SHS', level: 'HUMSS', type: 'strand' },
];

const getCouncilPositions = (council) => {
  const core = [...CORE_POSITIONS];
  if (council === 'JHS') {
    return [...core, "Grade 7 Representative", "Grade 8 Representative", "Grade 9 Representative", "Grade 10 Representative"];
  } else {
    return [...core, "ABM Representative", "STEM Representative", "HUMSS Representative"];
  }
};

// --- ERROR BOUNDARY ---
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

// --- TOAST NOTIFICATIONS ---
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
              src="src/assets/Logo.png" 
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
              CCSSC <span className="text-[#c6b26c]">RESULTS</span>
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

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

// ============================================================================
// 1. PUBLIC DASHBOARD (PROPORTIONAL ANIMATION ENGINE)
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

  // Faster ticker for smooth proportional animation updates
  useEffect(() => {
    if (!config.isTransmitting) return;
    const interval = setInterval(() => { setTicker(t => t + 1); }, 100);
    return () => clearInterval(interval);
  }, [config.isTransmitting]);

  // Core Real-time Vote Interpolator Engine - By Voter Staggered Simulation
  const displayData = useMemo(() => {
    const votes = {};
    if (!config.isTransmitting) {
      candidates.forEach(c => { votes[c.id] = c.voteCount || 0; });
      return { votes, animatedCount: config.transmittedBallotsCount || 0 };
    }

    const elapsed = Date.now() - (config.transmissionStartTime || Date.now());
    const elapsedSeconds = Math.max(0, elapsed / 1000);

    const initialBallots = config.initialTransmittedBallotsCount || 0;
    const targetBallots = config.targetTransmittedBallotsCount || 0;
    const totalBallotsDiff = Math.max(0, targetBallots - initialBallots);

    // Using totalBallotsDiff directly as duration ensures roughly 1 ballot per second overall
    const duration = totalBallotsDiff > 0 ? totalBallotsDiff : 1;
    // Cap progress at exactly 1 to prevent overshoot when finished
    const progress = Math.min(1, elapsedSeconds / duration);

    const currentBallotsAnimated = initialBallots + Math.floor(progress * totalBallotsDiff);

    candidates.forEach(c => {
      const initial = c.initialVoteCount || 0;
      const target = c.targetVoteCount || 0;
      const diff = Math.max(0, target - initial);
      
      // Proportional reveal means candidates with more votes tick up faster, simulating individual randomized votes
      const revealed = Math.floor(progress * diff);
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
            <div>
              <div className="flex flex-col items-center justify-center mb-12">
                <span className="px-4 py-1.5 rounded-full bg-[#16345f]/10 text-[#16345f] text-[10px] font-black tracking-widest uppercase mb-4 border border-[#16345f]/20 shadow-sm">
                  Official Candidates
                </span>
                <h3 className="text-4xl md:text-5xl font-black text-[#16345f] tracking-tighter text-center">Junior High School</h3>
                <div className="w-24 h-1.5 bg-[#c6b26c] mt-4 rounded-full shadow-[0_0_15px_rgba(198,178,108,0.5)]"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {getCouncilPositions('JHS').map(pos => renderCandidatesGroup('JHS', pos))}
              </div>
            </div>

            <div>
              <div className="flex flex-col items-center justify-center mb-12">
                <span className="px-4 py-1.5 rounded-full bg-[#16345f]/10 text-[#16345f] text-[10px] font-black tracking-widest uppercase mb-4 border border-[#16345f]/20 shadow-sm">
                  Official Candidates
                </span>
                <h3 className="text-4xl md:text-5xl font-black text-[#16345f] tracking-tighter text-center">Senior High School</h3>
                <div className="w-24 h-1.5 bg-[#c6b26c] mt-4 rounded-full shadow-[0_0_15px_rgba(198,178,108,0.5)]"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {getCouncilPositions('SHS').map(pos => renderCandidatesGroup('SHS', pos))}
              </div>
            </div>
          </>
        ) : (
          <div className="max-w-3xl mx-auto bg-slate-50 border-2 border-slate-200 border-dashed rounded-3xl p-12 text-center shadow-inner">
             <h3 className="text-3xl font-black text-[#16345f] mb-2">Tally Board Offline</h3>
             <p className="text-slate-500 text-lg">The election commission has restricted public access to live results. Please check back when official transmission is active.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, title, value, progress }) {
  return (
    <div className="bg-[#1e293b] rounded-2xl p-6 shadow-xl border border-slate-700/50 flex flex-col justify-center relative overflow-hidden min-h-[110px]">
      {icon ? (
        <div className="flex items-center gap-4">
          <div className="bg-[#334155] p-3 rounded-xl shadow-inner">{icon}</div>
          <div>
            <div className="text-slate-400 text-[10px] md:text-xs font-bold tracking-widest uppercase mb-1">{title}</div>
            <div className="text-3xl font-black text-white">{value}</div>
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col justify-center">
          <div className="flex justify-between items-end mb-3">
             <div className="text-slate-400 text-[10px] md:text-xs font-bold tracking-widest uppercase">{title}</div>
             <div className="text-3xl font-black text-white">{value}</div>
          </div>
          <div className="h-1.5 w-full bg-[#334155] rounded-full overflow-hidden">
            <div className="h-full bg-[#c6b26c] transition-all duration-1000" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LOGIN COMPONENT
// ============================================================================
function LoginScreen({ title, correctHash, onLogin }) {
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const h = await hashPassword(pass);
    if (h === correctHash) onLogin();
    else { setErr('Invalid Credentials'); setPass(''); }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border-t-8 border-[#16345f]">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-[#16345f] rounded-full flex items-center justify-center">
            <Lock className="text-[#c6b26c] w-8 h-8" />
          </div>
        </div>
        <h2 className="text-2xl font-black text-center text-[#16345f] mb-8 uppercase tracking-widest">{title}</h2>
        {err && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm font-medium border border-red-200">{err}</div>}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Passkey</label>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-[#16345f] focus:outline-none transition-colors text-lg text-center" autoFocus />
          </div>
          <button type="submit" className="w-full bg-[#16345f] hover:bg-[#0b1a30] text-white font-bold py-4 rounded-lg transition-colors uppercase tracking-widest">
            Authenticate
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// 2. ADMIN & TABULATION PORTAL
// ============================================================================
function AdminPortal({ config, addToast, user }) {
  const [authOk, setAuthOk] = useState(false);
  const [tab, setTab] = useState('tabulate');

  if (!authOk) return <LoginScreen title="Adviser Portal Access" correctHash={config.adminHash} onLogin={() => setAuthOk(true)} />;
  if (config.isFirstLogin) return <AdminFirstSetup config={config} addToast={addToast} />;

  return (
    <div className="flex min-h-[calc(100vh-76px)] bg-slate-50 flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 shadow-sm z-10 flex flex-col font-sans shrink-0">
        <div className="p-6">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Management Panel</h3>
          <nav className="space-y-2">
            <AdminTab id="tabulate" icon={<Upload/>} label="Forms Tabulator" current={tab} setTab={setTab} />
            <AdminTab id="results" icon={<BarChart3/>} label="Official Results" current={tab} setTab={setTab} />
            <AdminTab id="candidates" icon={<Users/>} label="Candidate Directory" current={tab} setTab={setTab} />
            <AdminTab id="transmit" icon={<Activity/>} label="Transmission Stream" current={tab} setTab={setTab} />
            <AdminTab id="setup" icon={<Settings/>} label="Credentials" current={tab} setTab={setTab} />
          </nav>
        </div>
        <div className="mt-auto p-6 hidden md:block border-t border-slate-100">
          <button onClick={() => setAuthOk(false)} className="flex items-center gap-2 text-slate-400 hover:text-red-500 transition font-medium w-full px-4 py-2 rounded-lg hover:bg-slate-50">
            <LogOut className="w-4 h-4" /> Lock Adviser Terminal
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-10 overflow-y-auto w-full">
        <div className="max-w-6xl mx-auto">
          {tab === 'tabulate' && <AdminTabulateTab config={config} addToast={addToast} user={user} />}
          {tab === 'results' && <AdminCertifiedResultsTab user={user} config={config} />}
          {tab === 'candidates' && <AdminCandidatesTab addToast={addToast} user={user} />}
          {tab === 'transmit' && <AdminTransmitTab config={config} addToast={addToast} user={user} />}
          {tab === 'setup' && <AdminSetupTab config={config} addToast={addToast} />}
        </div>
      </main>
    </div>
  );
}

function AdminTab({ id, icon, label, current, setTab }) {
  const active = current === id;
  return (
    <button onClick={() => setTab(id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${active ? 'bg-[#16345f] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
      {React.cloneElement(icon, { className: "w-5 h-5" })}
      {label}
    </button>
  );
}

// --- ADMIN FIRST SETUP ---
function AdminFirstSetup({ config, addToast }) {
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(pass1 !== pass2) return addToast("Passwords do not match.", "error");
    if(pass1.length < 6) return addToast("Password too short (min 6 characters).", "error");

    setLoading(true);
    const newHash = await hashPassword(pass1);
    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_settings', 'system_config');
    await updateDoc(ref, { adminHash: newHash, isFirstLogin: false });
    addToast("Initial Admin Setup complete.", "success");
    setLoading(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-lg border-t-8 border-[#c6b26c]">
        <ShieldAlert className="w-16 h-16 text-[#c6b26c] mx-auto mb-6" />
        <h2 className="text-2xl font-black text-center text-[#16345f] mb-2 uppercase tracking-widest">Initial Setup Required</h2>
        <p className="text-center text-slate-500 mb-8 text-sm">Please secure the Adviser account by changing the default system password.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">New Password</label>
            <input type="password" value={pass1} onChange={e=>setPass1(e.target.value)} required className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-[#16345f] outline-none font-medium text-center" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Confirm Password</label>
            <input type="password" value={pass2} onChange={e=>setPass2(e.target.value)} required className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-[#16345f] outline-none font-medium text-center" />
          </div>
          <button disabled={loading} type="submit" className="w-full bg-[#16345f] text-white font-bold py-4 rounded-lg hover:bg-[#0b1a30] transition mt-6">
            {loading ? 'Securing System...' : 'Update Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// 3. TABULATION TAB (STRICT CANDIDATE MATCHING)
// ============================================================================
function AdminTabulateTab({ config, addToast, user }) {
  const [candidates, setCandidates] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(TAB_CATEGORIES[0]);
  const [fileText, setFileText] = useState('');
  
  const [parsedBallotsCount, setParsedBallotsCount] = useState(0);
  const [parsedCandidates, setParsedCandidates] = useState([]);

  useEffect(() => {
    if (!user) return;
    const cRef = collection(db, 'artifacts', appId, 'public', 'data', 'ccssc_candidates');
    const unsub = onSnapshot(cRef, snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      setCandidates(arr);
    }, (err) => console.error("Candidates error: ", err));
    return () => unsub();
  }, [user]);

  const cleanName = (name) => {
    if (!name) return '';
    return name.toUpperCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
  };

  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const handleProcessData = () => {
    if (!fileText.trim()) {
      addToast("Please upload a file or paste spreadsheet results.", "error");
      return;
    }

    const lines = fileText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) {
      addToast("The spreadsheet must contain a header row and at least one response row.", "error");
      return;
    }

    const firstLine = lines[0];
    const isTab = firstLine.includes('\t');
    const headers = isTab ? firstLine.split('\t') : parseCSVLine(firstLine);

    const columnMappings = [];
    
    // Improved, strict header matching to prevent candidate mixing
    headers.forEach((h, idx) => {
      const cleanedHeader = h.toLowerCase();
      let matchedPosition = null;
      let specificGrade = null;
      let specificStrand = null;

      if (cleanedHeader.includes('president') && !cleanedHeader.includes('vice')) {
        matchedPosition = 'President';
      } else if (cleanedHeader.includes('vice') && cleanedHeader.includes('president')) {
        matchedPosition = 'Vice President';
      } else if (cleanedHeader.includes('secretary')) {
        matchedPosition = 'Secretary';
      } else if (cleanedHeader.includes('treasurer')) {
        matchedPosition = 'Treasurer';
      } else if (cleanedHeader.includes('auditor')) {
        matchedPosition = 'Auditor';
      } else if (cleanedHeader.includes('project manager') || cleanedHeader.includes('project-manager')) {
        matchedPosition = 'Project Manager';
      } else if (cleanedHeader.includes('representative') || cleanedHeader.includes('rep')) {
        // Look for specific grades to separate reps correctly
        if (cleanedHeader.includes(' 7') || cleanedHeader.includes('seven')) specificGrade = 7;
        else if (cleanedHeader.includes(' 8') || cleanedHeader.includes('eight')) specificGrade = 8;
        else if (cleanedHeader.includes(' 9') || cleanedHeader.includes('nine')) specificGrade = 9;
        else if (cleanedHeader.includes(' 10') || cleanedHeader.includes('ten')) specificGrade = 10;
        else if (cleanedHeader.includes('11') || cleanedHeader.includes('eleven')) specificGrade = 11;
        else if (cleanedHeader.includes('12') || cleanedHeader.includes('twelve')) specificGrade = 12;
        
        // Look for specific strands
        if (cleanedHeader.includes('abm')) specificStrand = 'ABM';
        else if (cleanedHeader.includes('stem')) specificStrand = 'STEM';
        else if (cleanedHeader.includes('humss')) specificStrand = 'HUMSS';
        else if (cleanedHeader.includes('gas')) specificStrand = 'GAS';
        
        if (specificGrade) {
          matchedPosition = 'Grade Level Representative';
        } else if (specificStrand) {
          matchedPosition = 'Strand Representative';
        } else {
          // If totally generic, assume the selected category
          matchedPosition = selectedCategory.council === 'JHS' ? 'Grade Level Representative' : 'Strand Representative';
        }
      }

      if (matchedPosition) {
        columnMappings.push({ 
          index: idx, 
          position: matchedPosition,
          gradeLevel: specificGrade || (matchedPosition === 'Grade Level Representative' ? Number(selectedCategory.level) : null),
          strand: specificStrand || (matchedPosition === 'Strand Representative' ? selectedCategory.level : null)
        });
      }
    });

    if (columnMappings.length === 0) {
      addToast("Could not automatically map any headers. Check if columns contain 'President', 'Secretary', 'Representative', etc.", "error");
      return;
    }

    const votesCounter = {}; 
    const detectedCandidatesMap = {}; 
    let rowCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const rowText = lines[i];
      const row = isTab ? rowText.split('\t') : parseCSVLine(rowText);
      if (row.length < columnMappings.length) continue;

      rowCount++;

      columnMappings.forEach(mapping => {
        const cellValue = row[mapping.index];
        if (!cellValue) return;

        const cellItems = cellValue.split(';').map(item => item.trim()).filter(item => item !== '');

        cellItems.forEach(item => {
          let cleanedItem = item.trim();
          if (!cleanedItem || cleanedItem.toLowerCase() === 'abstain' || cleanedItem.toLowerCase().includes('abstain')) {
            return;
          }

          let partyList = 'INDEPENDENT';
          const partyMatch = cleanedItem.match(/\((.*?)\)/);
          if (partyMatch) {
            partyList = partyMatch[1].toUpperCase().trim();
            cleanedItem = cleanedItem.replace(/\([^)]+\)/, '').trim();
          }

          let cleanedNameText = cleanName(cleanedItem);
          if (!cleanedNameText) return;

          let firstName = '';
          let lastName = '';
          if (cleanedNameText.includes(',')) {
            const parts = cleanedNameText.split(',');
            lastName = parts[0].trim().toUpperCase();
            firstName = parts[1].trim().toUpperCase();
          } else {
            const parts = cleanedNameText.split(/\s+/);
            if (parts.length > 1) {
              lastName = parts[parts.length - 1].trim().toUpperCase();
              firstName = parts.slice(0, parts.length - 1).join(' ').trim().toUpperCase();
            } else {
              lastName = cleanedNameText.toUpperCase();
              firstName = 'CANDIDATE';
            }
          }

          const pCandGrade = mapping.gradeLevel;
          const pCandStrand = mapping.strand;

          // Highly strict unique key to guarantee candidates don't mix up across grades/strands
          const key = `${lastName}_${firstName}_${mapping.position}_${pCandGrade || 'NA'}_${pCandStrand || 'NA'}`.replace(/\s+/g, '_');

          if (!detectedCandidatesMap[key]) {
            detectedCandidatesMap[key] = {
              firstName,
              lastName,
              position: mapping.position,
              council: selectedCategory.council,
              gradeLevel: pCandGrade,
              strand: pCandStrand,
              partyList
            };
          }

          votesCounter[key] = (votesCounter[key] || 0) + 1;
        });
      });
    }

    const previewList = Object.keys(detectedCandidatesMap).map(key => {
      const pCand = detectedCandidatesMap[key];
      const votes = votesCounter[key] || 0;

      const dbMatch = candidates.find(c => {
        const matchName = cleanName(c.lastName) === cleanName(pCand.lastName) && cleanName(c.firstName) === cleanName(pCand.firstName);
        const matchPos = c.position === pCand.position;
        const matchGrade = pCand.gradeLevel ? c.gradeLevel === pCand.gradeLevel : true;
        const matchStrand = pCand.strand ? c.strand === pCand.strand : true;
        const matchCouncil = c.council === pCand.council;
        return matchName && matchPos && matchGrade && matchStrand && matchCouncil;
      });

      return {
        key,
        ...pCand,
        newVotes: votes,
        dbId: dbMatch ? dbMatch.id : null,
        currentDBVotes: dbMatch ? (dbMatch.voteCount || 0) + (dbMatch.pendingVotes || 0) : 0,
        isNew: !dbMatch
      };
    });

    setParsedBallotsCount(rowCount);
    setParsedCandidates(previewList);
    addToast(`Successfully compiled ${rowCount} response records. Match matrix is shown below!`, "success");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      setFileText(evt.target.result);
      addToast(`CSV File loaded: ${file.name}. Review below!`, "success");
    };
    reader.readAsText(file);
    e.target.value = null; 
  };

  const commitToDatabase = async () => {
    if (parsedCandidates.length === 0) {
      addToast("No parsed candidates to save. Process a spreadsheet first.", "error");
      return;
    }

    try {
      const batch = writeBatch(db);
      const categoryLabel = selectedCategory.label;

      for (const item of parsedCandidates) {
        let finalId = item.dbId;
        const breakdownKey = `breakdown.${categoryLabel}`;

        if (item.isNew) {
          finalId = generateId();
          const newCandRef = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_candidates', finalId);
          batch.set(newCandRef, {
            firstName: item.firstName,
            lastName: item.lastName,
            position: item.position,
            council: item.council,
            gradeLevel: item.gradeLevel,
            strand: item.strand,
            partyList: item.partyList,
            voteCount: 0,
            pendingVotes: item.newVotes,
            initialVoteCount: 0,
            targetVoteCount: item.newVotes,
            breakdown: { [categoryLabel]: item.newVotes }
          });
        } else {
          const existCandRef = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_candidates', finalId);
          batch.update(existCandRef, {
            pendingVotes: increment(item.newVotes),
            [breakdownKey]: increment(item.newVotes)
          });
        }
      }

      const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_settings', 'system_config');
      batch.update(configRef, {
        totalUploadedBallots: increment(parsedBallotsCount)
      });

      await batch.commit();
      addToast(`Successfully compiled ${parsedBallotsCount} ballots and updated candidate counts!`, "success");

      setFileText('');
      setParsedBallotsCount(0);
      setParsedCandidates([]);
    } catch (err) {
      console.error(err);
      addToast("Failed to commit entries to DB: " + err.message, "error");
    }
  };

  return (
    <div className="space-y-8 font-sans">
      <div>
        <h2 className="text-3xl font-black text-[#16345f] mb-2">Automated Forms Tabulator</h2>
        <p className="text-slate-500">Adviser platform. Drops standard CSV exports to parse candidates dynamically and verify comparative results.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-bold text-lg text-[#16345f] mb-4">Step 1: Select Active Category</h3>
        
        <div className="space-y-5">
          <div>
             <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Junior High School Level</h4>
             <div className="flex flex-wrap gap-2">
                {TAB_CATEGORIES.filter(cat => cat.council === 'JHS').map(cat => {
                  const isSelected = selectedCategory.id === cat.id;
                  return (
                    <button 
                      key={cat.id} 
                      onClick={() => { setSelectedCategory(cat); setFileText(''); setParsedBallotsCount(0); setParsedCandidates([]); }}
                      className={`py-2 px-4 text-xs font-black rounded-lg transition-all border ${isSelected ? 'bg-[#16345f] text-[#c6b26c] border-[#16345f] shadow' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'}`}
                    >
                      {cat.label}
                    </button>
                  )
                })}
             </div>
          </div>
          <div>
             <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Senior High School Level</h4>
             <div className="flex flex-wrap gap-2">
                {TAB_CATEGORIES.filter(cat => cat.council === 'SHS').map(cat => {
                  const isSelected = selectedCategory.id === cat.id;
                  return (
                    <button 
                      key={cat.id} 
                      onClick={() => { setSelectedCategory(cat); setFileText(''); setParsedBallotsCount(0); setParsedCandidates([]); }}
                      className={`py-2 px-4 text-xs font-black rounded-lg transition-all border ${isSelected ? 'bg-[#16345f] text-[#c6b26c] border-[#16345f] shadow' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'}`}
                    >
                      {cat.label}
                    </button>
                  )
                })}
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm lg:col-span-5 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <h3 className="font-bold text-lg text-[#16345f] flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#c6b26c]" /> Load Spreadsheet Data
            </h3>
            <span className="text-xs bg-[#16345f] text-white px-2 py-1 rounded font-bold uppercase">{selectedCategory.label}</span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-center w-full">
              <label htmlFor="csv-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer hover:bg-slate-50 transition">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-sm font-bold text-slate-600">Choose Google Forms .csv</p>
                  <p className="text-xs text-slate-400 mt-1">UTF-8 comma-separated files</p>
                </div>
                <input id="csv-upload" type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/plain" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase font-mono font-bold">
                <span className="bg-white px-3 text-slate-400">or paste columns manually</span>
              </div>
            </div>

            <div>
              <textarea 
                value={fileText}
                onChange={e => setFileText(e.target.value)}
                placeholder="Paste columns copied directly from your Google Form responses sheet here..."
                className="w-full h-40 p-3 border-2 border-slate-200 focus:border-[#16345f] rounded-xl outline-none font-mono text-xs text-slate-700 bg-slate-50"
              />
            </div>

            <button 
              onClick={handleProcessData}
              className="w-full bg-[#16345f] hover:bg-[#0b1a30] text-white font-extrabold py-3 rounded-xl transition uppercase tracking-widest text-xs"
            >
              Process and Tabulate
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm lg:col-span-7 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-bold text-lg text-[#16345f] flex items-center gap-2">
              <Clipboard className="w-5 h-5 text-[#c6b26c]" /> Comparative Tally Preview
            </h3>
            <p className="text-xs text-slate-400 mt-1">Verify dynamic candidate mappings and incremented votes cleanly before saving.</p>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex justify-between items-center">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase block tracking-wider">Responses/Ballots Counted</span>
                <span className="text-3xl font-black text-[#16345f] font-mono">{parsedBallotsCount}</span>
              </div>
              {parsedCandidates.length > 0 && (
                <div className="bg-amber-100 text-[#16345f] px-3 py-1.5 rounded-lg border border-[#c6b26c]/30 text-xs font-bold uppercase tracking-wider flex items-center gap-1 animate-pulse">
                  Ready to Commit
                </div>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Automatic Candidate Comparison Map</span>
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-96 overflow-y-auto bg-white">
                {parsedCandidates.map(c => (
                  <div key={c.key} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm hover:bg-slate-50 transition">
                    <div className="flex-1">
                      <div className="font-bold text-[#16345f] text-base">{c.lastName}, {c.firstName}</div>
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">
                        {c.position} {c.gradeLevel ? `(Gr. ${c.gradeLevel})` : c.strand ? `(${c.strand})` : ''} • {c.partyList}
                      </p>
                    </div>

                    <div className="flex items-center gap-6 text-center">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Current</span>
                        <span className="font-mono text-sm font-black text-slate-600">{c.currentDBVotes}</span>
                      </div>
                      <span className="text-slate-300 font-bold">+</span>
                      <div>
                        <span className="text-[10px] text-blue-500 font-bold block uppercase">New</span>
                        <span className="font-mono text-sm font-black text-blue-600">{c.newVotes}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {parsedCandidates.length === 0 && (
                  <p className="text-center p-8 text-xs text-slate-400 italic font-medium">No tabulated results processed. Load or paste a file in the sidebar to run the auto-mapper.</p>
                )}
              </div>
            </div>

            <button 
              onClick={commitToDatabase}
              disabled={parsedCandidates.length === 0}
              className={`w-full py-4 rounded-xl font-black transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2 ${
                parsedCandidates.length > 0 
                  ? 'bg-[#16345f] text-white hover:bg-[#0b1a30] shadow-xl' 
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle className="w-5 h-5 text-[#c6b26c]"/> Confirm and Save to Database
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 4. CERTIFIED RESULTS TAB (IMMEDIATE DB RECORD, NO TRANSMISSION DELAY)
// ============================================================================
function AdminCertifiedResultsTab({ user, config }) {
  const [candidates, setCandidates] = useState([]);

  useEffect(() => {
    if (!user) return;
    const cRef = collection(db, 'artifacts', appId, 'public', 'data', 'ccssc_candidates');
    const unsub = onSnapshot(cRef, snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      setCandidates(arr);
    }, (err) => console.error("Candidates certified snapshot error: ", err));
    return () => unsub();
  }, [user]);

  const renderOfficialCertifiedPositions = (council) => {
    const positions = getCouncilPositions(council);
    
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden space-y-6 p-6">
        <h3 className="text-xl font-extrabold text-[#16345f] border-b pb-3 border-slate-100 flex justify-between items-center">
          <span>{council === 'JHS' ? 'Junior High School' : 'Senior High School'} Official Ledger</span>
        </h3>

        {positions.map(pos => {
          const cands = candidates.filter(c => {
            if (c.council !== council) return false;
            if (pos.endsWith("Representative")) {
              if (council === 'JHS') {
                const grade = parseInt(pos.split(" ")[1], 10);
                return c.position === "Grade Level Representative" && c.gradeLevel === grade;
              } else {
                const strand = pos.split(" ")[0];
                return c.position === "Strand Representative" && c.strand === strand;
              }
            }
            return c.position === pos;
          });

          if (cands.length === 0) return null;

          // Directly uses Absolute Votes (voteCount + pendingVotes) instantly bypassing transmission animation!
          const sortedCands = [...cands].sort((a,b) => {
            const absoluteB = (b.voteCount || 0) + (b.pendingVotes || 0);
            const absoluteA = (a.voteCount || 0) + (a.pendingVotes || 0);
            return absoluteB - absoluteA;
          });

          return (
            <div key={pos} className="space-y-2 border-b border-slate-50 last:border-0 pb-4 last:pb-0">
              <span className="text-xs font-black text-slate-400 tracking-wider uppercase block">{pos}</span>
              <div className="space-y-1.5">
                {sortedCands.map((c, idx) => {
                  const absoluteTotal = (c.voteCount || 0) + (c.pendingVotes || 0);
                  return (
                    <div key={c.id} className="flex justify-between items-center text-sm p-2 rounded hover:bg-slate-50">
                      <div>
                        <div className="font-bold text-[#16345f]">{c.lastName}, {c.firstName}</div>
                        <div className="text-[10px] text-slate-400 font-bold tracking-widest mt-0.5 uppercase">{c.partyList || 'INDEPENDENT'}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {idx === 0 && <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-100 px-1.5 py-0.5 rounded">1ST</span>}
                        {idx === 1 && pos.includes("Representative") && council === 'SHS' && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-100 px-1.5 py-0.5 rounded">2ND</span>
                        )}
                        <span className="font-mono font-black text-sm bg-slate-100 border px-3 py-1 rounded min-w-[3rem] text-center text-slate-700">
                          {absoluteTotal}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-8 font-sans">
      <div>
        <h2 className="text-3xl font-black text-[#16345f] mb-2">Official Certified Results Ledger</h2>
        <p className="text-slate-500">Displays absolute real-time database records immediately upon saving, unaffected by public transmission delays.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {renderOfficialCertifiedPositions('JHS')}
        {renderOfficialCertifiedPositions('SHS')}
      </div>
    </div>
  );
}

// ============================================================================
// 5. CANDIDATE DIRECTORY & ANALYTICS
// ============================================================================
function AdminCandidatesTab({ addToast, user }) {
  const [candidates, setCandidates] = useState([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [viewCandidate, setViewCandidate] = useState(null);

  useEffect(() => {
    if (!user) return;
    const cRef = collection(db, 'artifacts', appId, 'public', 'data', 'ccssc_candidates');
    const unsub = onSnapshot(cRef, snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      setCandidates(arr);
    }, (err) => console.error("Candidates error: ", err));
    return () => unsub();
  }, [user]);

  const executeDelete = async (id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_candidates', id));
    addToast("Candidate deleted successfully.", "success");
    setConfirmDeleteId(null);
    if(viewCandidate && viewCandidate.id === id) setViewCandidate(null);
  };

  const sortCandidates = (list) => {
    return [...list].sort((a, b) => {
      const orderA = POSITION_ORDER[a.position] || 99;
      const orderB = POSITION_ORDER[b.position] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.lastName.localeCompare(b.lastName);
    });
  };

  const jhsCandidates = useMemo(() => sortCandidates(candidates.filter(c => c.council === 'JHS')), [candidates]);
  const shsCandidates = useMemo(() => sortCandidates(candidates.filter(c => c.council === 'SHS')), [candidates]);

  const renderAnalyticsModal = () => {
    if (!viewCandidate) return null;
    const c = viewCandidate;
    const absoluteTotal = (c.voteCount || 0) + (c.pendingVotes || 0);
    const breakdown = c.breakdown || {};
    const entries = Object.entries(breakdown).map(([label, value]) => ({label, value})).sort((a,b) => b.value - a.value);
    
    // Dynamic Conic Gradient calculation for pie chart
    const colors = ['#16345f', '#c6b26c', '#34d399', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa'];
    let currentPercent = 0;
    const totalForPie = entries.reduce((s, e) => s + e.value, 0) || 1;
    const gradientStops = entries.map((entry, i) => {
      const percent = (entry.value / totalForPie) * 100;
      const stop = `${colors[i % colors.length]} ${currentPercent}% ${currentPercent + percent}%`;
      currentPercent += percent;
      return stop;
    });
    const pieStyle = { background: gradientStops.length > 0 ? `conic-gradient(${gradientStops.join(', ')})` : '#e2e8f0' };

    return (
      <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
          <div className="bg-[#16345f] p-6 relative">
             <button onClick={() => setViewCandidate(null)} className="absolute top-6 right-6 text-white/70 hover:text-white transition"><X className="w-6 h-6"/></button>
             <h3 className="text-3xl font-black text-white">{c.lastName}, {c.firstName}</h3>
             <p className="text-[#c6b26c] font-bold tracking-widest uppercase text-sm mt-1">{c.position} {c.gradeLevel ? `(Grade ${c.gradeLevel})` : c.strand ? `(${c.strand})` : ''} • {c.partyList || 'INDEPENDENT'}</p>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
              
              <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl">
                 <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Total Votes Garnered</div>
                 <div className="text-6xl font-black text-[#16345f] font-mono tracking-tighter">{absoluteTotal.toLocaleString()}</div>
                 {c.pendingVotes > 0 && <div className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded mt-3 uppercase tracking-wider">{c.pendingVotes} Pending Transmission</div>}
              </div>

              <div>
                <h4 className="font-bold text-[#16345f] mb-4 border-b border-slate-100 pb-2 flex items-center gap-2"><PieChart className="w-4 h-4 text-[#c6b26c]" /> Voter Demographics</h4>
                
                {entries.length > 0 ? (
                  <div className="flex gap-6 items-center">
                    <div className="w-32 h-32 rounded-full shadow-inner border border-slate-200 shrink-0 transform hover:scale-105 transition-transform" style={pieStyle}></div>
                    <div className="flex-1 space-y-2">
                      {entries.map((entry, i) => (
                        <div key={entry.label} className="flex justify-between items-center text-xs">
                           <div className="flex items-center gap-2">
                             <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i % colors.length] }}></div>
                             <span className="font-bold text-slate-700">{entry.label}</span>
                           </div>
                           <span className="font-mono font-black text-slate-500">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 italic">No breakdown data available.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 font-sans">
      {renderAnalyticsModal()}

      <div>
        <h2 className="text-3xl font-black text-[#16345f] mb-2">Candidate Directory</h2>
        <p className="text-slate-500">View registered candidates. Click on any candidate's row to open their detailed voting analytics and demographics.</p>
      </div>

      {/* JHS Candidates Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-[#16345f] px-6 py-4">
          <h3 className="font-extrabold text-white text-lg">Junior High School Candidates</h3>
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Name</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Position & Level</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Party</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jhsCandidates.map(c => (
              <tr key={c.id} onClick={() => setViewCandidate(c)} className="hover:bg-blue-50 cursor-pointer transition-colors">
                <td className="p-4 font-bold text-[#16345f]">{c.lastName}, {c.firstName} {c.middleName || ''}</td>
                <td className="p-4 text-sm"><span className="bg-slate-200 px-2 py-1 rounded text-xs font-bold mr-2">{c.position}</span>{c.gradeLevel ? `(Gr. ${c.gradeLevel})` : ''}</td>
                <td className="p-4 text-sm font-mono">{c.partyList || 'IND'}</td>
                <td className="p-4 text-right">
                  {confirmDeleteId === c.id ? (
                    <div className="inline-flex items-center gap-2" onClick={e=>e.stopPropagation()}>
                      <button onClick={() => executeDelete(c.id)} className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 py-1.5 rounded transition">Confirm</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="bg-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded transition">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(c.id); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {jhsCandidates.length === 0 && (
              <tr>
                <td colSpan="4" className="text-center py-6 text-slate-400 font-medium text-sm">No registered JHS candidates. Try uploading a JHS Google Forms .csv in the tabulator.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* SHS Candidates Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-[#16345f] px-6 py-4">
          <h3 className="font-extrabold text-white text-lg">Senior High School Candidates</h3>
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Name</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Position & Strand</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase">Party</th>
              <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shsCandidates.map(c => (
              <tr key={c.id} onClick={() => setViewCandidate(c)} className="hover:bg-blue-50 cursor-pointer transition-colors">
                <td className="p-4 font-bold text-[#16345f]">{c.lastName}, {c.firstName} {c.middleName || ''}</td>
                <td className="p-4 text-sm"><span className="bg-slate-200 px-2 py-1 rounded text-xs font-bold mr-2">{c.position}</span>{c.strand ? `(${c.strand})` : ''}</td>
                <td className="p-4 text-sm font-mono">{c.partyList || 'IND'}</td>
                <td className="p-4 text-right">
                  {confirmDeleteId === c.id ? (
                    <div className="inline-flex items-center gap-2" onClick={e=>e.stopPropagation()}>
                      <button onClick={() => executeDelete(c.id)} className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 py-1.5 rounded transition">Confirm</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="bg-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded transition">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(c.id); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {shsCandidates.length === 0 && (
              <tr>
                <td colSpan="4" className="text-center py-6 text-slate-400 font-medium text-sm">No registered SHS candidates. Try uploading an SHS Google Forms .csv in the tabulator.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// 6. TRANSMISSION CONTROLS
// ============================================================================
function AdminTransmitTab({ config, addToast, user }) {
  const [candidates, setCandidates] = useState([]);
  const [confirmTransmit, setConfirmTransmit] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetCode, setResetCode] = useState('');

  useEffect(() => {
    if (!user) return;
    const cRef = collection(db, 'artifacts', appId, 'public', 'data', 'ccssc_candidates');
    const unsub = onSnapshot(cRef, snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      setCandidates(arr);
    }, (err) => console.error("Candidates error: ", err));
    return () => unsub();
  }, [user]);

  const totalUploadedBallots = config.totalUploadedBallots || 0;
  const transmittedCount = config.transmittedBallotsCount || 0;
  const totalPendingBallots = Math.max(0, totalUploadedBallots - transmittedCount);

  // Active state calculations
  const elapsed = Date.now() - (config.transmissionStartTime || Date.now());
  const elapsedSeconds = Math.max(0, elapsed / 1000);
  const targetTransmission = config.targetTransmittedBallotsCount || 0;
  const initialTransmission = config.initialTransmittedBallotsCount || 0;
  
  const maxDiff = Math.max(0, targetTransmission - initialTransmission);
  const progress = maxDiff === 0 ? 1 : Math.min(1, elapsedSeconds / maxDiff);
  const transmittedNow = Math.floor(progress * maxDiff);

  const isFinished = config.isTransmitting && progress >= 1;

  const handleTransmit = async () => {
    if(totalPendingBallots === 0) return addToast("No pending ballots to transmit.", "error");

    const batch = writeBatch(db);
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_settings', 'system_config');

    batch.update(configRef, {
      isTransmitting: true,
      transmissionStartTime: Date.now(),
      initialTransmittedBallotsCount: transmittedCount,
      targetTransmittedBallotsCount: totalUploadedBallots,
      transmittedBallotsCount: totalUploadedBallots
    });

    candidates.forEach(c => {
      const ref = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_candidates', c.id);
      const current = c.voteCount || 0;
      const pending = c.pendingVotes || 0;
      batch.update(ref, {
        initialVoteCount: current,
        targetVoteCount: current + pending,
        voteCount: current + pending, 
        pendingVotes: 0 
      });
    });

    await batch.commit();
    setConfirmTransmit(false);
    addToast("Data transmission stream initialized! Publishing proportional votes smoothly...", "success");
  };

  const handleStopTransmission = async () => {
    const batch = writeBatch(db);
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_settings', 'system_config');
    
    const newTransmittedCount = Math.min(targetTransmission, initialTransmission + transmittedNow);
    
    batch.update(configRef, {
      isTransmitting: false,
      transmittedBallotsCount: newTransmittedCount,
      targetTransmittedBallotsCount: newTransmittedCount
    });
    
    candidates.forEach(c => {
      const diff = Math.max(0, (c.targetVoteCount || 0) - (c.initialVoteCount || 0));
      const revealed = Math.floor(progress * diff);
      const currentVote = (c.initialVoteCount || 0) + revealed;
      const remaining = diff - revealed;
      
      const ref = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_candidates', c.id);
      batch.update(ref, {
        voteCount: currentVote,
        targetVoteCount: currentVote,
        initialVoteCount: currentVote,
        pendingVotes: remaining
      });
    });
    
    await batch.commit();
    addToast("Transmission feed paused. Progress saved securely.", "success");
  };

  const togglePublicResults = async () => {
    try {
      const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_settings', 'system_config');
      await updateDoc(configRef, { isResultsPublic: !config.isResultsPublic });
      addToast(config.isResultsPublic ? "Live Tally Board hidden from the public homepage." : "Live Tally Board published to homepage successfully.", "success");
    } catch (e) {
      addToast("Failed to modify public visibility status.", "error");
    }
  };

  const handleReset = async () => {
    if(resetCode !== 'RESET') {
       return addToast("Invalid confirmation entry. Please enter 'RESET'.", "error");
    }

    try {
      const batch = writeBatch(db);

      const cSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'ccssc_candidates'));
      cSnap.forEach(cDoc => { batch.delete(cDoc.ref); });

      const defaultAdminHash = await hashPassword('admin2026');
      const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_settings', 'system_config');
      batch.update(configRef, {
        adminHash: defaultAdminHash,
        isFirstLogin: true,
        isTransmitting: false,
        transmissionStartTime: 0,
        isResultsPublic: false,
        transmittedBallotsCount: 0,
        initialTransmittedBallotsCount: 0,
        targetTransmittedBallotsCount: 0,
        totalUploadedBallots: 0
      });

      await batch.commit();
      setShowReset(false);
      setResetCode('');
      addToast("System fully formatted. Default credentials restored successfully.", "success");
    } catch (err) {
      console.error("Reset error: ", err);
      addToast("Format process failed: " + err.message, "error");
    }
  };

  return (
    <div className="space-y-8 font-sans">
      <div>
        <h2 className="text-3xl font-black text-[#16345f] mb-2">Transmission Streams</h2>
        <p className="text-slate-500">Initialize and feed certified voter data packets directly onto the homepage tally dashboard.</p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
        <Activity className="w-16 h-16 text-[#c6b26c] mx-auto mb-4" />
        <div className="text-6xl font-black text-[#16345f] mb-2 font-mono">{totalPendingBallots.toLocaleString()}</div>
        <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8 font-sans">Ballots Pending Transmission</div>

        {isFinished ? (
           <div className="w-full max-w-sm mx-auto block py-4 rounded-xl font-bold uppercase tracking-widest bg-emerald-100 text-emerald-700 border border-emerald-300 flex justify-center items-center gap-2 text-xs">
             <CheckCircle className="w-5 h-5"/> All Channels Transmitted
           </div>
        ) : config.isTransmitting ? (
           <button 
             onClick={handleStopTransmission}
             className="w-full max-w-sm mx-auto py-4 rounded-xl font-bold uppercase tracking-widest transition-all bg-red-600 hover:bg-red-700 text-white shadow-xl flex justify-center items-center gap-2 text-xs"
           >
             <StopCircle className="w-5 h-5"/> Pause Stream Transmission
           </button>
        ) : !confirmTransmit ? (
          <button 
            onClick={() => setConfirmTransmit(true)}
            disabled={totalPendingBallots === 0}
            className={`w-full max-w-sm mx-auto block py-4 rounded-xl font-bold uppercase tracking-widest transition-all text-xs ${
              totalPendingBallots > 0 
                ? 'bg-[#16345f] text-white hover:bg-[#0b1a30] shadow-xl hover:-translate-y-0.5' 
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            Start Transmission Sync
          </button>
        ) : (
          <div className="flex gap-4 justify-center max-w-sm mx-auto">
            <button onClick={handleTransmit} className="flex-1 bg-emerald-600 text-white font-bold py-4 rounded-xl uppercase tracking-widest shadow-lg hover:bg-emerald-700 text-xs">Confirm</button>
            <button onClick={() => setConfirmTransmit(false)} className="flex-1 bg-slate-200 text-slate-700 font-bold py-4 rounded-xl uppercase tracking-widest hover:bg-slate-300 text-xs">Cancel</button>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h4 className="font-bold text-[#16345f]">Public Board Visibility Toggle</h4>
          <p className="text-sm text-slate-500">Allow standard users to browse the finalized counts on the homepage.</p>
        </div>
        <button 
          onClick={togglePublicResults}
          className={`px-6 py-3 rounded-lg font-bold shadow-sm transition whitespace-nowrap flex items-center gap-2 text-xs ${
            config.isResultsPublic 
              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-300' 
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300 border border-slate-300'
          }`}
        >
          {config.isResultsPublic ? <><Eye className="w-4 h-4"/> Public (Online)</> : <><EyeOff className="w-4 h-4"/> Hidden (Offline)</>}
        </button>
      </div>

      <div className="bg-red-50 p-6 rounded-xl border border-red-200 mt-12 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h4 className="font-bold text-red-700">Danger Zone: Full Format Reset</h4>
          <p className="text-sm text-red-600/80">Permanently purge all candidates, totals, streams, and restore default credential hashes.</p>
        </div>

        {!showReset ? (
          <button onClick={() => setShowReset(true)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg shadow-sm transition whitespace-nowrap text-xs">
            Erase Election Data
          </button>
        ) : (
          <div className="flex gap-2">
            <input 
              type="text" placeholder="Type RESET" value={resetCode} onChange={(e)=>setResetCode(e.target.value)}
              className="px-4 py-2 border border-red-300 rounded-lg outline-none focus:border-red-500 font-bold w-32 text-center text-xs"
            />
            <button onClick={handleReset} className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-lg text-xs">Verify</button>
            <button onClick={() => setShowReset(false)} className="bg-red-200 text-red-800 font-bold px-4 py-2 rounded-lg text-xs">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 7. SYSTEM CREDENTIALS AND ACCESS SETUP
// ============================================================================
function AdminSetupTab({ config, addToast }) {
  const [newAdmin, setNewAdmin] = useState('');

  const changeAdmin = async () => {
    if(!newAdmin) return;
    const h = await hashPassword(newAdmin);
    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_settings', 'system_config');
    await updateDoc(ref, { adminHash: h });
    setNewAdmin('');
    addToast("Adviser system passkey successfully updated.", "success");
  };

  return (
    <div className="space-y-8 font-sans">
      <div>
        <h2 className="text-3xl font-black text-[#16345f] mb-2">Access Credentials</h2>
        <p className="text-slate-500">Configure core passwords and local security keys.</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Lock className="w-5 h-5 text-[#c6b26c]"/> Adviser Security Passkey</h3>
        <div className="space-y-4">
          <div className="flex gap-4">
            <input type="password" placeholder="New Adviser Password" value={newAdmin} onChange={e=>setNewAdmin(e.target.value)} className="flex-1 p-3 border-2 border-slate-200 rounded-lg outline-none focus:border-[#16345f]" />
            <button onClick={changeAdmin} className="w-48 bg-slate-800 hover:bg-[#16345f] text-white font-bold py-3 px-6 rounded-lg transition text-xs">Update Passkey</button>
          </div>
        </div>
      </div>
    </div>
  );
}


