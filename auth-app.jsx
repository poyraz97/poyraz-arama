import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, updateProfile, signInWithPopup, 
  GoogleAuthProvider, signOut, setPersistence, browserLocalPersistence 
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, onSnapshot, query, 
  orderBy, serverTimestamp, limit 
} from 'firebase/firestore';
import { 
  Wind, Mail, Lock, User, LogOut, Camera, CameraOff, 
  Mic, MicOff, PhoneOff, Send, MessageSquare, AlertCircle, ChevronRight 
} from 'lucide-react';

const firebaseConfig = {
  apiKey: "AIzaSyCgw5ip7yWYo4yxwgI7n1nV0bpId6CqRc8",
  authDomain: "poyraz-arama.firebaseapp.com",
  projectId: "poyraz-arama",
  storageBucket: "poyraz-arama.firebasestorage.app",
  messagingSenderId: "302327435109",
  appId: "1:302327435109:web:e3690705e41873fdb35b8c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isInCall, setIsInCall] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const localVideoRef = useRef(null);
  const localStream = useRef(null);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).then(() => {
      return onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      });
    });
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (authMode === 'signup') {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(res.user, { displayName });
        setUser({...res.user, displayName});
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError("Giriş bilgileri hatalı veya kullanıcı mevcut.");
    }
  };

  const handleGoogleAuth = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
    } catch (err) {
      setError("Google girişi şu an yapılamıyor.");
    }
  };

  const joinRoom = async () => {
    if (!roomName.trim()) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream.current = stream;
      setIsInCall(true);
      setTimeout(() => { if (localVideoRef.current) localVideoRef.current.srcObject = stream; }, 500);
      const q = query(collection(db, 'rooms', roomName, 'messages'), orderBy('timestamp', 'asc'), limit(50));
      onSnapshot(q, (snapshot) => {
        setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
    } catch (err) { setError("Cihaz izni alınamadı."); }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    await addDoc(collection(db, 'rooms', roomName, 'messages'), {
      text: newMessage,
      sender: user.displayName || user.email,
      uid: user.uid,
      timestamp: serverTimestamp()
    });
    setNewMessage('');
  };

  if (loading) return <div className="h-screen bg-black text-blue-500 flex items-center justify-center">YÜKLENİYOR...</div>;

  if (!user) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 p-8 rounded-[40px] border border-zinc-800 shadow-2xl">
        <div className="text-center mb-10">
          <Wind className="mx-auto text-blue-500 mb-4" size={48} />
          <h1 className="text-4xl font-black italic uppercase">Poyraz</h1>
        </div>
        {error && <div className="bg-red-500/10 text-red-500 p-4 rounded-2xl mb-4 text-xs">{error}</div>}
        <form onSubmit={handleAuth} className="space-y-4">
          {authMode === 'signup' && (
            <input className="w-full bg-black border border-zinc-800 p-4 rounded-2xl outline-none focus:border-blue-500 text-white" placeholder="Ad Soyad" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
          )}
          <input type="email" className="w-full bg-black border border-zinc-800 p-4 rounded-2xl outline-none focus:border-blue-500 text-white" placeholder="E-posta" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" className="w-full bg-black border border-zinc-800 p-4 rounded-2xl outline-none focus:border-blue-500 text-white" placeholder="Şifre" value={password} onChange={e => setPassword(e.target.value)} required />
          <button className="w-full bg-blue-600 p-4 rounded-2xl font-bold uppercase text-white transition-all active:scale-95">{authMode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}</button>
        </form>
        <button onClick={handleGoogleAuth} className="w-full mt-4 bg-white text-black p-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95">Google ile Gir</button>
        <p onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-center mt-6 text-zinc-500 cursor-pointer text-sm underline font-bold">
          {authMode === 'login' ? 'Hesabın yok mu? Kaydol' : 'Zaten üyeyim, Giriş Yap'}
        </p>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-black text-white font-sans">
      <nav className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
        <div className="flex items-center gap-2"><Wind className="text-blue-500" /><span className="font-bold tracking-tighter text-xl">POYRAZ</span></div>
        <button onClick={() => { if(localStream.current) localStream.current.getTracks().forEach(t=>t.stop()); signOut(auth); }} className="p-2 bg-zinc-800 rounded-full"><LogOut size={20}/></button>
      </nav>
      {!isInCall ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center bg-zinc-900 p-12 rounded-[50px] border border-zinc-800 w-full max-w-sm">
            <h2 className="text-2xl font-black mb-6 uppercase">Odaya Giriş</h2>
            <input className="bg-black border border-zinc-800 p-4 rounded-2xl text-center mb-6 block w-full text-lg font-bold" placeholder="ODA ADI" value={roomName} onChange={e => setRoomName(e.target.value.toUpperCase())} />
            <button onClick={joinRoom} className="bg-blue-600 px-8 py-4 rounded-2xl font-bold w-full shadow-lg shadow-blue-600/20 active:scale-95 transition-all">KATIL</button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <div className="flex-1 p-4 relative flex items-center justify-center">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full max-w-4xl object-cover rounded-[40px] border-2 border-blue-600" style={{transform: 'scaleX(-1)'}} />
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-4 bg-black/50 p-4 rounded-3xl border border-white/10 backdrop-blur-md">
              <button onClick={() => window.location.reload()} className="bg-red-600 p-4 rounded-2xl hover:bg-red-500 transition-all"><PhoneOff size={24}/></button>
            </div>
          </div>
          <div className="w-full md:w-80 border-l border-zinc-800 flex flex-col bg-zinc-950">
            <div className="p-4 border-b border-zinc-800 font-bold text-xs opacity-50 uppercase tracking-widest">Sohbet</div>
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {messages.map(m => (
                <div key={m.id} className={`flex flex-col ${m.uid === user.uid ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-zinc-600 font-bold mb-1">{m.sender}</span>
                  <div className={`p-3 rounded-2xl text-xs ${m.uid === user.uid ? 'bg-blue-600 rounded-tr-none' : 'bg-zinc-800 rounded-tl-none border border-zinc-700'}`}>{m.text}</div>
                </div>
              ))}
            </div>
            <form onSubmit={sendMessage} className="p-4 border-t border-zinc-800 flex gap-2">
              <input className="flex-1 bg-zinc-900 p-3 rounded-xl outline-none text-xs border border-zinc-800" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Bir şeyler yaz..." />
              <button className="bg-blue-600 p-3 rounded-xl hover:bg-blue-500 transition-all"><Send size={18} /></button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
