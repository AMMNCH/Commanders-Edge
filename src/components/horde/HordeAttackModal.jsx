import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Swords, Zap, ChevronRight, AlertTriangle, Skull } from 'lucide-react';

// Parse keyword abilities from a creature object (stored in notes or ability flags)
function getAbilities(creature) {
  const notes = (creature.notes || '').toLowerCase();
  return {
    doubleStrike: creature.has_double_strike || notes.includes('double strike'),
    firstStrike: creature.has_first_strike || notes.includes('first strike'),
    trample: creature.has_trample || notes.includes('trample'),
    deathtouch: creature.has_deathtouch || notes.includes('deathtouch'),
    lifelink: creature.has_lifelink || notes.includes('lifelink'),
    flying: creature.has_flying || notes.includes('flying'),
    defender: creature.is_defender || notes.includes('defender'),
    haste: creature.has_haste,
    vigilance: creature.has_vigilance || notes.includes('vigilance'),
    indestructible: creature.has_indestructible || notes.includes('indestructible'),
    menace: creature.has_menace || notes.includes('menace'),
    reach: creature.has_reach || notes.includes('reach'),
  };
}

function calcEffectivePower(c) {
  const net = (c.counters?.['+1+1'] || 0) - (c.counters?.['-1-1'] || 0);
  return (c.power || 0) + net;
}
function calcEffectiveToughness(c) {
  const net = (c.counters?.['+1+1'] || 0) - (c.counters?.['-1-1'] || 0);
  return (c.toughness || 0) + net;
}

const PHASE = { ATTACKERS: 0, BLOCKING: 1, DAMAGE: 2 };

