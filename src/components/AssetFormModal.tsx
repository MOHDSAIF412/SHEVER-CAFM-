import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { cafmDataService } from '../api/supabase';
import { Hierarchy, placeAssetInRoom } from '../api/hierarchy';
import { Asset, Category, Subcategory } from '../types';

/**
 * One asset form for create and edit, used by the Facility tree and the Asset
 * Registry. The location is picked as Facility -> Building -> Floor -> Room;
 * the asset's building/floor/zone/facility columns are derived from the room.
 */
interface Props {
  hierarchy: Hierarchy;
  asset?: Asset;
  defaultRoomId?: string;
  onClose: () => void;
  onSaved: (asset: Asset) => void;
}

const STATUSES: Asset['status'][] = ['Active', 'Under Maintenance', 'Inactive', 'Disposed'];
const CRITICALITY: Asset['criticality'][] = ['Critical', 'High', 'Medium', 'Low'];
const CONDITION = [
  { v: 5, label: '5 · Very good' },
  { v: 4, label: '4 · Good' },
  { v: 3, label: '3 · Fair' },
  { v: 2, label: '2 · Poor' },
  { v: 1, label: '1 · Very poor' },
];

const NONE = '__none__';

export const AssetFormModal: React.FC<Props> = ({ hierarchy: h, asset, defaultRoomId, onClose, onSaved }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const startRoom = asset?.location_id || defaultRoomId || '';
  const startFloor = h.rooms.find((r) => r.id === startRoom)?.floor_id || '';
  const startBuilding = h.floors.find((f) => f.id === startFloor)?.building_id || '';
  const startFacility = h.buildings.find((b) => b.id === startBuilding)?.facility_id || (startBuilding ? NONE : '');

  const [facilityId, setFacilityId] = useState(startFacility);
  const [buildingId, setBuildingId] = useState(startBuilding);
  const [floorId, setFloorId] = useState(startFloor);
  const [roomId, setRoomId] = useState(startRoom);

  const [v, setV] = useState<Partial<Asset>>(() => ({
    asset_number: asset?.asset_number || '',
    name: asset?.name || '',
    category_id: asset?.category_id || '',
    subcategory_id: asset?.subcategory_id || '',
    type: asset?.type || '',
    manufacturer: asset?.manufacturer || '',
    model: asset?.model || '',
    serial_number: asset?.serial_number || '',
    nesting_reference: asset?.nesting_reference || '',
    barcode: asset?.barcode || '',
    installation_date: asset?.installation_date || '',
    warranty_expiry: asset?.warranty_expiry || '',
    status: asset?.status || 'Active',
    criticality: asset?.criticality || 'Medium',
    condition_score: asset?.condition_score ?? null,
    purchase_cost: asset?.purchase_cost ?? null,
    expected_life_years: asset?.expected_life_years ?? null,
    parent_asset_id: asset?.parent_asset_id || '',
  }));
  const set = <K extends keyof Asset>(k: K, val: Asset[K] | string | null) => setV((p) => ({ ...p, [k]: val }));

  useEffect(() => {
    Promise.all([cafmDataService.getCategories(), cafmDataService.getSubcategories()]).then(([c, s]) => {
      setCategories(c);
      setSubcategories(s);
      setV((p) => (p.category_id || !c[0] ? p : { ...p, category_id: c[0].id }));
    });
  }, []);

  const buildings = h.buildings.filter((b) =>
    !facilityId ? true : facilityId === NONE ? !b.facility_id : b.facility_id === facilityId
  );
  const floors = h.floors.filter((f) => f.building_id === buildingId);
  const rooms = h.rooms.filter((r) => r.floor_id === floorId);
  const zoneName = (zid?: string | null) => h.zones.find((z) => z.id === zid)?.name;

  // A parent must be in the same building and must not be this asset or one of its descendants.
  const parentOptions = useMemo(() => {
    const blocked = new Set<string>();
    if (asset) {
      blocked.add(asset.id);
      let grew = true;
      while (grew) {
        grew = false;
        for (const a of h.assets) {
          if (a.parent_asset_id && blocked.has(a.parent_asset_id) && !blocked.has(a.id)) {
            blocked.add(a.id);
            grew = true;
          }
        }
      }
    }
    return h.assets.filter((a) => a.building_id === buildingId && !blocked.has(a.id));
  }, [h.assets, buildingId, asset]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!String(v.name || '').trim()) return setError('Asset name is required.');
    if (!v.category_id) return setError('Choose a category.');
    if (!roomId) return setError('Choose the room this asset is in.');

    const num = (x: unknown) => (x === '' || x == null ? null : Number(x));
    const payload: Partial<Asset> = {
      ...v,
      name: String(v.name).trim(),
      asset_number: String(v.asset_number || '').trim().toUpperCase() || undefined,
      subcategory_id: v.subcategory_id || undefined,
      parent_asset_id: v.parent_asset_id || null,
      installation_date: v.installation_date || undefined,
      warranty_expiry: v.warranty_expiry || undefined,
      condition_score: num(v.condition_score),
      purchase_cost: num(v.purchase_cost),
      expected_life_years: num(v.expected_life_years),
      ...placeAssetInRoom(h, roomId),
    };

    setSaving(true);
    setError('');
    try {
      const saved = asset
        ? await cafmDataService.updateAsset(asset.id, payload)
        : await cafmDataService.createAsset(payload);
      onSaved(saved);
    } catch (err: any) {
      const msg = String(err?.message || err);
      setError(/duplicate|unique/i.test(msg) ? 'That asset number is already used.' : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={() => !saving && onClose()}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ocs-blue dark:text-white">{asset ? `Edit asset ${asset.asset_number}` : 'Add asset'}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>
        {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}

        <Section title="Identity">
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Asset name *"><input value={v.name || ''} onChange={(e) => set('name', e.target.value)} className="enterprise-input" placeholder="e.g. Chilled water pump 1" /></F>
            <F label="Asset number (blank = automatic)"><input value={v.asset_number || ''} onChange={(e) => set('asset_number', e.target.value)} className="enterprise-input font-mono uppercase" /></F>
            <F label="Category *">
              <select value={v.category_id || ''} onChange={(e) => { set('category_id', e.target.value); set('subcategory_id', ''); }} className="enterprise-input">
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </F>
            <F label="Sub-category">
              <select value={v.subcategory_id || ''} onChange={(e) => set('subcategory_id', e.target.value)} className="enterprise-input">
                <option value="">—</option>
                {subcategories.filter((s) => s.category_id === v.category_id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </F>
          </div>
        </Section>

        <Section title="Location">
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Facility">
              <select value={facilityId} onChange={(e) => { setFacilityId(e.target.value); setBuildingId(''); setFloorId(''); setRoomId(''); }} className="enterprise-input">
                <option value="">All facilities</option>
                {h.facilities.map((f) => <option key={f.id} value={f.id}>{f.code} · {f.name}</option>)}
                {h.buildings.some((b) => !b.facility_id) && <option value={NONE}>Unassigned buildings</option>}
              </select>
            </F>
            <F label="Building *">
              <select value={buildingId} onChange={(e) => { setBuildingId(e.target.value); setFloorId(''); setRoomId(''); set('parent_asset_id', ''); }} className="enterprise-input">
                <option value="">Choose…</option>
                {buildings.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
              </select>
            </F>
            <F label="Floor *">
              <select value={floorId} onChange={(e) => { setFloorId(e.target.value); setRoomId(''); }} className="enterprise-input" disabled={!buildingId}>
                <option value="">Choose…</option>
                {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </F>
            <F label="Room *">
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="enterprise-input" disabled={!floorId}>
                <option value="">Choose…</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.code} · {r.name}{zoneName(r.zone_id) ? ` (${zoneName(r.zone_id)})` : ''}</option>
                ))}
              </select>
            </F>
            <F label="Parent asset (e.g. the AHU this motor belongs to)">
              <select value={v.parent_asset_id || ''} onChange={(e) => set('parent_asset_id', e.target.value)} className="enterprise-input" disabled={!buildingId}>
                <option value="">None</option>
                {parentOptions.map((a) => <option key={a.id} value={a.id}>{a.asset_number} · {a.name}</option>)}
              </select>
            </F>
            <F label="Nesting / client reference"><input value={v.nesting_reference || ''} onChange={(e) => set('nesting_reference', e.target.value)} className="enterprise-input font-mono" /></F>
          </div>
        </Section>

        <Section title="Equipment details">
          <div className="grid gap-3 sm:grid-cols-3">
            <F label="Manufacturer"><input value={v.manufacturer || ''} onChange={(e) => set('manufacturer', e.target.value)} className="enterprise-input" /></F>
            <F label="Model"><input value={v.model || ''} onChange={(e) => set('model', e.target.value)} className="enterprise-input" /></F>
            <F label="Serial number"><input value={v.serial_number || ''} onChange={(e) => set('serial_number', e.target.value)} className="enterprise-input" /></F>
            <F label="Barcode"><input value={v.barcode || ''} onChange={(e) => set('barcode', e.target.value)} className="enterprise-input" /></F>
            <F label="Installed on"><input type="date" value={v.installation_date || ''} onChange={(e) => set('installation_date', e.target.value)} className="enterprise-input" /></F>
            <F label="Warranty until"><input type="date" value={v.warranty_expiry || ''} onChange={(e) => set('warranty_expiry', e.target.value)} className="enterprise-input" /></F>
          </div>
        </Section>

        <Section title="Condition & lifecycle">
          <div className="grid gap-3 sm:grid-cols-3">
            <F label="Status">
              <select value={v.status} onChange={(e) => set('status', e.target.value)} className="enterprise-input">
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </F>
            <F label="Criticality">
              <select value={v.criticality} onChange={(e) => set('criticality', e.target.value)} className="enterprise-input">
                {CRITICALITY.map((s) => <option key={s}>{s}</option>)}
              </select>
            </F>
            <F label="Condition">
              <select value={v.condition_score ?? ''} onChange={(e) => set('condition_score', e.target.value)} className="enterprise-input">
                <option value="">Not assessed</option>
                {CONDITION.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
              </select>
            </F>
            <F label="Purchase cost (AED)"><input type="number" step="0.01" value={v.purchase_cost ?? ''} onChange={(e) => set('purchase_cost', e.target.value)} className="enterprise-input" /></F>
            <F label="Expected life (years)"><input type="number" value={v.expected_life_years ?? ''} onChange={(e) => set('expected_life_years', e.target.value)} className="enterprise-input" /></F>
          </div>
        </Section>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
          <button disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save asset
          </button>
        </div>
      </form>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <fieldset className="space-y-2">
    <legend className="text-[10px] font-bold uppercase tracking-wider text-orange-500">{title}</legend>
    {children}
  </fieldset>
);

const F: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block space-y-1">
    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">{label}</span>
    {children}
  </label>
);
