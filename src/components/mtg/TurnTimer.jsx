import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function TurnTimer({ startedAt, isMyTurn }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const update = () => {
      setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const secs = String(elapsed % 60).padStart(2, '0');
  const isWarning = elapsed > 120;

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-mono font-bold transition-colors ${
      isMyTurn
        ? isWarning ? 'bg-red-500/25 text-red-300' : 'bg-green-500/20 text-green-300'
        : 'bg-white/10 text-white/40'
    }`}>
      <Clock className="w-3.5 h-3.5" />
      {mins}:{secs}
    </div>
  );
}