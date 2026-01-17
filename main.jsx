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
  Wind, 
  User, 
  MessageSquare, 
  Send, 
  X, 
  LogOut, 
  Globe, 
  Ghost,
  MoreVertical,
  Settings,
  Users
} from 'lucide-react';

// Ortam değişkenleri kontrolü (Hata düzeltilmiş versiyon)
const getEnv = (key, fallback) => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch (e) {}
  return fallback;
};

const firebaseConfig = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY", "AIzaSyCgw5ip7yWYo4yxwgI7n1nV0bpId6CqRc8"),
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN", "poyraz-arama.firebaseapp.com"),
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID", "poyraz-arama"),
  storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET", "poyraz-arama.firebasestorage.app"),
  messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "302327435109"),
  appId: getEnv("VITE_FIREBASE_APP_ID", "1:302327435109:web:e3690705e41873fdb35b8c")
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const googleProvider = new GoogleAuthProvider();
const appId = "poyraz-arama";

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
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState([]);

  const localVideoRef = useRef();
  const localStream = useRef(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u?.displayName) setDisplayName(u.displayName);
    });
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (authMode === 'signup') {
        const u = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(u.user, { displayName });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) { setError("Kimlik doğrulama hatası: " + err.message); }
    setLoading(false);
  };

  const startMeeting = async () => {
    if (!roomName || !user) return;
    try {
      setIsInCall(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const roomPath = `artifacts/${appId}/public/data/rooms/${roomName}`;
      await setDoc(doc(db, `${roomPath}/participants/${user.uid}`), { 
        uid: user.uid, name: user.displayName || "İsimsiz", joinedAt: Date.now() 
      });

      onSnapshot(collection(db, `${roomPath}/participants`), (snapshot) => {
        setParticipants(snapshot.docs.map(d => d.data()));
      });

      const q = query(collection(db, `${roomPath}/messages`), orderBy('timestamp', 'asc'), limit(50));
      onSnapshot(q, (snapshot) => {
        setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    } catch (err) { setError(err.message); setIsInCall(false); }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4 font-sans overflow-hidden">
        {/* Arka Plan Dekorasyonu */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full"></div>
        </div>

        <div className="w-full max-w-[400px] relative z-10">
          <div className="bg-white/5 border border-white/10 p-8 rounded-[40px] shadow-2xl backdrop-blur-3xl">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-3xl shadow-lg shadow-blue-600/40 mb-4 animate-pulse">
                <Wind className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-black tracking-tighter uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-white to-white/40">
                Poyraz
              </h1>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">Ultra Hızlı Bağlantı</p>
            </div>

            {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center">{error}</div>}

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'signup' && (
                <div className="group relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                  <input className="w-full bg-white/5 border border-white/10 p-4 pl-12 rounded-2xl outline-none focus:border-blue-600 focus:bg-white/[0.08] transition-all text-sm" placeholder="Ad Soyad" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
                </div>
              )}
              <div className="group relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input type="email" className="w-full bg-white/5 border border-white/10 p-4 pl-12 rounded-2xl outline-none focus:border-blue-600 focus:bg-white/[0.08] transition-all text-sm" placeholder="E-posta" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="group relative">
                <Ghost className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input type="password" className="w-full bg-white/5 border border-white/10 p-4 pl-12 rounded-2xl outline-none focus:border-blue-600 focus:bg-white/[0.08] transition-all text-sm" placeholder="Şifre" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              
              <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-bold uppercase text-xs tracking-widest shadow-xl shadow-blue-600/30 active:scale-95 transition-all">
                {loading ? 'Yükleniyor...' : (authMode === 'login' ? 'Giriş Yap' : 'Kayıt Ol')}
              </button>
            </form>

            <div className="mt-8 flex flex-col gap-3">
              <button onClick={() => signInWithPopup(auth, googleProvider)} className="w-full flex items-center justify-center gap-3 bg-white text-black py-4 rounded-2xl font-bold text-xs hover:bg-slate-100 transition-all">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/layout/google.svg" className="w-4 h-4" alt="Google" />
                Google ile Devam Et
              </button>
              <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-slate-500 text-[10px] uppercase font-bold text-center mt-2 hover:text-white transition-colors">
                {authMode === 'login' ? 'Hesabın yok mu? Kayıt Ol' : 'Zaten hesabın var mı? Giriş Yap'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <nav className="h-20 px-8 flex justify-between items-center border-b border-white/5 bg-black/20 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Wind size={20} />
          </div>
          <span className="font-black italic uppercase text-xl tracking-tighter">Poyraz</span>
        </div>
        
        {isInCall && (
          <div className="hidden md:flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Canlı: {roomName}</span>
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right">
            <p className="text-[8px] text-slate-500 font-bold uppercase">Kullanıcı</p>
            <p className="text-xs font-bold">{user.displayName || "Misafir"}</p>
          </div>
          <button onClick={() => signOut(auth)} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full hover:bg-red-500/20 hover:text-red-500 transition-all">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      {!isInCall ? (
        <div className="flex-1 flex items-center justify-center p-6 relative">
          <div className="absolute w-[300px] h-[300px] bg-blue-600/10 blur-[100px] rounded-full"></div>
          <div className="w-full max-w-md bg-white/5 border border-white/10 p-10 rounded-[40px] text-center backdrop-blur-3xl shadow-2xl relative z-10">
            <h2 className="text-2xl font-bold mb-2">Görüşmeye Başla</h2>
            <p className="text-slate-500 text-xs mb-8">Bir oda adı girerek arkadaşlarınla anında bağlan.</p>
            <div className="space-y-4">
              <input className="w-full bg-black/40 border border-white/10 p-5 rounded-2xl outline-none focus:border-blue-600 text-sm text-center font-mono tracking-widest" placeholder="ODA-ADI-YAZIN" value={roomName} onChange={e => setRoomName(e.target.value.toUpperCase().replace(/\s/g, '-'))} />
              <button onClick={startMeeting} className="w-full bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl font-bold uppercase text-xs tracking-[0.2em] shadow-lg shadow-blue-600/30 active:scale-95 transition-all">
                Odaya Giriş Yap
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative flex overflow-hidden">
          {/* Video Grid */}
          <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 gap-6 content-center bg-black">
            <div className="relative aspect-video bg-slate-900 rounded-[32px] overflow-hidden border-2 border-blue-600 shadow-2xl group">
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-black/60 p-2 rounded-lg backdrop-blur-md"><Settings size={14}/></div>
              </div>
              <div className="absolute bottom-6 left-6 bg-blue-600/90 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                Siz (Kamera)
              </div>
              {!isCameraOn && (
                <div className="absolute inset-0 bg-slate-950 flex items-center justify-center flex-col gap-4">
                  <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center"><User size={48} className="text-slate-700" /></div>
                  <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Kameranız Kapalı</p>
                </div>
              )}
            </div>
            
            {/* Mock Remote Video (Tasarım testi için) */}
            <div className="relative aspect-video bg-slate-900 rounded-[32px] overflow-hidden border border-white/5 shadow-xl flex items-center justify-center">
               <div className="flex flex-col items-center gap-4 text-slate-600">
                  <Users size={48} />
                  <p className="text-[10px] uppercase font-black tracking-tighter">Diğer katılımcılar bekleniyor...</p>
               </div>
            </div>
          </div>

          {/* Side Chat */}
          {isChatOpen && (
            <div className="w-full md:w-[380px] bg-[#0A0A0A] border-l border-white/5 flex flex-col shadow-2xl z-40 animate-in slide-in-from-right duration-300">
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest">Grup Sohbeti</h3>
                  <p className="text-[8px] text-slate-500 uppercase mt-0.5">{messages.length} Mesaj</p>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-lg hover:bg-white/10"><X size={16}/></button>
              </div>
              
              <div className="flex-1 p-6 overflow-y-auto space-y-6 custom-scrollbar">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center px-10">
                    <MessageSquare size={32} className="mb-4 opacity-20" />
                    <p className="text-[10px] uppercase font-bold tracking-widest">Henüz mesaj yok. İlk yazan sen ol!</p>
                  </div>
                ) : (
                  messages.map(m => (
                    <div key={m.id} className={`flex flex-col ${m.senderId === user.uid ? 'items-end' : 'items-start'}`}>
                      <span className="text-[9px] font-bold text-slate-500 mb-2 px-1 uppercase">{m.sender}</span>
                      <div className={`px-5 py-3 rounded-2xl text-[12px] leading-relaxed max-w-[90%] shadow-lg ${m.senderId === user.uid ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white/5 border border-white/10 rounded-tl-none text-slate-200'}`}>
                        {m.text}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!newMessage.trim()) return;
                await addDoc(collection(db, `artifacts/${appId}/public/data/rooms/${roomName}/messages`), {
                  text: newMessage, sender: user.displayName || "İsimsiz", senderId: user.uid, timestamp: serverTimestamp()
                });
                setNewMessage('');
              }} className="p-6 bg-black/40 backdrop-blur-xl border-t border-white/5">
                <div className="relative flex items-center">
                  <input className="w-full bg-white/5 border border-white/10 rounded-2xl pl-5 pr-14 py-4 text-xs outline-none focus:border-blue-600 focus:bg-white/[0.08] transition-all" placeholder="Bir şeyler yaz..." value={newMessage} onChange={e => setNewMessage(e.target.value)} />
                  <button type="submit" className="absolute right-2 w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"><Send size={16} /></button>
                </div>
              </form>
            </div>
          )}

          {/* Floating Controls */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/40 backdrop-blur-3xl border border-white/10 px-6 py-4 rounded-[32px] shadow-2xl z-50 transition-all hover:bg-black/60">
            <button onClick={() => { if(localStream.current) { const a = localStream.current.getAudioTracks()[0]; a.enabled = !a.enabled; setIsMicOn(a.enabled); } }} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isMicOn ? 'bg-white/5 hover:bg-white/10' : 'bg-red-500/20 text-red-500 border border-red-500/40'}`}>
              {isMicOn ? <Mic size={22}/> : <MicOff size={22}/>}
            </button>
            <button onClick={() => { if(localStream.current) { const v = localStream.current.getVideoTracks()[0]; v.enabled = !v.enabled; setIsCameraOn(v.enabled); } }} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isCameraOn ? 'bg-white/5 hover:bg-white/10' : 'bg-red-500/20 text-red-500 border border-red-500/40'}`}>
              {isCameraOn ? <Camera size={22}/> : <CameraOff size={22}/>}
            </button>
            
            <div className="w-px h-10 bg-white/10 mx-2" />

            <button onClick={() => setIsChatOpen(!isChatOpen)} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all relative ${isChatOpen ? 'bg-blue-600 text-white' : 'bg-white/5 hover:bg-white/10'}`}>
              <MessageSquare size={22}/>
              {!isChatOpen && <div className="absolute top-3 right-3 w-2 h-2 bg-blue-500 rounded-full border-2 border-black"></div>}
            </button>
            <button className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center hover:bg-white/10"><MoreVertical size={22}/></button>
            
            <button onClick={() => window.location.reload()} className="w-20 h-14 bg-red-600 rounded-2xl flex items-center justify-center hover:bg-red-500 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-red-600/30 ml-2">
              <PhoneOff size={22}/>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
