import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Building2,
  MapPin,
  Flame,
  AlertCircle,
  Clock,
  UserCheck,
  CheckCircle2,
  ArrowLeft,
  Boxes,
} from 'lucide-react';
import { cafmDataService } from '../../api/supabase';
import {
  Building,
  Floor,
  Location,
  Category,
  Subcategory,
  Asset,
  UserProfile,
  PriorityLevel,
} from '../../types';

import { useAuth } from '../../context/AuthContext';

export const CreateWorkOrder: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [technicians, setTechnicians] = useState<UserProfile[]>([]);
  const [supervisors, setSupervisors] = useState<UserProfile[]>([]);

  // Form state
  const [buildingId, setBuildingId] = useState('');
  const [floorId, setFloorId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('Medium');
  const [problemDescription, setProblemDescription] = useState('');
  const [reportedByName, setReportedByName] = useState(user?.full_name || 'Operations Desk');
  const [reportedByPhone, setReportedByPhone] = useState(user?.phone || '+971 50 000 0000');
  const [assignedTechnicianId, setAssignedTechnicianId] = useState('');
  const [assignedSupervisorId, setAssignedSupervisorId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (user) {
      setReportedByName(user.full_name);
      if (user.phone) setReportedByPhone(user.phone);
    }
  }, [user]);

  useEffect(() => {
    const init = async () => {
      const [blds, cats, asts, techs, sups] = await Promise.all([
        cafmDataService.getBuildings(),
        cafmDataService.getCategories(),
        cafmDataService.getAssets(),
        cafmDataService.getTechnicians(),
        cafmDataService.getSupervisors(),
      ]);
      setBuildings(blds);
      setCategories(cats);
      setAssets(asts);
      setTechnicians(techs);
      setSupervisors(sups);

      if (blds.length > 0) {
        setBuildingId(blds[0].id);
        const flrs = await cafmDataService.getFloors(blds[0].id);
        setFloors(flrs);
        if (flrs.length > 0) {
          setFloorId(flrs[0].id);
          const locs = await cafmDataService.getLocations(flrs[0].id);
          setLocations(locs);
          if (locs.length > 0) setLocationId(locs[0].id);
        }
      }

      if (cats.length > 0) {
        setCategoryId(cats[0].id);
        const subcats = await cafmDataService.getSubcategories(cats[0].id);
        setSubcategories(subcats);
        if (subcats.length > 0) setSubcategoryId(subcats[0].id);
      }
    };
    init();
  }, []);

  const handleBuildingChange = async (bId: string) => {
    setBuildingId(bId);
    const flrs = await cafmDataService.getFloors(bId);
    setFloors(flrs);
    if (flrs.length > 0) {
      setFloorId(flrs[0].id);
      const locs = await cafmDataService.getLocations(flrs[0].id);
      setLocations(locs);
      if (locs.length > 0) setLocationId(locs[0].id);
    } else {
      setFloors([]);
      setLocations([]);
    }
  };

  const handleFloorChange = async (fId: string) => {
    setFloorId(fId);
    const locs = await cafmDataService.getLocations(fId);
    setLocations(locs);
    if (locs.length > 0) setLocationId(locs[0].id);
    else setLocations([]);
  };

  const handleCategoryChange = async (cId: string) => {
    setCategoryId(cId);
    const subcats = await cafmDataService.getSubcategories(cId);
    setSubcategories(subcats);
    if (subcats.length > 0) setSubcategoryId(subcats[0].id);
    else setSubcategoryId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemDescription.trim()) {
      setErrorMsg('Please provide a problem description.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const created = await cafmDataService.createWorkOrder({
        building_id: buildingId,
        floor_id: floorId,
        location_id: locationId,
        asset_id: assetId || undefined,
        category_id: categoryId,
        subcategory_id: subcategoryId || undefined,
        priority,
        problem_description: problemDescription,
        reported_by_name: reportedByName,
        reported_by_phone: reportedByPhone,
        assigned_technician_id: assignedTechnicianId || undefined,
        assigned_supervisor_id: assignedSupervisorId || undefined,
      });

      navigate(`/work-orders/${created.id}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save work order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            to="/work-orders"
            className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Create Reactive Work Order</h1>
            <p className="text-xs text-slate-500">Log a new corrective maintenance request into the CAFM system</p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        {/* Section 1: Location & Facility Hierarchy */}
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-teal-600" />
            <span>1. Facility Location & Asset</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Building */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Building *</label>
              <select
                value={buildingId}
                onChange={(e) => handleBuildingChange(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-800"
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Floor */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Floor *</label>
              <select
                value={floorId}
                onChange={(e) => handleFloorChange(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-800"
              >
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Location / Room */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Specific Location / Room *</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-800"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Linked Asset Selection */}
          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Asset / Equipment (Optional)</label>
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-800"
            >
              <option value="">-- No specific asset / General Area maintenance --</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.asset_number} - {a.name} ({a.manufacturer || 'General'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Section 2: Category & Priority */}
        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center space-x-2">
            <Flame className="w-4 h-4 text-teal-600" />
            <span>2. Classification & SLA Priority</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
              <select
                value={categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-800"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subcategory */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subcategory</label>
              <select
                value={subcategoryId}
                onChange={(e) => setSubcategoryId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-800"
              >
                <option value="">-- Select Subcategory --</option>
                {subcategories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Level */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Priority Level *</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none font-bold text-slate-800"
              >
                <option value="Emergency">🔴 Emergency (15m Response / 2h Resolution)</option>
                <option value="High">🟠 High (30m Response / 4h Resolution)</option>
                <option value="Medium">🟡 Medium (2h Response / 24h Resolution)</option>
                <option value="Low">🟢 Low (4h Response / 72h Resolution)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Problem Description */}
        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-teal-600" />
            <span>3. Issue Details</span>
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Problem Description *</label>
            <textarea
              rows={4}
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              placeholder="Describe the breakdown, symptoms, noise, leakage, error code or tenant complaint in detail..."
              required
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-800"
            />
          </div>
        </div>

        {/* Section 4: Assignment & Reporter */}
        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center space-x-2">
            <UserCheck className="w-4 h-4 text-teal-600" />
            <span>4. Assignment & Contact</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Technician (Optional)</label>
              <select
                value={assignedTechnicianId}
                onChange={(e) => setAssignedTechnicianId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-800"
              >
                <option value="">-- Assign Later / Direct to Queue --</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} ({t.department || 'Technician'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Supervisor (Optional)</label>
              <select
                value={assignedSupervisorId}
                onChange={(e) => setAssignedSupervisorId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-800"
              >
                <option value="">-- Select Supervisor --</option>
                {supervisors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.department || 'Supervisor'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
          <Link
            to="/work-orders"
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-teal-500 hover:bg-teal-600 active:bg-teal-700 text-slate-950 text-xs font-bold rounded-xl shadow transition-colors flex items-center space-x-2"
          >
            {submitting ? (
              <span>Saving Work Order...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Submit & Generate Work Order</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
