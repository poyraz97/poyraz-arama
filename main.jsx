import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
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

// Firebase Yapılandırması
const firebaseConfig = {
  apiKey: "AIzaSyCgw5ip7yWYo4yxwgI7n1nV0bpId6CqRc8",
  authDomain: "poyraz-arama.firebaseapp.com",
  projectId: "poyraz-arama",
  storageBucket: "poyraz-arama.firebasestorage.app",
  messagingSenderId: "302327435109",
  appId: "1:302327435109:web:e3690705e41873fdb35b8c"
};

// Firebase başlatma
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const servers = {
  iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }],
  iceCandidatePoolSize: 10,
};

const App = () => {
  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isInCall, setIsInCall] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [error, setError] = useState(null);
  const [remoteParticipants, setRemoteParticipants] = useState({});

  const localVideoRef = useRef();
  const localStream = useRef(null);
  const peerConnections = useRef({}); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!u) {
        signInAnonymously(auth).catch(err => setError("Firebase Auth hatası: " + err.message));
      } else {
        setUser(u);
      }
    });
    return () => unsubscribe();
  }, []);

  const setupLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (err) {
      setError("Kamera veya mikrofon izni alınamadı.");
      throw err;
    }
  };

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

  const startMeeting = async () => {
    if (!roomName || !displayName || !user) return;
    try {
      setIsInCall(true);
      await setupLocalMedia();
      const roomRef = doc(db, 'rooms', roomName);
      const userRef = doc(collection(roomRef, 'participants'), user.uid);
      await setDoc(userRef, { uid: user.uid, name: displayName, joinedAt: Date.now() });

      onSnapshot(collection(roomRef, 'participants'), (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added' && change.doc.id !== user.uid) {
            const pData = change.doc.data();
            initiateConnection(pData.uid, pData.name);
          }
        });
      }, (err) => console.error("Katılımcı hatası:", err));

      onSnapshot(collection(userRef, 'signals'), (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') handleSignal(change.doc.data());
        });
      }, (err) => console.error("Sinyal hatası:", err));
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
    
    if (type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription({ type, sdp }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal(from, { type: 'answer', sdp: answer.sdp, senderName: displayName });
    } else if (type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription({ type, sdp }));
    } else if (type === 'ice') {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  const sendSignal = async (toUid, payload) => {
    await addDoc(collection(db, 'rooms', roomName, 'participants', toUid, 'signals'), {
      ...payload, from: user.uid, timestamp: Date.now()
    });
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans">
      <nav className="p-4 border-b border-white/10 flex justify-between items-center bg-zinc-900">
        <div className="flex items-center gap-2 text-blue-500">
          <Wind /> <span className="font-bold text-xl italic uppercase">Poyraz Arama</span>
        </div>
      </nav>
      <main className="flex-1 flex flex-col p-4 justify-center items-center">
        {error && <div className="bg-red-500/20 text-red-500 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        {!isInCall ? (
          <div className="bg-zinc-900 p-8 rounded-3xl w-full max-w-sm border border-white/5 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-center text-blue-400">Giriş Yap</h2>
            <input 
              className="w-full bg-black border border-white/10 p-4 rounded-xl mb-4 focus:border-blue-500 outline-none"
              placeholder="Adınız" value={displayName} onChange={e => setDisplayName(e.target.value)}
            />
            <input 
              className="w-full bg-black border border-white/10 p-4 rounded-xl mb-6 focus:border-blue-500 outline-none"
              placeholder="Oda Adı" value={roomName} onChange={e => setRoomName(e.target.value.toLowerCase())}
            />
            <button 
              onClick={startMeeting}
              className="w-full bg-blue-600 p-4 rounded-xl font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20"
            >
              Görüşmeyi Başlat
            </button>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col gap-4 max-w-6xl">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative group">
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full bg-zinc-900 rounded-2xl border border-blue-500/50 aspect-video object-cover shadow-2xl" />
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-sm border border-white/10 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  Sen ({displayName})
                </div>
              </div>
              {Object.entries(remoteParticipants).map(([uid, p]) => (
                <div key={uid} className="relative group">
                  <video autoPlay playsInline ref={el => { if(el) el.srcObject = p.stream }} className="w-full bg-zinc-900 rounded-2xl border border-white/10 aspect-video object-cover shadow-2xl" />
                  <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-sm border border-white/10">
                    {p.name}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex justify-center gap-6 p-6 bg-zinc-900/80 rounded-full w-fit mx-auto backdrop-blur-xl border border-white/10 shadow-2xl mb-4">
              <button 
                onClick={() => {
                  if (localStream.current) {
                    const audio = localStream.current.getAudioTracks()[0];
                    audio.enabled = !audio.enabled;
                    setIsMicOn(audio.enabled);
                  }
                }}
                className={`p-4 rounded-full transition-all hover:scale-110 ${isMicOn ? 'bg-zinc-800' : 'bg-red-500 ring-4 ring-red-500/20'}`}
              >
                {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
              </button>
              <button 
                onClick={() => {
                  if (localStream.current) {
                    const video = localStream.current.getVideoTracks()[0];
                    video.enabled = !video.enabled;
                    setIsCameraOn(video.enabled);
                  }
                }}
                className={`p-4 rounded-full transition-all hover:scale-110 ${isCameraOn ? 'bg-zinc-800' : 'bg-red-500 ring-4 ring-red-500/20'}`}
              >
                {isCameraOn ? <Camera size={24} /> : <CameraOff size={24} />}
              </button>
              <button 
                onClick={() => window.location.reload()} 
                className="bg-red-600 p-4 rounded-full hover:bg-red-500 hover:scale-110 transition-all shadow-lg shadow-red-600/30"
              >
                <PhoneOff size={24} />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Varsayılan export ve root render işlemini Vercel'in en kararlı bulduğu şekilde güncelledim.
export default App;

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
