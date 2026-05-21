import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShieldAlert, ShieldCheck, Users, CheckCircle, Clock, 
  Settings, LogOut, QrCode, Lock, UserPlus, FileText, Activity, AlertCircle, ChevronRight, X, TrendingUp,
  Pencil, Trash2, ArrowRight, BarChart3, EyeOff, Eye
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, getDoc, getDocs, 
  onSnapshot, runTransaction, writeBatch, updateDoc, increment, deleteDoc 
} from 'firebase/firestore';

// --- FIREBASE INITIALIZATION ---
const defaultFirebaseConfig = {
  apiKey: "AIzaSyDeZzE7CnTar7ImNvVgcTAKmC5GztOlEd0",
  authDomain: "ccssc-voting-app.firebaseapp.com",
  projectId: "ccssc-voting-app",
  storageBucket: "ccssc-voting-app.firebasestorage.app",
  messagingSenderId: "404338605727",
  appId: "1:404338605727:web:1d30d962913a6832c56caa",
  measurementId: "G-0NCJ42D4SZ"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : defaultFirebaseConfig;

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ccssc-voting-system';

// --- UTILS & CONSTANTS ---
const POSITIONS = [
  "President", "Vice President", "Secretary", "Treasurer", 
  "Auditor", "Project Manager", "Grade Level Representative"
];

const POSITION_ORDER = {
  "President": 1,
  "Vice President": 2,
  "Secretary": 3,
  "Treasurer": 4,
  "Auditor": 5,
  "Project Manager": 6,
  "Grade Level Representative": 7
};

const getCouncilPositions = (council) => {
  const core = ["President", "Vice President", "Secretary", "Treasurer", "Auditor", "Project Manager"];
  if (council === 'JHS') {
    return [...core, "Grade 7 Representative", "Grade 8 Representative", "Grade 9 Representative", "Grade 10 Representative"];
  } else {
    return [...core, "Grade 11 Representative", "Grade 12 Representative"];
  }
};

const hashPassword = async (password) => {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

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

// --- MAIN APPLICATION COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); 
  const [clickCount, setClickCount] = useState(0);
  const [showHiddenNav, setShowHiddenNav] = useState(false);
  const [systemConfig, setSystemConfig] = useState(null);
  const [toasts, setToasts] = useState([]);

  const addToast = (msg, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
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
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
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
        const defaultElecom = await hashPassword('elecom2026');
        const initialConfig = {
          adminHash: defaultHash,
          elecomHash: defaultElecom,
          isFirstLogin: true,
          isElectionOpen: false,
          startTime: 0,
          endTime: 0,
          isTransmitting: false,
          transmissionStartTime: 0,
          isResultsPublic: false // Controls public tally board visibility
        };
        await setDoc(configRef, initialConfig);
        setSystemConfig(initialConfig);
      }
    }, (err) => console.error("Config onSnapshot error: ", err));

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (clickCount >= 5) {
      setShowHiddenNav(true);
      setClickCount(0);
    }
    const timer = setTimeout(() => setClickCount(0), 2000);
    return () => clearTimeout(timer);
  }, [clickCount]);

  const safeConfig = systemConfig || {
    isElectionOpen: false, startTime: 0, endTime: 0, isTransmitting: false, transmissionStartTime: 0, isResultsPublic: false, adminHash: '', elecomHash: ''
  };

  const isHome = view === 'home';
  const isKiosk = view === 'kiosk';

  return (
    <div className={`min-h-screen font-sans bg-white text-slate-900`}>
      <ToastContainer toasts={toasts} />
      
      {!isKiosk && (
        <header className={`${isHome ? 'bg-[#0f172a] border-none text-white' : 'bg-[#16345f] text-white'} p-4 md:px-8 flex items-center justify-between relative z-50 transition-colors`}>
          <div 
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={() => setClickCount(c => c + 1)}
          >
            <div className={`w-10 h-10 border border-[#c6b26c] rounded-lg flex items-center justify-center ${isHome ? 'bg-transparent' : 'bg-[#10274a]'}`}>
              <CheckCircle className="text-[#c6b26c] w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold tracking-wider leading-tight text-white">
                CCSSC <span className="text-[#c6b26c]">PUBLIC</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-bold tracking-widest">ELECTION SYSTEM 2026</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             {!isHome && (
               <button 
                 onClick={() => setView('home')}
                 className="text-sm font-medium text-slate-300 hover:text-white transition"
               >
                 Return Home
               </button>
             )}
          </div>
        </header>
      )}

      {showHiddenNav && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 border-t-4 border-[#c6b26c]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[#16345f]">System Access</h2>
              <button onClick={() => setShowHiddenNav(false)}><X className="text-slate-400 hover:text-red-500" /></button>
            </div>
            <div className="space-y-3">
              <button onClick={() => { setView('admin'); setShowHiddenNav(false); }} className="w-full text-left px-4 py-3 bg-slate-100 hover:bg-[#16345f] hover:text-white rounded-lg font-medium transition flex items-center gap-3">
                <ShieldAlert className="w-5 h-5" /> Admin Portal
              </button>
              <button onClick={() => { setView('registry'); setShowHiddenNav(false); }} className="w-full text-left px-4 py-3 bg-slate-100 hover:bg-[#16345f] hover:text-white rounded-lg font-medium transition flex items-center gap-3">
                <Users className="w-5 h-5" /> Voter Registry
              </button>
              <button onClick={() => { setView('kiosk'); setShowHiddenNav(false); }} className="w-full text-left px-4 py-3 bg-slate-100 hover:bg-[#16345f] hover:text-white rounded-lg font-medium transition flex items-center gap-3">
                <Lock className="w-5 h-5" /> Voting Kiosk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main rendering tree block (Loading screen removed, components load directly but wait gracefully for user config) */}
      <main className="w-full">
        {view === 'home' && <PublicDashboard config={safeConfig} user={user} />}
        {view === 'admin' && <AdminPortal config={safeConfig} addToast={addToast} user={user} />}
        {view === 'registry' && <RegistryPortal config={safeConfig} addToast={addToast} user={user} />}
        {view === 'kiosk' && <VotingKiosk config={safeConfig} addToast={addToast} user={user} />}
      </main>
    </div>
  );
}

