import React, { useState, useEffect, useMemo } from 'react';
import { Tab, Player, ActivityLog, TournamentConfig, AutoFillAssignment } from './types';
import { DEFAULT_TEAM_NAMES, DEFAULT_CONFIG, DEFAULT_SPORTS, DEFAULT_CATEGORIES } from './constants';
import { calculateTeamStats, normalizeRating, parseCurrency } from './utils';
import Dashboard from './components/Dashboard';
import AuctionConsole from './components/AuctionConsole';
import RosterView from './components/RosterView';
import FileUploader from './components/FileUploader';
import { PlayerManager } from './components/PlayerManager';
import AutoFillModal from './components/AutoFillModal';
import { LayoutDashboard, Gavel, Users, Settings, Trophy, UploadCloud, Trash2, Lock, Unlock, Menu, X, Save, Settings2, CheckCircle, ShieldCheck, Scale, Zap, Plus, Layers, Table, BookOpen, ClipboardList, Hourglass, Edit2, Check, Info, Wand2, RefreshCw, FileSpreadsheet, RotateCcw } from 'lucide-react';
import * as XLSX from 'xlsx';

// Helper to safely get value from row with fuzzy key matching
const getRowValue = (row: any, ...candidates: string[]) => {
    const keys = Object.keys(row);
    for (const candidate of candidates) {
        const foundKey = keys.find(k => k.trim().toLowerCase() === candidate.toLowerCase());
        if (foundKey !== undefined) return row[foundKey];
    }
    return undefined;
};

