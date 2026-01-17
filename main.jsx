import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  collection, 
  addDoc 
} from 'firebase/firestore';
import { 
  Mic, 
  MicOff, 
  Camera, 
  CameraOff, 
  PhoneOff, 
  Wind,
  User,
  Users
} from 'lucide-react';

/**
 * FIREBASE YAPILANDIRMASI
 */
const firebaseConfig = {
  apiKey: "AIzaSyCgw5ip7yWYo4yxwgI7n1nV0bpId6CqRc8",
  authDomain: "poyraz-arama.firebaseapp.com",
  projectId: "poyraz-arama",
  storageBucket: "poyraz-arama.firebasestorage.app",
  messagingSenderId: "302327435109",
  appId: "1:302327435109:web:e3690705e41873fdb35b8c"
};

// Uygulama Başlatma (Hata payını azaltmak için globalde başlatıyoruz)
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const APP_ID = "poyraz-arama";

const servers = {
  iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }],
  iceCandidatePoolSize: 10,
};

function App() {
  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isInCall, setIsInCall] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [error, setError] = useState(null);
  const [remoteParticipants, setRemoteParticipants] = useState({});

  const localVideoRef = useRef(null);
  const localStream = useRef(null);
  const peerConnections = useRef({}); 

  // Firebase Anonim Giriş Takibi
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) {
        signInAnonymously(auth).catch(err => {
          setError("Bağlantı Hatası: " + err.message);
        });
      } else {
        setUser(u);
      }
    });
    return () => unsubscribe();
  }, []);

  // Kamera ve Mikrofon Kurulumu
  const setupLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (err) {
      setError("Kamera veya Mikrofon izni alınamadı. Lütfen tarayıcı ayarlarını kontrol edin.");
      throw err;
    }
  };

  // WebRTC Peer Connection Oluşturma
  const createPeerConnection = (remoteUid, remoteName) => {
    const pc = new RTCPeerConnection(servers);
    peerConnections.current[remoteUid] = pc;
    
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => pc.addTrack(track, localStream.current));
    }
    
    pc.ontrack = (event) => {
      setRemoteParticipants(prev => ({
        ...prev,
        [remoteUid]: { stream: event.streams[0], name: remoteName }
      }));
    };
    
    return pc;
  };

  // Görüşmeyi Başlatma
  const startMeeting = async () => {
    if (!roomName || !displayName || !user) return;
    try {
      setIsInCall(true);
      await setupLocalMedia();
      
      const roomPath = `artifacts/${APP_ID}/public/data/rooms/${roomName}`;
      const userRef = doc(db, `${roomPath}/participants/${user.uid}`);
      
      await setDoc(userRef, { uid: user.uid, name: displayName, joinedAt: Date.now() });

      // Katılımcıları İzle (Yeni biri gelirse bağlan)
      onSnapshot(collection(db, `${roomPath}/participants`), (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added' && change.doc.id !== user.uid) {
            const pData = change.doc.data();
            initiateConnection(pData.uid, pData.name);
          }
        });
      });

      // Gelen Sinyalleri İzle
      onSnapshot(collection(db, `${roomPath}/participants/${user.uid}/signals`), (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') handleSignal(change.doc.data());
        });
      });
      
    } catch (err) {
      setIsInCall(false);
      setError(err.message);
    }
  };

  const initiateConnection = async (remoteUid, remoteName) => {
    const pc = createPeerConnection(remoteUid, remoteName);
    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal(remoteUid, { type: 'ice', candidate: e.candidate.toJSON() });
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal(remoteUid, { type: 'offer', sdp: offer.sdp, senderName: displayName });
  };

  const handleSignal = async (data) => {
    const { from, type, sdp, candidate, senderName } = data;
    let pc = peerConnections.current[from] || createPeerConnection(from, senderName);
    
    try {
      if (type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription({ type, sdp }));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal(from, { type: 'answer', sdp: answer.sdp, senderName: displayName });
      } else if (type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription({ type, sdp }));
      } else if (type === 'ice' && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (e) {
      console.error("Sinyal hatası:", e);
    }
  };

  const sendSignal = async (toUid, payload) => {
    const signalPath = `artifacts/${APP_ID}/public/data/rooms/${roomName}/participants/${toUid}/signals`;
    await addDoc(collection(db, signalPath), {
      ...payload, from: user.uid, timestamp: Date.now()
    });
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans">
      <nav className="p-4 border-b border-white/10 flex justify-between items-center bg-zinc-900 sticky top-0 z-50">
        <div className="flex items-center gap-2 text-blue-500 font-bold italic tracking-tighter">
          <Wind className="w-6 h-6" /> POYRAZ ARAMA
        </div>
      </nav>
      
      <main className="flex-1 flex flex-col p-4 justify-center items-center">
        {error && (
          <div className="bg-red-500/20 text-red-500 p-4 rounded-2xl mb-4 text-sm border border-red-500/50 max-w-sm w-full text-center">
            {error}
          </div>
        )}
        
        {!isInCall ? (
          <div className="bg-zinc-900 p-8 rounded-[2.5rem] w-full max-w-sm border border-white/5 shadow-2xl">
            <h2 className="text-3xl font-black mb-8 text-center text-blue-500 italic tracking-widest uppercase">Poyraz</h2>
            <div className="space-y-4">
              <div className="relative">
                <User className="absolute left-4 top-4 text-zinc-500 w-5 h-5" />
                <input 
                  className="w-full bg-black border border-white/10 p-4 pl-12 rounded-2xl outline-none focus:border-blue-500 transition-all" 
                  placeholder="Adınız" 
                  value={displayName} 
                  onChange={e => setDisplayName(e.target.value)} 
                />
              </div>
              <div className="relative">
                <Users className="absolute left-4 top-4 text-zinc-500 w-5 h-5" />
                <input 
                  className="w-full bg-black border border-white/10 p-4 pl-12 rounded-2xl outline-none focus:border-blue-500 transition-all" 
                  placeholder="Oda Adı" 
                  value={roomName} 
                  onChange={e => setRoomName(e.target.value.toLowerCase().replace(/\s/g, '-'))} 
                />
              </div>
              <button 
                onClick={startMeeting} 
                disabled={!user || !displayName || !roomName}
                className="w-full bg-blue-600 p-4 rounded-2xl font-black hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-30 mt-2"
              >
                GÖRÜŞMEYİ BAŞLAT
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-6xl flex flex-col gap-4 h-[calc(100vh-140px)]">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto p-2">
              <div className="relative aspect-video shadow-2xl overflow-hidden rounded-3xl border border-blue-600">
                <video 
                  ref={localVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full bg-zinc-900 object-cover scale-x-[-1]" 
                />
                <div className="absolute bottom-4 left-4 bg-blue-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                  SİZ ({displayName})
                </div>
              </div>
              
              {Object.entries(remoteParticipants).map(([uid, p]) => (
                <div key={uid} className="relative aspect-video shadow-2xl overflow-hidden rounded-3xl border border-white/10">
                  <video 
                    autoPlay 
                    playsInline 
                    ref={el => { if(el) el.srcObject = p.stream }} 
                    className="w-full h-full bg-zinc-900 object-cover" 
                  />
                  <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10">
                    {p.name}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex justify-center gap-6 p-5 bg-zinc-900/90 backdrop-blur-2xl rounded-3xl w-fit mx-auto border border-white/10 shadow-2xl mb-4">
              <button 
                onClick={() => { if(localStream.current) { const a = localStream.current.getAudioTracks()[0]; a.enabled = !a.enabled; setIsMicOn(a.enabled); } }} 
                className={`p-4 rounded-2xl transition-all ${isMicOn ? 'bg-zinc-800' : 'bg-red-600'}`}
              >
                {isMicOn ? <Mic size={24}/> : <MicOff size={24}/>}
              </button>
              <button 
                onClick={() => { if(localStream.current) { const v = localStream.current.getVideoTracks()[0]; v.enabled = !v.enabled; setIsCameraOn(v.enabled); } }} 
                className={`p-4 rounded-2xl transition-all ${isCameraOn ? 'bg-zinc-800' : 'bg-red-600'}`}
              >
                {isCameraOn ? <Camera size={24}/> : <CameraOff size={24}/>}
              </button>
              <div className="w-px h-10 bg-white/10 mx-2" />
              <button 
                onClick={() => window.location.reload()} 
                className="bg-red-600 p-4 rounded-2xl hover:bg-red-500 transition-all px-10"
              >
                <PhoneOff size={24}/>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Uygulamanın en altına render işlemini ekliyoruz
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
