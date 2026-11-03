import React, { useRef, useState, useEffect, useCallback } from 'react';

const ITEM_H = 52;
const VISIBLE = 5;
const PAD = Math.floor(VISIBLE / 2);

const C_CHORD_OCTAVES = [
  { root: 130.81, third: 164.81, fifth: 196.00 },
  { root: 261.63, third: 329.63, fifth: 392.00 },
  { root: 523.25, third: 659.25, fifth: 783.99 },
  { root: 1046.50, third: 1318.51, fifth: 1567.98 },
];

function getPIRChordFreqs(step) {
  const octaveIdx = Math.min(Math.floor(step / 7), C_CHORD_OCTAVES.length - 1);
  const rotation = Math.floor(step / 7);
  const oct = C_CHORD_OCTAVES[octaveIdx];
  const nextOct = C_CHORD_OCTAVES[Math.min(octaveIdx + 1, C_CHORD_OCTAVES.length - 1)];
  if (rotation === 0) return [oct.root];
  if (rotation === 1) return [oct.root, oct.third];
  if (rotation === 2) return [oct.root, oct.third, oct.fifth];
  return [oct.root, oct.fifth, nextOct.root];
}

function playTick(up, audioCtx) {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(up ? 660 : 440, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.06);
  } catch (_) {}
}

function playPIRTick(currentValue, startLife, audioCtx) {
  if (!audioCtx) return;
  try {
    const step = Math.max(0, currentValue - startLife);
    const freqs = getPIRChordFreqs(step);
    freqs.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      const offset = idx * 0.012;
      gain.gain.setValueAtTime(0, audioCtx.currentTime + offset);
      gain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + offset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + offset + 0.28);
      osc.start(audioCtx.currentTime + offset);
      osc.stop(audioCtx.currentTime + offset + 0.3);
    });
  } catch (_) {}
}

// Descending "bwaa bwaa bwaa bwaaaa" trombone tick — played every step down
function playDescendingTick(audioCtx) {
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sawtooth';
    // Slides down like a sad trombone note
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.18);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch (_) {}
}

// Full "Wah Wah Wah Waaah" only on first crossing below start
function playSadTrombone(audioCtx) {
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const wahs = [
      { start: 0.0,  startF: 466, endF: 349, dur: 0.28 },
      { start: 0.28, startF: 415, endF: 311, dur: 0.28 },
      { start: 0.56, startF: 370, endF: 277, dur: 0.28 },
      { start: 0.84, startF: 330, endF: 196, dur: 0.65 },
    ];
    wahs.forEach(({ start, startF, endF, dur }) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(startF, now + start);
      osc.frequency.exponentialRampToValueAtTime(endF, now + start + dur);
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.18, now + start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    });
  } catch (_) {}
}

// Audience GASP — sharp inhale + staggered shocked "aaah" voices
function playAudienceGasp(audioCtx) {
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    // Sharp inhale: noise burst with rising filter sweep
    const bufferSize = audioCtx.sampleRate * 0.15;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let j = 0; j < bufferSize; j++) data[j] = (Math.random() * 2 - 1);
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(400, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(2800, now + 0.12);
    noiseFilter.Q.value = 2;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    noise.start(now);
    noise.stop(now + 0.15);

    // Staggered shocked "AAAHH" voices rising in pitch
    const voices = [
      { freq: 280, delay: 0.05, rise: 1.4 },
      { freq: 320, delay: 0.07, rise: 1.5 },
      { freq: 260, delay: 0.09, rise: 1.35 },
      { freq: 350, delay: 0.06, rise: 1.6 },
      { freq: 300, delay: 0.10, rise: 1.45 },
      { freq: 240, delay: 0.08, rise: 1.3 },
    ];
    voices.forEach(({ freq, delay, rise }) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);
      osc.frequency.exponentialRampToValueAtTime(freq * rise, now + delay + 0.5);
      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.08, now + delay + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.6);
      osc.start(now + delay);
      osc.stop(now + delay + 0.65);
    });
  } catch (_) {}
}

export default function LifeWheelPickerDefault() { return null; }

