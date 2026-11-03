import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, PhoneOff, Radio } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export default function VoiceChat({ channelId, playerIndex, playerName }) {
  const [status, setStatus] = useState('idle'); // idle | connecting | connected | error
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pollingRef = useRef(null);
  const isOffererRef = useRef(playerIndex === 0); // P0 = offerer

  const cleanup = () => {
    clearInterval(pollingRef.current);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setStatus('idle');
  };

  const sendSignal = async (type, payload) => {
    await base44.entities.WebRTCSignal.create({
      channel_id: channelId,
      from_player: playerIndex,
      to_player: 1 - playerIndex,
      signal_type: type,
      payload: JSON.stringify(payload),
      consumed: false,
    });
  };

  const pollSignals = async () => {
    const signals = await base44.entities.WebRTCSignal.filter({
      channel_id: channelId,
      to_player: playerIndex,
      consumed: false,
    });
    for (const sig of (signals || [])) {
      await base44.entities.WebRTCSignal.update(sig.id, { consumed: true });
      const data = JSON.parse(sig.payload);
      const pc = pcRef.current;
      if (!pc) continue;
      if (sig.signal_type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal('answer', answer);
      } else if (sig.signal_type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
      } else if (sig.signal_type === 'candidate') {
        await pc.addIceCandidate(new RTCIceCandidate(data));
      } else if (sig.signal_type === 'hangup') {
        cleanup();
      }
    }
  };

  const startCall = async () => {
    setStatus('connecting');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0];
      }
      setStatus('connected');
    };

    pc.onicecandidate = async (e) => {
      if (e.candidate) await sendSignal('candidate', e.candidate);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setStatus('connected');
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') setStatus('error');
    };

    if (isOffererRef.current) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal('offer', offer);
    }

    pollingRef.current = setInterval(pollSignals, 1500);
  };

  const endCall = async () => {
    await sendSignal('hangup', {});
    cleanup();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = muted; });
    }
    setMuted(v => !v);
  };

  const toggleDeafen = () => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !deafened;
    }
    setDeafened(v => !v);
  };

  useEffect(() => () => cleanup(), []);

  const statusColor = { idle: '#6b7280', connecting: '#f59e0b', connected: '#22c55e', error: '#ef4444' }[status];
  const statusLabel = { idle: 'Voice Off', connecting: 'Connecting...', connected: 'Live', error: 'Failed' }[status];

  return (
    <div className="relative">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Compact pill */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all"
        style={{ background: statusColor + '22', borderColor: statusColor + '55', color: statusColor }}
      >
        <motion.div animate={status === 'connected' ? { scale: [1, 1.3, 1] } : {}} transition={{ repeat: Infinity, duration: 1.5 }}>
          <Radio className="w-3.5 h-3.5" />
        </motion.div>
        {statusLabel}
      </button>

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 4 }}
            className="absolute top-full right-0 mt-2 z-50 bg-slate-900 border border-white/15 rounded-2xl p-4 w-56 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold text-sm">Voice Chat</h3>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: statusColor }} />
                <span className="text-xs" style={{ color: statusColor }}>{statusLabel}</span>
              </div>
            </div>

            {status === 'idle' && (
              <button onClick={startCall}
                className="w-full py-2.5 rounded-xl bg-green-600/30 border border-green-500/50 text-green-300 text-sm font-bold active:scale-95 flex items-center justify-center gap-2">
                <Mic className="w-4 h-4" /> Start Voice Chat
              </button>
            )}

            {(status === 'connecting' || status === 'connected') && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button onClick={toggleMute}
                    className={`flex-1 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 ${muted ? 'bg-red-600/30 border-red-500/50 text-red-300' : 'bg-white/10 border-white/15 text-white/60'}`}>
                    {muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    {muted ? 'Muted' : 'Mute'}
                  </button>
                  <button onClick={toggleDeafen}
                    className={`flex-1 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 ${deafened ? 'bg-orange-600/30 border-orange-500/50 text-orange-300' : 'bg-white/10 border-white/15 text-white/60'}`}>
                    {deafened ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    {deafened ? 'Deaf' : 'Deafen'}
                  </button>
                </div>
                <button onClick={endCall}
                  className="w-full py-2 rounded-xl bg-red-700/30 border border-red-600/40 text-red-300 text-xs font-bold flex items-center justify-center gap-2">
                  <PhoneOff className="w-3.5 h-3.5" /> End Call
                </button>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-2">
                <p className="text-red-400 text-xs text-center">Connection failed. Check mic permissions.</p>
                <button onClick={startCall}
                  className="w-full py-2 rounded-xl bg-white/10 border border-white/15 text-white/60 text-xs font-bold">
                  Retry
                </button>
              </div>
            )}

            <p className="text-white/20 text-[10px] mt-3 text-center">Peer-to-peer · End-to-end</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}