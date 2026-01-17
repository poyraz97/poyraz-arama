import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile, 
  onAuthStateChanged, 
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  collection, 
  addDoc, 
  query,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { 
  Camera, 
  CameraOff, 
  Mic, 
  MicOff, 
  PhoneOff, 
  MonitorUp, 
  Copy,
  Users,
  Wind,
  User,
  MessageSquare,
  Send,
  X,
  LogOut,
  Mail,
  Lock,
  Globe,
  Ghost
} from 'lucide-react';

// Firebase Yapılandırması
const firebaseConfig = {
  apiKey: "AIzaSyCgw5ip7yWYo4yxwgI7n1nV0bpId6CqRc8",
  authDomain: "poyraz-arama.firebaseapp.com",
  projectId: "poyraz-arama",
  storageBucket: "poyraz-arama.firebasestorage.app",
  messagingSenderId: "302327435109",
  appId: "1:302327435109:web:e3690705e41873fdb35b8c"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const googleProvider = new GoogleAuthProvider();
const appId = "poyraz-arama";

const servers = {
  iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }],
  iceCandidatePoolSize: 10,
};

// --- SES EFEKTLERİ ---
const playSound = (type) => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const envelope = audioCtx.createGain();
    osc.connect(envelope);
    envelope.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'join') {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
      envelope.gain.linearRampToValueAtTime(0.3, now + 0.05);
      envelope.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.start(); osc.stop(now + 0.3);
    } else if (type === 'message') {
      osc.frequency.setValueAtTime(800, now);
      envelope.gain.linearRampToValueAtTime(0.2, now + 0.05);
      envelope.gain.linearRampToValueAtTime(0, now + 0.15);
      osc.start(); osc.stop(now + 0.15);
    }
  } catch (e) { console.error("Audio error", e); }
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  
  const [roomName, setRoomName] = useState('');
  const [isInCall, setIsInCall] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState({});

  const localVideoRef = useRef();
  const localStream = useRef(null);
  const screenStream = useRef(null);
  const peerConnections = useRef({});

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u?.displayName) setDisplayName(u.displayName);
    });
  }, []);

  // --- AUTH FONKSİYONLARI ---
  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) { setError("Google hatası: " + err.message); }
    setLoading(false);
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      const u = await signInAnonymously(auth);
      await updateProfile(u.user, { displayName: displayName || "Misafir" });
      setUser({...u.user, displayName: displayName || "Misafir"});
    } catch (err) { setError("Misafir girişi hatası: " + err.message); }
    setLoading(false);
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (authMode === 'signup') {
        const u = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(u.user, { displayName });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) { setError("Hata: " + err.message); }
    setLoading(false);
  };

  // --- GÖRÜŞME MANTIĞI ---
  useEffect(() => {
    if (isInCall && roomName) {
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'rooms', roomName, 'messages'), orderBy('timestamp', 'asc'), limit(50));
      return onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (msgs.length > messages.length && msgs[msgs.length-1]?.senderId !== user?.uid) playSound('message');
        setMessages(msgs);
      });
    }
  }, [isInCall, roomName]);

  const startMeeting = async () => {
    if (!roomName || !user) return;
    try {
      setIsInCall(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      playSound('join');

      const roomPath = `artifacts/${appId}/public/data/rooms/${roomName}`;
      await setDoc(doc(db, `${roomPath}/participants/${user.uid}`), { 
        uid: user.uid, name: user.displayName || "İsimsiz", joinedAt: Date.now() 
      });

      onSnapshot(collection(db, `${roomPath}/participants`), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' && change.doc.id !== user.uid) {
            playSound('join');
            initiateConnection(change.doc.data().uid, change.doc.data().name);
          }
        });
      });
    } catch (err) { setError(err.message); setIsInCall(false); }
  };

  const initiateConnection = async (remoteUid, remoteName) => {
    const pc = new RTCPeerConnection(servers);
    peerConnections.current[remoteUid] = pc;
    localStream.current.getTracks().forEach(t => pc.addTrack(t, localStream.current));
    pc.ontrack = (e) => setRemoteParticipants(p => ({ ...p, [remoteUid]: { stream: e.streams[0], name: remoteName } }));
    // RTC Sinyalleşme devamı...
  };

  const toggleCamera = () => {
    if (localStream.current) {
      const v = localStream.current.getVideoTracks()[0];
      v.enabled = !v.enabled;
      setIsCameraOn(v.enabled);
    }
  };

  // --- ARAYÜZ ---
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 font-sans bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950">
        <div className="w-full max-w-md bg-slate-900/50 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl backdrop-blur-2xl">
          <div className="text-center mb-8">
            <Wind className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h1 className="text-3xl font-black italic tracking-tighter uppercase">Poyraz Arama</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2">Bağlanmaya Hazır Mısın?</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <button onClick={handleGoogleLogin} className="flex items-center justify-center gap-2 bg-white text-black py-3 rounded-2xl font-bold text-xs hover:bg-slate-200 transition-all">
              <Globe size={16} /> Google
            </button>
            <button onClick={() => setAuthMode('guest')} className="flex items-center justify-center gap-2 bg-slate-800 text-white py-3 rounded-2xl font-bold text-xs hover:bg-slate-700 transition-all">
              <Ghost size={16} /> Misafir
            </button>
          </div>

          <div className="relative flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-slate-800"></div>
            <span className="text-[10px] font-bold text-slate-600 uppercase">Veya E-posta</span>
            <div className="flex-1 h-px bg-slate-800"></div>
          </div>

          {authMode === 'guest' ? (
            <div className="space-y-4">
              <input className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl outline-none focus:border-blue-600 text-sm" placeholder="Görünecek Adınız" value={displayName} onChange={e => setDisplayName(e.target.value)} />
              <button onClick={handleGuestLogin} className="w-full bg-blue-600 py-4 rounded-2xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-blue-600/20">Misafir Olarak Gir</button>
              <button onClick={() => setAuthMode('login')} className="w-full text-slate-500 text-[10px] uppercase font-bold">Geri Dön</button>
            </div>
          ) : (
            <form onSubmit={handleEmailAuth} className="space-y-4">
              {authMode === 'signup' && <input className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl outline-none focus:border-blue-600 text-sm" placeholder="Tam Adınız" value={displayName} onChange={e => setDisplayName(e.target.value)} required />}
              <input type="email" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl outline-none focus:border-blue-600 text-sm" placeholder="E-posta" value={email} onChange={e => setEmail(e.target.value)} required />
              <input type="password" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl outline-none focus:border-blue-600 text-sm" placeholder="Şifre" value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="submit" className="w-full bg-blue-600 py-4 rounded-2xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-blue-600/20">
                {authMode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
              </button>
              <button type="button" onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="w-full text-slate-500 text-[10px] uppercase font-bold">
                {authMode === 'login' ? 'Hesabın yok mu? Kayıt Ol' : 'Zaten hesabın var mı? Giriş Yap'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      <nav className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Wind className="text-blue-500" />
          <span className="font-black italic uppercase tracking-tighter">Poyraz</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-[9px] text-slate-500 font-bold uppercase">Aktif Profil</p>
            <p className="text-xs font-bold text-blue-400">{user.displayName || (user.isAnonymous ? "Misafir" : user.email)}</p>
          </div>
          <button onClick={() => signOut(auth)} className="p-2 bg-slate-800 rounded-xl hover:bg-red-600/20 hover:text-red-500 transition-all"><LogOut size={18} /></button>
        </div>
      </nav>

      {!isInCall ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] text-center shadow-2xl backdrop-blur-md">
            <h2 className="text-xl font-bold mb-6">Oda Oluştur veya Katıl</h2>
            <input className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl outline-none focus:border-blue-600 mb-4 text-sm" placeholder="Oda Adı" value={roomName} onChange={e => setRoomName(e.target.value.toLowerCase().replace(/\s/g, '-'))} />
            <button onClick={startMeeting} className="w-full bg-blue-600 py-4 rounded-2xl font-bold uppercase text-xs tracking-widest shadow-xl">Görüşmeye Başla</button>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative flex flex-col md:flex-row overflow-hidden">
          <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 content-start overflow-y-auto">
            <div className="relative aspect-video bg-slate-900 rounded-[2rem] overflow-hidden border-2 border-blue-600 shadow-2xl">
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
              <div className="absolute bottom-4 left-4 bg-blue-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase">Siz</div>
              {!isCameraOn && <div className="absolute inset-0 bg-slate-900 flex items-center justify-center"><User size={48} className="text-slate-800" /></div>}
            </div>
            {Object.entries(remoteParticipants).map(([uid, p]) => (
              <div key={uid} className="relative aspect-video bg-slate-900 rounded-[2rem] overflow-hidden border border-slate-800 shadow-xl">
                <video autoPlay playsInline ref={el => { if(el) el.srcObject = p.stream }} className="w-full h-full object-cover" />
                <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-lg text-[9px] font-black uppercase">{p.name}</div>
              </div>
            ))}
          </div>

          {/* Chat Panel */}
          {isChatOpen && (
            <div className="w-full md:w-80 bg-slate-900 border-l border-slate-800 flex flex-col">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center"><span className="text-[10px] font-bold uppercase tracking-widest">Chat</span><button onClick={() => setIsChatOpen(false)}><X size={16}/></button></div>
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {messages.map(m => (
                  <div key={m.id} className={`flex flex-col ${m.senderId === user.uid ? 'items-end' : 'items-start'}`}>
                    <span className="text-[8px] text-slate-500 mb-1">{m.sender}</span>
                    <div className={`px-4 py-2 rounded-2xl text-[11px] max-w-[85%] ${m.senderId === user.uid ? 'bg-blue-600' : 'bg-slate-800'}`}>{m.text}</div>
                  </div>
                ))}
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!newMessage.trim()) return;
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'rooms', roomName, 'messages'), {
                  text: newMessage, sender: user.displayName || "Misafir", senderId: user.uid, timestamp: serverTimestamp()
                });
                setNewMessage('');
              }} className="p-4 border-t border-slate-800 flex gap-2">
                <input className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs outline-none" placeholder="Yazın..." value={newMessage} onChange={e => setNewMessage(e.target.value)} />
                <button type="submit" className="bg-blue-600 p-2 rounded-xl"><Send size={16} /></button>
              </form>
            </div>
          )}

          {/* Controls */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-3xl border border-slate-800 px-6 py-4 rounded-full flex items-center gap-4 shadow-2xl">
            <button onClick={() => { if(localStream.current) { const a = localStream.current.getAudioTracks()[0]; a.enabled = !a.enabled; setIsMicOn(a.enabled); } }} className={`p-4 rounded-full ${isMicOn ? 'bg-slate-800' : 'bg-red-600'}`}><Mic size={18}/></button>
            <button onClick={toggleCamera} className={`p-4 rounded-full ${isCameraOn ? 'bg-slate-800' : 'bg-red-600'}`}><Camera size={18}/></button>
            <button onClick={() => setIsChatOpen(!isChatOpen)} className={`p-4 rounded-full ${isChatOpen ? 'bg-blue-600' : 'bg-slate-800'}`}><MessageSquare size={18}/></button>
            <div className="w-px h-6 bg-slate-800 mx-1" />
            <button onClick={() => window.location.reload()} className="bg-red-600 p-4 rounded-full px-8 hover:scale-105 transition-transform"><PhoneOff size={18}/></button>
          </div>
        </div>
      )}
    </div>
  );
}
