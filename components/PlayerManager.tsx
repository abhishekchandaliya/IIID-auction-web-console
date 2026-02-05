import React, { useState, useMemo } from 'react';
import { Player } from '../types';
import { Search, Plus, Edit2, Trash2, X, Save, User, Phone } from 'lucide-react';

interface PlayerManagerProps {
  players: Player[];
  sports: string[];
  categories: string[];
  onAdd: (player: Omit<Player, 'id' | 'team' | 'price' | 'status' | 'captainFor'>) => void;
  onUpdate: (player: Player) => void;
  onDelete: (id: number) => void;
}

const PlayerManager: React.FC<PlayerManagerProps> = ({ players, sports, categories, onAdd, onUpdate, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    contactNo: "",
    ratings: {} as Record<string, string>
  });

  const filteredPlayers = useMemo(() => {
    if (!searchTerm) return players.slice(0, 50); // Limit initial view for performance
    return players.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [players, searchTerm]);

  const openAddModal = () => {
    setEditingPlayer(null);
    const initialRatings: Record<string, string> = {};
    sports.forEach(s => initialRatings[s] = '0');
    setFormData({ name: "", contactNo: "", ratings: initialRatings });
    setIsModalOpen(true);
  };

  const openEditModal = (player: Player) => {
    setEditingPlayer(player);
    // Ensure all current sports exist in ratings map, even if player data is old
    const currentRatings = { ...player.ratings };
    sports.forEach(s => {
        if (!currentRatings[s]) currentRatings[s] = '0';
    });

    setFormData({
        name: player.name,
        contactNo: player.contactNo || "",
        ratings: currentRatings
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingPlayer) {
        onUpdate({
            ...editingPlayer,
            name: formData.name,
            contactNo: formData.contactNo,
            ratings: formData.ratings
        });
    } else {
        onAdd({
            name: formData.name,
            contactNo: formData.contactNo,
            ratings: formData.ratings
        });
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: number, name: string) => {
      if (confirm(`Are you sure you want to permanently delete ${name}?`)) {
          onDelete(id);
      }
  };

  return (
    <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 mt-8">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h4 className="text-xl font-black text-white flex items-center gap-2">
              <User className="text-indigo-400" /> Player Database Manager
          </h4>
          <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="Search players..." 
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
              </div>
              <button onClick={openAddModal} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 whitespace-nowrap">
                  <Plus className="w-4 h-4" /> Add Player
              </button>
          </div>
      </div>

      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden max-h-[500px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-sm text-left">
              <thead className="bg-slate-900 text-slate-400 font-bold uppercase text-xs sticky top-0 z-10">
                  <tr>
                      <th className="p-3">ID</th>
                      <th className="p-3">Name</th>
                      <th className="p-3 text-center">Status</th>
                      {sports.map(s => <th key={s} className="p-3 text-center">{s}</th>)}
                      <th className="p-3 text-right">Actions</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                  {filteredPlayers.map(p => (
                      <tr key={p.id} className="hover:bg-slate-900/50 transition-colors">
                          <td className="p-3 font-mono text-slate-500">#{p.id}</td>
                          <td className="p-3 font-bold text-slate-200">
                              {p.name}
                              {p.contactNo && <div className="text-[10px] text-slate-500 font-mono font-normal">{p.contactNo}</div>}
                          </td>
                          <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  p.status === 'sold' ? 'bg-emerald-900/30 text-emerald-400' :
                                  p.status === 'unsold' ? 'bg-amber-900/30 text-amber-400' :
                                  'bg-slate-800 text-slate-400'
                              }`}>
                                  {p.status}
                              </span>
                          </td>
                          {sports.map(s => (
                              <td key={s} className="p-3 text-center text-slate-400">
                                  {p.ratings[s] && p.ratings[s] !== '0' ? 
                                    <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-bold text-xs">{p.ratings[s]}</span> 
                                    : '-'}
                              </td>
                          ))}
                          <td className="p-3 text-right">
                              <div className="flex justify-end gap-2">
                                  <button onClick={() => openEditModal(p)} className="p-1.5 text-indigo-400 hover:bg-indigo-900/30 rounded" title="Edit"><Edit2 className="w-4 h-4" /></button>
                                  <button type="button" onClick={() => handleDelete(p.id, p.name)} className="p-1.5 text-red-400 hover:bg-red-900/30 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>
                              </div>
                          </td>
                      </tr>
                  ))}
                  {filteredPlayers.length === 0 && (
                      <tr><td colSpan={4 + sports.length} className="p-8 text-center text-slate-500">No players found</td></tr>
                  )}
              </tbody>
          </table>
      </div>

      {/* ADD/EDIT MODAL */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                      <h3 className="text-xl font-black text-white">{editingPlayer ? 'Edit Player' : 'Add New Player'}</h3>
                      <button onClick={() => setIsModalOpen(false)}><X className="text-slate-400 hover:text-white" /></button>
                  </div>
                  <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar">
                      <div className="space-y-4">
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Full Name</label>
                              <div className="relative">
                                  <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                  <input 
                                    required 
                                    type="text" 
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white focus:border-indigo-500 outline-none" 
                                    placeholder="Enter player name"
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                  />
                              </div>
                          </div>
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Contact Number</label>
                              <div className="relative">
                                  <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                  <input 
                                    type="text" 
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white focus:border-indigo-500 outline-none" 
                                    placeholder="Optional"
                                    value={formData.contactNo}
                                    onChange={e => setFormData({...formData, contactNo: e.target.value})}
                                  />
                              </div>
                          </div>

                          <div className="pt-4 border-t border-slate-800">
                              <h4 className="text-sm font-bold text-white mb-3">Sports Ratings</h4>
                              <div className="grid grid-cols-2 gap-4">
                                  {sports.map(sport => (
                                      <div key={sport}>
                                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">{sport}</label>
                                          <select 
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-white text-sm focus:border-indigo-500 outline-none appearance-none"
                                            value={formData.ratings[sport] || '0'}
                                            onChange={e => setFormData({
                                                ...formData,
                                                ratings: { ...formData.ratings, [sport]: e.target.value }
                                            })}
                                          >
                                              <option value="0">N/A</option>
                                              {categories.map(c => (
                                                  <option key={c} value={c}>Grade {c}</option>
                                              ))}
                                          </select>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                      <div className="mt-8 flex gap-3">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold">Cancel</button>
                          <button type="submit" className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex justify-center items-center gap-2">
                              <Save className="w-4 h-4" /> Save Player
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default PlayerManager;