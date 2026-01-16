import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query
} from 'firebase/firestore';
import { 
  Camera, 
  CameraOff, 
  Mic, 
  MicOff, 
  PhoneOff, 
  Video, 
  MonitorUp, 
  Copy,
  Users,
  Wind,
  User
} from 'lucide-react';

// Firebase yapılandırması
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'poyraz-arama';

const servers = {
  iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }],
  iceCandidatePoolSize: 10,
};

export default function App() {
  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isInCall, setIsInCall] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [error, setError] = useState(null);
  const [remoteParticipants, setRemoteParticipants] = useState({}); // { uid: { stream, name } }

  const localVideoRef = useRef();
  const localStream = useRef(null);
  const peerConnections = useRef({}); 

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
        setError("Kimlik doğrulama başarısız oldu.");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
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
      setError("Kamera veya mikrofon izni verilmedi.");
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
        [remoteUid]: { 
          stream: event.streams[0],
          name: remoteName || `Katılımcı ${remoteUid.substring(0, 4)}`
        }
      }));
    };

    return pc;
  };

  const startMeeting = async () => {
    if (!roomName || !user || !displayName) {
      setError("Lütfen adınızı ve oda adını girin.");
      return;
    }
    
    try {
      setIsInCall(true);
      const stream = await setupLocalMedia();

      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomName);
      const userRef = doc(roomRef, 'participants', user.uid);
      
      // Kayıt olurken ismi de gönderiyoruz
      await setDoc(userRef, { 
        joinedAt: Date.now(), 
        uid: user.uid, 
        name: displayName 
      });

      const participantsRef = collection(roomRef, 'participants');
      onSnapshot(participantsRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          const pData = change.doc.data();
          if (change.type === 'added' && pData.uid !== user.uid) {
            initiateConnection(pData.uid, pData.name);
          }
        });
      }, (err) => console.error("Permission Error:", err));

      const signalsRef = collection(userRef, 'signals');
      onSnapshot(signalsRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            handleSignal(change.doc.data());
          }
        });
      }, (err) => console.error("Permission Error:", err));

    } catch (err) {
      console.error("Meeting error:", err);
      setIsInCall(false);
    }
  };

  const initiateConnection = async (remoteUid, remoteName) => {
    const pc = createPeerConnection(remoteUid, remoteName);
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(remoteUid, { type: 'ice', candidate: event.candidate.toJSON() });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal(remoteUid, { 
      type: 'offer', 
      sdp: offer.sdp, 
      senderName: displayName // Teklif gönderirken ismimizi de gönderiyoruz
    });
  };

  const handleSignal = async (data) => {
    const { from, type, sdp, candidate, senderName } = data;
    let pc = peerConnections.current[from];

    if (!pc) pc = createPeerConnection(from, senderName);

    try {
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
    } catch (e) {
      console.error("Signal handling error:", e);
    }
  };

  const sendSignal = async (toUid, payload) => {
    if (!user) return;
    try {
      const targetSignalsRef = collection(db, 'artifacts', appId, 'public', 'data', 'rooms', roomName, 'participants', toUid, 'signals');
      await addDoc(targetSignalsRef, { ...payload, from: user.uid, timestamp: Date.now() });
    } catch (e) {
      console.error("Signal sending error:", e);
    }
  };

  const endCall = () => window.location.reload();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <nav className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-blue-500 p-2 rounded-xl shadow-lg shadow-blue-500/20">
            <Wind className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-black tracking-tighter uppercase italic">Poyraz Arama</span>
        </div>
        {isInCall && (
          <div className="flex items-center gap-3">
            <div className="bg-slate-800 px-4 py-1.5 rounded-full text-xs font-medium border border-slate-700 hidden sm:block">
              Oda: <span className="text-blue-400 font-bold">{roomName}</span>
            </div>
            <div className="bg-blue-500/10 text-blue-400 px-4 py-1.5 rounded-full text-xs font-bold border border-blue-500/20">
              {displayName}
            </div>
          </div>
        )}
      </nav>

      <main className="flex-1 flex flex-col p-4">
        {error && (
          <div className="max-w-md mx-auto w-full bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl mb-6 text-sm flex items-center gap-3">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            {error}
          </div>
        )}

        {!isInCall ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-sm bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2 italic">POYRAZ</h2>
                <p className="text-slate-400 text-sm tracking-wide">Yüksek hızlı video konferans paneli.</p>
              </div>
              
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 ml-1">Adınız</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Adınızı girin"
                      className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl pl-12 pr-5 py-4 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 ml-1">Oda İsmi</label>
                  <div className="relative">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value.toLowerCase().replace(/\s/g, '-'))}
                      placeholder="oda-adi"
                      className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl pl-12 pr-5 py-4 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600 font-medium"
                    />
                  </div>
                </div>
                
                <button
                  onClick={startMeeting}
                  disabled={!roomName || !user || !displayName}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 py-4 rounded-2xl font-bold shadow-xl shadow-blue-600/20 transition-all transform active:scale-[0.98] mt-2"
                >
                  {user ? "Görüşmeye Katıl" : "Bağlanıyor..."}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-fr overflow-y-auto max-h-[calc(100vh-180px)] p-2">
              {/* Yerel Video */}
              <div className="relative group bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-lg aspect-video ring-2 ring-blue-500/50">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute bottom-3 left-3 bg-blue-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-lg border border-white/10">
                  {displayName} (Siz)
                </div>
              </div>

              {/* Uzak Videolar */}
              {Object.entries(remoteParticipants).map(([uid, participant]) => (
                <div key={uid} className="relative group bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-lg aspect-video">
                  <video
                    autoPlay
                    playsInline
                    ref={(el) => { if (el && participant.stream) el.srcObject = participant.stream; }}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-white/10">
                    {participant.name}
                  </div>
                </div>
              ))}
            </div>

            {/* Kontroller */}
            <div className="bg-slate-900/80 backdrop-blur-xl p-4 rounded-3xl border border-slate-800 flex items-center justify-center gap-4 sm:gap-6 shadow-2xl max-w-2xl mx-auto w-full mb-4">
              <button
                onClick={() => {
                  if (localStream.current) {
                    const audio = localStream.current.getAudioTracks()[0];
                    audio.enabled = !audio.enabled;
                    setIsMicOn(audio.enabled);
                  }
                }}
                className={`p-4 rounded-2xl transition-all ${isMicOn ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-red-500/20 text-red-500 border border-red-500/50'}`}
              >
                {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              <button
                onClick={() => {
                  if (localStream.current) {
                    const video = localStream.current.getVideoTracks()[0];
                    video.enabled = !video.enabled;
                    setIsCameraOn(video.enabled);
                  }
                }}
                className={`p-4 rounded-2xl transition-all ${isCameraOn ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-red-500/20 text-red-500 border border-red-500/50'}`}
              >
                {isCameraOn ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
              </button>

              <div className="w-px h-8 bg-slate-800 mx-2" />

              <button
                onClick={endCall}
                className="p-4 rounded-2xl bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-600/30 transition-all transform hover:scale-105 active:scale-95 px-8"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="p-4 text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest bg-slate-900/30">
        &copy; 2026 Poyraz Arama Altyapısı - Yerel Ağ & Geniş Katılım
      </footer>
    </div>
  );
}