const App: React.FC = () => {
  // --- Global Dynamic State ---
  const [eventName, setEventName] = useState("Sports Auction 2026");
  const [teamNames, setTeamNames] = useState<string[]>(DEFAULT_TEAM_NAMES);
  
  // DYNAMIC CONFIGURATION STATE
  const [sports, setSports] = useState<string[]>(DEFAULT_SPORTS);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);

  const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);
  const [players, setPlayers] = useState<Player[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); 
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  
  // Configuration State
  const [config, setConfig] = useState<TournamentConfig>(DEFAULT_CONFIG);
  const [tempConfig, setTempConfig] = useState<TournamentConfig>(DEFAULT_CONFIG); 
  const [configSaved, setConfigSaved] = useState(false);
  
  // Settings UI State
  const [settingsSportTab, setSettingsSportTab] = useState<string>("");
  const [newSportInput, setNewSportInput] = useState("");
  const [newCatInput, setNewCatInput] = useState("");

  // Edit Mode State for Config
  const [editingSport, setEditingSport] = useState<string | null>(null);
  const [editSportValue, setEditSportValue] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryValue, setEditCategoryValue] = useState("");

  // Navigation State
  const [targetTeam, setTargetTeam] = useState<string | null>(null);
  const [currentAuctionPlayerId, setCurrentAuctionPlayerId] = useState<string>(""); 
  
  // Audit Trail
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);

  // Auto-Fill State
  const [autoFillModalOpen, setAutoFillModalOpen] = useState(false);
  const [proposedAssignments, setProposedAssignments] = useState<AutoFillAssignment[]>([]);
  const [lastBatchIds, setLastBatchIds] = useState<number[]>([]);
  const [undoToastOpen, setUndoToastOpen] = useState(false);

  // Initialize selected sport tab
  useEffect(() => {
    if (sports.length > 0 && !settingsSportTab) {
        setSettingsSportTab(sports[0]);
    }
  }, [sports]);

  const addActivity = (log: Omit<ActivityLog, 'id' | 'timestamp'>) => {
      const newLog: ActivityLog = {
          ...log,
          id: Math.random().toString(36).substr(2, 9),
          timestamp: Date.now()
      };
      setRecentActivity(prev => [newLog, ...prev].slice(0, 8)); 
  };

  // Derive Team Stats dynamically
  const teams = useMemo(() => {
    return teamNames.map(name => {
      return calculateTeamStats(name, players, config, sports, categories);
    });
  }, [players, config, teamNames, sports, categories]);

  // --- Persistence ---
  useEffect(() => {
    // 1. Players
    const savedPlayers = localStorage.getItem('sports_auction_players');
    if (savedPlayers) {
        try {
            const parsed = JSON.parse(savedPlayers);
            if (parsed.length > 0) {
                const migratedPlayers = parsed.map((p: any) => ({
                    ...p,
                    status: p.status || (p.team ? 'sold' : 'available'),
                    auctionType: p.auctionType || 'LIVE',
                    gender: p.gender || 'Male'
                }));
                setPlayers(migratedPlayers);
                setDataLoaded(true);
            }
        } catch (e) { console.error("Failed to load players"); }
    }

    // 2. Config & Meta
    const savedConfig = localStorage.getItem('sports_auction_config');
    if (savedConfig) {
        try {
             const parsed = JSON.parse(savedConfig);
             // Ensure legacy configs get new fields
             const safeConfig = { ...DEFAULT_CONFIG, ...parsed };
             if (!safeConfig.sportLimits) safeConfig.sportLimits = DEFAULT_CONFIG.sportLimits;
             if (!safeConfig.categoryMaxLimits) safeConfig.categoryMaxLimits = DEFAULT_CONFIG.categoryMaxLimits;
             
             setConfig(safeConfig);
             setTempConfig(safeConfig);
        } catch (e) {}
    }
    const savedEvent = localStorage.getItem('sports_auction_event_name');
    if (savedEvent) setEventName(savedEvent);

    const savedTeams = localStorage.getItem('sports_auction_teams');
    if (savedTeams) setTeamNames(JSON.parse(savedTeams));

    const savedSports = localStorage.getItem('sports_auction_sports');
    if (savedSports) setSports(JSON.parse(savedSports));

    const savedCats = localStorage.getItem('sports_auction_categories');
    if (savedCats) setCategories(JSON.parse(savedCats));

  }, []);

  // Save Effects
  useEffect(() => { if (dataLoaded) localStorage.setItem('sports_auction_players', JSON.stringify(players)); }, [players, dataLoaded]);
  useEffect(() => { localStorage.setItem('sports_auction_event_name', eventName); }, [eventName]);
  useEffect(() => { localStorage.setItem('sports_auction_teams', JSON.stringify(teamNames)); }, [teamNames]);
  useEffect(() => { localStorage.setItem('sports_auction_sports', JSON.stringify(sports)); }, [sports]);
  useEffect(() => { localStorage.setItem('sports_auction_categories', JSON.stringify(categories)); }, [categories]);

  // Ensure config has entries for all sports/categories
  useEffect(() => {
      const newLimits = { ...config.categoryLimits };
      const newMaxLimits = { ...(config.categoryMaxLimits || {}) };
      const newSportLimits = { ...(config.sportLimits || {}) };
      let changed = false;
      
      sports.forEach(s => {
          if (!newLimits[s]) { newLimits[s] = {}; changed = true; }
          if (!newMaxLimits[s]) { newMaxLimits[s] = {}; changed = true; }
          if (!newSportLimits[s]) { newSportLimits[s] = { min: 0, max: 20 }; changed = true; }
          categories.forEach(c => {
              if (newLimits[s][c] === undefined) { newLimits[s][c] = 2; changed = true; }
              if (newMaxLimits[s][c] === undefined) { newMaxLimits[s][c] = 99; changed = true; }
          });
      });
      if (changed) {
          const newConfig = { ...config, categoryLimits: newLimits, categoryMaxLimits: newMaxLimits, sportLimits: newSportLimits };
          setConfig(newConfig);
          setTempConfig(newConfig);
      }
  }, [sports, categories]);


  // --- Handlers ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === "ABCD2026") { 
        setIsAdmin(true);
        setLoginError(false);
        setPasswordInput("");
    } else {
        setLoginError(true);
    }
  };

  const handleLogout = () => { setIsAdmin(false); setActiveTab(Tab.DASHBOARD); };
  const switchTab = (tab: Tab) => { setActiveTab(tab); setMobileMenuOpen(false); };
  
  // Team Management
  const handleAddTeam = (name: string) => {
      if (name.trim() && !teamNames.includes(name.trim())) setTeamNames([...teamNames, name.trim()]);
  };
  const handleRenameTeam = (oldName: string, newName: string) => {
      if (!newName.trim() || teamNames.includes(newName.trim())) return;
      setTeamNames(prev => prev.map(t => t === oldName ? newName.trim() : t));
      setPlayers(prev => prev.map(p => p.team === oldName ? { ...p, team: newName.trim() } : p));
  };
  const handleDeleteTeam = (name: string) => {
      if (confirm(`Delete "${name}"?`)) {
          setTeamNames(prev => prev.filter(t => t !== name));
          setPlayers(prev => prev.map(p => p.team === name ? { ...p, team: null, price: 0, captainFor: undefined, status: 'available' } : p));
      }
  };

  // --- Sport/Category Management (CRUD) ---
  const handleAddSport = () => {
      if (newSportInput && !sports.includes(newSportInput)) {
          setSports([...sports, newSportInput]);
          setNewSportInput("");
      }
  };

  const handleRenameSport = (oldName: string) => {
      const newName = editSportValue.trim();
      if (!newName || sports.includes(newName)) { setEditingSport(null); return; }
      setSports(prev => prev.map(s => s === oldName ? newName : s));
      if (settingsSportTab === oldName) setSettingsSportTab(newName);
      
      // Update Config Keys
      const updateConfigKey = (obj: any) => {
          const newObj = { ...obj };
          if (newObj[oldName]) { newObj[newName] = newObj[oldName]; delete newObj[oldName]; }
          return newObj;
      };
      
      const newConfig = { 
          ...config, 
          categoryLimits: updateConfigKey(config.categoryLimits), 
          categoryMaxLimits: updateConfigKey(config.categoryMaxLimits),
          sportLimits: updateConfigKey(config.sportLimits)
      };
      setConfig(newConfig);
      setTempConfig(newConfig);

      // Update Players
      setPlayers(prev => prev.map(p => {
          const newRatings = { ...p.ratings };
          if (newRatings[oldName] !== undefined) { newRatings[newName] = newRatings[oldName]; delete newRatings[oldName]; }
          const newCaptainFor = p.captainFor === oldName ? newName : p.captainFor;
          return { ...p, ratings: newRatings, captainFor: newCaptainFor };
      }));
      setEditingSport(null);
  };

  const handleDeleteSport = (s: string) => {
      if (players.some(p => p.ratings[s] && p.ratings[s] !== '0')) {
          if (!confirm(`WARNING: Players have ratings for ${s}. Delete anyway?`)) return;
      }
      setSports(prev => prev.filter(sport => sport !== s));
      if(settingsSportTab === s) setSettingsSportTab(sports[0] || "");
  };

  const handleAddCategory = () => {
      if (newCatInput && !categories.includes(newCatInput.toUpperCase())) {
          setCategories([...categories, newCatInput.toUpperCase()]);
          setNewCatInput("");
      }
  };

  const handleRenameCategory = (oldName: string) => {
      const newName = editCategoryValue.trim().toUpperCase();
      if (!newName || categories.includes(newName)) { setEditingCategory(null); return; }
      setCategories(prev => prev.map(c => c === oldName ? newName : c));
      
      // Update Limits
      const newLimits = { ...config.categoryLimits };
      const newMaxLimits = { ...config.categoryMaxLimits };
      Object.keys(newLimits).forEach(s => {
          if (newLimits[s][oldName] !== undefined) { newLimits[s][newName] = newLimits[s][oldName]; delete newLimits[s][oldName]; }
          if (newMaxLimits[s][oldName] !== undefined) { newMaxLimits[s][newName] = newMaxLimits[s][oldName]; delete newMaxLimits[s][oldName]; }
      });
      setConfig({ ...config, categoryLimits: newLimits, categoryMaxLimits: newMaxLimits });
      setTempConfig({ ...config, categoryLimits: newLimits, categoryMaxLimits: newMaxLimits });

      // Update Players
      setPlayers(prev => prev.map(p => {
          const newRatings = { ...p.ratings };
          Object.keys(newRatings).forEach(s => { if (newRatings[s] === oldName) newRatings[s] = newName; });
          return { ...p, ratings: newRatings };
      }));
      setEditingCategory(null);
  };

  const handleDeleteCategory = (c: string) => {
       if (players.some(p => Object.values(p.ratings).includes(c))) {
           if(!confirm(`WARNING: Players are rated '${c}'. Delete anyway?`)) return;
       }
       setCategories(prev => prev.filter(cat => cat !== c));
  };

  // --- SMART MERGE CSV LOGIC ---
  const handleMasterLoad = (rawData: any[]) => {
    let newCount = 0;
    let updateCount = 0;
    let currentPlayers = [...players];

    rawData.forEach((row: any) => {
        const pNameRaw = getRowValue(row, 'Player Name', 'Name', 'Player');
        if (!pNameRaw || typeof pNameRaw !== 'string' || pNameRaw.trim() === '') return;
        
        const pName = pNameRaw.trim();
        const pTeam = getRowValue(row, 'Team', 'Winning Team', 'Sold To');
        const pPriceVal = getRowValue(row, 'Auction Value', 'Price', 'Sold Price', 'Amount');
        const pContact = getRowValue(row, 'Contact No', 'Mobile', 'Phone');
        const pType = getRowValue(row, 'Auction Type', 'Type', 'Pool'); 
        const pGender = getRowValue(row, 'Gender', 'Sex', 'M/F'); 

        // Gender Parse
        let genderStr = 'Male';
        if (pGender) {
            const g = String(pGender).toLowerCase();
            if (g.startsWith('f') || g.includes('wom') || g.includes('girl')) genderStr = 'Female';
            else if (g.includes('kid') || g.includes('child')) genderStr = 'Kid';
        }

        // Auction Type Parse
        let auctionType: 'LIVE' | 'LOTTERY' = 'LIVE';
        if (pType && String(pType).toLowerCase().includes('lottery')) auctionType = 'LOTTERY';

        // Ratings Parse
        const newRatings: Record<string, string> = {};
        sports.forEach(sport => {
            const val = getRowValue(row, sport, sport.toLowerCase(), sport.toUpperCase());
            if (val) newRatings[sport] = normalizeRating(val, categories);
        });

        // Match Logic: Name (Case Insensitive)
        const existingIndex = currentPlayers.findIndex(p => p.name.toLowerCase() === pName.toLowerCase());

        if (existingIndex > -1) {
            // MERGE
            const existing = currentPlayers[existingIndex];
            const mergedRatings = { ...existing.ratings };
            Object.keys(newRatings).forEach(s => {
                if (newRatings[s] && newRatings[s] !== '0') mergedRatings[s] = newRatings[s];
            });

            currentPlayers[existingIndex] = {
                ...existing,
                gender: genderStr,
                contactNo: pContact ? String(pContact).trim() : existing.contactNo,
                ratings: mergedRatings,
                auctionType: pType ? auctionType : existing.auctionType,
                team: pTeam ? teamNames.find(t => t.toLowerCase() === pTeam.trim().toLowerCase()) || existing.team : existing.team,
                price: pPriceVal ? parseCurrency(pPriceVal) : existing.price,
                status: pTeam ? 'sold' : existing.status
            };
            updateCount++;
        } else {
            // CREATE
            const newId = currentPlayers.length > 0 ? Math.max(...currentPlayers.map(p => p.id)) + 1 : 1;
            let matchedTeam = null;
            if (pTeam) matchedTeam = teamNames.find(t => t.toLowerCase() === pTeam.trim().toLowerCase()) || null;

            currentPlayers.push({
                id: newId,
                name: pName,
                gender: genderStr,
                team: matchedTeam,
                price: matchedTeam ? parseCurrency(pPriceVal || '0') : 0,
                ratings: newRatings,
                contactNo: pContact ? String(pContact).trim() : 'N/A',
                status: matchedTeam ? 'sold' : 'available',
                auctionType
            });
            newCount++;
        }
    });

    if (newCount === 0 && updateCount === 0) { alert("No valid player data found."); return; }
    setPlayers(currentPlayers);
    setDataLoaded(true);
    alert(`Import Complete!\nNew Players: ${newCount}\nUpdated Players: ${updateCount}`);
  };

  // --- REPORT EXPORTERS ---
  const handleExportMaster = () => {
      const wb = XLSX.utils.book_new();
      const pData = players.map(p => {
          const row: any = { ID: p.id, Name: p.name, Gender: p.gender || 'Male', Team: p.team || '', Price: p.price, Status: p.status, Pool: p.auctionType };
          sports.forEach(s => row[s] = p.ratings[s]);
          return row;
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pData), "All Players");
      XLSX.writeFile(wb, "Full_Database_Export.xlsx");
  };

  const handleExportTeams = () => {
      const data = teams.map(t => ({
          "Team Name": t.name,
          "Purse Spent": t.spent,
          "Purse Remaining": t.disposableBalance,
          "Squad Count": t.playerCount,
          "Max Size": config.maxSquadSize
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Teams Summary");
      XLSX.writeFile(wb, "All_Teams_Summary.xlsx");
  };

  const handleExportSports = () => {
      const data = players.map(p => {
          const row: any = { Name: p.name, Gender: p.gender || 'Male', Pool: p.auctionType, Status: p.status };
          sports.forEach(s => row[s] = p.ratings[s]);
          return row;
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Player Categories");
      XLSX.writeFile(wb, "Player_Category_List.csv");
  };

  const handleDownloadTemplate = () => {
      const row: any = { "Player Name": "", "Gender": "Male/Female/Kid", "Auction Type": "LIVE", "Team": "", "Auction Value": "", "Contact No": "" };
      sports.forEach(s => row[s] = "Grade (A/B/C)");
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([row]), "Template");
      XLSX.writeFile(wb, "Registration_Template.csv");
  };

  // --- AUCTION ACTIONS ---
  const handleSellPlayer = (playerId: number, teamName: string, price: number) => {
    let sold: Player | null = null;
    setPlayers(prev => prev.map(p => {
        if (p.id === playerId) {
            sold = { ...p, team: teamName, price: price, status: 'sold' };
            return sold;
        }
        return p;
    }));
    if (sold) addActivity({ type: 'sale', message: `💰 SOLD: ${(sold as Player).name} to ${teamName} for **${price}**`, details: { playerName: (sold as Player).name, price, teamName } });
  };

  const handleUnsellPlayer = (playerId: number) => {
      const player = players.find(p => p.id === playerId);
      if (!player) return;
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, team: null, price: 0, captainFor: undefined, status: 'available' } : p));
      setRecentActivity(prev => prev.filter(log => !(log.type === 'sale' && log.details?.playerName === player.name)));
  };

  const handleMarkUnsold = (playerId: number) => {
      const player = players.find(p => p.id === playerId);
      if (!player) return;
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, team: null, price: 0, captainFor: undefined, status: 'unsold' } : p));
      addActivity({ type: 'unsold', message: `⚠️ UNSOLD: ${player.name} remained unsold`, details: { playerName: player.name } });
  }

  const handleUpdatePlayer = (playerId: number, teamName: string, price: number) => {
      const player = players.find(p => p.id === playerId);
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, team: teamName, price: price, status: 'sold' } : p));
      if(player) addActivity({ type: 'correction', message: `🛠️ CORRECTION: ${player.name} updated`, details: { playerName: player.name, price, teamName } });
  };

  const handleAssignCaptain = (playerId: number, teamName: string, sport: string, price: number) => {
    setPlayers(prev => prev.map(p => {
        if (p.id === playerId) return { ...p, team: teamName, price: price, captainFor: sport, status: 'sold' };
        if (p.team === teamName && p.captainFor === sport) return { ...p, team: null, price: 0, captainFor: undefined, status: 'available' };
        return p;
    }));
  };

  const handleRemoveCaptain = (playerId: number) => {
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, team: null, price: 0, captainFor: undefined, status: 'available' } : p));
  };

  const handleAddPlayerManual = (playerData: Omit<Player, 'id' | 'team' | 'price' | 'status' | 'captainFor'>) => {
      const newId = players.length > 0 ? Math.max(...players.map(p => p.id)) + 1 : 1;
      const newPlayer: Player = { id: newId, team: null, price: 0, status: 'available', ...playerData, auctionType: playerData.auctionType || 'LIVE' };
      setPlayers(prev => [...prev, newPlayer]);
      setDataLoaded(true); 
  };

  const handleUpdatePlayerProfile = (updatedPlayer: Player) => { setPlayers(prev => prev.map(p => p.id === updatedPlayer.id ? updatedPlayer : p)); };
  const handleDeletePlayer = (id: number) => { 
      setPlayers(prev => prev.filter(p => p.id !== id));
      const player = players.find(p => p.id === id);
      if (player) setRecentActivity(prev => prev.filter(log => log.details?.playerName !== player.name));
  };
  const handleBulkUpdateType = (ids: number[], type: 'LIVE' | 'LOTTERY') => {
      if (ids.length === 0) return;
      setPlayers(prev => prev.map(p => ids.includes(p.id) ? { ...p, auctionType: type } : p));
  };

  // --- NEW BATCH ASSIGNMENT HANDLERS (For Global Distributor) ---
  const handleBatchAssign = (assignments: {playerId: string | number, teamId: string, price: number}[]) => {
      const newPlayerState = [...players];
      let assignedCount = 0;
      const batchIds: number[] = [];

      assignments.forEach(({ playerId, teamId, price }) => {
          const pid = Number(playerId);
          const pIndex = newPlayerState.findIndex(p => p.id === pid);
          if (pIndex > -1) {
              // The console sends teamId, we need to map it to the Team Name string used in App.tsx
              const teamObj = teams.find(t => t.id === teamId);
              const teamName = teamObj ? teamObj.name : ''; 
              
              if (teamName) {
                  newPlayerState[pIndex] = {
                      ...newPlayerState[pIndex],
                      team: teamName,
                      price: price,
                      status: 'sold'
                  };
                  batchIds.push(pid);
                  assignedCount++;
              }
          }
      });

      setPlayers(newPlayerState);
      setLastBatchIds(batchIds);
      setUndoToastOpen(true);
      setTimeout(() => setUndoToastOpen(false), 10000); 

      if (assignedCount > 0) {
        addActivity({ 
            type: 'sale', 
            message: `⚡ BATCH: Assigned ${assignedCount} players via Auto-Distributor`, 
            details: { playerName: `${assignedCount} Players`, price: 0, teamName: 'Multiple' } 
        });
      }
  };

  const handleUndoBatch = (playerIds: string[] | number[]) => {
      const idsToRevert = playerIds.map(id => Number(id));
      setPlayers(prev => prev.map(p => {
          if (idsToRevert.includes(p.id)) {
              return { ...p, team: null, price: 0, status: 'available' };
          }
          return p;
      }));
      setLastBatchIds([]);
      setUndoToastOpen(false);
      addActivity({ type: 'correction', message: `Start-Over: Reverted last batch distribution`, details: { playerName: 'Batch Undo', price: 0, teamName: '-' } });
  };


  const handleSaveConfig = (e: React.FormEvent) => {
      e.preventDefault();
      setConfig(tempConfig);
      localStorage.setItem('sports_auction_config', JSON.stringify(tempConfig));
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
  };

  const handleReset = () => {
    if(confirm("FACTORY RESET: Delete ALL players, teams, and settings? This cannot be undone.")) {
        setPlayers([]); setTeamNames(DEFAULT_TEAM_NAMES); setConfig(DEFAULT_CONFIG); setRecentActivity([]); setDataLoaded(false);
        localStorage.clear();
        window.location.reload();
    }
  };

  const handleTeamSelect = (teamName: string) => { setTargetTeam(teamName); setActiveTab(Tab.ROSTER); };
  const handleAutoFillPreview = () => { alert("Auto-Fill Wizard Coming Soon! (Module Disabled in Lite Version)"); };
  const handleAutoFillConfirm = () => { };
  const handleAutoFillUndo = () => { };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-amber-500/30 flex flex-col relative">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-lg">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="bg-gradient-to-br from-amber-500 to-amber-700 p-2 rounded-lg shadow-lg">
                <Trophy className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg md:text-2xl font-black bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent tracking-tight">
              {eventName}
            </h1>
            {isAdmin && <span className="px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 text-[10px] border border-emerald-500/30 uppercase font-bold">Admin</span>}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button onClick={() => setShowAboutModal(true)} className="p-2 text-slate-400 hover:text-indigo-400 transition-colors" title="About">
                <Info className="w-5 h-5" />
            </button>
            <nav className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
                <button onClick={() => switchTab(Tab.DASHBOARD)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === Tab.DASHBOARD ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}><LayoutDashboard className="w-4 h-4" /> Dashboard</button>
                {isAdmin && <button onClick={() => switchTab(Tab.AUCTION)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === Tab.AUCTION ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}><Gavel className="w-4 h-4" /> Console</button>}
                <button onClick={() => switchTab(Tab.ROSTER)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === Tab.ROSTER ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}><Users className="w-4 h-4" /> Teams</button>
                <button onClick={() => switchTab(Tab.SETTINGS)} className={`p-2 rounded-lg ${activeTab === Tab.SETTINGS ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>{isAdmin ? <Settings className="w-4 h-4" /> : <Lock className="w-4 h-4" />}</button>
            </nav>
            {isAdmin && <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400"><Unlock className="w-5 h-5" /></button>}
          </div>
          <button className="md:hidden p-2 text-slate-300" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
             {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
            <div className="md:hidden absolute top-16 left-0 w-full bg-slate-900 border-b border-slate-800 shadow-xl z-50 animate-in slide-in-from-top-5">
                <nav className="flex flex-col p-4 space-y-2">
                    <button onClick={() => switchTab(Tab.DASHBOARD)} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold ${activeTab === Tab.DASHBOARD ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><LayoutDashboard className="w-5 h-5" /> Dashboard</button>
                    {isAdmin && <button onClick={() => switchTab(Tab.AUCTION)} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold ${activeTab === Tab.AUCTION ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Gavel className="w-5 h-5" /> Console</button>}
                    <button onClick={() => switchTab(Tab.ROSTER)} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold ${activeTab === Tab.ROSTER ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Users className="w-5 h-5" /> Teams</button>
                    <button onClick={() => switchTab(Tab.SETTINGS)} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold ${activeTab === Tab.SETTINGS ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>{isAdmin ? <Settings className="w-5 h-5" /> : <Lock className="w-5 h-5" />} Settings</button>
                    <button onClick={() => { setShowAboutModal(true); setMobileMenuOpen(false); }} className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 rounded-xl text-sm font-bold"><Info className="w-5 h-5" /> About</button>
                    {isAdmin && <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-900/20 rounded-xl text-sm font-bold"><Unlock className="w-5 h-5" /> Logout</button>}
                </nav>
            </div>
        )}
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 py-6 md:py-8 max-w-[1600px] flex-grow">
        {activeTab === Tab.DASHBOARD && (
            players.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500 animate-in fade-in text-center">
                    <Hourglass className="w-20 h-20 mb-6 opacity-20 text-indigo-500" />
                    <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Sports Auction 2026</h2>
                    <p className="text-lg text-slate-400 mb-8 font-medium">An Initiative by <span className="text-indigo-400">Ar. Abhishek Chandaliya</span></p>
                    <div className="p-6 bg-slate-900/50 rounded-2xl border border-slate-800 max-w-md w-full">
                        <h3 className="font-bold text-slate-300 mb-2">Waiting for Data</h3>
                        <p className="text-sm text-slate-500">The auction setup is in progress. Please check back later or log in to upload master data.</p>
                    </div>
                </div>
            ) : (
                <Dashboard teams={teams} players={players} onTeamSelect={handleTeamSelect} currentAuctionPlayerId={currentAuctionPlayerId} config={config} sports={sports} categories={categories} />
            )
        )}

        {activeTab === Tab.AUCTION && isAdmin && (
            players.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 animate-in fade-in"><Gavel className="w-16 h-16 mb-4 opacity-20" /><h2 className="text-2xl font-bold text-slate-400">Auction Waiting to Start</h2></div>
            ) : (
                <AuctionConsole 
                    players={players} 
                    teams={teams} 
                    onSale={(pid, tid, amt) => handleSellPlayer(Number(pid), teams.find(t => t.id === tid)?.name || '', amt)} 
                    onUndoSale={(id) => handleUnsellPlayer(Number(id))} 
                    onMarkUnsold={(id) => handleMarkUnsold(Number(id))} 
                    onUpdatePlayer={(pid, tname, amt) => handleUpdatePlayer(Number(pid), tname, amt)} 
                    // NEW PROPS FOR BATCH
                    onBatchAssign={handleBatchAssign}
                    onUndoBatch={handleUndoBatch}
                    // -----------
                    isReadOnly={!isAdmin} 
                    currentPlayerId={currentAuctionPlayerId} 
                    onSelectPlayer={setCurrentAuctionPlayerId} 
                    recentActivity={recentActivity} 
                    // Mapping history properly if your component expects 'history'
                    history={recentActivity as any}
                    config={config} 
                    sports={sports} 
                    categories={categories} 
                />
            )
        )}

        {activeTab === Tab.ROSTER && (
             teams.length === 0 ? <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 animate-in fade-in"><Users className="w-16 h-16 mb-4 opacity-20" /><h2 className="text-2xl font-bold text-slate-400">No teams initialized yet</h2></div> : 
             <RosterView players={players} teams={teams} recentActivity={recentActivity} targetTeam={targetTeam} config={config} isAdmin={isAdmin} onAddTeam={handleAddTeam} onRenameTeam={handleRenameTeam} onDeleteTeam={handleDeleteTeam} onAssignCaptain={handleAssignCaptain} onRemoveCaptain={handleRemoveCaptain} onEditConfig={() => switchTab(Tab.SETTINGS)} sports={sports} categories={categories} />
        )}

        {activeTab === Tab.SETTINGS && (
            <div className="max-w-5xl mx-auto pt-6 pb-20">
                {!isAdmin ? (
                    <div className="max-w-md mx-auto bg-slate-900 p-8 rounded-2xl border border-slate-800 text-center">
                        <ShieldCheck className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
                        <h2 className="text-2xl font-black text-white mb-4">Admin Access</h2>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <input type="password" placeholder="Password" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-5 py-3 text-white" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} />
                            {loginError && <p className="text-red-400 text-sm">Incorrect password.</p>}
                            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl">Unlock</button>
                        </form>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in fade-in">
                        {/* Event Name */}
                        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                            <h3 className="text-xl font-black text-white mb-4 flex gap-2"><Zap className="text-amber-400" /> Event Settings</h3>
                            <input type="text" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Event Name" />
                        </div>

                        {/* GAME CONFIGURATION */}
                        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                            <h3 className="text-xl font-black text-white mb-6 flex gap-2"><Layers className="text-blue-400" /> Game Configuration</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                    <h4 className="font-bold text-slate-300 mb-3 uppercase text-sm">Active Sports</h4>
                                    <div className="space-y-2 mb-4">
                                        {sports.map(s => (
                                            <div key={s} className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800">
                                                {editingSport === s ? (
                                                    <div className="flex items-center gap-2 flex-1"><input type="text" className="flex-1 bg-slate-900 border border-indigo-500 rounded px-2 py-1 text-white text-sm" autoFocus value={editSportValue} onChange={e => setEditSportValue(e.target.value)} /><button onClick={() => handleRenameSport(s)} className="text-emerald-400"><Check className="w-4 h-4"/></button><button onClick={() => setEditingSport(null)} className="text-red-400"><X className="w-4 h-4"/></button></div>
                                                ) : (
                                                    <><span className="text-sm font-medium">{s}</span><div className="flex gap-1"><button onClick={() => { setEditingSport(s); setEditSportValue(s); }} className="text-indigo-400 p-1.5 rounded"><Edit2 className="w-3.5 h-3.5" /></button><button onClick={() => handleDeleteSport(s)} className="text-red-400 p-1.5 rounded"><Trash2 className="w-3.5 h-3.5" /></button></div></>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex gap-2"><input type="text" className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm" placeholder="Add Sport..." value={newSportInput} onChange={e => setNewSportInput(e.target.value)} /><button onClick={handleAddSport} className="bg-indigo-600 px-3 py-1 rounded text-white"><Plus className="w-4 h-4" /></button></div>
                                </div>
                                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                    <h4 className="font-bold text-slate-300 mb-3 uppercase text-sm">Rating Categories</h4>
                                    <div className="space-y-2 mb-4">
                                        {categories.map(c => (
                                            <div key={c} className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800">
                                                {editingCategory === c ? (
                                                    <div className="flex items-center gap-2 flex-1"><input type="text" className="flex-1 bg-slate-900 border border-indigo-500 rounded px-2 py-1 text-white text-sm" autoFocus value={editCategoryValue} onChange={e => setEditCategoryValue(e.target.value)} /><button onClick={() => handleRenameCategory(c)} className="text-emerald-400"><Check className="w-4 h-4"/></button><button onClick={() => setEditingCategory(null)} className="text-red-400"><X className="w-4 h-4"/></button></div>
                                                ) : (
                                                    <><span className="text-sm font-medium">Grade '{c}'</span><div className="flex gap-1"><button onClick={() => { setEditingCategory(c); setEditCategoryValue(c); }} className="text-indigo-400 p-1.5 rounded"><Edit2 className="w-3.5 h-3.5" /></button><button onClick={() => handleDeleteCategory(c)} className="text-red-400 p-1.5 rounded"><Trash2 className="w-3.5 h-3.5" /></button></div></>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex gap-2"><input type="text" className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm" placeholder="Add Grade..." value={newCatInput} onChange={e => setNewCatInput(e.target.value)} /><button onClick={handleAddCategory} className="bg-indigo-600 px-3 py-1 rounded text-white"><Plus className="w-4 h-4" /></button></div>
                                </div>
                            </div>
                        </div>

                        {/* RULES CONFIGURATION */}
                        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                            <h3 className="text-xl font-black text-white mb-4 flex gap-2"><Scale className="text-indigo-400" /> Tournament Rules</h3>
                            <form onSubmit={handleSaveConfig} className="space-y-6">
                                <div className="grid grid-cols-3 gap-4">
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase">Purse</label><input type="number" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono font-bold" value={tempConfig.purseLimit} onChange={e => setTempConfig({...tempConfig, purseLimit: parseInt(e.target.value) || 0})} /></div>
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase">Squad Size</label><input type="number" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono font-bold" value={tempConfig.maxSquadSize} onChange={e => setTempConfig({...tempConfig, maxSquadSize: parseInt(e.target.value) || 0})} /></div>
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase">Base Price</label><input type="number" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono font-bold" value={tempConfig.basePrice} onChange={e => setTempConfig({...tempConfig, basePrice: parseInt(e.target.value) || 0})} /></div>
                                </div>

                                <div className="pt-4 border-t border-slate-700">
                                    <h4 className="text-sm font-bold text-white uppercase mb-4 flex items-center gap-2"><Settings2 className="w-4 h-4 text-emerald-400" /> Fair Play Quotas (Category Limits)</h4>
                                    <div className="flex gap-2 mb-4 overflow-x-auto">
                                        {sports.map(s => (
                                            <button type="button" key={s} onClick={() => setSettingsSportTab(s)} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${settingsSportTab === s ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>{s}</button>
                                        ))}
                                    </div>
                                    {settingsSportTab && tempConfig.categoryLimits && tempConfig.categoryMaxLimits && tempConfig.sportLimits && (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-900 p-6 rounded-xl border border-slate-800 animate-in fade-in">
                                            {/* Category Limits */}
                                            <div>
                                                <h5 className="text-xs font-bold text-indigo-400 uppercase mb-4 tracking-widest flex items-center gap-2">Grade Quotas</h5>
                                                {/* MIN LIMITS */}
                                                <div className="mb-6">
                                                    <label className="text-[10px] font-bold text-emerald-500 uppercase mb-2 block">Minimum Required</label>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                        {categories.map(c => (
                                                            <div key={`min-${c}`} className="flex items-center bg-slate-950 border border-emerald-900/50 rounded-lg overflow-hidden">
                                                                <span className="px-2 text-[10px] font-bold text-emerald-600 bg-emerald-900/10 border-r border-emerald-900/50">{c}</span>
                                                                <input type="number" className="w-full bg-transparent p-2 text-white font-mono text-sm focus:outline-none" value={tempConfig.categoryLimits[settingsSportTab]?.[c] ?? 0} onChange={(e) => setTempConfig({...tempConfig, categoryLimits: {...tempConfig.categoryLimits, [settingsSportTab]: {...tempConfig.categoryLimits[settingsSportTab], [c]: parseInt(e.target.value) || 0}}})} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                {/* MAX LIMITS */}
                                                <div>
                                                    <label className="text-[10px] font-bold text-orange-500 uppercase mb-2 block">Maximum Allowed</label>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                        {categories.map(c => (
                                                            <div key={`max-${c}`} className="flex items-center bg-slate-950 border border-orange-900/50 rounded-lg overflow-hidden">
                                                                <span className="px-2 text-[10px] font-bold text-orange-600 bg-orange-900/10 border-r border-orange-900/50">{c}</span>
                                                                <input type="number" className="w-full bg-transparent p-2 text-white font-mono text-sm focus:outline-none" value={tempConfig.categoryMaxLimits[settingsSportTab]?.[c] ?? 99} onChange={(e) => setTempConfig({...tempConfig, categoryMaxLimits: {...tempConfig.categoryMaxLimits, [settingsSportTab]: {...tempConfig.categoryMaxLimits[settingsSportTab], [c]: parseInt(e.target.value) || 0}}})} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Sport Limits */}
                                            <div className="lg:border-l border-slate-800 lg:pl-6 pt-6 lg:pt-0 border-t lg:border-t-0">
                                                <h5 className="text-xs font-bold text-emerald-400 uppercase mb-4 tracking-widest">Total {settingsSportTab} Players</h5>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Min Players</label><input type="number" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono" value={tempConfig.sportLimits[settingsSportTab]?.min ?? 0} onChange={(e) => setTempConfig({...tempConfig, sportLimits: {...tempConfig.sportLimits, [settingsSportTab]: {...tempConfig.sportLimits[settingsSportTab] || {min:0,max:99}, min: parseInt(e.target.value) || 0}}})} /></div>
                                                    <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Max Players</label><input type="number" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono" value={tempConfig.sportLimits[settingsSportTab]?.max ?? 99} onChange={(e) => setTempConfig({...tempConfig, sportLimits: {...tempConfig.sportLimits, [settingsSportTab]: {...tempConfig.sportLimits[settingsSportTab] || {min:0,max:99}, max: parseInt(e.target.value) || 0}}})} /></div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    {configSaved && <span className="text-emerald-400 flex items-center gap-1 font-bold animate-pulse"><CheckCircle className="w-4 h-4"/> Rules Saved</span>}
                                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-indigo-900/20 transition-all flex items-center gap-2"><Save className="w-4 h-4" /> Save Rules</button>
                                </div>
                            </form>
                        </div>
                        
                        {/* PLAYER MANAGER */}
                        <PlayerManager players={players} sports={sports} categories={categories} onAdd={handleAddPlayerManual} onUpdate={handleUpdatePlayerProfile} onDelete={handleDeletePlayer} onBulkUpdateType={handleBulkUpdateType} />

                        {/* DATA MANAGEMENT */}
                        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 mt-8">
                            <h4 className="text-md font-bold text-slate-300 mb-4 flex items-center gap-2"><UploadCloud className="w-5 h-5" /> Data Management</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div className="space-y-4">
                                    <FileUploader label="Upload Master List" onDataLoaded={handleMasterLoad} />
                                    <FileUploader label="Upload Sport Specific List" onDataLoaded={handleMasterLoad} variant="compact" />
                                </div>
                                <div className="space-y-3">
                                    <h5 className="text-xs font-bold text-slate-500 uppercase">Export Reports</h5>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={handleExportMaster} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-all"><Table className="w-5 h-5 text-blue-400" /><span className="text-xs font-bold text-slate-300">Full Database</span></button>
                                        <button onClick={handleExportTeams} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-all"><BookOpen className="w-5 h-5 text-emerald-400" /><span className="text-xs font-bold text-slate-300">Team Summary</span></button>
                                        <button onClick={handleExportSports} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-all"><ClipboardList className="w-5 h-5 text-amber-400" /><span className="text-xs font-bold text-slate-300">Category List</span></button>
                                        <button onClick={handleDownloadTemplate} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-all"><FileSpreadsheet className="w-5 h-5 text-indigo-400" /><span className="text-xs font-bold text-slate-300">Template</span></button>
                                    </div>
                                </div>
                            </div>
                            <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row gap-4">
                                <button onClick={handleAutoFillPreview} className="flex-1 py-4 bg-indigo-900/30 text-indigo-400 border border-indigo-500/30 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-900/50"><Wand2 className="w-5 h-5" /> Auto-Fill Wizard</button>
                                <button onClick={handleReset} className="flex-1 py-4 bg-red-900/30 text-red-400 border border-red-500/30 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-900/50"><Trash2 className="w-5 h-5" /> Factory Reset</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}
      </main>

      {/* ABOUT MODAL */}
      {showAboutModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowAboutModal(false)}>
            <div className="bg-slate-950 border border-slate-800 p-8 rounded-3xl max-w-lg w-full shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500"></div>
                <button onClick={() => setShowAboutModal(false)} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white rounded-full hover:bg-slate-800 transition-colors"><X className="w-6 h-6"/></button>
                <div className="flex items-center gap-3 mb-6"><div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400"><Info className="w-8 h-8" /></div><div><h2 className="text-xl font-bold text-white">About the Initiative</h2><p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Digital Transformation</p></div></div>
                <h3 className="text-2xl font-black text-white mb-4 leading-tight">Digital Transformation of <br/><span className="text-indigo-400">IIID Sports Auction</span></h3>
                <p className="text-slate-300 mb-8 leading-relaxed text-sm text-justify">This platform is a pro-bono initiative conceptualized and developed by <strong className="text-white">Ar. Abhishek Chandaliya</strong> to take the auction process to the next level.</p>
                <div className="pt-6 border-t border-slate-800 text-center"><p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Architected & Developed By</p><p className="text-lg font-black text-indigo-400">Ar. Abhishek Chandaliya</p><p className="text-xs text-slate-600 mt-1">© 2026 All Rights Reserved</p></div>
            </div>
        </div>
      )}

      {/* AUTO FILL MODAL */}
      <AutoFillModal isOpen={autoFillModalOpen} assignments={proposedAssignments} onClose={() => setAutoFillModalOpen(false)} onConfirm={handleAutoFillConfirm} />

      {/* UNDO TOAST */}
      {undoToastOpen && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[70] animate-in slide-in-from-bottom-8 fade-in duration-300">
             <div className="bg-slate-900 border border-indigo-500/50 shadow-2xl rounded-2xl p-4 flex items-center gap-6">
                 <div className="flex items-center gap-3"><CheckCircle className="text-emerald-500 w-5 h-5" /><div><div className="font-bold text-white">Auto-Fill Complete</div><div className="text-xs text-slate-400">{lastBatchIds.length} players assigned.</div></div></div>
                 <button onClick={() => handleUndoBatch(lastBatchIds)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-sm flex items-center gap-2 border border-slate-700 transition-colors"><RotateCcw className="w-4 h-4" /> UNDO</button>
             </div>
        </div>
      )}
    </div>
  );
};
export default App;
