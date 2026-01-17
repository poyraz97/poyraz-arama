import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { Camera, CameraOff, Mic, MicOff, PhoneOff, Wind, User, MessageSquare, Send, LogOut, Users } from 'lucide-react';

// Firebase Yapılandırması
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
  const [roomName, setRoomName] = useState('');
  const [isInCall, setIsInCall] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const localVideoRef = useRef(null);
  const localStream = useRef(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  const login = () => signInWithPopup(auth, googleProvider);

  const startCall = async () => {
    if (!roomName) return;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStream.current = stream;
    setIsInCall(true);
    setTimeout(() => { if (localVideoRef.current) localVideoRef.current.srcObject = stream; }, 100);
    
    const q = query(collection(db, 'rooms', roomName, 'messages'), orderBy('timestamp', 'asc'), limit(50));
    onSnapshot(q, (s) => setMessages(s.docs.map(d => ({ id: d.id, ...d.data() }))));
  };

  const sendMsg = async (e) => {
    e.preventDefault();
    if (!newMessage) return;
    await addDoc(collection(db, 'rooms', roomName, 'messages'), {
      text: newMessage,
      sender: user.displayName,
      timestamp: serverTimestamp()
    });
    setNewMessage('');
  };

  if (!user) return (
    <div className="h-screen flex items-center justify-center bg-black text-white">
      <button onClick={login} className="bg-blue-600 px-8 py-4 rounded-2xl font-bold flex items-center gap-2">
        <Wind /> Google ile Giriş Yap
      </button>
    </div>
  );

  return (
    <div className="h-screen bg-[#050505] text-white flex flex-col">
      <nav className="p-6 border-b border-white/5 flex justify-between items-center">
        <h1 className="text-2xl font-black italic uppercase">Poyraz</h1>
        <button onClick={() => signOut(auth)} className="text-slate-500 hover:text-white"><LogOut /></button>
      </nav>

      {!isInCall ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white/5 p-10 rounded-[40px] border border-white/10 text-center">
            <h2 className="text-2xl font-bold mb-6">Görüşmeye Başla</h2>
            <input className="w-full bg-black border border-white/10 p-4 rounded-xl text-center mb-4" placeholder="ODA ADI" onChange={e => setRoomName(e.target.value.toUpperCase())} />
            <button onClick={startCall} className="w-full bg-blue-600 py-4 rounded-xl font-bold uppercase tracking-widest">Bağlan</button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row">
          <div className="flex-1 p-6 relative bg-black">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover rounded-3xl border-2 border-blue-600" />
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-4 bg-black/50 p-4 rounded-full backdrop-blur-xl">
              <button onClick={() => { 
                const t = localStream.current.getVideoTracks()[0]; 
                t.enabled = !t.enabled; setIsCameraOn(t.enabled); 
              }} className={`p-4 rounded-full ${isCameraOn ? 'bg-white/10' : 'bg-red-500'}`}>
                {isCameraOn ? <Camera /> : <CameraOff />}
              </button>
              <button onClick={() => window.location.reload()} className="p-4 bg-red-600 rounded-full"><PhoneOff /></button>
            </div>
          </div>
          
          <div className="w-full md:w-80 border-l border-white/5 flex flex-col bg-white/5">
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {messages.map(m => (
                <div key={m.id} className="bg-white/10 p-3 rounded-xl text-sm">
                  <p className="font-bold text-[10px] text-blue-400 mb-1">{m.sender}</p>
                  <p>{m.text}</p>
                </div>
              ))}
            </div>
            <form onSubmit={sendMsg} className="p-4 border-t border-white/5 flex gap-2">
              <input className="flex-1 bg-black p-2 rounded-lg text-xs outline-none" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Mesaj..." />
              <button className="bg-blue-600 p-2 rounded-lg"><Send size={16} /></button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