export function InlineSpinWheel({ value, onChange, accentColor, audioCtx, pirMode, startLife }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [visualOffset, setVisualOffset] = useState(0);

  const displayRef = useRef(value);
  const offsetRef = useRef(0);
  const lastYRef = useRef(0);
  const velRef = useRef(0);
  const rafRef = useRef(null);
  const isDragging = useRef(false);
  const containerRef = useRef(null);
  const lastTickRef = useRef(value);
  const sadPlayedRef = useRef(false);

  useEffect(() => {
    setDisplayValue(value);
    displayRef.current = value;
    lastTickRef.current = value;
  }, []); // eslint-disable-line

  const minVal = -999;
  const maxVal = 9999;

  const applyOffset = useCallback((rawOffset) => {
    setVisualOffset(rawOffset);
    const steps = Math.round(rawOffset / ITEM_H);
    const tentative = Math.max(minVal, Math.min(maxVal, displayRef.current - steps));

    if (tentative !== lastTickRef.current) {
      const up = tentative > lastTickRef.current;
      lastTickRef.current = tentative;
      onChange(tentative);
      if (pirMode) {
        const sl = startLife ?? value;
        if (tentative <= 0) {
          // Hit zero — audience GASP
          if (!sadPlayedRef.current) {
            sadPlayedRef.current = true;
            playSadTrombone(audioCtx);
            setTimeout(() => playAudienceGasp(audioCtx), 1600);
          } else {
            playDescendingTick(audioCtx);
          }
        } else if (tentative < sl) {
          // Every descending step below start gets the descending tick
          if (!sadPlayedRef.current) {
            sadPlayedRef.current = true;
            playSadTrombone(audioCtx);
          } else {
            playDescendingTick(audioCtx);
          }
        } else {
          sadPlayedRef.current = false;
          playPIRTick(tentative, sl, audioCtx);
        }
      } else {
        playTick(up, audioCtx);
      }
    }
  }, [onChange, audioCtx, pirMode, startLife, value, minVal, maxVal]);

  const snap = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const steps = Math.round(offsetRef.current / ITEM_H);
    const finalVal = Math.max(minVal, Math.min(maxVal, displayRef.current - steps));
    displayRef.current = finalVal;
    setDisplayValue(finalVal);
    lastTickRef.current = finalVal;
    offsetRef.current = 0;
    setVisualOffset(0);
    onChange(finalVal);
  }, [onChange, minVal, maxVal]);

  const runMomentum = useCallback(() => {
    let vel = velRef.current;
    const tick = () => {
      if (Math.abs(vel) < 0.5) { snap(); return; }
      offsetRef.current += vel;
      applyOffset(offsetRef.current);
      vel *= 0.88;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [snap, applyOffset]);

  const onPointerDown = (e) => {
    e.preventDefault();
    cancelAnimationFrame(rafRef.current);
    clearTimeout(rafRef.snapTimer);
    isDragging.current = true;
    lastYRef.current = e.clientY;
    velRef.current = 0;
    const steps = Math.round(offsetRef.current / ITEM_H);
    const midVal = Math.max(minVal, Math.min(maxVal, displayRef.current - steps));
    displayRef.current = midVal;
    setDisplayValue(midVal);
    lastTickRef.current = midVal;
    offsetRef.current = 0;
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!isDragging.current) return;
    const dy = e.clientY - lastYRef.current;
    velRef.current = dy;
    lastYRef.current = e.clientY;
    offsetRef.current += dy;
    applyOffset(offsetRef.current);
  };

  const onPointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    runMomentum();
  };

  const onWheel = (e) => {
    e.preventDefault();
    cancelAnimationFrame(rafRef.current);
    offsetRef.current += -e.deltaY * 0.8;
    applyOffset(offsetRef.current);
    clearTimeout(rafRef.snapTimer);
    rafRef.snapTimer = setTimeout(snap, 120);
  };

  const currentCenter = displayRef.current - Math.round(visualOffset / ITEM_H);
  const items = [];
  for (let i = -PAD - 1; i <= PAD + 1; i++) {
    items.push({ i, num: currentCenter + i });
  }

  const subOffset = visualOffset - Math.round(visualOffset / ITEM_H) * ITEM_H;

  return (
    <div
      ref={containerRef}
      className="relative touch-none cursor-grab active:cursor-grabbing select-none"
      style={{ width: '100%', height: ITEM_H * VISIBLE, overflow: 'hidden' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <div className="absolute inset-0 pointer-events-none z-20" style={{
        background: `linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 28%, transparent 42%, transparent 58%, rgba(0,0,0,0.2) 72%, rgba(0,0,0,0.9) 100%)`
      }} />

      <div className="absolute left-0 right-0 pointer-events-none z-10" style={{
        top: ITEM_H * PAD, height: ITEM_H,
        background: `linear-gradient(to bottom, ${accentColor}12, ${accentColor}25, ${accentColor}12)`,
      }} />
      <div className="absolute left-3 right-3 pointer-events-none z-10" style={{ top: ITEM_H * PAD, height: 1.5, background: `${accentColor}88` }} />
      <div className="absolute left-3 right-3 pointer-events-none z-10" style={{ top: ITEM_H * (PAD + 1) - 1, height: 1.5, background: `${accentColor}88` }} />

      {items.map(({ i, num }) => {
        const visualPos = i - subOffset / ITEM_H;
        const dist = Math.abs(visualPos);
        const scale = Math.max(0.55, 1 - dist * 0.14);
        const opacity = Math.max(0.06, 1 - dist * 0.42);
        const rotX = visualPos * -16;
        const isCenter = dist < 0.6;
        const isBelowStart = pirMode && num < (startLife ?? value);

        return (
          <div
            key={i}
            className="absolute left-0 right-0 flex items-center justify-center"
            style={{
              height: ITEM_H,
              top: ITEM_H * (PAD + i),
              transform: `translateY(${subOffset}px) perspective(500px) rotateX(${rotX}deg) scale(${scale})`,
              opacity: isBelowStart ? opacity * 0.5 : opacity,
              fontSize: isCenter ? 42 : 26,
              fontWeight: 900,
              color: isBelowStart ? (isCenter ? '#f87171' : '#7f1d1d') : isCenter ? '#fff' : `${accentColor}cc`,
              fontVariantNumeric: 'tabular-nums',
              textShadow: isCenter && isBelowStart ? '0 0 20px rgba(248,113,113,0.6)' : isCenter ? `0 0 20px ${accentColor}88` : 'none',
              willChange: 'transform',
              transition: 'none',
            }}
          >
            {num}
          </div>
        );
      })}
    </div>
  );
}