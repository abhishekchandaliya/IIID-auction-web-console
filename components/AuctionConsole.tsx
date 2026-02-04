import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Player, TeamStats, ActivityLog, TournamentConfig } from '../types';
import { Search, Gavel, Shuffle, Sparkles, X, ChevronRight, Lock, Ban, User, ArrowRight, Minus, Plus, Star, Scale, PenTool, CheckCircle, AlertTriangle, Clock, AlertOctagon, Wallet, Play } from 'lucide-react';
import PlayerImage from './PlayerImage';
import { getSportColor } from '../utils';

interface AuctionConsoleProps {
  players: Player[];
  teams: TeamStats[];
  onSellPlayer: (playerId: number, teamName: string, price: number) => void;
  onUnsellPlayer: (playerId: number) => void;
  onMarkUnsold: (playerId: number) => void;
  onUpdatePlayer: (playerId: number, teamName: string, price: number) => void;
  isReadOnly?: boolean;
  currentPlayerId: string;
  onSelectPlayer: (id: string) => void;
  recentActivity: ActivityLog[];
  config: TournamentConfig;
  sports: string[];
  categories: string[];
}

const AuctionConsole: React.FC<AuctionConsoleProps> = ({ 
    players, teams, onSellPlayer, onUnsellPlayer, onMarkUnsold, onUpdatePlayer, isReadOnly = false,
    currentPlayerId, onSelectPlayer, recentActivity, config, sports, categories
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [winningTeam, setWinningTeam] = useState("");
  const [bidPrice, setBidPrice] = useState(config.basePrice);
  const [error, setError] = useState<string | null>(null);
  const [fairPlayError, setFairPlayError] = useState<string | null>(null);
  const [overrideFairPlay, setOverrideFairPlay] = useState(false);
  const [correctionSearch, setCorrectionSearch] = useState("");
  const [correctionPlayerId, setCorrectionPlayerId] = useState<string>("");
  const [correctionTeam, setCorrectionTeam] = useState("");
  const [correctionPrice, setCorrectionPrice] = useState(0);
  const [showRandomizer, setShowRandomizer] = useState(false);
  const [rSport, setRSport] = useState<string>('all');
  const [rGrade, setRGrade] = useState<string>('all');
  const [poolSource, setPoolSource] = useState<'available' | 'unsold'>('available');
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinName, setSpinName] = useState("Ready?");
  const [spinWinner, setSpinWinner] = useState<Player | null>(null);
  const [selectionOrigin, setSelectionOrigin] = useState<'randomizer' | 'manual'>('manual');
  
  // Post-Sale State
  const [lastSale, setLastSale] = useState<{player: Player, team: string, price: number, remainingPurse: number} | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, []);
  useEffect(() => { if (!isReadOnly) setBidPrice(config.basePrice); }, [config.basePrice, currentPlayerId, isReadOnly]);

  const selectedPlayer = useMemo(() => players.find(p => p.id.toString() === currentPlayerId), [currentPlayerId, players]);

  // Dynamic Fair Play & Squad Composition Check
  useEffect(() => {
      setFairPlayError(null);
      setOverrideFairPlay(false);
      if (selectedPlayer && winningTeam) {
          const targetTeam = teams.find(t => t.name === winningTeam);
          if (targetTeam) {
              // 1. Check Max Sport Limits
              for (const sport of sports) {
                  // Only check if player actually plays this sport
                  if (selectedPlayer.ratings[sport] && selectedPlayer.ratings[sport] !== '0') {
                      const limit = config.sportLimits?.[sport]?.max || 999;
                      const currentCount = targetTeam.sportStats[sport]?.total || 0;
                      if (currentCount >= limit) {
                           setFairPlayError(`🚫 MAX SQUAD LIMIT: ${winningTeam} already has ${currentCount} ${sport} players (Max ${limit}).`);
                           return; // Stop checking other rules if this fails
                      }
                  }
              }

              // 2. Check Fair Play Quotas (Category Limits)
              if (config.categoryLimits) {
                for (const sport of sports) {
                    const rating = selectedPlayer.ratings[sport];
                    if (rating && rating !== '0' && config.categoryLimits[sport]) {
                        const limit = config.categoryLimits[sport][rating];
                        const currentCount = targetTeam.sportStats[sport]?.categoryCounts[rating] || 0;
                        if (currentCount >= limit) {
                            const othersLagging = teams.filter(t => t.name !== winningTeam).some(t => (t.sportStats[sport]?.categoryCounts[rating] || 0) < limit);
                            if (othersLagging) {
                                setFairPlayError(`⚠️ FAIR PLAY QUOTA: All teams must have ${limit} Grade '${rating}' players before you can buy more.`);
                                return;
                            }
                        }
                    }
                }
              }
          }
      }
  }, [winningTeam, selectedPlayer, teams, config, sports]);

  const unsoldPlayers = useMemo(() => players.filter(p => !p.team && p.status !== 'sold' && p.name.toLowerCase().includes(searchTerm.toLowerCase())), [players, searchTerm]);
  const soldPlayers = useMemo(() => correctionSearch ? players.filter(p => p.team && p.name.toLowerCase().includes(correctionSearch.toLowerCase())) : [], [players, correctionSearch]);
  
  const recentlySoldList = useMemo(() => {
    const list: Player[] = [];
    const ids = new Set<string>();
    recentActivity.forEach(log => {
        if (log.type === 'sale' && log.details?.playerName) {
            const p = players.find(pl => pl.name === log.details!.playerName && pl.team);
            if (p && !ids.has(p.name)) { list.push(p); ids.add(p.name); }
        }
    });
    return list.slice(0, 10);
  }, [recentActivity, players]);

  const eligibleRandomPlayers = useMemo(() => {
     return players.filter(p => {
         // Pool Source Filter
         if (poolSource === 'available' && p.status !== 'available') return false;
         if (poolSource === 'unsold' && p.status !== 'unsold') return false;
         if (p.team) return false; // Safety check

         // Sport/Grade Filter
         if (rSport !== 'all' && (!p.ratings[rSport] || p.ratings[rSport] === '0')) return false;
         if (rGrade !== 'all') {
             if (rSport === 'all') return Object.values(p.ratings).includes(rGrade);
             return p.ratings[rSport] === rGrade;
         }
         return true;
     });
  }, [players, rSport, rGrade, poolSource]);

  const selectedCorrectionPlayer = useMemo(() => players.find(p => p.id.toString() === correctionPlayerId), [correctionPlayerId, players]);
  useEffect(() => {
      if (selectedCorrectionPlayer?.team) {
          setCorrectionTeam(selectedCorrectionPlayer.team);
          setCorrectionPrice(selectedCorrectionPlayer.price);
      }
  }, [selectedCorrectionPlayer]);

  const handleSell = () => {
    if (isReadOnly || !selectedPlayer || !winningTeam) { setError("Select team."); return; }
    const team = teams.find(t => t.name === winningTeam);
    if (!team) return;
    if (team.playerCount >= config.maxSquadSize) { setError("Team Full!"); return; }
    
    // Check Budget with Reserve
    const emptySlots = Math.max(0, config.maxSquadSize - team.playerCount - 1); // -1 for current
    const reserve = emptySlots * config.basePrice;
    const maxBid = team.availableBalance - reserve;

    if (bidPrice > maxBid) { setError(`Insufficient Funds. Max Bid: ${maxBid}`); return; }

    // Execute Sale
    onSellPlayer(selectedPlayer.id, winningTeam, bidPrice);

    // Calculate Updated Balance for Display (Global state update might be slightly delayed)
    const newRemainingPurse = team.disposableBalance - bidPrice;

    // Show Summary Overlay instead of immediate reset
    setLastSale({
        player: selectedPlayer,
        team: winningTeam,
        price: bidPrice,
        remainingPurse: newRemainingPurse
    });
    
    setError(null);
  };

  const handlePostSaleContinue = () => {
      setLastSale(null);
      onSelectPlayer(""); 
      setWinningTeam(""); 
      setBidPrice(config.basePrice); 
      
      if (selectionOrigin === 'randomizer') { 
          setShowRandomizer(true); 
          setSpinWinner(null); 
          setSpinName("Ready?"); 
      }
  };

  const handleMarkUnsoldAction = () => {
      if (!selectedPlayer) return;
      onMarkUnsold(selectedPlayer.id);
      onSelectPlayer(""); setWinningTeam(""); setBidPrice(config.basePrice); setError(null);
      if (selectionOrigin === 'randomizer') { setShowRandomizer(true); setSpinWinner(null); setSpinName("Ready?"); }
  }

  const handleSpin = () => {
    if (eligibleRandomPlayers.length === 0) return;
    setIsSpinning(true); setSpinWinner(null);
    let speed = 50, counter = 0;
    const run = () => {
        const candidate = eligibleRandomPlayers[Math.floor(Math.random() * eligibleRandomPlayers.length)];
        setSpinName(candidate.name);
        counter++;
        if (counter < 25) {
             if (counter > 15) speed += 40;
             timerRef.current = setTimeout(run, speed);
        } else {
             setSpinWinner(candidate); setIsSpinning(false);
        }
    };
    run();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)] min-h-[700px]">
      
      {/* SIDEBAR */}
      <div className="lg:col-span-3 flex flex-col gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 h-full overflow-hidden shadow-xl lg:order-1 order-2">
        {!isReadOnly && <button onClick={() => { setShowRandomizer(true); onSelectPlayer(""); setSpinWinner(null); setLastSale(null); }} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 text-white rounded-xl font-bold flex justify-center gap-2"><Shuffle /> Random Spin</button>}
        <div className="relative"><Search className="absolute left-3 top-3.5 h-5 w-5 text-slate-500" /><input type="text" placeholder="Search..." className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {unsoldPlayers.map(p => (
              <button key={p.id} onClick={() => { onSelectPlayer(p.id.toString()); setSelectionOrigin('manual'); setShowRandomizer(false); setError(null); setLastSale(null); }} className={`w-full text-left px-4 py-3 rounded-xl border flex justify-between ${currentPlayerId === p.id.toString() ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800/50 border-slate-800 text-slate-200'}`}>
                <div>
                    <span className="font-bold text-sm block">{p.name}</span>
                    <span className="text-[10px] opacity-60 flex gap-2">
                        <span>#{p.id}</span>
                        {p.status === 'unsold' && <span className="text-amber-400 font-bold">Unsold</span>}
                    </span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>
            ))}
        </div>
      </div>

      {/* MAIN AREA */}
      <div className="lg:col-span-9 h-full flex flex-col relative lg:order-2 order-1 min-h-[500px]">
        
        {/* VIEW LOGIC: 1. Randomizer -> 2. Sale Summary -> 3. Selected Player -> 4. Empty State */}
        
        {showRandomizer ? (
            <div className="h-full bg-slate-900 rounded-2xl border border-slate-700 flex flex-col">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center"><h2 className="text-purple-400 font-bold uppercase flex gap-2"><Sparkles /> Random Picker</h2><button onClick={() => setShowRandomizer(false)}><X className="text-slate-400" /></button></div>
                <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
                     <div className="flex gap-4 mb-8 z-10 flex-wrap justify-center">
                        <select value={poolSource} onChange={(e) => setPoolSource(e.target.value as any)} disabled={isSpinning} className="bg-slate-800 border-slate-700 text-white rounded px-4 py-2 font-bold"><option value="available">Fresh Pool</option><option value="unsold">Unsold Pool</option></select>
                        <select value={rSport} onChange={(e) => setRSport(e.target.value)} disabled={isSpinning} className="bg-slate-800 border-slate-700 text-white rounded px-4 py-2"><option value="all">All Sports</option>{sports.map(s => <option key={s} value={s}>{s}</option>)}</select>
                        <select value={rGrade} onChange={(e) => setRGrade(e.target.value)} disabled={isSpinning} className="bg-slate-800 border-slate-700 text-white rounded px-4 py-2"><option value="all">Any Grade</option>{categories.map(c => <option key={c} value={c}>Grade {c}</option>)}</select>
                     </div>
                     <div className="mb-16 text-center z-10 w-full min-h-[200px] flex items-center justify-center">
                        {spinWinner ? (
                            <div className="animate-in zoom-in">
                                <div className="text-emerald-400 font-bold tracking-widest uppercase mb-4 animate-pulse">Winner</div>
                                <h1 className="text-6xl md:text-8xl font-black text-white mb-8">{spinWinner.name}</h1>
                                <div className="flex justify-center gap-3">
                                    {sports.map((s, i) => {
                                        const r = spinWinner.ratings[s];
                                        if(!r || r==='0') return null;
                                        return <span key={s} className={`px-4 py-1 rounded-full font-bold text-sm text-white ${getSportColor(i).bg}`}>{s}: {r}</span>
                                    })}
                                </div>
                            </div>
                        ) : eligibleRandomPlayers.length === 0 ? (
                            <div className="text-slate-500 text-2xl font-bold">No {poolSource} players found matching filters.</div>
                        ) : (
                            <h1 className="text-6xl md:text-9xl font-black text-slate-800">{spinName}</h1>
                        )}
                     </div>
                     <div className="z-10 h-20">
                        {spinWinner ? (
                            <button onClick={() => { onSelectPlayer(spinWinner.id.toString()); setSelectionOrigin('randomizer'); setShowRandomizer(false); }} className="px-10 py-4 bg-emerald-600 text-white rounded-full font-bold text-xl flex items-center gap-3">Start Bidding <ArrowRight /></button>
                        ) : (
                            <button onClick={handleSpin} disabled={isSpinning || eligibleRandomPlayers.length === 0} className="px-16 py-6 bg-indigo-600 text-white rounded-full font-black text-2xl flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">{isSpinning ? '...' : 'SPIN'}</button>
                        )}
                     </div>
                </div>
            </div>
        ) : lastSale ? (
            /* SALE SUMMARY OVERLAY */
            <div className="h-full flex flex-col items-center justify-center bg-slate-900 rounded-3xl border border-slate-700 p-8 animate-in zoom-in-95 duration-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]"></div>
                <div className="text-center z-10">
                    <h1 className="text-6xl md:text-8xl font-black text-emerald-500 mb-2 drop-shadow-2xl tracking-tighter">SOLD!</h1>
                    <div className="text-4xl md:text-6xl text-white font-bold mb-8">{lastSale.player.name}</div>
                    
                    <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 w-full max-w-xl mx-auto space-y-6 shadow-2xl">
                        <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                            <span className="text-slate-400 uppercase font-bold text-sm tracking-widest">Sold To</span>
                            <span className="text-indigo-400 font-black text-3xl">{lastSale.team}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                            <span className="text-slate-400 uppercase font-bold text-sm tracking-widest">Price</span>
                            <span className="text-white font-black text-4xl font-mono">₹{lastSale.price}</span>
                        </div>
                        <div className="pt-2">
                            <div className="flex justify-between items-center bg-emerald-900/20 p-4 rounded-xl border border-emerald-500/30">
                                <div className="flex items-center gap-2 text-emerald-400">
                                    <Wallet className="w-5 h-5" />
                                    <span className="text-xs uppercase font-bold tracking-wider">New Purse Balance</span>
                                </div>
                                <span className="text-emerald-300 font-mono font-black text-2xl">₹{lastSale.remainingPurse}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 mt-12 justify-center">
                        <button onClick={handlePostSaleContinue} className="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-lg flex items-center gap-2 transition-all">
                            Continue <ChevronRight className="w-5 h-5" />
                        </button>
                        {selectionOrigin === 'randomizer' && (
                            <button onClick={handlePostSaleContinue} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-lg flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all">
                                <Shuffle className="w-5 h-5" /> Next Spin
                            </button>
                        )}
                    </div>
                </div>
            </div>
        ) : selectedPlayer ? (
          <div className="h-full flex flex-col gap-4 animate-in slide-in-from-bottom-8">
            {/* HERO CARD */}
            <div className="flex-[2] bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border border-slate-700 p-6 relative flex items-center justify-center">
               <button onClick={() => onSelectPlayer("")} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white"><X /></button>
               <div className="w-full max-w-5xl flex flex-col md:flex-row items-center gap-12">
                   <div className="w-64 h-64 rounded-2xl border-4 border-slate-600/50 overflow-hidden bg-slate-800 relative shadow-2xl">
                        <PlayerImage name={selectedPlayer.name} className="w-full h-full object-cover" />
                   </div>
                   <div className="flex-1 text-center md:text-left space-y-4">
                        <div>
                            <div className={`inline-block px-3 py-1 text-xs font-bold uppercase rounded-full mb-2 ${selectedPlayer.status === 'unsold' ? 'bg-amber-900/50 text-amber-400' : 'bg-slate-700/50 text-slate-400'}`}>
                                {selectedPlayer.status === 'unsold' ? 'Re-Auctioning (Unsold)' : 'Now Auctioning'}
                            </div>
                            <h1 className="text-6xl font-black text-white leading-tight">{selectedPlayer.name}</h1>
                        </div>
                        <div className="flex flex-wrap justify-center md:justify-start gap-3">
                           {sports.map((sport, i) => {
                               const rating = selectedPlayer.ratings[sport];
                               if (!rating || rating === '0') return null;
                               const colors = getSportColor(i);
                               return <div key={sport} className={`px-4 py-2 rounded-xl border-2 text-lg font-black uppercase shadow-lg ${colors.bg} ${colors.border} text-white`}>{sport}: {rating}</div>
                           })}
                        </div>
                        <div className="pt-2"><span className="text-slate-400 text-sm uppercase font-bold">Base Price</span><div className="text-3xl font-mono font-black text-emerald-400">{config.basePrice}</div></div>
                   </div>
               </div>
            </div>

            {/* CONTROLS */}
            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-center">
                {error && <div className="mb-4 p-3 bg-red-900/30 text-red-200 rounded-lg text-center font-bold">{error}</div>}
                {fairPlayError && <div className="mb-4 p-4 bg-amber-900/20 text-amber-100 rounded-lg flex gap-3"><Scale className="text-amber-500" /><div><p className="font-bold text-sm">{fairPlayError}</p><label className="flex gap-2 mt-2 cursor-pointer"><input type="checkbox" checked={overrideFairPlay} onChange={e => setOverrideFairPlay(e.target.checked)} /><span className="text-xs font-bold text-amber-400 uppercase">Override Rule</span></label></div></div>}
                
                {!isReadOnly ? (
                    <div className="flex flex-col md:flex-row items-end gap-4 h-full">
                        <div className="w-full md:flex-[2] h-full flex flex-col">
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2">Team</label>
                            <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-2 overflow-y-auto max-h-[160px] custom-scrollbar">
                                {teams.map(t => (
                                    <button key={t.name} onClick={() => setWinningTeam(t.name)} disabled={t.disposableBalance <= 0} className={`p-3 rounded-xl border text-left ${winningTeam === t.name ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'} ${t.disposableBalance<=0?'opacity-50':''}`}>
                                        <div className="font-bold text-sm truncate">{t.name}</div><div className="text-xs font-mono opacity-80">${t.disposableBalance}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="w-full md:flex-1">
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2">Bid</label>
                            <div className="flex h-[88px]"><button onClick={() => setBidPrice(p => Math.max(0, p-5))} className="px-3 bg-slate-800 border border-slate-700 rounded-l-2xl text-slate-300"><Minus /></button><input type="number" className="w-full bg-slate-950 border-y border-slate-700 text-center text-white text-4xl font-black" value={bidPrice} onChange={e => setBidPrice(parseInt(e.target.value)||0)} /><button onClick={() => setBidPrice(p => p+5)} className="px-3 bg-slate-800 border border-slate-700 rounded-r-2xl text-slate-300"><Plus /></button></div>
                        </div>
                        <div className="w-full md:flex-1 flex gap-2 h-[88px]">
                             <button onClick={() => { onSelectPlayer(""); setWinningTeam(""); }} className="aspect-square bg-slate-800 border-2 border-slate-700 text-slate-400 hover:text-red-400 rounded-2xl flex flex-col items-center justify-center"><Ban /><span className="text-[10px] font-bold">PASS</span></button>
                             <div className="flex-1 flex flex-col gap-2 h-full">
                                <button onClick={handleSell} disabled={!!fairPlayError && !overrideFairPlay} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"><Gavel className="w-5 h-5" /> SOLD</button>
                                <button onClick={handleMarkUnsoldAction} className="h-10 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-900/20"><AlertOctagon className="w-4 h-4" /> MARK UNSOLD</button>
                             </div>
                        </div>
                    </div>
                ) : <div className="text-center opacity-50"><Gavel className="w-16 h-16 mx-auto mb-4" /><h3>Waiting for Auctioneer</h3></div>}
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-slate-900/50 rounded-3xl border border-slate-800/50 flex flex-col items-center justify-center text-slate-600">
              <div className="w-32 h-32 bg-slate-800 rounded-full flex items-center justify-center mb-6"><Gavel className="w-12 h-12" /></div>
              <h2 className="text-3xl font-black text-slate-700">Ready</h2>
          </div>
        )}

        {/* CORRECTION MANAGER */}
        {!isReadOnly && (
            <div className="mt-6 bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <details className="group">
                    <summary className="flex items-center gap-2 cursor-pointer font-bold text-slate-500 hover:text-white"><PenTool className="w-4 h-4" /> Correction Manager</summary>
                    <div className="pt-4 mt-4 border-t border-slate-800 space-y-4">
                        <div className="flex gap-4">
                            <select className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-sm" onChange={e => setCorrectionPlayerId(e.target.value)} value={correctionPlayerId}><option value="">Recently Sold</option>{recentlySoldList.map(p => <option key={p.id} value={p.id}>{p.name} ({p.team})</option>)}</select>
                            <input type="text" placeholder="Search sold players..." className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-sm" value={correctionSearch} onChange={e => { setCorrectionSearch(e.target.value); setCorrectionPlayerId(""); }} />
                        </div>
                        {correctionSearch && !correctionPlayerId && (
                            <div className="bg-slate-800 p-2 rounded max-h-32 overflow-y-auto">{soldPlayers.map(p => <div key={p.id} onClick={() => { setCorrectionPlayerId(p.id.toString()); setCorrectionSearch(""); }} className="p-2 hover:bg-slate-700 cursor-pointer text-sm text-slate-300">{p.name} ({p.team})</div>)}</div>
                        )}
                        {selectedCorrectionPlayer && (
                            <div className="bg-indigo-900/20 border border-indigo-500/30 p-3 rounded flex justify-between items-center">
                                <div><div className="text-xs text-slate-400 font-bold uppercase">Editing</div><div className="font-black text-white">{selectedCorrectionPlayer.name}</div></div>
                                <div className="flex gap-2">
                                    <select className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white text-sm" value={correctionTeam} onChange={e => setCorrectionTeam(e.target.value)}>{teams.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}</select>
                                    <input type="number" className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white text-sm" value={correctionPrice} onChange={e => setCorrectionPrice(parseInt(e.target.value))} />
                                    <button onClick={() => { onUpdatePlayer(parseInt(correctionPlayerId), correctionTeam, correctionPrice); setCorrectionPlayerId(""); }} className="bg-indigo-600 px-3 rounded text-white text-xs font-bold">Save</button>
                                    <button onClick={() => { if(confirm("Unsell?")) { onUnsellPlayer(parseInt(correctionPlayerId)); setCorrectionPlayerId(""); } }} className="bg-red-600 px-3 rounded text-white text-xs font-bold">Unsell</button>
                                </div>
                            </div>
                        )}
                    </div>
                </details>
            </div>
        )}
      </div>
    </div>
  );
};
export default AuctionConsole;