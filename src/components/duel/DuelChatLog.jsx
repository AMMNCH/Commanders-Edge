import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, ChevronDown } from 'lucide-react';

export default function DuelChatLog({ chatLog = [], playerIndex, playerName, onSend }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open && bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [open, chatLog.length]);

  const send = () => {
    if (!msg.trim()) return;
    onSend(msg.trim());
    setMsg('');
  };

  const unread = chatLog.filter(m => m.type !== 'system' && m.player_index !== playerIndex).length;

  return (
    <div className="rounded-xl bg-slate-900/80 border border-white/10 overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-3 py-2.5 active:bg-white/5">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-white/40" />
          <span className="text-white/60 text-xs font-bold">Game Log</span>
          {!open && unread > 0 && (
            <span className="w-4 h-4 rounded-full bg-amber-500 text-black text-[9px] font-black flex items-center justify-center">{unread}</span>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="border-t border-white/10">
              <div className="h-40 overflow-y-auto px-3 py-2 space-y-1.5">
                {chatLog.map((entry, i) => (
                  <div key={i} className={`text-xs ${entry.type === 'system' ? 'text-white/30 italic' : entry.player_index === playerIndex ? 'text-amber-200' : 'text-white/70'}`}>
                    {entry.type !== 'system' && (
                      <span className="font-bold mr-1" style={{ color: entry.player_index === 0 ? '#60a5fa' : '#f87171' }}>
                        {entry.player_name}:
                      </span>
                    )}
                    {entry.message}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <div className="flex gap-2 px-3 pb-3 pt-1">
                <input
                  value={msg} onChange={e => setMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && send()}
                  placeholder="Send message..."
                  className="flex-1 bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white text-xs placeholder-white/20 focus:outline-none focus:border-amber-500"
                />
                <button onClick={send} disabled={!msg.trim()}
                  className="w-9 h-9 rounded-xl bg-amber-500/30 border border-amber-500/50 text-amber-300 flex items-center justify-center disabled:opacity-30 active:scale-95">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}