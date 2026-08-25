import React, { useEffect, useState } from 'react';
import { Building2, Layers, MapPin, Plus, X, Trash2 } from 'lucide-react';
import { cafmDataService } from '../../api/supabase';
import { Building, Floor, Location } from '../../types';

export const BuildingsList: React.FC = () => {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [showFloorModal, setShowFloorModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  // Form states
  const [bldName, setBldName] = useState('');
  const [bldCode, setBldCode] = useState('');
  const [bldCity, setBldCity] = useState('Dubai');
  const [flrName, setFlrName] = useState('');
  const [flrNumber, setFlrNumber] = useState(1);
  const [locName, setLocName] = useState('');
  const [locZone, setLocZone] = useState('North Wing');

  const handleDeleteBuilding = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this building and all its associated floors and rooms?')) {
      await cafmDataService.deleteBuilding(id);
      setSelectedBuilding(null);
      await loadData();
    }
  };

  const handleDeleteFloor = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this floor and its associated rooms?')) {
      await cafmDataService.deleteFloor(id);
      setSelectedFloor(null);
      if (selectedBuilding) await handleSelectBuilding(selectedBuilding);
    }
  };

  const handleDeleteLocation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this room/location?')) {
      await cafmDataService.deleteLocation(id);
      if (selectedFloor) await handleSelectFloor(selectedFloor);
    }
  };

  const loadData = async () => {
    const blds = await cafmDataService.getBuildings();
    setBuildings(blds);
    if (blds.length > 0) {
      const current = selectedBuilding ? blds.find((b) => b.id === selectedBuilding.id) || blds[0] : blds[0];
      setSelectedBuilding(current);
      const flrs = await cafmDataService.getFloors(current.id);
      setFloors(flrs);
      if (flrs.length > 0) {
        const curFlr = selectedFloor ? flrs.find((f) => f.id === selectedFloor.id) || flrs[0] : flrs[0];
        setSelectedFloor(curFlr);
        const locs = await cafmDataService.getLocations(curFlr.id);
        setLocations(locs);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectBuilding = async (bld: Building) => {
    setSelectedBuilding(bld);
    const flrs = await cafmDataService.getFloors(bld.id);
    setFloors(flrs);
    if (flrs.length > 0) {
      setSelectedFloor(flrs[0]);
      const locs = await cafmDataService.getLocations(flrs[0].id);
      setLocations(locs);
    } else {
      setSelectedFloor(null);
      setLocations([]);
    }
  };

  const handleSelectFloor = async (flr: Floor) => {
    setSelectedFloor(flr);
    const locs = await cafmDataService.getLocations(flr.id);
    setLocations(locs);
  };

  const handleAddBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    await cafmDataService.createBuilding({
      name: bldName,
      code: bldCode,
      city: bldCity,
    });
    setShowBuildingModal(false);
    setBldName('');
    setBldCode('');
    await loadData();
  };

  const handleAddFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuilding) return;
    await cafmDataService.createFloor({
      building_id: selectedBuilding.id,
      name: flrName,
      floor_number: flrNumber,
    });
    setShowFloorModal(false);
    setFlrName('');
    await handleSelectBuilding(selectedBuilding);
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFloor) return;
    await cafmDataService.createLocation({
      floor_id: selectedFloor.id,
      name: locName,
      zone: locZone,
    });
    setShowLocationModal(false);
    setLocName('');
    await handleSelectFloor(selectedFloor);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Facility Hierarchy</h1>
          <p className="text-xs text-slate-500">Manage Buildings, Floors, Zones, and Specific Location Rooms</p>
        </div>
        <button
          onClick={() => setShowBuildingModal(true)}
          className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Building</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Buildings Column */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-teal-600" />
              <span>Buildings ({buildings.length})</span>
            </h3>
            <button
              onClick={() => setShowBuildingModal(true)}
              className="text-xs text-teal-600 font-bold hover:underline"
            >
              + Add
            </button>
          </div>

          <div className="space-y-2">
            {buildings.map((b) => (
              <div
                key={b.id}
                onClick={() => handleSelectBuilding(b)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedBuilding?.id === b.id
                    ? 'border-teal-500 bg-teal-50/50 shadow-sm'
                    : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-900">{b.name}</h4>
                  <div className="flex items-center space-x-1">
                    <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                      {b.code}
                    </span>
                    <button
                      onClick={(e) => handleDeleteBuilding(e, b.id)}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Delete Building"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{b.address || b.city}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Floors Column */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Floors ({floors.length})</span>
            </h3>
            {selectedBuilding && (
              <button
                onClick={() => setShowFloorModal(true)}
                className="text-xs text-indigo-600 font-bold hover:underline"
              >
                + Add Floor
              </button>
            )}
          </div>

          <div className="space-y-2">
            {floors.map((f) => (
              <div
                key={f.id}
                onClick={() => handleSelectFloor(f)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedFloor?.id === f.id
                    ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                    : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-900">{f.name}</h4>
                  <div className="flex items-center space-x-1">
                    <span className="text-[10px] text-slate-400">Level {f.floor_number}</span>
                    <button
                      onClick={(e) => handleDeleteFloor(e, f.id)}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Delete Floor"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {floors.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400">No floors added yet.</div>
            )}
          </div>
        </div>

        {/* Locations Column */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Locations / Rooms ({locations.length})</span>
            </h3>
            {selectedFloor && (
              <button
                onClick={() => setShowLocationModal(true)}
                className="text-xs text-emerald-600 font-bold hover:underline"
              >
                + Add Room
              </button>
            )}
          </div>

          <div className="space-y-2">
            {locations.map((l) => (
              <div key={l.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-900">{l.name}</h4>
                  <div className="flex items-center space-x-1">
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">
                      {l.zone || 'Zone A'}
                    </span>
                    <button
                      onClick={(e) => handleDeleteLocation(e, l.id)}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Delete Room"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{l.code}</p>
              </div>
            ))}
            {locations.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-400">No locations added yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Add Building Modal */}
      {showBuildingModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add New Building Facility</h3>
              <button onClick={() => setShowBuildingModal(false)} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleAddBuilding} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Building Name *</label>
                <input type="text" required value={bldName} onChange={(e) => setBldName(e.target.value)} placeholder="e.g. Shever Tower - Business Bay" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Building Code *</label>
                  <input type="text" required value={bldCode} onChange={(e) => setBldCode(e.target.value)} placeholder="e.g. BLD-DXB-04" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City</label>
                  <input type="text" value={bldCity} onChange={(e) => setBldCity(e.target.value)} placeholder="Dubai" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none" />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowBuildingModal(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold rounded-xl">Save Building</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Floor Modal */}
      {showFloorModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add Floor to {selectedBuilding?.name}</h3>
              <button onClick={() => setShowFloorModal(false)} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleAddFloor} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Floor Name *</label>
                <input type="text" required value={flrName} onChange={(e) => setFlrName(e.target.value)} placeholder="e.g. Level 5 or Ground Floor" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Floor Number</label>
                <input type="number" value={flrNumber} onChange={(e) => setFlrNumber(Number(e.target.value))} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none" />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowFloorModal(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl">Save Floor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Location Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add Room to {selectedFloor?.name}</h3>
              <button onClick={() => setShowLocationModal(false)} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleAddLocation} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Room / Area Name *</label>
                <input type="text" required value={locName} onChange={(e) => setLocName(e.target.value)} placeholder="e.g. Electrical Main Switchboard Room" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Zone / Sector</label>
                <input type="text" value={locZone} onChange={(e) => setLocZone(e.target.value)} placeholder="e.g. East Wing / Service Core" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none" />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowLocationModal(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl">Save Room</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
