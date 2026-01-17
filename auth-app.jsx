import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, updateProfile, signInWithPopup, 
  GoogleAuthProvider, signOut 
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, onSnapshot, query, 
  orderBy, serverTimestamp, limit 
} from 'firebase/firestore';
import { 
  Wind, Mail, Lock, User, LogOut, Camera, CameraOff, 
  Mic, MicOff, PhoneOff, Send, MessageSquare, 
  AlertCircle, ChevronRight
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
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  const localVideoRef = useRef(null);
  const localStream = useRef(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (authMode === 'signup') {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(res.user, { displayName });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError("Giriş başarısız. Bilgilerinizi kontrol edin.");
    }
  };

  const handleGoogleAuth = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError("Google girişi yapılamadı.");
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

  if (loading) return <div className="h-screen flex items-center justify-center">Yükleniyor...</div>;

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-black">
      <div className="w-full max-w-md bg-zinc-900 p-8 rounded-3xl border border-zinc-800">
        <div className="text-center mb-8">
          <Wind className="mx-auto text-blue-500 mb-4" size={48} />
          <h1 className="text-3xl font-bold italic uppercase">Poyraz</h1>
        </div>

        {error && <div className="bg-red-500/10 text-red-500 p-3 rounded-xl mb-4 text-xs">{error}</div>}

        <form onSubmit={handleAuth} className="space-y-4">
          {authMode === 'signup' && (
            <input className="w-full bg-zinc-800 p-4 rounded-xl outline-none" placeholder="Ad Soyad" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
          )}
          <input type="email" className="w-full bg-zinc-800 p-4 rounded-xl outline-none" placeholder="E-posta" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" className="w-full bg-zinc-800 p-4 rounded-xl outline-none" placeholder="Şifre" value={password} onChange={e => setPassword(e.target.value)} required />
          <button className="w-full bg-blue-600 p-4 rounded-xl font-bold uppercase">{authMode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}</button>
        </form>

        <button onClick={handleGoogleAuth} className="w-full mt-4 bg-white text-black p-4 rounded-xl font-bold flex items-center justify-center gap-2">
          Google ile Devam Et
        </button>

        <p onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-center mt-6 text-zinc-500 cursor-pointer text-sm">
          {authMode === 'login' ? 'Hesabın yok mu? Kaydol' : 'Zaten üyen misin? Giriş Yap'}
        </p>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-black">
      <nav className="p-4 border-b border-zinc-800 flex justify-between items-center">
        <div className="flex items-center gap-2"><Wind className="text-blue-500" /><span className="font-bold">POYRAZ</span></div>
        <button onClick={() => signOut(auth)}><LogOut /></button>
      </nav>

      {!isInCall ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center bg-zinc-900 p-10 rounded-3xl border border-zinc-800">
            <h2 className="text-2xl font-bold mb-4 uppercase">Odaya Bağlan</h2>
            <input className="bg-black border border-zinc-800 p-4 rounded-xl text-center mb-4 block w-full" placeholder="ODA ADI" value={roomName} onChange={e => setRoomName(e.target.value.toUpperCase())} />
            <button onClick={joinRoom} className="bg-blue-600 px-8 py-4 rounded-xl font-bold w-full">KATIL</button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <div className="flex-1 p-4 relative">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover rounded-3xl bg-zinc-900" style={{transform: 'scaleX(-1)'}} />
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-4">
              <button onClick={() => window.location.reload()} className="bg-red-600 p-4 rounded-full"><PhoneOff /></button>
            </div>
          </div>
          <div className="w-full md:w-80 border-l border-zinc-800 flex flex-col">
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {messages.map(m => (
                <div key={m.id} className={`p-3 rounded-xl ${m.uid === user.uid ? 'bg-blue-600 ml-auto' : 'bg-zinc-800 mr-auto'} max-w-[80%]`}>
                  <p className="text-[10px] opacity-50">{m.sender}</p>
                  <p className="text-sm">{m.text}</p>
                </div>
              ))}
            </div>
            <form onSubmit={sendMessage} className="p-4 border-t border-zinc-800 flex gap-2">
              <input className="flex-1 bg-zinc-900 p-2 rounded-lg outline-none" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Mesaj..." />
              <button className="bg-blue-600 p-2 rounded-lg"><Send size={18} /></button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
