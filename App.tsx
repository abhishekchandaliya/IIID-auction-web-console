import React, { useState, useEffect, useMemo } from 'react';
import { Tab, Player, ActivityLog, TournamentConfig } from './types';
import { DEFAULT_TEAM_NAMES, DEFAULT_CONFIG, DEFAULT_SPORTS, DEFAULT_CATEGORIES } from './constants';
import { calculateTeamStats, normalizeRating, parseCurrency } from './utils';
import Dashboard from './components/Dashboard';
import AuctionConsole from './components/AuctionConsole';
import RosterView from './components/RosterView';
import FileUploader from './components/FileUploader';
import PlayerManager from './components/PlayerManager';
import { LayoutDashboard, Gavel, Users, Settings, Trophy, UploadCloud, Trash2, Lock, Unlock, Download, ChevronDown, Database, Menu, X, Save, Settings2, CheckCircle, ShieldCheck, Scale, Zap, Plus, Layers, Activity, FileSpreadsheet, Table, BookOpen, ClipboardList, Hourglass, Edit2, Check, Info } from 'lucide-react';
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
                // Migration for legacy data (add status if missing)
                const migratedPlayers = parsed.map((p: any) => ({
                    ...p,
                    status: p.status || (p.team ? 'sold' : 'available')
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
             // Ensure legacy configs get new fields (sportLimits)
             const safeConfig = { ...DEFAULT_CONFIG, ...parsed };
             if (!safeConfig.sportLimits) safeConfig.sportLimits = DEFAULT_CONFIG.sportLimits;
             
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
      const newSportLimits = { ...(config.sportLimits || {}) };
      let changed = false;
      
      sports.forEach(s => {
          if (!newLimits[s]) {
              newLimits[s] = {};
              changed = true;
          }
          if (!newSportLimits[s]) {
              newSportLimits[s] = { min: 0, max: 20 };
              changed = true;
          }
          categories.forEach(c => {
              if (newLimits[s][c] === undefined) {
                  newLimits[s][c] = 2; // Default limit
                  changed = true;
              }
          });
      });
      if (changed) {
          const newConfig = { ...config, categoryLimits: newLimits, sportLimits: newSportLimits };
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

  // --- Sport Management (CRUD) ---
  
  const handleAddSport = () => {
      if (newSportInput && !sports.includes(newSportInput)) {
          setSports([...sports, newSportInput]);
          setNewSportInput("");
      }
  };

  const handleRenameSport = (oldName: string) => {
      const newName = editSportValue.trim();
      if (!newName || sports.includes(newName)) {
          setEditingSport(null);
          return;
      }
      
      // 1. Update List
      setSports(prev => prev.map(s => s === oldName ? newName : s));
      if (settingsSportTab === oldName) setSettingsSportTab(newName);

      // 2. Update Config (Move keys)
      const newCategoryLimits = { ...config.categoryLimits };
      if (newCategoryLimits[oldName]) {
          newCategoryLimits[newName] = newCategoryLimits[oldName];
          delete newCategoryLimits[oldName];
      }
      const newSportLimits = { ...config.sportLimits };
      if (newSportLimits[oldName]) {
          newSportLimits[newName] = newSportLimits[oldName];
          delete newSportLimits[oldName];
      }
      
      const newConfig = { ...config, categoryLimits: newCategoryLimits, sportLimits: newSportLimits };
      setConfig(newConfig);
      setTempConfig(newConfig);

      // 3. Update Players (Move rating keys)
      setPlayers(prev => prev.map(p => {
          const newRatings = { ...p.ratings };
          if (newRatings[oldName] !== undefined) {
              newRatings[newName] = newRatings[oldName];
              delete newRatings[oldName];
          }
          // Update captaincy if applicable
          const newCaptainFor = p.captainFor === oldName ? newName : p.captainFor;
          return { ...p, ratings: newRatings, captainFor: newCaptainFor };
      }));

      setEditingSport(null);
  };

  const handleDeleteSport = (s: string) => {
      // Safety Check
      const playersWithData = players.filter(p => p.ratings[s] && p.ratings[s] !== '0');
      if (playersWithData.length > 0) {
          if (!confirm(`WARNING: ${playersWithData.length} players have ratings for ${s}. Deleting this sport will hide their data. Continue?`)) {
              return;
          }
      }

      setSports(prev => prev.filter(sport => sport !== s));
      if(settingsSportTab === s) setSettingsSportTab(sports[0] || "");
  };

  // --- Category Management (CRUD) ---

  const handleAddCategory = () => {
      if (newCatInput && !categories.includes(newCatInput.toUpperCase())) {
          setCategories([...categories, newCatInput.toUpperCase()]);
          setNewCatInput("");
      }
  };

  const handleRenameCategory = (oldName: string) => {
      const newName = editCategoryValue.trim().toUpperCase();
      if (!newName || categories.includes(newName)) {
          setEditingCategory(null);
          return;
      }

      // 1. Update List
      setCategories(prev => prev.map(c => c === oldName ? newName : c));

      // 2. Update Config (Update inner keys)
      const newCategoryLimits = { ...config.categoryLimits };
      Object.keys(newCategoryLimits).forEach(sport => {
          if (newCategoryLimits[sport][oldName] !== undefined) {
              newCategoryLimits[sport][newName] = newCategoryLimits[sport][oldName];
              delete newCategoryLimits[sport][oldName];
          }
      });
      const newConfig = { ...config, categoryLimits: newCategoryLimits };
      setConfig(newConfig);
      setTempConfig(newConfig);

      // 3. Update Players (Update rating values)
      setPlayers(prev => prev.map(p => {
          const newRatings = { ...p.ratings };
          Object.keys(newRatings).forEach(sport => {
              if (newRatings[sport] === oldName) {
                  newRatings[sport] = newName;
              }
          });
          return { ...p, ratings: newRatings };
      }));

      setEditingCategory(null);
  };

  const handleDeleteCategory = (c: string) => {
       // Safety Check
       const playersWithData = players.filter(p => Object.values(p.ratings).includes(c));
       if (playersWithData.length > 0) {
           if(!confirm(`WARNING: ${playersWithData.length} players are rated as '${c}'. Deleting this category will effectively remove those ratings. Continue?`)) {
               return;
           }
       }
       setCategories(prev => prev.filter(cat => cat !== c));
  };

  // CSV Load - Dynamic
  const handleMasterLoad = (rawData: any[]) => {
    const parsedPlayers: Player[] = rawData
        .filter((row: any) => {
             const name = getRowValue(row, 'Player Name', 'Name', 'Player');
             return name && typeof name === 'string' && name.trim() !== '';
        })
        .map((row: any, index: number) => {
            const pName = getRowValue(row, 'Player Name', 'Name', 'Player');
            const pTeam = getRowValue(row, 'Team', 'Winning Team', 'Sold To');
            const pPriceVal = getRowValue(row, 'Auction Value', 'Price', 'Sold Price', 'Amount');
            const pPrice = parseCurrency(pPriceVal || '0');
            const pContact = getRowValue(row, 'Contact No', 'Mobile', 'Phone');
            
            // Dynamic Rating Parsing
            const ratings: Record<string, string> = {};
            sports.forEach(sport => {
                // Look for column with sport name (fuzzy)
                const val = getRowValue(row, sport, sport.toLowerCase(), sport.toUpperCase());
                ratings[sport] = normalizeRating(val, categories);
            });

            let matchedTeam = null;
            if (pTeam) {
                const cleanTeam = pTeam.trim();
                const found = teamNames.find(t => t.toLowerCase() === cleanTeam.toLowerCase());
                if (found) matchedTeam = found;
            }

            return {
                id: index + 1,
                name: pName.trim(),
                team: matchedTeam,
                price: matchedTeam ? pPrice : 0, 
                ratings,
                contactNo: pContact ? String(pContact).trim() : 'N/A',
                status: matchedTeam ? 'sold' : 'available'
            };
        });

    if (parsedPlayers.length === 0) {
        alert("No valid player data found.");
        return;
    }

    setPlayers(parsedPlayers);
    setDataLoaded(true);
    alert(`Successfully loaded ${parsedPlayers.length} players!`);
  };

  // --- REPORT EXPORTERS ---

  // 1. MASTER DUMP
  const handleExportMaster = () => {
      if(players.length === 0) return alert("No data to export");
      
      const exportData = players.map(p => {
          const row: any = {
              "ID": p.id,
              "Name": p.name,
              "Status": p.status,
              "Team": p.team || "",
              "Sold Price": p.price || 0,
              "Contact No": p.contactNo || ""
          };
          // Add dynamic sport ratings
          sports.forEach(s => row[s] = p.ratings[s] || "");
          return row;
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Master Data");
      XLSX.writeFile(wb, `${eventName.replace(/\s+/g,'_')}_MasterDump.xlsx`);
  };

  // 2. TEAM INSIGHTS (Multi-sheet)
  const handleExportTeams = () => {
      if(teams.length === 0) return alert("No teams defined");
      const wb = XLSX.utils.book_new();

      // Sheet 1: Team Summaries
      const summaryData = teams.map(t => {
          // Calculate Deficits String
          const deficits = (Object.entries(t.validation.sportStatus) as [string, { status: string; limit: number }][])
            .filter(([_, val]) => val.status === 'under')
            .map(([sport, val]) => `${sport}: Need ${val.limit - t.sportStats[sport].total} more`)
            .join(", ");

          // Captain Names
          const captains = players
            .filter(p => p.team === t.name && p.captainFor)
            .map(p => `${p.name} (${p.captainFor})`)
            .join(", ");

          return {
              "Team Name": t.name,
              "Captains": captains,
              "Total Spent": t.spent,
              "Purse Remaining": t.disposableBalance,
              "Squad Size": t.playerCount,
              "Max Squad": config.maxSquadSize,
              "Is Valid?": t.validation.isValid ? "Yes" : "No",
              "Deficits": deficits || "None"
          };
      });
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Team Summaries");

      // Sheet 2: Full Rosters
      const rosterData = players
        .filter(p => p.team)
        .sort((a, b) => (a.team || "").localeCompare(b.team || ""))
        .map(p => ({
            "Team": p.team,
            "Name": p.name,
            "Price": p.price,
            "Captain": p.captainFor || "",
            ...p.ratings
        }));
      const wsRoster = XLSX.utils.json_to_sheet(rosterData);
      XLSX.utils.book_append_sheet(wb, wsRoster, "Full Rosters");

      XLSX.writeFile(wb, `${eventName.replace(/\s+/g,'_')}_TeamInsights.xlsx`);
  };

  // 3. SPORT ENCYCLOPEDIA (Multi-sheet)
  const handleExportSports = () => {
      const wb = XLSX.utils.book_new();

      sports.forEach(sport => {
          // Filter players relevant to this sport
          const sportPlayers = players
            .filter(p => p.ratings[sport] && p.ratings[sport] !== '0')
            .sort((a, b) => {
                // Sort by Category Index (A -> B -> C)
                const catA = categories.indexOf(a.ratings[sport]);
                const catB = categories.indexOf(b.ratings[sport]);
                if (catA !== catB) return catA - catB;
                // Then by Price (Desc)
                return b.price - a.price; 
            });

          if (sportPlayers.length > 0) {
              const sheetData = sportPlayers.map(p => ({
                  "Category": p.ratings[sport],
                  "Name": p.name,
                  "Status": p.status,
                  "Team": p.team || "",
                  "Price": p.price,
                  "All Ratings": JSON.stringify(p.ratings)
              }));
              const ws = XLSX.utils.json_to_sheet(sheetData);
              XLSX.utils.book_append_sheet(wb, ws, sport);
          }
      });

      if (wb.SheetNames.length === 0) return alert("No sport data found.");
      XLSX.writeFile(wb, `${eventName.replace(/\s+/g,'_')}_SportEncyclopedia.xlsx`);
  };

  // Template Generator
  const handleDownloadTemplate = () => {
      const headers = ["Name", "Team", "Price", "Contact No", ...sports];
      const exampleRow = [
          "Example Player Name",
          "", // Team (empty for unsold)
          "0", // Price
          "9876543210", // Contact
          ...sports.map(() => categories[0] || "A") 
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Upload Template");
      XLSX.writeFile(wb, "Sports_Auction_Template.csv");
  };

  // Auction Actions
  const handleSellPlayer = (playerId: number, teamName: string, price: number) => {
    let sold: Player | null = null;
    setPlayers(prev => prev.map(p => {
        if (p.id === playerId) {
            sold = { ...p, team: teamName, price: price, status: 'sold' };
            return sold;
        }
        return p;
    }));
    if (sold) addActivity({ type: 'sale', message: `💰 SOLD: ${(sold as Player).name} to ${teamName} for **${price}**` });
  };

  const handleUnsellPlayer = (playerId: number) => {
      const player = players.find(p => p.id === playerId);
      if (!player) return;
      const prevTeam = player.team;
      // Revert to available status
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, team: null, price: 0, captainFor: undefined, status: 'available' } : p));
      addActivity({ type: 'revert', message: `❌ REVERTED: ${player.name} removed from ${prevTeam}` });
  };

  const handleMarkUnsold = (playerId: number) => {
      const player = players.find(p => p.id === playerId);
      if (!player) return;
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, team: null, price: 0, captainFor: undefined, status: 'unsold' } : p));
      addActivity({ type: 'unsold', message: `⚠️ UNSOLD: ${player.name} remained unsold` });
  }

  const handleUpdatePlayer = (playerId: number, teamName: string, price: number) => {
      const player = players.find(p => p.id === playerId);
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, team: teamName, price: price, status: 'sold' } : p));
      if(player) addActivity({ type: 'correction', message: `🛠️ CORRECTION: ${player.name} updated` });
  };

  const handleAssignCaptain = (playerId: number, teamName: string, sport: string, price: number) => {
    let sold: Player | null = null;
    setPlayers(prev => prev.map(p => {
        if (p.id === playerId) {
            sold = { ...p, team: teamName, price: price, captainFor: sport, status: 'sold' };
            return sold;
        }
        if (p.team === teamName && p.captainFor === sport) {
            return { ...p, team: null, price: 0, captainFor: undefined, status: 'available' };
        }
        return p;
    }));
    if (sold) addActivity({ type: 'captain', message: `👑 CAPTAIN: ${(sold as Player).name} assigned to ${teamName}` });
  };

  const handleRemoveCaptain = (playerId: number) => {
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, team: null, price: 0, captainFor: undefined, status: 'available' } : p));
  };

  // CRUD HANDLERS FOR PLAYER MANAGER
  const handleAddPlayerManual = (playerData: Omit<Player, 'id' | 'team' | 'price' | 'status' | 'captainFor'>) => {
      const newId = players.length > 0 ? Math.max(...players.map(p => p.id)) + 1 : 1;
      const newPlayer: Player = {
        id: newId,
        team: null,
        price: 0,
        status: 'available',
        ...playerData
      };
      setPlayers(prev => [...prev, newPlayer]);
      setDataLoaded(true); // Ensure dashboard shows if this is first entry
  };

  const handleUpdatePlayerProfile = (updatedPlayer: Player) => {
      setPlayers(prev => prev.map(p => p.id === updatedPlayer.id ? updatedPlayer : p));
  };

  const handleDeletePlayer = (id: number) => {
      setPlayers(prev => prev.filter(p => p.id !== id));
  };

  const handleSaveConfig = (e: React.FormEvent) => {
      e.preventDefault();
      setConfig(tempConfig);
      localStorage.setItem('sports_auction_config', JSON.stringify(tempConfig));
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
  };

  const handleReset = () => {
    if(confirm("FACTORY RESET: Are you sure? This cannot be undone.")) {
        setDataLoaded(false);
        localStorage.clear();
        window.location.reload();
    }
  };

  const handleTeamSelect = (teamName: string) => {
      setTargetTeam(teamName);
      setActiveTab(Tab.ROSTER);
  };

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
            <button onClick={() => setShowAboutModal(true)} className="p-2 text-slate-400 hover:text-indigo-400 transition-colors" title="About the Initiative">
                <Info className="w-5 h-5" />
            </button>
            <nav className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
                <button onClick={() => switchTab(Tab.DASHBOARD)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === Tab.DASHBOARD ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                    <LayoutDashboard className="w-4 h-4" /> Dashboard
                </button>
                {isAdmin && (
                    <button onClick={() => switchTab(Tab.AUCTION)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === Tab.AUCTION ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                        <Gavel className="w-4 h-4" /> Console
                    </button>
                )}
                <button onClick={() => switchTab(Tab.ROSTER)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === Tab.ROSTER ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                    <Users className="w-4 h-4" /> Teams
                </button>
                <button onClick={() => switchTab(Tab.SETTINGS)} className={`p-2 rounded-lg ${activeTab === Tab.SETTINGS ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
                    {isAdmin ? <Settings className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </button>
            </nav>
            {isAdmin && <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400"><Unlock className="w-5 h-5" /></button>}
          </div>
          <button className="md:hidden p-2 text-slate-300" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}><Menu /></button>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 py-6 md:py-8 max-w-[1600px] flex-grow">
        
        {/* DASHBOARD TAB */}
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

        {/* AUCTION TAB */}
        {activeTab === Tab.AUCTION && isAdmin && (
            players.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 animate-in fade-in">
                    <Gavel className="w-16 h-16 mb-4 opacity-20" />
                    <h2 className="text-2xl font-bold text-slate-400">Auction Waiting to Start</h2>
                    <p className="text-slate-600 mt-2">Upload player data in Settings to begin.</p>
                </div>
            ) : (
                <AuctionConsole players={players} teams={teams} onSellPlayer={handleSellPlayer} onUnsellPlayer={handleUnsellPlayer} onMarkUnsold={handleMarkUnsold} onUpdatePlayer={handleUpdatePlayer} isReadOnly={!isAdmin} currentPlayerId={currentAuctionPlayerId} onSelectPlayer={setCurrentAuctionPlayerId} recentActivity={recentActivity} config={config} sports={sports} categories={categories} />
            )
        )}

        {/* TEAMS TAB */}
        {activeTab === Tab.ROSTER && (
             teams.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 animate-in fade-in">
                    <Users className="w-16 h-16 mb-4 opacity-20" />
                    <h2 className="text-2xl font-bold text-slate-400">No teams initialized yet</h2>
                </div>
             ) : (
                <RosterView players={players} teams={teams} recentActivity={recentActivity} targetTeam={targetTeam} config={config} isAdmin={isAdmin} onAddTeam={handleAddTeam} onRenameTeam={handleRenameTeam} onDeleteTeam={handleDeleteTeam} onAssignCaptain={handleAssignCaptain} onRemoveCaptain={handleRemoveCaptain} onEditConfig={() => switchTab(Tab.SETTINGS)} sports={sports} categories={categories} />
             )
        )}

        {/* SETTINGS TAB */}
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

                        {/* GAME CONFIGURATION (Dynamic Sports/Categories) */}
                        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                            <h3 className="text-xl font-black text-white mb-6 flex gap-2"><Layers className="text-blue-400" /> Game Configuration</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Sports Manager */}
                                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                    <h4 className="font-bold text-slate-300 mb-3 uppercase text-sm">Active Sports</h4>
                                    <div className="space-y-2 mb-4">
                                        {sports.map(s => (
                                            <div key={s} className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800">
                                                {editingSport === s ? (
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <input 
                                                            type="text" 
                                                            className="flex-1 bg-slate-900 border border-indigo-500 rounded px-2 py-1 text-white text-sm" 
                                                            autoFocus
                                                            value={editSportValue}
                                                            onChange={e => setEditSportValue(e.target.value)}
                                                        />
                                                        <button onClick={() => handleRenameSport(s)} className="text-emerald-400 hover:bg-emerald-900/30 p-1 rounded"><Check className="w-4 h-4"/></button>
                                                        <button onClick={() => setEditingSport(null)} className="text-red-400 hover:bg-red-900/30 p-1 rounded"><X className="w-4 h-4"/></button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <span className="text-sm font-medium">{s}</span>
                                                        <div className="flex gap-1">
                                                            <button onClick={() => { setEditingSport(s); setEditSportValue(s); }} className="text-indigo-400 hover:bg-indigo-900/30 p-1.5 rounded transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                                                            <button onClick={() => handleDeleteSport(s)} className="text-red-400 hover:bg-red-900/30 p-1.5 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <input type="text" className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm" placeholder="Add Sport..." value={newSportInput} onChange={e => setNewSportInput(e.target.value)} />
                                        <button onClick={handleAddSport} className="bg-indigo-600 px-3 py-1 rounded text-white"><Plus className="w-4 h-4" /></button>
                                    </div>
                                </div>

                                {/* Categories Manager */}
                                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                    <h4 className="font-bold text-slate-300 mb-3 uppercase text-sm">Rating Categories</h4>
                                    <div className="space-y-2 mb-4">
                                        {categories.map(c => (
                                            <div key={c} className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800">
                                                {editingCategory === c ? (
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <input 
                                                            type="text" 
                                                            className="flex-1 bg-slate-900 border border-indigo-500 rounded px-2 py-1 text-white text-sm" 
                                                            autoFocus
                                                            value={editCategoryValue}
                                                            onChange={e => setEditCategoryValue(e.target.value)}
                                                        />
                                                        <button onClick={() => handleRenameCategory(c)} className="text-emerald-400 hover:bg-emerald-900/30 p-1 rounded"><Check className="w-4 h-4"/></button>
                                                        <button onClick={() => setEditingCategory(null)} className="text-red-400 hover:bg-red-900/30 p-1 rounded"><X className="w-4 h-4"/></button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <span className="text-sm font-medium">Grade '{c}'</span>
                                                        <div className="flex gap-1">
                                                            <button onClick={() => { setEditingCategory(c); setEditCategoryValue(c); }} className="text-indigo-400 hover:bg-indigo-900/30 p-1.5 rounded transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                                                            <button onClick={() => handleDeleteCategory(c)} className="text-red-400 hover:bg-red-900/30 p-1.5 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <input type="text" className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm" placeholder="Add Grade..." value={newCatInput} onChange={e => setNewCatInput(e.target.value)} />
                                        <button onClick={handleAddCategory} className="bg-indigo-600 px-3 py-1 rounded text-white"><Plus className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RULES CONFIGURATION (Dynamic) */}
                        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
                            <h3 className="text-xl font-black text-white mb-4 flex gap-2"><Scale className="text-indigo-400" /> Tournament Rules</h3>
                            <form onSubmit={handleSaveConfig} className="space-y-6">
                                <div className="grid grid-cols-3 gap-4">
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase">Purse</label><input type="number" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2" value={tempConfig.purseLimit} onChange={e => setTempConfig({...tempConfig, purseLimit: parseInt(e.target.value)})} /></div>
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase">Squad Size</label><input type="number" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2" value={tempConfig.maxSquadSize} onChange={e => setTempConfig({...tempConfig, maxSquadSize: parseInt(e.target.value)})} /></div>
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase">Base Price</label><input type="number" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2" value={tempConfig.basePrice} onChange={e => setTempConfig({...tempConfig, basePrice: parseInt(e.target.value)})} /></div>
                                </div>

                                <div className="pt-4 border-t border-slate-700">
                                    <h4 className="text-sm font-bold text-white uppercase mb-4">Fair Play Quotas (Category Limits) & Squad Composition (Sport Limits)</h4>
                                    <div className="flex gap-2 mb-4 overflow-x-auto">
                                        {sports.map(s => (
                                            <button type="button" key={s} onClick={() => setSettingsSportTab(s)} className={`px-3 py-1 rounded-lg text-sm font-bold whitespace-nowrap ${settingsSportTab === s ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}>{s}</button>
                                        ))}
                                    </div>
                                    
                                    {settingsSportTab && tempConfig.categoryLimits && tempConfig.sportLimits && (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-900 p-4 rounded-xl">
                                            {/* Category Limits */}
                                            <div>
                                                <h5 className="text-xs font-bold text-indigo-400 uppercase mb-3">Min Players per Grade</h5>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                    {categories.map(c => (
                                                        <div key={c}>
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Grade '{c}'</label>
                                                            <input 
                                                                type="number" 
                                                                className="w-full bg-slate-950 border border-slate-700 rounded p-1.5"
                                                                value={tempConfig.categoryLimits[settingsSportTab]?.[c] || 0}
                                                                onChange={(e) => {
                                                                    const val = parseInt(e.target.value) || 0;
                                                                    setTempConfig({
                                                                        ...tempConfig,
                                                                        categoryLimits: {
                                                                            ...tempConfig.categoryLimits,
                                                                            [settingsSportTab]: {
                                                                                ...tempConfig.categoryLimits[settingsSportTab],
                                                                                [c]: val
                                                                            }
                                                                        }
                                                                    });
                                                                }}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Sport Limits (Min/Max) */}
                                            <div className="border-l border-slate-800 pl-6">
                                                <h5 className="text-xs font-bold text-emerald-400 uppercase mb-3">Total {settingsSportTab} Players</h5>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Min Players</label>
                                                        <input 
                                                            type="number" 
                                                            className="w-full bg-slate-950 border border-slate-700 rounded p-1.5"
                                                            value={tempConfig.sportLimits[settingsSportTab]?.min || 0}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value) || 0;
                                                                setTempConfig({
                                                                    ...tempConfig,
                                                                    sportLimits: {
                                                                        ...tempConfig.sportLimits,
                                                                        [settingsSportTab]: {
                                                                            ...tempConfig.sportLimits[settingsSportTab] || { min: 0, max: 999 },
                                                                            min: val
                                                                        }
                                                                    }
                                                                });
                                                            }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Max Players</label>
                                                        <input 
                                                            type="number" 
                                                            className="w-full bg-slate-950 border border-slate-700 rounded p-1.5"
                                                            value={tempConfig.sportLimits[settingsSportTab]?.max || 99}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value) || 0;
                                                                setTempConfig({
                                                                    ...tempConfig,
                                                                    sportLimits: {
                                                                        ...tempConfig.sportLimits,
                                                                        [settingsSportTab]: {
                                                                            ...tempConfig.sportLimits[settingsSportTab] || { min: 0, max: 999 },
                                                                            max: val
                                                                        }
                                                                    }
                                                                });
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-end gap-3">
                                    {configSaved && <span className="text-emerald-400 flex items-center gap-1 font-bold"><CheckCircle className="w-4 h-4"/> Saved</span>}
                                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold">Save Rules</button>
                                </div>
                            </form>
                        </div>
                        
                        {/* NEW: PLAYER DATABASE MANAGER */}
                        <PlayerManager 
                            players={players} 
                            sports={sports} 
                            categories={categories}
                            onAdd={handleAddPlayerManual}
                            onUpdate={handleUpdatePlayerProfile}
                            onDelete={handleDeletePlayer}
                        />

                        {/* Data Management (Upload/Template) */}
                        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 mt-8">
                            <h4 className="text-md font-bold text-slate-300 mb-4 flex items-center gap-2">
                                <UploadCloud className="w-5 h-5" /> Data Management
                            </h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <FileUploader label="Upload Master List" onDataLoaded={handleMasterLoad} />
                                
                                <div className="space-y-3">
                                    <h5 className="text-xs font-bold text-slate-500 uppercase">Export Reports</h5>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={handleExportMaster} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-all">
                                            <Table className="w-5 h-5 text-blue-400" />
                                            <span className="text-xs font-bold text-slate-300">Master Dump</span>
                                        </button>
                                        <button onClick={handleExportTeams} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-all">
                                            <BookOpen className="w-5 h-5 text-emerald-400" />
                                            <span className="text-xs font-bold text-slate-300">Team Insights</span>
                                        </button>
                                        <button onClick={handleExportSports} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-all">
                                            <ClipboardList className="w-5 h-5 text-amber-400" />
                                            <span className="text-xs font-bold text-slate-300">Sport Encyclopedia</span>
                                        </button>
                                        <button onClick={handleDownloadTemplate} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-all">
                                            <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                                            <span className="text-xs font-bold text-slate-300">Empty Template</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="pt-8 border-t border-slate-800">
                                <button onClick={handleReset} className="w-full py-4 bg-red-900/30 text-red-400 border border-red-500/30 rounded-xl font-bold flex justify-center gap-2 hover:bg-red-900/50"><Trash2 /> Factory Reset</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="py-6 text-center z-10">
          <p className="text-xs text-slate-600 font-bold uppercase tracking-widest hover:text-indigo-400 transition-colors">Developed by Ar. Abhishek Chandaliya</p>
      </footer>

      {/* ABOUT MODAL */}
      {showAboutModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowAboutModal(false)}>
            <div className="bg-slate-950 border border-slate-800 p-8 rounded-3xl max-w-lg w-full shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                <button onClick={() => setShowAboutModal(false)} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white rounded-full hover:bg-slate-800 transition-colors"><X className="w-6 h-6"/></button>
                
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400"><Info className="w-8 h-8" /></div>
                    <div>
                        <h2 className="text-xl font-bold text-white">About the Initiative</h2>
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Digital Transformation</p>
                    </div>
                </div>

                <h3 className="text-2xl font-black text-white mb-4 leading-tight">Digital Transformation of <br/><span className="text-indigo-400">IIID Sports Auction</span></h3>
                
                <p className="text-slate-300 mb-8 leading-relaxed text-sm text-justify">
                    This platform is a pro-bono initiative conceptualized and developed by <strong className="text-white">Ar. Abhishek Chandaliya</strong> to take the auction process to the next level. 
                    Transitioning from the manual Excel-based systems used over the past 3 years, this cloud-based application creates a seamless, transparent, and error-free experience for organizers, team owners, and coordinators.
                </p>
                
                <div className="pt-6 border-t border-slate-800 text-center">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Architected & Developed By</p>
                    <p className="text-lg font-black text-indigo-400">Ar. Abhishek Chandaliya</p>
                    <p className="text-xs text-slate-600 mt-1">© 2026 All Rights Reserved</p>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
export default App;