// ============================================================================
// 1. PUBLIC DASHBOARD
// ============================================================================
function PublicDashboard({ config, user }) {
  const [candidates, setCandidates] = useState([]);
  const [votersCount, setVotersCount] = useState(0);
  const [displayVotes, setDisplayVotes] = useState({});

  useEffect(() => {
    if (!user) return;
    const fetchVoters = async () => {
      const vRef = collection(db, 'artifacts', appId, 'public', 'data', 'ccssc_voters');
      const snap = await getDocs(vRef);
      setVotersCount(snap.size);
    };
    fetchVoters();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const cRef = collection(db, 'artifacts', appId, 'public', 'data', 'ccssc_candidates');
    const unsub = onSnapshot(cRef, (snap) => {
      const c = [];
      snap.forEach(doc => c.push({ id: doc.id, ...doc.data() }));
      setCandidates(c);
    }, (err) => console.error("Candidates onSnapshot error: ", err));
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!config.isTransmitting) {
      const current = {};
      candidates.forEach(c => current[c.id] = c.voteCount || 0);
      setDisplayVotes(current);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - config.transmissionStartTime;
      const studentBallotsTransmitted = Math.floor(elapsed / 2000); 
      
      const newDisplay = {};
      let allDone = true;

      candidates.forEach(c => {
        const initial = c.initialVoteCount || 0;
        const target = c.targetVoteCount || 0;
        const diff = target - initial; 
        
        const revealedForCand = Math.min(studentBallotsTransmitted, diff);
        newDisplay[c.id] = initial + revealedForCand;

        if (revealedForCand < diff) {
          allDone = false; 
        }
      });

      setDisplayVotes(newDisplay);

      if (allDone && candidates.length > 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [config.isTransmitting, config.transmissionStartTime, candidates]);

  const totalTransmitted = candidates.reduce((sum, c) => sum + (displayVotes[c.id] || 0), 0);
  const estimatedVotersTurnout = Math.min(votersCount, Math.ceil(totalTransmitted / 7));
  const turnoutPercent = votersCount === 0 ? 0 : Math.round((estimatedVotersTurnout / votersCount) * 100);

  const renderCandidatesGroup = (council, virtualPosition) => {
    const positionCandidates = candidates.filter(c => {
      if (c.council !== council) return false;
      if (virtualPosition.startsWith("Grade ") && virtualPosition.endsWith(" Representative")) {
        const grade = parseInt(virtualPosition.split(" ")[1], 10);
        return c.position === "Grade Level Representative" && c.gradeLevel === grade;
      }
      return c.position === virtualPosition;
    });

    if (positionCandidates.length === 0) return null;

    const totalPosVotes = positionCandidates.reduce((sum, c) => sum + (displayVotes[c.id] || 0), 0);
    const sortedCandidates = [...positionCandidates].sort((a, b) => (displayVotes[b.id] || 0) - (displayVotes[a.id] || 0));
    const highestVotes = displayVotes[sortedCandidates[0]?.id] || 0;

    return (
      <div key={`${council}-${virtualPosition}`} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all duration-300">
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <h4 className="text-xl font-bold text-[#16345f] tracking-tight">{virtualPosition}</h4>
        </div>

        <div className="space-y-4">
          {sortedCandidates.map(c => {
            const votes = displayVotes[c.id] || 0;
            const isWinner = votes > 0 && votes === highestVotes;
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
                        <TrendingUp className="w-3 h-3 animate-bounce" /> LEADING
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
          <div className="inline-flex items-center gap-2 bg-red-950/40 text-red-400 border border-red-800/60 px-3 py-1 rounded-full text-xs font-bold tracking-widest mb-6 font-mono">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> LIVE COVERAGE
          </div>
          <h2 className="text-5xl md:text-7xl font-black tracking-tight mb-4 text-white">Official Tally Board</h2>
          <p className="text-slate-400 text-lg md:text-xl max-w-2xl leading-relaxed">
            Real-time election results synchronization. Showing all successfully transmitted and verified student ballots.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 -mt-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard icon={<Users className="w-6 h-6 text-[#60a5fa]"/>} title="REGISTERED VOTERS" value={votersCount.toLocaleString()} />
          <MetricCard icon={<CheckCircle className="w-6 h-6 text-[#34d399]"/>} title="TRANSMITTED BALLOTS" value={estimatedVotersTurnout.toLocaleString()} />
          <MetricCard title="VOTER TURNOUT" value={`${turnoutPercent}%`} progress={turnoutPercent} />
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
             <h3 className="text-3xl font-black text-[#16345f] mb-2">Tally Board Hidden</h3>
             <p className="text-slate-500 text-lg">The election commission has temporarily disabled public access to live results. Please wait for the official announcement for the confirmed outcome. </p>
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
            <div className="h-full bg-slate-300 transition-all duration-1000" style={{ width: `${progress}%` }} />
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
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-[#16345f] focus:outline-none transition-colors text-lg" autoFocus />
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
// 2. ADMIN PORTAL
// ============================================================================
function AdminPortal({ config, addToast, user }) {
  const [authOk, setAuthOk] = useState(false);
  const [tab, setTab] = useState('setup');
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  const isLockedOut = config.isElectionOpen && currentTime < config.endTime;

  if (!authOk) return <LoginScreen title="Admin Access" correctHash={config.adminHash} onLogin={() => setAuthOk(true)} />;
  if (config.isFirstLogin) return <AdminFirstSetup config={config} addToast={addToast} />;

  if (isLockedOut) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="bg-red-50 border-2 border-red-200 p-10 rounded-3xl max-w-2xl text-center shadow-2xl">
          <Lock className="w-20 h-20 text-red-500 mx-auto mb-6" />
          <h2 className="text-4xl font-black text-red-700 mb-4 uppercase">System Locked</h2>
          <p className="text-red-600/80 text-lg mb-8 font-medium">
            The election is currently open and ongoing. Administrative access is disabled to ensure voting session integrity. 
            Access unlocks automatically after the scheduled period ends.
          </p>
          <div className="bg-white rounded-xl p-4 inline-block font-mono font-bold text-slate-700 border border-slate-200 shadow-sm">
            Unlocks at: {new Date(config.endTime).toLocaleString()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-76px)] bg-slate-50">
      <aside className="w-64 bg-white border-r border-slate-200 shadow-sm z-10 flex flex-col">
        <div className="p-6">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Control Panel</h3>
          <nav className="space-y-2">
            <AdminTab id="setup" icon={<Settings/>} label="Election Setup" current={tab} setTab={setTab} />
            <AdminTab id="candidates" icon={<Users/>} label="Candidates" current={tab} setTab={setTab} />
            <AdminTab id="voters" icon={<FileText/>} label="Voter Registry" current={tab} setTab={setTab} />
            <AdminTab id="transmit" icon={<Activity/>} label="Transmission" current={tab} setTab={setTab} />
            <AdminTab id="results" icon={<BarChart3/>} label="Live Results" current={tab} setTab={setTab} />
          </nav>
        </div>
        <div className="mt-auto p-6">
          <button onClick={() => setAuthOk(false)} className="flex items-center gap-2 text-slate-400 hover:text-red-500 transition font-medium w-full px-4 py-2 rounded-lg hover:bg-slate-50">
            <LogOut className="w-4 h-4" /> Lock Terminal
          </button>
        </div>
      </aside>

      <main className="flex-1 p-10 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {tab === 'setup' && <AdminSetupTab config={config} addToast={addToast} />}
          {tab === 'candidates' && <AdminCandidatesTab addToast={addToast} user={user} />}
          {tab === 'voters' && <AdminVotersTab user={user} addToast={addToast} />}
          {tab === 'transmit' && <AdminTransmitTab config={config} addToast={addToast} user={user} />}
          {tab === 'results' && <AdminResultsTab user={user} />}
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

// ----------------------------------------------------------------------------
// NEW ADMIN RESULTS TAB
// ----------------------------------------------------------------------------
function AdminResultsTab({ user }) {
  const [candidates, setCandidates] = useState([]);
  const [votersCount, setVotersCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const vRef = collection(db, 'artifacts', appId, 'public', 'data', 'ccssc_voters');
    getDocs(vRef).then(snap => setVotersCount(snap.size)).catch(e => console.error(e));
    
    const cRef = collection(db, 'artifacts', appId, 'public', 'data', 'ccssc_candidates');
    const unsub = onSnapshot(cRef, snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      // Sort immediately by vote count descending
      arr.sort((a,b) => (b.voteCount || 0) - (a.voteCount || 0));
      setCandidates(arr);
    }, err => console.error(err));
    return () => unsub();
  }, [user]);

  const totalTransmittedVotes = candidates.reduce((sum, c) => sum + (c.voteCount || 0), 0);
  const transmittedBallots = Math.min(votersCount, Math.ceil(totalTransmittedVotes / 7));
  const turnout = votersCount === 0 ? 0 : Math.round((transmittedBallots / votersCount) * 100);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-black text-[#16345f] mb-2">Live Election Results</h2>
        <p className="text-slate-500">Internal view of transmitted votes.</p>
      </div>
      
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
           <div className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">Registered Voters</div>
           <div className="text-4xl font-black text-[#16345f]">{votersCount.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
           <div className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">Transmitted Ballots</div>
           <div className="text-4xl font-black text-[#16345f]">{transmittedBallots.toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
           <div className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">Voter Turnout</div>
           <div className="text-4xl font-black text-[#16345f]">{turnout}%</div>
        </div>
      </div>

      {/* Simpler List Layout for Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
         
         {/* JHS Results Table */}
         <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-[#16345f] text-white px-5 py-4 font-black tracking-widest uppercase">JHS Results</div>
            <div className="p-0">
              {getCouncilPositions('JHS').map(pos => {
                const cands = candidates.filter(c => c.council === 'JHS' && (c.position === pos || (pos.includes('Grade') && c.position === 'Grade Level Representative' && pos.includes(c.gradeLevel))));
                if(cands.length===0) return null;
                return (
                  <div key={pos} className="border-b border-slate-100 last:border-0 p-5">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{pos}</h4>
                    <div className="space-y-2.5">
                      {cands.map(c => (
                        <div key={c.id} className="flex justify-between items-center group">
                          <div>
                             <span className="font-bold text-[#16345f] text-sm group-hover:text-blue-600 transition-colors">{c.lastName}, {c.firstName}</span>
                             <span className="text-[10px] text-slate-400 ml-2 font-mono uppercase">{c.partyList || 'IND'}</span>
                          </div>
                          <span className="font-mono font-black text-lg bg-slate-50 border border-slate-100 px-3 py-1 rounded-lg text-[#16345f] min-w-[3rem] text-center">{c.voteCount || 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
         </div>
         
         {/* SHS Results Table */}
         <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-[#16345f] text-white px-5 py-4 font-black tracking-widest uppercase">SHS Results</div>
            <div className="p-0">
              {getCouncilPositions('SHS').map(pos => {
                const cands = candidates.filter(c => c.council === 'SHS' && (c.position === pos || (pos.includes('Grade') && c.position === 'Grade Level Representative' && pos.includes(c.gradeLevel))));
                if(cands.length===0) return null;
                return (
                  <div key={pos} className="border-b border-slate-100 last:border-0 p-5">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{pos}</h4>
                    <div className="space-y-2.5">
                      {cands.map(c => (
                        <div key={c.id} className="flex justify-between items-center group">
                          <div>
                             <span className="font-bold text-[#16345f] text-sm group-hover:text-blue-600 transition-colors">{c.lastName}, {c.firstName}</span>
                             <span className="text-[10px] text-slate-400 ml-2 font-mono uppercase">{c.partyList || 'IND'}</span>
                          </div>
                          <span className="font-mono font-black text-lg bg-slate-50 border border-slate-100 px-3 py-1 rounded-lg text-[#16345f] min-w-[3rem] text-center">{c.voteCount || 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
         </div>

      </div>
    </div>
  );
}

function AdminFirstSetup({ config, addToast }) {
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(pass1 !== pass2) return addToast("Passwords do not match.", "error");
    if(pass1.length < 6) return addToast("Password too short.", "error");
    
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
        <p className="text-center text-slate-500 mb-8 text-sm">Please secure the administrative account by changing the default password.</p>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">New Admin Password</label>
            <input type="password" value={pass1} onChange={e=>setPass1(e.target.value)} required className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-[#16345f] outline-none font-medium" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Confirm Password</label>
            <input type="password" value={pass2} onChange={e=>setPass2(e.target.value)} required className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-[#16345f] outline-none font-medium" />
          </div>
          <button disabled={loading} type="submit" className="w-full bg-[#16345f] text-white font-bold py-4 rounded-lg hover:bg-[#0b1a30] transition mt-6">
            {loading ? 'Securing System...' : 'Update Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminSetupTab({ config, addToast }) {
  const formatDateTimeLocal = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [newElecom, setNewElecom] = useState('');
  const [newAdmin, setNewAdmin] = useState('');

  useEffect(() => {
    if (config.startTime) setStart(formatDateTimeLocal(config.startTime));
    if (config.endTime) setEnd(formatDateTimeLocal(config.endTime));
  }, [config.startTime, config.endTime]);
  
  const updateSchedule = async () => {
    if(!start || !end) return addToast("Select both start and end times.", "error");
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    if(startMs >= endMs) return addToast("End time must be after start time.", "error");

    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_settings', 'system_config');
    await updateDoc(ref, { startTime: startMs, endTime: endMs });
    addToast("Voting schedule updated securely.", "success");
  };

  const toggleElection = async () => {
    if(!config.startTime || !config.endTime) return addToast("Please set and save a schedule first.", "error");
    
    if(!config.isElectionOpen) {
       if(Date.now() >= config.endTime) return addToast("Cannot open election. The scheduled end time has already passed.", "error");
       
       const ref = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_settings', 'system_config');
       await updateDoc(ref, { isElectionOpen: true });
       addToast("Election officially opened. Access lock engaged.", "success");
    } else {
       const ref = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_settings', 'system_config');
       await updateDoc(ref, { isElectionOpen: false });
       addToast("Election officially closed.", "success");
    }
  };

  const changeElecom = async () => {
    if(!newElecom) return;
    const h = await hashPassword(newElecom);
    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_settings', 'system_config');
    await updateDoc(ref, { elecomHash: h });
    setNewElecom('');
    addToast("ELECOM Passkey successfully updated.", "success");
  };

  const changeAdmin = async () => {
    if(!newAdmin) return;
    const h = await hashPassword(newAdmin);
    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_settings', 'system_config');
    await updateDoc(ref, { adminHash: h });
    setNewAdmin('');
    addToast("Admin Password successfully updated.", "success");
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-black text-[#16345f] mb-2">Election Setup</h2>
        <p className="text-slate-500">Configure election timing and system access keys.</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-[#c6b26c]"/> Voting Schedule</h3>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Start Time</label>
            <input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} className="w-full p-3 border-2 border-slate-200 rounded-lg outline-none focus:border-[#16345f]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">End Time</label>
            <input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)} className="w-full p-3 border-2 border-slate-200 rounded-lg outline-none focus:border-[#16345f]" />
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={updateSchedule} className="bg-slate-100 hover:bg-slate-200 text-[#16345f] font-bold py-3 px-6 rounded-lg transition">Save Schedule</button>
          <button 
            onClick={toggleElection}
            className={`font-bold py-3 px-6 rounded-lg transition ${config.isElectionOpen ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-[#16345f] text-white hover:bg-[#0b1a30]'}`}
          >
            {config.isElectionOpen ? 'Close Election' : 'Open Election'}
          </button>
        </div>
        {config.isElectionOpen && (
           <p className="text-xs text-red-600 mt-4 font-medium flex items-center gap-1">
             <AlertCircle className="w-4 h-4"/> Election is currently marked OPEN. The portal will lock if the current time reaches the start schedule.
           </p>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Lock className="w-5 h-5 text-[#c6b26c]"/> Change System Passkeys</h3>
        <div className="space-y-4">
          <div className="flex gap-4">
            <input type="password" placeholder="New ELECOM Passkey" value={newElecom} onChange={e=>setNewElecom(e.target.value)} className="flex-1 p-3 border-2 border-slate-200 rounded-lg outline-none focus:border-[#16345f]" />
            <button onClick={changeElecom} className="w-48 bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-6 rounded-lg transition">Update ELECOM</button>
          </div>
          <div className="flex gap-4">
            <input type="password" placeholder="New Admin Password" value={newAdmin} onChange={e=>setNewAdmin(e.target.value)} className="flex-1 p-3 border-2 border-slate-200 rounded-lg outline-none focus:border-[#16345f]" />
            <button onClick={changeAdmin} className="w-48 bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-6 rounded-lg transition">Update Admin</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminCandidatesTab({ addToast, user }) {
  const [candidates, setCandidates] = useState([]);
  const [editId, setEditId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  
  const [form, setForm] = useState({ firstName: '', middleName: '', lastName: '', position: 'President', council: 'JHS', gradeLevel: '', partyList: '' });

  useEffect(() => {
    if (!user) return;
    const cRef = collection(db, 'artifacts', appId, 'public', 'data', 'ccssc_candidates');
    const unsub = onSnapshot(cRef, snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      setCandidates(arr);
    }, (err) => console.error("Candidates onSnapshot error: ", err));
    return () => unsub();
  }, [user]);

  const handleAddOrUpdate = async (e) => {
    e.preventDefault();
    const newCand = {
      firstName: form.firstName,
      middleName: form.middleName,
      lastName: form.lastName,
      position: form.position,
      council: form.council,
      gradeLevel: form.position === 'Grade Level Representative' ? Number(form.gradeLevel) : null,
      partyList: form.partyList
    };

    if (editId) {
      const cRef = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_candidates', editId);
      await updateDoc(cRef, newCand);
      addToast("Candidate successfully updated.", "success");
      setEditId(null);
    } else {
      newCand.voteCount = 0;
      newCand.pendingVotes = 0;
      newCand.initialVoteCount = 0;
      newCand.targetVoteCount = 0;
      const cRef = collection(db, 'artifacts', appId, 'public', 'data', 'ccssc_candidates');
      await setDoc(doc(cRef, crypto.randomUUID()), newCand);
      addToast("Candidate successfully added.", "success");
    }
    
    setForm({ firstName: '', middleName: '', lastName: '', position: 'President', council: 'JHS', gradeLevel: '', partyList: '' });
  };

  const handleEdit = (candidate) => {
    setForm({
      firstName: candidate.firstName || '',
      middleName: candidate.middleName || '',
      lastName: candidate.lastName || '',
      position: candidate.position || 'President',
      council: candidate.council || 'JHS',
      gradeLevel: candidate.gradeLevel || '',
      partyList: candidate.partyList || ''
    });
    setEditId(candidate.id);
  };

  const executeDelete = async (id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_candidates', id));
    addToast("Candidate successfully removed.", "success");
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm({ firstName: '', middleName: '', lastName: '', position: 'President', council: 'JHS', gradeLevel: '', partyList: '' });
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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-black text-[#16345f] mb-2">Candidate Management</h2>
        <p className="text-slate-500">Add, edit, or remove official candidates. All names are forced to uppercase.</p>
      </div>

      <form onSubmit={handleAddOrUpdate} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <h3 className="font-bold text-[#16345f] border-b pb-2 border-slate-100">{editId ? 'Editing Candidate Details' : 'Register New Candidate'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">First Name</label>
            <input required type="text" value={form.firstName} onChange={e=>setForm({...form, firstName: e.target.value.toUpperCase()})} className="w-full p-3 border-2 border-slate-200 rounded-lg outline-none focus:border-[#16345f] font-medium" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Middle Name (Optional)</label>
            <input type="text" value={form.middleName} onChange={e=>setForm({...form, middleName: e.target.value.toUpperCase()})} className="w-full p-3 border-2 border-slate-200 rounded-lg outline-none focus:border-[#16345f] font-medium" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Last Name</label>
            <input required type="text" value={form.lastName} onChange={e=>setForm({...form, lastName: e.target.value.toUpperCase()})} className="w-full p-3 border-2 border-slate-200 rounded-lg outline-none focus:border-[#16345f] font-medium" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Council</label>
            <select value={form.council} onChange={e=>setForm({...form, council: e.target.value})} className="w-full p-3 border-2 border-slate-200 rounded-lg outline-none focus:border-[#16345f] font-medium">
              <option value="JHS">JHS (7-10)</option>
              <option value="SHS">SHS (11-12)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Position</label>
            <select value={form.position} onChange={e=>setForm({...form, position: e.target.value})} className="w-full p-3 border-2 border-slate-200 rounded-lg outline-none focus:border-[#16345f] font-medium">
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {form.position === 'Grade Level Representative' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Grade Level</label>
              <input required type="number" min="7" max="12" value={form.gradeLevel} onChange={e=>setForm({...form, gradeLevel: e.target.value})} className="w-full p-3 border-2 border-slate-200 rounded-lg outline-none focus:border-[#16345f] font-medium" />
            </div>
          )}
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Party List</label>
            <input type="text" value={form.partyList} onChange={e=>setForm({...form, partyList: e.target.value.toUpperCase()})} placeholder="e.g. INDEPENDENT" className="w-full p-3 border-2 border-slate-200 rounded-lg outline-none focus:border-[#16345f] font-medium" />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4">
          <button type="submit" className="bg-[#16345f] text-white font-bold py-3 px-6 rounded-lg hover:bg-[#0b1a30] transition flex items-center gap-2">
            <UserPlus className="w-5 h-5" /> {editId ? 'Save Changes' : 'Add Candidate'}
          </button>
          {editId && (
            <button type="button" onClick={cancelEdit} className="bg-slate-200 text-slate-600 font-bold py-3 px-6 rounded-lg hover:bg-slate-300 transition">
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      {/* --- SEPARATE DIV FOR JHS CANDIDATES --- */}
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
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="p-4 font-bold text-[#16345f]">{c.lastName}, {c.firstName} {c.middleName}</td>
                <td className="p-4 text-sm"><span className="bg-slate-200 px-2 py-1 rounded text-xs font-bold mr-2">{c.position}</span>{c.gradeLevel ? `(Gr. ${c.gradeLevel})` : ''}</td>
                <td className="p-4 text-sm font-mono">{c.partyList || 'IND'}</td>
                <td className="p-4 text-right">
                  {confirmDeleteId === c.id ? (
                    <div className="inline-flex items-center gap-2">
                      <button onClick={() => executeDelete(c.id)} className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 py-1.5 rounded transition">Confirm</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="bg-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded transition">Cancel</button>
                    </div>
                  ) : (
                    <div className="inline-flex justify-end gap-2">
                      <button onClick={() => handleEdit(c)} className="p-2 text-slate-400 hover:text-[#16345f] hover:bg-slate-100 rounded-lg transition" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setConfirmDeleteId(c.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {jhsCandidates.length === 0 && (
              <tr>
                <td colSpan="4" className="text-center py-6 text-slate-400 font-medium text-sm">No JHS candidates found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- SEPARATE DIV FOR SHS CANDIDATES --- */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-[#16345f] px-6 py-4">
          <h3 className="font-extrabold text-white text-lg">Senior High School Candidates</h3>
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
            {shsCandidates.map(c => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="p-4 font-bold text-[#16345f]">{c.lastName}, {c.firstName} {c.middleName}</td>
                <td className="p-4 text-sm"><span className="bg-slate-200 px-2 py-1 rounded text-xs font-bold mr-2">{c.position}</span>{c.gradeLevel ? `(Gr. ${c.gradeLevel})` : ''}</td>
                <td className="p-4 text-sm font-mono">{c.partyList || 'IND'}</td>
                <td className="p-4 text-right">
                  {confirmDeleteId === c.id ? (
                    <div className="inline-flex items-center gap-2">
                      <button onClick={() => executeDelete(c.id)} className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 py-1.5 rounded transition">Confirm</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="bg-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded transition">Cancel</button>
                    </div>
                  ) : (
                    <div className="inline-flex justify-end gap-2">
                      <button onClick={() => handleEdit(c)} className="p-2 text-slate-400 hover:text-[#16345f] hover:bg-slate-100 rounded-lg transition" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setConfirmDeleteId(c.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {shsCandidates.length === 0 && (
              <tr>
                <td colSpan="4" className="text-center py-6 text-slate-400 font-medium text-sm">No SHS candidates found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminVotersTab({ user, addToast }) {
  const [voters, setVoters] = useState([]);
  const [search, setSearch] = useState('');
  
  // Edit and Delete State
  const [editVoterId, setEditVoterId] = useState(null);
  const [editForm, setEditForm] = useState({ id: '', grade: 7, hasVoted: false });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    if (!user) return;
    const vRef = collection(db, 'artifacts', appId, 'public', 'data', 'ccssc_voters');
    const unsub = onSnapshot(vRef, snap => {
      const arr = [];
      snap.forEach(d => arr.push(d.data()));
      setVoters(arr);
    }, (err) => console.error("Voters onSnapshot error: ", err));
    return () => unsub();
  }, [user]);

  const filtered = voters.filter(v => v.id.includes(search.toUpperCase()));

  const groupedByGrade = filtered.reduce((acc, v) => {
    acc[v.grade] = acc[v.grade] || [];
    acc[v.grade].push(v);
    return acc;
  }, {});

  // Edit Voter Handlers
  const handleEdit = (v) => {
    setEditVoterId(v.id);
    setEditForm({ id: v.id, grade: v.grade, hasVoted: v.hasVoted });
  };

  const saveEdit = async (oldId) => {
    try {
      const isNowVoted = String(editForm.hasVoted) === 'true';
      
      if (editForm.id.toUpperCase() !== oldId) {
        // If ID changed, verify it doesn't already exist to prevent overwrites
        const newRef = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_voters', editForm.id.toUpperCase());
        const newSnap = await getDoc(newRef);
        if (newSnap.exists()) {
          addToast("A voter with that ID already exists.", "error");
          return;
        }
        
        // Recreate Document with new ID
        const oldRef = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_voters', oldId);
        const oldSnap = await getDoc(oldRef);
        
        await setDoc(newRef, {
          ...oldSnap.data(),
          id: editForm.id.toUpperCase(),
          grade: Number(editForm.grade),
          hasVoted: isNowVoted
        });
        await deleteDoc(oldRef);
      } else {
        // Just update existing document
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_voters', oldId);
        await updateDoc(docRef, {
          grade: Number(editForm.grade),
          hasVoted: isNowVoted
        });
      }
      addToast("Voter successfully updated.", "success");
      setEditVoterId(null);
    } catch (err) {
      addToast("Error updating voter: " + err.message, "error");
    }
  };

  const executeDelete = async (id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_voters', id));
    addToast("Voter successfully removed.", "success");
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => setEditVoterId(null);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-[#16345f] mb-2">Voter Registry</h2>
          <p className="text-slate-500">Monitor registered students, edit records, and voting status.</p>
        </div>
        <div className="w-64">
          <input type="text" placeholder="Search ID..." value={search} onChange={e=>setSearch(e.target.value)} className="w-full p-3 border-2 border-slate-200 rounded-lg outline-none focus:border-[#16345f] text-sm font-medium uppercase" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        {[7, 8, 9, 10, 11, 12].map(g => (
          <div key={g} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center">
            <div className="text-xs font-bold text-slate-400 uppercase">Grade {g}</div>
            <div className="text-2xl font-black text-[#16345f]">
              {voters.filter(v => v.grade === g).length}
            </div>
          </div>
        ))}
      </div>

      {Object.keys(groupedByGrade).sort((a,b)=>a-b).map(grade => (
        <div key={grade} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-[#16345f] text-white px-4 py-3 font-bold tracking-widest text-sm flex justify-between items-center">
            <span>GRADE {grade}</span>
            <span className="bg-[#10274a] px-3 py-1 rounded-full text-xs">{groupedByGrade[grade].length} Registered</span>
          </div>
          <div className="p-4 flex flex-col gap-3 max-h-[500px] overflow-y-auto">
            {groupedByGrade[grade].map(v => (
              <div key={v.id} className="border border-slate-200 p-4 rounded-lg flex justify-between items-center bg-slate-50 hover:bg-slate-100 transition w-full">
                
                {editVoterId === v.id ? (
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 items-center mr-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Student ID</label>
                      <input type="text" value={editForm.id} onChange={e=>setEditForm({...editForm, id: e.target.value.toUpperCase()})} className="w-full p-2 border-2 border-slate-200 rounded outline-none focus:border-[#16345f] font-mono text-sm uppercase" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Grade</label>
                      <select value={editForm.grade} onChange={e=>setEditForm({...editForm, grade: e.target.value})} className="w-full p-2 border-2 border-slate-200 rounded outline-none focus:border-[#16345f] text-sm">
                        {[7,8,9,10,11,12].map(g => <option key={g} value={g}>Grade {g}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</label>
                      <select value={editForm.hasVoted} onChange={e=>setEditForm({...editForm, hasVoted: e.target.value})} className="w-full p-2 border-2 border-slate-200 rounded outline-none focus:border-[#16345f] text-sm">
                        <option value={true}>Voted</option>
                        <option value={false}>Pending</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-bold text-[#16345f] text-lg">Student ID: {v.id}</div>
                      <div className="text-sm text-slate-500 font-mono">Registered On: {new Date(v.registeredAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  {editVoterId === v.id ? (
                    <div className="flex gap-2">
                       <button onClick={() => saveEdit(v.id)} className="bg-emerald-600 text-white p-2.5 rounded-lg hover:bg-emerald-700 transition shadow-sm" title="Save">
                         <CheckCircle className="w-4 h-4" />
                       </button>
                       <button onClick={cancelEdit} className="bg-slate-300 text-slate-700 p-2.5 rounded-lg hover:bg-slate-400 transition" title="Cancel">
                         <X className="w-4 h-4" />
                       </button>
                    </div>
                  ) : confirmDeleteId === v.id ? (
                    <div className="flex items-center gap-2">
                       <button onClick={() => executeDelete(v.id)} className="bg-red-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-red-700 transition shadow-sm">Confirm</button>
                       <button onClick={() => setConfirmDeleteId(null)} className="bg-slate-300 text-slate-700 text-xs font-bold px-3 py-2 rounded-lg hover:bg-slate-400 transition">Cancel</button>
                    </div>
                  ) : (
                    <>
                      {v.hasVoted ? (
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 mr-2"><CheckCircle className="w-4 h-4"/> Voted</span>
                      ) : (
                        <span className="bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 mr-2"><Clock className="w-4 h-4"/> Pending</span>
                      )}
                      <button onClick={() => handleEdit(v)} className="p-2 text-slate-400 hover:text-[#16345f] hover:bg-slate-200 rounded-lg transition" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setConfirmDeleteId(v.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>

              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

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
    }, (err) => console.error("Candidates onSnapshot error: ", err));
    return () => unsub();
  }, [user]);

  const totalPending = candidates.reduce((sum, c) => sum + (c.pendingVotes || 0), 0);

  const handleTransmit = async () => {
    if(totalPending === 0) return addToast("No pending votes to transmit.", "error");

    const batch = writeBatch(db);
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_settings', 'system_config');
    batch.update(configRef, {
      isTransmitting: true,
      transmissionStartTime: Date.now()
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
    addToast("Vote transmission successfully initialized.", "success");
  };

  const togglePublicResults = async () => {
    try {
      const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_settings', 'system_config');
      await updateDoc(configRef, { isResultsPublic: !config.isResultsPublic });
      addToast(config.isResultsPublic ? "Results hidden from public tally board." : "Results successfully made public.", "success");
    } catch (e) {
      addToast("Failed to update visibility.", "error");
    }
  };

  const handleReset = async () => {
    if(resetCode !== 'RESET') {
       return addToast("Invalid reset code.", "error");
    }
    
    try {
      const batch = writeBatch(db);
      
      const cSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'ccssc_candidates'));
      cSnap.forEach(cDoc => {
        batch.delete(cDoc.ref);
      });

      const vSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'ccssc_voters'));
      vSnap.forEach(vDoc => {
        batch.delete(vDoc.ref);
      });

      const defaultAdminHash = await hashPassword('admin2026');
      const defaultElecomHash = await hashPassword('elecom2026');

      const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_settings', 'system_config');
      batch.update(configRef, {
        adminHash: defaultAdminHash,
        elecomHash: defaultElecomHash,
        isFirstLogin: true,
        isTransmitting: false,
        isElectionOpen: false,
        startTime: 0,
        endTime: 0,
        transmissionStartTime: 0,
        isResultsPublic: false
      });

      await batch.commit();
      setShowReset(false);
      setResetCode('');
      addToast("Full Factory Reset Complete. System returning to initial setup.", "success");
    } catch (err) {
      console.error("Reset error: ", err);
      addToast("Failed to perform factory reset: " + err.message, "error");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-black text-[#16345f] mb-2">Transmission Controls</h2>
        <p className="text-slate-500">Push offline kiosk votes to the public live tally board.</p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
        <Activity className="w-16 h-16 text-[#c6b26c] mx-auto mb-4" />
        <div className="text-6xl font-black text-[#16345f] mb-2 font-mono">{totalPending.toLocaleString()}</div>
        <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8">Pending Votes to Transmit</div>

        {!confirmTransmit ? (
          <button 
            onClick={() => setConfirmTransmit(true)}
            disabled={totalPending === 0 || config.isTransmitting}
            className={`w-full max-w-md mx-auto block py-4 rounded-xl font-bold uppercase tracking-widest transition-all ${
              totalPending > 0 && !config.isTransmitting 
                ? 'bg-[#16345f] text-white hover:bg-[#0b1a30] shadow-xl hover:-translate-y-1' 
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {config.isTransmitting ? 'Transmission in Progress...' : 'Initialize Transmission'}
          </button>
        ) : (
          <div className="flex gap-4 justify-center max-w-md mx-auto">
            <button onClick={handleTransmit} className="flex-1 bg-emerald-600 text-white font-bold py-4 rounded-xl uppercase tracking-widest shadow-lg hover:bg-emerald-700">Confirm</button>
            <button onClick={() => setConfirmTransmit(false)} className="flex-1 bg-slate-200 text-slate-700 font-bold py-4 rounded-xl uppercase tracking-widest hover:bg-slate-300">Cancel</button>
          </div>
        )}
      </div>

      {/* New Public Results Toggle */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h4 className="font-bold text-[#16345f]">Public Tally Board Visibility</h4>
          <p className="text-sm text-slate-500">Allow visitors to view the real-time vote results on the Home Page.</p>
        </div>
        <button 
          onClick={togglePublicResults}
          className={`px-6 py-3 rounded-lg font-bold shadow-sm transition whitespace-nowrap flex items-center gap-2 ${
            config.isResultsPublic 
              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-300' 
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300 border border-slate-300'
          }`}
        >
          {config.isResultsPublic ? <><Eye className="w-4 h-4"/> Public</> : <><EyeOff className="w-4 h-4"/> Hidden</>}
        </button>
      </div>

      <div className="bg-red-50 p-6 rounded-xl border border-red-200 mt-12 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h4 className="font-bold text-red-700">Danger Zone: Full Factory Reset</h4>
          <p className="text-sm text-red-600/80">Permanently erase all candidates, registered voters, votes, and active election sessions.</p>
        </div>
        
        {!showReset ? (
          <button onClick={() => setShowReset(true)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg shadow-sm transition whitespace-nowrap">
            Factory Reset
          </button>
        ) : (
          <div className="flex gap-2">
            <input 
              type="text" placeholder="Type RESET" value={resetCode} onChange={(e)=>setResetCode(e.target.value)}
              className="px-4 py-2 border border-red-300 rounded-lg outline-none focus:border-red-500 font-bold w-32"
            />
            <button onClick={handleReset} className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-lg">Verify</button>
            <button onClick={() => setShowReset(false)} className="bg-red-200 text-red-800 font-bold px-4 py-2 rounded-lg">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}


// ============================================================================
// 3. REGISTRY PORTAL
// ============================================================================
function RegistryPortal({ config, addToast, user }) {
  const [authOk, setAuthOk] = useState(false);
  const [form, setForm] = useState({ id: '', grade: '7' });
  const [scanning, setScanning] = useState(false);
  const lastScanned = useRef('');

  // Native Web Audio API Beep Generator 
  const playBeep = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.15); // Beep for 150ms
    } catch(e) {
      console.warn("Audio feedback not supported.");
    }
  };

  useEffect(() => {
    if(authOk && scanning) {
      if(!document.getElementById('html5-qrcode-script')) {
        const script = document.createElement('script');
        script.id = 'html5-qrcode-script';
        script.src = 'https://unpkg.com/html5-qrcode';
        script.onload = () => initScanner();
        document.head.appendChild(script);
      } else {
        initScanner();
      }
    }
    return () => {
      if(window.html5QrcodeScanner) {
        window.html5QrcodeScanner.clear().catch(e=>console.error(e));
        window.html5QrcodeScanner = null;
      }
    }
  }, [authOk, scanning]);

  const initScanner = () => {
    if(window.Html5QrcodeScanner) {
      const scanner = new window.Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
      scanner.render((text) => {
        const scannedId = text.toUpperCase();
        
        // Continuous scan logic: Only trigger if the QR code is different from the very last one read
        if (lastScanned.current !== scannedId) {
          lastScanned.current = scannedId;
          playBeep(); // Trigger audible feedback
          setForm(prev => ({...prev, id: scannedId}));
          // NOTE: We no longer call scanner.clear() or setScanning(false) so it stays completely open
        }
      }, (err) => {});
      window.html5QrcodeScanner = scanner;
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!user) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_voters', form.id);
    const snap = await getDoc(docRef);
    if(snap.exists()) {
      return addToast("Student ID already registered in the system.", "error");
    }
    await setDoc(docRef, {
      id: form.id,
      grade: Number(form.grade),
      hasVoted: false,
      registeredAt: Date.now()
    });
    addToast("Voter registered successfully.", "success");
    
    // Clear current form ID, AND clear the ref so they can scan the exact same ID again if they want to
    lastScanned.current = '';
    setForm(prev => ({ ...prev, id: '' }));
  };

  if (!authOk) return <LoginScreen title="ELECOM Registry" correctHash={config.elecomHash} onLogin={() => setAuthOk(true)} />;

  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl border-t-8 border-[#c6b26c]">
        <div className="flex items-center gap-4 mb-8 border-b border-slate-100 pb-6">
          <div className="bg-[#16345f] p-3 rounded-xl text-[#c6b26c]">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#16345f] uppercase tracking-widest">Voter Registration</h2>
            <p className="text-slate-500 text-sm">Add students to the official electoral roll.</p>
          </div>
        </div>

        {scanning ? (
          <div className="mb-6">
            <div id="reader" className="w-full bg-slate-100 rounded-lg overflow-hidden border border-slate-200"></div>
            <button onClick={() => setScanning(false)} className="w-full mt-2 text-red-500 font-bold text-sm py-2">Close Scanner</button>
            <p className="text-xs text-center text-slate-400 mt-2">Scanner stays open automatically. Beep indicates successful scan.</p>
          </div>
        ) : (
          <button onClick={() => setScanning(true)} className="w-full mb-6 py-4 rounded-xl border-2 border-dashed border-[#16345f] text-[#16345f] hover:bg-slate-50 font-bold flex justify-center items-center gap-2 transition">
            <QrCode className="w-5 h-5" />OPEN QR SCANNER
          </button>
        )}

        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Student ID No.</label>
            <input required type="text" value={form.id} onChange={e=>setForm({...form, id: e.target.value.toUpperCase()})} className="w-full p-4 text-lg border-2 border-slate-200 rounded-xl outline-none focus:border-[#16345f] font-mono font-bold text-[#16345f]" placeholder="e.g. 2023-1029" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Grade Level</label>
            <select value={form.grade} onChange={e=>setForm({...form, grade: e.target.value})} className="w-full p-4 border-2 border-slate-200 rounded-xl outline-none focus:border-[#16345f] font-bold">
              {[7,8,9,10,11,12].map(g => <option key={g} value={g}>Grade {g}</option>)}
            </select>
          </div>
          <button type="submit" className="w-full bg-[#16345f] hover:bg-[#0b1a30] text-white font-bold py-4 rounded-xl transition uppercase tracking-widest mt-4">
            Register Voter
          </button>
        </form>
      </div>
    </div>
  );
}


// ============================================================================
// 4. VOTING KIOSK
// ============================================================================
function VotingKiosk({ config, addToast, user }) {
  const [authOk, setAuthOk] = useState(false);
  const [step, setStep] = useState(1);
  const [voterData, setVoterData] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selections, setSelections] = useState({}); 
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    const cRef = collection(db, 'artifacts', appId, 'public', 'data', 'ccssc_candidates');
    const unsub = onSnapshot(cRef, snap => {
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      setCandidates(arr);
    }, (err) => console.error("Candidates onSnapshot error: ", err));
    return () => unsub();
  }, [user]);

  const isTimeValid = config.isElectionOpen && currentTime >= config.startTime && currentTime <= config.endTime;

  const getCountdownString = () => {
    const diff = config.startTime - currentTime;
    if (diff <= 0) return '';
    const hrs = String(Math.floor(diff / (3600 * 1000))).padStart(2, '0');
    const mins = String(Math.floor((diff % (3600 * 1000)) / (60 * 1000))).padStart(2, '0');
    const secs = String(Math.floor((diff % (60 * 1000)) / 1000)).padStart(2, '0');
    return `${hrs}h ${mins}m ${secs}s`;
  };

  if (!authOk) {
    if (!isTimeValid) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white p-6">
          <div className="text-center bg-[#1e293b] p-6 rounded-2xl border border-slate-700 max-w-sm w-full shadow-xl">
            <Lock className="w-8 h-8 text-[#c6b26c] mx-auto mb-3" />
            <h1 className="text-lg font-extrabold mb-1 tracking-tight">Kiosk Locked</h1>
            <p className="text-slate-400 text-[11px] mb-3">Polling window is unavailable.</p>
            {config.isElectionOpen && config.startTime > currentTime ? (
              <div className="bg-[#16345f]/50 py-1.5 px-3 rounded-lg border border-[#c6b26c]/20 inline-block font-mono text-[10px] font-black text-[#c6b26c]">
                Voting opens in: {getCountdownString()}
              </div>
            ) : (
              <span className="text-[9px] text-red-400 font-bold uppercase tracking-widest">Election Inactive</span>
            )}
          </div>
        </div>
      );
    }
    return <LoginScreen title="Unlock Voting Terminal" correctHash={config.elecomHash} onLogin={() => setAuthOk(true)} />;
  }

  const handleVoterAuth = async (id, grade) => {
    if (!user) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_voters', id);
    const snap = await getDoc(docRef);
    if(!snap.exists()) throw new Error("Voter not found in registry.");
    
    const v = snap.data();
    if(v.grade !== Number(grade)) throw new Error("Details mismatch. Check grade.");
    if(v.hasVoted) throw new Error("Voter has already cast their ballot.");
    
    setVoterData(v);
    setSelections({});
    setStep(2);
  };

  const handleSubmitVote = async () => {
    if(!voterData || !user) return;
    try {
      const voterRef = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_voters', voterData.id);
      await runTransaction(db, async (transaction) => {
        const vSnap = await transaction.get(voterRef);
        if(vSnap.data().hasVoted) throw new Error("Double voting detected.");
        
        transaction.update(voterRef, { hasVoted: true });
        
        Object.values(selections).flat().forEach(candId => {
           const cRef = doc(db, 'artifacts', appId, 'public', 'data', 'ccssc_candidates', candId);
           transaction.update(cRef, { pendingVotes: increment(1) });
        });
      });
      
      setStep(4);
      setTimeout(() => {
        setVoterData(null);
        setStep(1);
      }, 3000);

    } catch (err) {
      addToast(err.message, "error");
      setStep(1);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-100 overflow-y-auto">
      {voterData && step < 4 && (
        <div className="bg-[#16345f] text-white py-3 px-6 shadow-md flex justify-between items-center text-xs font-bold tracking-wider">
          <span className="text-slate-300">STUDENT SESSION ACTIVE</span>
          <span>ID: {voterData.id} • GRADE {voterData.grade}</span>
        </div>
      )}

      <div className="max-w-4xl mx-auto py-10 px-4">
        {step === 1 && <KioskAuth onAuth={handleVoterAuth} addToast={addToast} />}
        {step === 2 && <KioskBallot voter={voterData} candidates={candidates} selections={selections} setSelections={setSelections} onNext={() => setStep(3)} />}
        {step === 3 && <KioskReview candidates={candidates} selections={selections} onSubmit={handleSubmitVote} onBack={() => setStep(2)} />}
        {step === 4 && (
          <div className="text-center py-32 animate-in fade-in zoom-in duration-500">
            <CheckCircle className="w-32 h-32 text-emerald-500 mx-auto mb-6" />
            <h2 className="text-5xl font-black text-[#16345f] uppercase tracking-widest mb-4">Vote Submitted</h2>
            <p className="text-xl text-slate-500 font-medium">Thank you for participating.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function KioskAuth({ onAuth, addToast }) {
  const [form, setForm] = useState({ id: '', grade: '7' });

  const submit = async (e) => {
    e.preventDefault();
    try {
      await onAuth(form.id, form.grade);
    } catch(e) {
      addToast(e.message, "error");
    }
  };

  return (
    <div className="bg-white p-10 rounded-3xl shadow-2xl border-t-8 border-[#16345f] max-w-lg mx-auto">
      <div className="text-center mb-10">
        <ShieldCheck className="w-16 h-16 text-[#16345f] mx-auto mb-4" />
        <h2 className="text-3xl font-black text-[#16345f] uppercase tracking-tight">Ballot Access</h2>
        <p className="text-slate-500 font-medium mt-2 text-sm">Input your Student ID and Grade Level to proceed.</p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-600 uppercase mb-2">Student ID No.</label>
          <input required type="text" value={form.id} onChange={e=>setForm({...form, id: e.target.value.toUpperCase()})} className="w-full p-5 text-xl border-2 border-slate-200 rounded-xl outline-none focus:border-[#16345f] font-mono font-bold bg-slate-50 text-center" placeholder="e.g. 2026-0001" />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-600 uppercase mb-2">Grade Level</label>
          <select value={form.grade} onChange={e=>setForm({...form, grade: e.target.value})} className="w-full p-5 text-xl border-2 border-slate-200 rounded-xl outline-none focus:border-[#16345f] font-bold bg-slate-50">
            {[7,8,9,10,11,12].map(g => <option key={g} value={g}>Grade {g}</option>)}
          </select>
        </div>
        <button type="submit" className="w-full bg-[#16345f] hover:bg-[#0b1a30] text-white font-black py-6 text-xl rounded-xl transition uppercase tracking-widest mt-8 shadow-lg">
          Validate & Begin
        </button>
      </form>
    </div>
  );
}

function KioskBallot({ voter, candidates, selections, setSelections, onNext }) {
  const council = voter.grade <= 10 ? 'JHS' : 'SHS';
  
  const eligibleCandidates = candidates.filter(c => {
    if(c.council !== council) return false;
    if(c.position === 'Grade Level Representative' && c.gradeLevel !== voter.grade) return false;
    return true;
  });

  const handleSelect = (pos, candId, isMulti) => {
    if(isMulti) {
      const current = selections[pos] || [];
      if(current.includes(candId)) {
        setSelections({...selections, [pos]: current.filter(id => id !== candId)});
      } else if(current.length < 2) {
        setSelections({...selections, [pos]: [...current, candId]});
      }
    } else {
      setSelections({...selections, [pos]: [candId]});
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {POSITIONS.map(pos => {
        const posCands = eligibleCandidates.filter(c => c.position === pos);
        if(posCands.length === 0) return null;
        
        const isMulti = pos === 'Project Manager';
        const maxText = isMulti ? '(Select up to 2)' : '(Select 1)';
        
        return (
          <div key={pos} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden max-w-3xl mx-auto">
            <div className="bg-[#16345f] text-white px-5 py-3 flex justify-between items-center">
              <h3 className="text-base font-extrabold uppercase tracking-wider">{pos}</h3>
              <p className="text-[#c6b26c] font-black text-[10px]">{maxText}</p>
            </div>
            <div className="p-3 space-y-2">
              {posCands.map(c => {
                const isSelected = (selections[pos] || []).includes(c.id);
                const name = `${c.lastName}, ${c.firstName} ${c.middleName}`.trim();
                
                return (
                  <div key={c.id} onClick={() => handleSelect(pos, c.id, isMulti)} className={`p-3 rounded-xl border cursor-pointer transition-all flex justify-between items-center ${isSelected ? 'border-[#16345f] bg-blue-50/20 shadow-sm' : 'border-slate-100 hover:border-slate-300'}`}>
                    <div>
                      <div className={`text-sm font-bold uppercase ${isSelected ? 'text-[#16345f]' : 'text-slate-700'}`}>{name}</div>
                      <div className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">{c.partyList || 'INDEPENDENT'}</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-[#16345f] bg-[#16345f]' : 'border-slate-300'}`}>
                      {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      
      <div className="mt-12 flex justify-center w-full max-w-3xl mx-auto">
        <button 
          onClick={onNext} 
          className="group relative inline-flex items-center gap-3 bg-[#16345f] hover:bg-[#0b1a30] text-white font-black py-4 px-12 rounded-2xl text-lg transition-all duration-300 shadow-xl hover:shadow-[#16345f]/30 hover:-translate-y-1 active:translate-y-0"
        >
          <div className="absolute inset-x-0 -top-px mx-auto h-px w-2/3 bg-gradient-to-r from-transparent via-[#c6b26c] to-transparent" />
          <span className="tracking-widest uppercase">Review Selections & Cast Ballot</span>
          <ArrowRight className="w-5 h-5 text-[#c6b26c] transition-transform group-hover:translate-x-1.5" />
        </button>
      </div>
    </div>
  );
}

function KioskReview({ candidates, selections, onSubmit, onBack }) {
  const getSelectedNames = (pos) => {
    const ids = selections[pos] || [];
    if(ids.length === 0) return <span className="text-slate-400 italic font-medium">Abstain</span>;
    return ids.map(id => {
      const c = candidates.find(cand => cand.id === id);
      return `${c.lastName}, ${c.firstName} ${c.middleName}`.trim();
    }).join(' & ');
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-[#16345f] max-w-2xl mx-auto">
      <div className="bg-[#16345f] text-white p-6 text-center">
        <h2 className="text-2xl font-black uppercase tracking-widest mb-1">Review Ballot</h2>
        <p className="text-[#c6b26c] font-bold text-xs">Please verify your selections before casting your final vote.</p>
      </div>
      
      <div className="p-6 space-y-4">
        {POSITIONS.map(pos => (
          <div key={pos} className="flex justify-between items-center border-b border-slate-100 pb-2">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest w-1/3">{pos}</div>
            <div className="text-sm font-black text-[#16345f] w-2/3 text-right uppercase">
              {getSelectedNames(pos)}
            </div>
          </div>
        ))}
      </div>
      
      <div className="p-6 bg-slate-50 flex gap-4">
        <button onClick={onBack} className="flex-1 py-3 rounded-lg font-black text-[#16345f] border-2 border-[#16345f] hover:bg-[#16345f] hover:text-white transition uppercase tracking-widest text-sm">
          Go Back
        </button>
        <button onClick={onSubmit} className="flex-1 py-3 rounded-lg font-black text-white bg-[#16345f] hover:bg-[#0b1a30] shadow-md transition uppercase tracking-widest text-sm">
          Submit Vote
        </button>
      </div>
    </div>
  );
}