export default function HordeAttackModal({ creatures, sharedLife, onResolve, onClose }) {
  // Only untapped, non-defender creatures attack
  const attackers = useMemo(() =>
    creatures.filter(c => !c.tapped && !getAbilities(c).defender),
    [creatures]
  );

  const [phase, setPhase] = useState(PHASE.ATTACKERS);
  // For each attacker id: 'unblocked' | 'blocked_survived' | 'blocked_killed'
  const [blockStates, setBlockStates] = useState({});
  const [damageResult, setDamageResult] = useState(null);

  // ── PHASE 0: Show all attackers ──
  const proceedToBlocking = () => setPhase(PHASE.BLOCKING);

  // ── PHASE 1: Blocking ──
  const setBlock = (id, state) => setBlockStates(prev => ({ ...prev, [id]: state }));

  const proceedToDamage = () => {
    // Fill unset as 'unblocked'
    const filled = { ...blockStates };
    attackers.forEach(a => { if (!filled[a.id]) filled[a.id] = 'unblocked'; });
    setBlockStates(filled);

    // Compute damage
    let totalDamage = 0;
    let hordeLibraryAdditions = 0; // Lifelink adds cards back to the Horde library
    const killedIds = [];
    const survivedIds = [];
    const details = [];

    attackers.forEach(a => {
      const abilities = getAbilities(a);
      const power = calcEffectivePower(a);
      const bs = filled[a.id];

      // Indestructible: treat blocked_killed as blocked_survived
      const effectiveBS = (bs === 'blocked_killed' && abilities.indestructible) ? 'blocked_survived' : bs;

      if (effectiveBS === 'unblocked') {
        let dmg = abilities.doubleStrike ? power * 2 : power;
        totalDamage += dmg;
        if (abilities.lifelink) hordeLibraryAdditions += dmg;
        const noteStr = abilities.indestructible && bs === 'blocked_killed' ? 'Indestructible (survived)' : abilities.doubleStrike ? 'Double Strike' : abilities.firstStrike ? 'First Strike' : null;
        details.push({ name: a.name, dmg, note: noteStr });
        survivedIds.push(a.id);
      } else if (effectiveBS === 'blocked_survived') {
        if (abilities.trample) {
          const toughness = calcEffectiveToughness(a);
          const excess = Math.max(0, power - toughness);
          if (excess > 0) {
            totalDamage += excess;
            if (abilities.lifelink) hordeLibraryAdditions += excess;
            const note = abilities.indestructible && bs === 'blocked_killed' ? 'Indestructible + Trample' : 'Trample excess';
            details.push({ name: a.name, dmg: excess, note });
          } else {
            details.push({ name: a.name, dmg: 0, note: abilities.indestructible && bs === 'blocked_killed' ? 'Indestructible (blocked)' : 'Blocked (no trample)' });
          }
        } else {
          details.push({ name: a.name, dmg: 0, note: abilities.indestructible && bs === 'blocked_killed' ? 'Indestructible (blocked)' : 'Fully blocked' });
        }
        survivedIds.push(a.id);
      } else if (effectiveBS === 'blocked_killed') {
        if (abilities.trample) {
          const toughness = calcEffectiveToughness(a);
          const excess = Math.max(0, power - toughness);
          if (excess > 0) {
            totalDamage += excess;
            if (abilities.lifelink) hordeLibraryAdditions += excess;
            details.push({ name: a.name, dmg: excess, note: 'Killed + Trample' });
          } else {
            details.push({ name: a.name, dmg: 0, note: 'Destroyed in combat' });
          }
        } else {
          details.push({ name: a.name, dmg: 0, note: 'Destroyed in combat' });
        }
        killedIds.push(a.id);
      }
    });

    const newLife = Math.max(0, sharedLife - totalDamage);
    setDamageResult({ totalDamage, hordeLibraryAdditions, details, killedIds, survivedIds, newLife });
    setPhase(PHASE.DAMAGE);
  };

  // ── PHASE 2: Accept damage ──
  const acceptDamage = () => {
    // Vigilance creatures don't tap after attacking
    const tappedIds = damageResult.survivedIds.filter(id => {
      const creature = creatures.find(c => c.id === id);
      return !getAbilities(creature).vigilance;
    });
    onResolve({
      killedIds: damageResult.killedIds,
      tappedIds,
      newLife: damageResult.newLife,
      hordeLibraryAdditions: damageResult.hordeLibraryAdditions,
    });
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9000] flex items-end justify-center bg-black/80"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 35 }}
        className="w-full max-w-md rounded-t-3xl bg-slate-900 border-t border-white/10 overflow-hidden"
        style={{ maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-red-400" />
            <span className="text-white font-black text-base">
              {phase === PHASE.ATTACKERS && 'Horde Attacks!'}
              {phase === PHASE.BLOCKING && 'Declare Blockers'}
              {phase === PHASE.DAMAGE && 'Combat Damage'}
            </span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <X className="w-4 h-4 text-white/50" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 pt-3 pb-6" style={{ maxHeight: 'calc(88vh - 70px)' }}>

          {/* ── PHASE 0: Attackers Overview ── */}
          {phase === PHASE.ATTACKERS && (
            <div className="space-y-3">
              {attackers.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="w-10 h-10 text-green-400 mx-auto mb-2" />
                  <p className="text-green-300 font-bold">No attackers!</p>
                  <p className="text-white/40 text-sm mt-1">All creatures are tapped or have Defender.</p>
                  <button onClick={onClose}
                    className="mt-4 px-6 py-2.5 rounded-xl bg-green-600/30 border border-green-500/40 text-green-300 font-bold text-sm active:scale-95">
                    Continue
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-white/50 text-sm">{attackers.length} creature{attackers.length !== 1 ? 's' : ''} attack. All must attack if able.</p>
                  <div className="space-y-2">
                    {attackers.map(a => <AttackerRow key={a.id} creature={a} />)}
                  </div>
                  <button onClick={proceedToBlocking}
                    className="w-full py-3 rounded-xl bg-red-700/40 border border-red-600/50 text-white font-black text-sm flex items-center justify-center gap-2 active:scale-95 mt-2">
                    <ChevronRight className="w-4 h-4" /> Declare Blockers
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── PHASE 1: Blocking ── */}
          {phase === PHASE.BLOCKING && (
            <div className="space-y-3">
              <p className="text-white/50 text-sm">For each attacker, choose what happened in combat.</p>
              <div className="space-y-3">
                {attackers.map(a => {
                  const bs = blockStates[a.id] || null;
                  const abilities = getAbilities(a);
                  return (
                    <div key={a.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        {a.image_url && <img src={a.image_url} alt={a.name} className="w-10 rounded-md border border-white/10 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-sm truncate">{a.name}</p>
                          <p className="text-red-300 text-xs font-black">{calcEffectivePower(a)}/{calcEffectiveToughness(a)}</p>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {abilities.trample && <AbilityTag label="Trample" color="orange" />}
                            {abilities.doubleStrike && <AbilityTag label="Double Strike" color="yellow" />}
                            {abilities.firstStrike && <AbilityTag label="First Strike" color="yellow" />}
                            {abilities.deathtouch && <AbilityTag label="Deathtouch" color="green" />}
                            {abilities.lifelink && <AbilityTag label="Lifelink" color="pink" />}
                            {abilities.flying && <AbilityTag label="Flying" color="blue" />}
                            {abilities.vigilance && <AbilityTag label="Vigilance" color="blue" />}
                            {abilities.indestructible && <AbilityTag label="Indestructible" color="yellow" />}
                            {abilities.menace && <AbilityTag label="Menace" color="red" />}
                            {abilities.reach && <AbilityTag label="Reach" color="green" />}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 mt-1">
                        {[
                          { val: 'unblocked', label: 'Unblocked', icon: <Swords className="w-3 h-3" />, color: 'red' },
                          { val: 'blocked_survived', label: 'Blocked', icon: <Shield className="w-3 h-3" />, color: 'blue' },
                          { val: 'blocked_killed', label: 'Destroyed', icon: <Skull className="w-3 h-3" />, color: 'green' },
                        ].map(opt => (
                          <button key={opt.val} onClick={() => setBlock(a.id, opt.val)}
                            className={`py-1.5 rounded-lg text-[10px] font-bold flex flex-col items-center gap-0.5 transition-all active:scale-95 border ${
                              bs === opt.val
                                ? opt.color === 'red' ? 'bg-red-600/40 border-red-500/60 text-red-200'
                                : opt.color === 'blue' ? 'bg-blue-600/40 border-blue-500/60 text-blue-200'
                                : 'bg-green-600/40 border-green-500/60 text-green-200'
                                : 'bg-white/5 border-white/10 text-white/40'
                            }`}>
                            {opt.icon}
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {bs === 'blocked_survived' && abilities.trample && (
                        <p className="text-orange-300/70 text-[10px] mt-1.5">⚡ Trample: excess damage still hits players</p>
                      )}
                      {bs === 'blocked_killed' && abilities.trample && (
                        <p className="text-orange-300/70 text-[10px] mt-1.5">⚡ Trample: excess damage may still hit players</p>
                      )}
                      {bs === 'blocked_killed' && abilities.indestructible && (
                        <p className="text-yellow-300/70 text-[10px] mt-1.5">🛡 Indestructible: cannot be destroyed</p>
                      )}
                      {abilities.menace && !bs && (
                        <p className="text-red-300/70 text-[10px] mt-1.5">⚠ Menace: must be blocked by 2+ creatures</p>
                      )}
                      {abilities.vigilance && (
                        <p className="text-blue-300/70 text-[10px] mt-1.5">👁 Vigilance: does not tap when attacking</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <button onClick={proceedToDamage}
                className="w-full py-3 rounded-xl bg-orange-700/40 border border-orange-600/50 text-white font-black text-sm flex items-center justify-center gap-2 active:scale-95">
                <Zap className="w-4 h-4" /> Calculate Damage
              </button>
            </div>
          )}

          {/* ── PHASE 2: Damage Resolution ── */}
          {phase === PHASE.DAMAGE && damageResult && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                {damageResult.details.map((d, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/8">
                    <div>
                      <span className="text-white text-sm font-semibold">{d.name}</span>
                      {d.note && <span className="text-white/30 text-xs ml-2">{d.note}</span>}
                    </div>
                    <span className={`font-black text-sm tabular-nums ${d.dmg > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {d.dmg > 0 ? `-${d.dmg}` : '✓'}
                    </span>
                  </div>
                ))}
              </div>

              {damageResult.hordeLibraryAdditions > 0 && (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-pink-900/30 border border-pink-500/30">
                  <span className="text-pink-300 text-sm font-semibold">🩸 Lifelink → Horde Library</span>
                  <span className="text-pink-300 font-black text-sm">+{damageResult.hordeLibraryAdditions} cards</span>
                </div>
              )}

              {damageResult.killedIds.length > 0 && (
                <div className="px-3 py-2 rounded-lg bg-green-900/25 border border-green-600/30">
                  <p className="text-green-300 text-xs font-bold">{damageResult.killedIds.length} creature{damageResult.killedIds.length !== 1 ? 's' : ''} destroyed in combat</p>
                </div>
              )}

              <div className={`rounded-xl border p-4 text-center ${damageResult.newLife <= 0 ? 'bg-red-950/60 border-red-600/60' : 'bg-white/5 border-white/15'}`}>
                <p className="text-white/40 text-xs mb-1">Players' Life After Combat</p>
                <p className={`font-black text-4xl tabular-nums ${damageResult.newLife <= 0 ? 'text-red-400' : damageResult.totalDamage > 0 ? 'text-orange-300' : 'text-green-300'}`}>
                  {damageResult.newLife}
                </p>
                {damageResult.totalDamage > 0 && (
                  <p className="text-red-400/70 text-sm mt-1">−{damageResult.totalDamage} damage taken</p>
                )}
                {damageResult.newLife <= 0 && (
                  <p className="text-red-400 font-black text-sm mt-1 animate-pulse">💀 HORDE WINS</p>
                )}
              </div>

              <button onClick={acceptDamage}
                className="w-full py-3 rounded-xl bg-red-700/50 border border-red-600/60 text-white font-black text-sm flex items-center justify-center gap-2 active:scale-95">
                Accept Damage &amp; End Attack
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

function AttackerRow({ creature }) {
  const abilities = getAbilities(creature);
  const power = calcEffectivePower(creature);
  const toughness = calcEffectiveToughness(creature);
  return (
    <div className="flex items-center gap-3 p-2 rounded-xl bg-red-950/30 border border-red-800/30">
      {creature.image_url && <img src={creature.image_url} alt={creature.name} className="w-10 rounded-md border border-red-700/30 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm truncate">{creature.name}</p>
        <p className="text-red-300 text-xs font-black">{power}/{toughness}</p>
        <div className="flex flex-wrap gap-1 mt-0.5">
          {abilities.trample && <AbilityTag label="Trample" color="orange" />}
          {abilities.doubleStrike && <AbilityTag label="Double Strike" color="yellow" />}
          {abilities.firstStrike && <AbilityTag label="First Strike" color="yellow" />}
          {abilities.deathtouch && <AbilityTag label="Deathtouch" color="green" />}
          {abilities.lifelink && <AbilityTag label="Lifelink" color="pink" />}
          {abilities.flying && <AbilityTag label="Flying" color="blue" />}
          {abilities.haste && <AbilityTag label="Haste" color="red" />}
          {abilities.vigilance && <AbilityTag label="Vigilance" color="blue" />}
          {abilities.indestructible && <AbilityTag label="Indestructible" color="yellow" />}
          {abilities.menace && <AbilityTag label="Menace" color="red" />}
          {abilities.reach && <AbilityTag label="Reach" color="green" />}
        </div>
      </div>
      <Swords className="w-4 h-4 text-red-500 flex-shrink-0" />
    </div>
  );
}

function AbilityTag({ label, color }) {
  const colors = {
    red: 'bg-red-900/50 text-red-300 border-red-700/30',
    orange: 'bg-orange-900/50 text-orange-300 border-orange-700/30',
    yellow: 'bg-yellow-900/50 text-yellow-300 border-yellow-700/30',
    green: 'bg-green-900/50 text-green-300 border-green-700/30',
    blue: 'bg-blue-900/50 text-blue-300 border-blue-700/30',
    pink: 'bg-pink-900/50 text-pink-300 border-pink-700/30',
  };
  return (
    <span className={`text-[8px] font-bold px-1 py-0.5 rounded border ${colors[color] || colors.red}`}>{label}</span>
  );
}