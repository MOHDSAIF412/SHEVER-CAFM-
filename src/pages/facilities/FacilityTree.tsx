import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, ChevronDown, ChevronRight, DoorOpen, FileSpreadsheet, Layers, LayoutGrid, Loader2,
  MapPin, Pencil, Plus, QrCode, Search, Trash2, X, Boxes,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Hierarchy, HierarchyTable, NodeKind, NodeRef, hierarchyService, roomIdsUnder, roomQrValue } from '../../api/hierarchy';
import { useAuth } from '../../context/AuthContext';
import { AssetFormModal } from '../../components/AssetFormModal';
import { Asset } from '../../types';

const UNASSIGNED = '__unassigned__';

const KIND_META: Record<NodeKind, { label: string; table: HierarchyTable; icon: React.ElementType }> = {
  facility: { label: 'Facility', table: 'facilities', icon: MapPin },
  building: { label: 'Building', table: 'buildings', icon: Building2 },
  floor: { label: 'Floor', table: 'floors', icon: Layers },
  zone: { label: 'Zone', table: 'zones', icon: LayoutGrid },
  room: { label: 'Room', table: 'locations', icon: DoorOpen },
};

const CHILD_KINDS: Record<NodeKind, NodeKind[]> = {
  facility: ['building'],
  building: ['floor'],
  floor: ['zone', 'room'],
  zone: ['room'],
  room: [],
};

const SPACE_TYPES = ['Plant Room', 'Electrical Room', 'Office', 'Meeting Room', 'Toilet', 'Kitchen / Pantry',
  'Corridor', 'Lobby', 'Store', 'Classroom', 'Roof', 'Car Park', 'External Area', 'Other'];

interface FormState {
  mode: 'create' | 'edit';
  kind: NodeKind;
  id?: string;
  parent?: NodeRef;
  values: Record<string, any>;
}

export const FacilityTree: React.FC = () => {
  const { canEdit, canDelete } = useAuth();
  const [h, setH] = useState<Hierarchy | null>(null);
  const [selected, setSelected] = useState<NodeRef | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const [assetModal, setAssetModal] = useState<{ asset?: Asset; roomId?: string } | null>(null);

  const notify = (msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 4500);
  };

  const load = async () => {
    const data = await hierarchyService.loadAll();
    setH(data);
    return data;
  };

  useEffect(() => {
    load().then((data) => {
      // Open the first facility so the screen is never a blank tree.
      const first = data.facilities[0];
      if (first) {
        setExpanded(new Set([first.id]));
        setSelected({ kind: 'facility', id: first.id });
      } else if (data.buildings.length) {
        setExpanded(new Set([UNASSIGNED]));
      }
    });
  }, []);

  // ------------------------------------------------------------------ lookups
  const children = (node: NodeRef): NodeRef[] => {
    if (!h) return [];
    switch (node.kind) {
      case 'facility':
        return h.buildings
          .filter((b) => (node.id === UNASSIGNED ? !b.facility_id : b.facility_id === node.id))
          .map((b) => ({ kind: 'building', id: b.id }));
      case 'building':
        return h.floors.filter((f) => f.building_id === node.id).map((f) => ({ kind: 'floor', id: f.id }));
      case 'floor':
        return [
          ...h.zones.filter((z) => z.floor_id === node.id).map((z) => ({ kind: 'zone' as const, id: z.id })),
          ...h.rooms.filter((r) => r.floor_id === node.id && !r.zone_id).map((r) => ({ kind: 'room' as const, id: r.id })),
        ];
      case 'zone':
        return h.rooms.filter((r) => r.zone_id === node.id).map((r) => ({ kind: 'room', id: r.id }));
      default:
        return [];
    }
  };

  const record = (node: NodeRef): any => {
    if (!h) return undefined;
    if (node.kind === 'facility' && node.id === UNASSIGNED) {
      return { id: UNASSIGNED, code: '—', name: 'Unassigned buildings' };
    }
    const list = { facility: h.facilities, building: h.buildings, floor: h.floors, zone: h.zones, room: h.rooms }[node.kind];
    return (list as any[]).find((r) => r.id === node.id);
  };

  const labelOf = (node: NodeRef) => {
    const r = record(node);
    if (!r) return '';
    if (node.kind === 'floor') return r.name;
    return r.code && r.code !== '—' ? `${r.code} · ${r.name}` : r.name;
  };

  const assetsUnder = (node: NodeRef): Asset[] => {
    if (!h) return [];
    if (node.id === UNASSIGNED) return [];
    const rooms = new Set(roomIdsUnder(h, node));
    return h.assets.filter((a) => rooms.has(a.location_id));
  };

  const parentOf = (node: NodeRef): NodeRef | null => {
    if (!h) return null;
    const r = record(node);
    if (!r) return null;
    switch (node.kind) {
      case 'building':
        return { kind: 'facility', id: r.facility_id || UNASSIGNED };
      case 'floor':
        return { kind: 'building', id: r.building_id };
      case 'zone':
        return { kind: 'floor', id: r.floor_id };
      case 'room':
        return r.zone_id ? { kind: 'zone', id: r.zone_id } : { kind: 'floor', id: r.floor_id };
      default:
        return null;
    }
  };

  const breadcrumb = (node: NodeRef): NodeRef[] => {
    const path: NodeRef[] = [];
    let cur: NodeRef | null = node;
    while (cur) {
      path.unshift(cur);
      cur = parentOf(cur);
    }
    return path;
  };

  // Search: keep any branch with a matching descendant.
  const matches = useMemo(() => {
    if (!h || !query.trim()) return null;
    const q = query.trim().toLowerCase();
    const hit = new Set<string>();
    const visit = (node: NodeRef): boolean => {
      const r = record(node);
      const self = !!r && `${r.code || ''} ${r.name || ''}`.toLowerCase().includes(q);
      const kids = children(node).map(visit).some(Boolean);
      if (self || kids) hit.add(`${node.kind}:${node.id}`);
      return self || kids;
    };
    [...h.facilities.map((f) => ({ kind: 'facility' as const, id: f.id })), { kind: 'facility' as const, id: UNASSIGNED }].forEach(visit);
    return hit;
  }, [h, query]);

  const roots: NodeRef[] = useMemo(() => {
    if (!h) return [];
    const list: NodeRef[] = h.facilities.map((f) => ({ kind: 'facility', id: f.id }));
    if (h.buildings.some((b) => !b.facility_id)) list.push({ kind: 'facility', id: UNASSIGNED });
    return list;
  }, [h]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const select = (node: NodeRef) => {
    setSelected(node);
    // Make sure the selected node is visible in the tree.
    setExpanded((prev) => {
      const next = new Set(prev);
      breadcrumb(node).slice(0, -1).forEach((n) => next.add(n.id));
      return next;
    });
  };

  // -------------------------------------------------------------------- forms
  const openCreate = (kind: NodeKind, parent?: NodeRef) => {
    const values: Record<string, any> = { code: '', name: '' };
    if (kind === 'facility') values.city = 'Abu Dhabi';
    if (kind === 'building') values.city = 'Abu Dhabi';
    if (kind === 'floor') {
      const siblings = h?.floors.filter((f) => f.building_id === parent?.id) || [];
      const next = siblings.length ? Math.max(...siblings.map((f) => f.floor_number)) + 1 : 0;
      values.floor_number = next;
      values.name = next === 0 ? 'Ground Floor' : `Level ${next}`;
    }
    if (kind === 'room') values.space_type = '';
    setFormError('');
    setForm({ mode: 'create', kind, parent, values });
  };

  const openEdit = (node: NodeRef) => {
    const r = record(node);
    if (!r) return;
    setFormError('');
    setForm({ mode: 'edit', kind: node.kind, id: node.id, values: { ...r } });
  };

  const setValue = (k: string, v: any) => setForm((f) => (f ? { ...f, values: { ...f.values, [k]: v } } : f));

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !h) return;
    const { kind, values } = form;
    const table = KIND_META[kind].table;
    const v = { ...values };

    if (kind !== 'floor' && !String(v.code || '').trim()) return setFormError('Code is required.');
    if (!String(v.name || '').trim()) return setFormError('Name is required.');
    v.code = v.code ? String(v.code).trim().toUpperCase() : v.code;
    v.name = String(v.name).trim();

    let data: Record<string, any> = {};
    if (kind === 'facility') data = { code: v.code, name: v.name, city: v.city, address: v.address };
    if (kind === 'building') data = { code: v.code, name: v.name, city: v.city, address: v.address, contact_person: v.contact_person, contact_phone: v.contact_phone };
    if (kind === 'floor') data = { floor_number: Number(v.floor_number) || 0, name: v.name };
    if (kind === 'zone') data = { code: v.code, name: v.name };
    if (kind === 'room') {
      data = { code: v.code, name: v.name, room_number: v.room_number, space_type: v.space_type || null,
        area_sqm: v.area_sqm === '' || v.area_sqm == null ? null : Number(v.area_sqm) };
    }

    if (form.mode === 'create' && form.parent) {
      const p = form.parent;
      if (kind === 'building') data.facility_id = p.id === UNASSIGNED ? null : p.id;
      if (kind === 'floor') data.building_id = p.id;
      if (kind === 'zone') data.floor_id = p.id;
      if (kind === 'room') {
        if (p.kind === 'zone') {
          const zone = h.zones.find((z) => z.id === p.id)!;
          data.floor_id = zone.floor_id;
          data.zone_id = zone.id;
          data.zone = zone.name; // legacy text column still read by older screens
        } else {
          data.floor_id = p.id;
        }
      }
      if (kind === 'building') {
        data.total_floors = 0;
      }
    }
    if (kind === 'room' && form.mode === 'create') data.qr_token = crypto.randomUUID().slice(0, 12);

    setSaving(true);
    setFormError('');
    try {
      if (form.mode === 'create') {
        const created: any = await hierarchyService.create(table, data as any);
        await load();
        select({ kind, id: created.id });
        notify(`${KIND_META[kind].label} "${v.name}" added.`);
      } else {
        await hierarchyService.update(table, form.id!, data as any);
        await load();
        notify(`${KIND_META[kind].label} "${v.name}" updated.`);
      }
      setForm(null);
    } catch (err: any) {
      const msg = String(err?.message || err);
      setFormError(/duplicate|unique/i.test(msg) ? `That code is already used here. Codes must be unique.` : msg);
    } finally {
      setSaving(false);
    }
  };

  const removeNode = async (node: NodeRef) => {
    if (!h) return;
    const r = record(node);
    const assetCount = node.kind === 'zone' ? 0 : assetsUnder(node).length;
    if (node.kind === 'zone') {
      if (!confirm(`Delete zone "${r.name}"? Its rooms stay on the floor.`)) return;
      try {
        await hierarchyService.remove('zones', node.id);
        setSelected(parentOf(node));
        await load();
        notify('Zone deleted.');
      } catch (err: any) {
        notify(String(err?.message || err), true);
      }
      return;
    }
    if (assetCount > 0) {
      notify(`Can't delete: ${assetCount} asset(s) are located here. Move or delete them first.`, true);
      return;
    }
    const kids = children(node).length;
    const warn =
      node.kind === 'facility'
        ? `Delete facility "${r.name}"? Its buildings stay, moved to "Unassigned buildings".`
        : kids > 0
          ? `Delete ${KIND_META[node.kind].label.toLowerCase()} "${r.name}" and everything inside it (${kids} item(s))?`
          : `Delete ${KIND_META[node.kind].label.toLowerCase()} "${r.name}"?`;
    if (!confirm(warn)) return;
    try {
      await hierarchyService.remove(KIND_META[node.kind].table, node.id);
      setSelected(parentOf(node));
      await load();
      notify(`${KIND_META[node.kind].label} deleted.`);
    } catch (err: any) {
      notify(String(err?.message || err), true);
    }
  };

  const ensureRoomToken = async (roomId: string) => {
    const room = h?.rooms.find((r) => r.id === roomId);
    if (!room || room.qr_token) return;
    try {
      await hierarchyService.update('locations', roomId, { qr_token: crypto.randomUUID().slice(0, 12) });
      await load();
    } catch (err: any) {
      notify(String(err?.message || err), true);
    }
  };

  // --------------------------------------------------------------------- render
  if (!h) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading facilities…
      </div>
    );
  }

  const TreeNode: React.FC<{ node: NodeRef; depth: number }> = ({ node, depth }) => {
    const key = `${node.kind}:${node.id}`;
    if (matches && !matches.has(key)) return null;
    const kids = children(node);
    const open = expanded.has(node.id) || !!matches;
    const Icon = KIND_META[node.kind].icon;
    const isSel = selected?.kind === node.kind && selected.id === node.id;
    const count = node.kind === 'room' ? h.assets.filter((a) => a.location_id === node.id).length : null;
    return (
      <div>
        <div
          className={`group flex cursor-pointer items-center gap-1 rounded-md py-1 pr-2 text-xs ${
            isSel ? 'bg-teal-50 font-semibold text-teal-700 dark:bg-teal-500/15 dark:text-teal-300' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
          style={{ paddingLeft: 6 + depth * 14 }}
          onClick={() => select(node)}
        >
          <button
            className={`flex h-4 w-4 items-center justify-center text-slate-400 ${kids.length ? '' : 'invisible'}`}
            onClick={(e) => {
              e.stopPropagation();
              toggle(node.id);
            }}
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <Icon className={`h-3.5 w-3.5 shrink-0 ${node.id === UNASSIGNED ? 'text-slate-400' : 'text-orange-500'}`} />
          <span className="truncate">{labelOf(node)}</span>
          {count ? <span className="ml-auto rounded bg-slate-100 px-1.5 text-[10px] text-slate-500 dark:bg-slate-800">{count}</span> : null}
        </div>
        {open && kids.map((k) => <TreeNode key={`${k.kind}:${k.id}`} node={k} depth={depth + 1} />)}
      </div>
    );
  };

  const sel = selected && record(selected) ? selected : null;
  const selRec = sel ? record(sel) : null;
  const selAssets = sel ? assetsUnder(sel) : [];
  const selKids = sel ? children(sel) : [];

  const countOf = (node: NodeRef) => {
    const rooms = node.id === UNASSIGNED ? [] : roomIdsUnder(h, node);
    return { rooms: rooms.length, assets: assetsUnder(node).length };
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ocs-blue dark:text-white">Facility Hierarchy</h1>
          <p className="text-xs text-slate-500">Facility → Building → Floor → Zone → Room. Every asset lives in a room.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/facilities/labels" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <QrCode className="h-4 w-4" /> QR labels
          </Link>
          {canEdit && (
            <>
              <Link to="/facilities/import" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <FileSpreadsheet className="h-4 w-4" /> Import Excel
              </Link>
              <button onClick={() => openCreate('facility')} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700">
                <Plus className="h-4 w-4" /> Add facility
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Tree */}
        <div className="enterprise-card flex max-h-[calc(100vh-200px)] min-h-[300px] flex-col p-3">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code or name…" className="enterprise-input pl-8" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {roots.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                No facilities yet.
                {canEdit && (
                  <button onClick={() => openCreate('facility')} className="mt-2 block w-full font-semibold text-teal-600">
                    + Add your first facility
                  </button>
                )}
              </div>
            ) : (
              roots.map((n) => <TreeNode key={n.id} node={n} depth={0} />)
            )}
          </div>
        </div>

        {/* Detail */}
        <div className="enterprise-card p-5">
          {!sel || !selRec ? (
            <div className="py-16 text-center text-sm text-slate-500">Select a facility, building, floor, zone or room.</div>
          ) : (
            <div className="space-y-5">
              {/* breadcrumb */}
              <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                {breadcrumb(sel).map((n, i, arr) => (
                  <React.Fragment key={n.id}>
                    <button onClick={() => select(n)} className={i === arr.length - 1 ? 'font-semibold text-slate-800 dark:text-slate-100' : 'hover:text-teal-600'}>
                      {record(n)?.name}
                    </button>
                    {i < arr.length - 1 && <ChevronRight className="h-3 w-3" />}
                  </React.Fragment>
                ))}
              </div>

              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500">{KIND_META[sel.kind].label}</span>
                  <h2 className="text-xl font-bold text-ocs-blue dark:text-white">{selRec.name}</h2>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {selRec.code && selRec.code !== '—' && <span>Code <b className="font-mono text-slate-700 dark:text-slate-300">{selRec.code}</b></span>}
                    {sel.kind === 'floor' && <span>Floor no. <b>{selRec.floor_number}</b></span>}
                    {selRec.city && <span>{selRec.city}</span>}
                    {selRec.space_type && <span>{selRec.space_type}</span>}
                    {selRec.area_sqm ? <span>{selRec.area_sqm} m²</span> : null}
                    {selRec.room_number && <span>Room no. {selRec.room_number}</span>}
                  </div>
                </div>
                {sel.id !== UNASSIGNED && (
                  <div className="flex gap-2">
                    {canEdit && (
                      <button onClick={() => openEdit(sel)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => removeNode(sel)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* stats */}
              {sel.kind !== 'room' && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {sel.kind === 'facility' && <Stat label="Buildings" value={selKids.length} />}
                  {sel.kind === 'building' && <Stat label="Floors" value={selKids.length} />}
                  {(sel.kind === 'floor' || sel.kind === 'zone') && (
                    <Stat label="Zones" value={selKids.filter((k) => k.kind === 'zone').length} />
                  )}
                  <Stat label="Rooms" value={countOf(sel).rooms} />
                  <Stat label="Assets" value={countOf(sel).assets} />
                </div>
              )}

              {/* children */}
              {CHILD_KINDS[sel.kind].length > 0 && (
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Inside this {KIND_META[sel.kind].label.toLowerCase()}</h3>
                    {canEdit && (
                      <div className="flex gap-2">
                        {CHILD_KINDS[sel.kind].map((k) => (
                          <button key={k} onClick={() => openCreate(k, sel)} className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-700">
                            <Plus className="h-3.5 w-3.5" /> {KIND_META[k].label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selKids.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-slate-700">Nothing here yet.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {selKids.map((k) => {
                        const Icon = KIND_META[k.kind].icon;
                        const c = countOf(k);
                        return (
                          <button key={k.id} onClick={() => select(k)} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-left hover:border-teal-300 hover:bg-teal-50/40 dark:border-slate-700 dark:hover:bg-slate-800">
                            <Icon className="h-4 w-4 shrink-0 text-orange-500" />
                            <div className="min-w-0">
                              <div className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{labelOf(k)}</div>
                              <div className="text-[10px] text-slate-500">
                                {KIND_META[k.kind].label}
                                {k.kind !== 'room' && ` · ${c.rooms} rooms`} · {c.assets} assets
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* room QR */}
              {sel.kind === 'room' && (
                <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                  {selRec.qr_token ? (
                    <div className="rounded bg-white p-2">
                      <QRCodeSVG value={roomQrValue(selRec.qr_token)} size={96} level="M" />
                    </div>
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded border border-dashed text-[10px] text-slate-400">No QR yet</div>
                  )}
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    <div className="font-semibold">Room QR code</div>
                    <p className="mt-1 max-w-sm text-slate-500">
                      Stick this on the room door. Later, tenants scan it to report a fault and the location is filled in automatically.
                    </p>
                    <div className="mt-2 flex gap-2">
                      {!selRec.qr_token && canEdit && (
                        <button onClick={() => ensureRoomToken(sel.id)} className="font-semibold text-teal-600">Generate QR</button>
                      )}
                      {selRec.qr_token && (
                        <Link to={`/facilities/labels?rooms=${sel.id}`} className="font-semibold text-teal-600">Print label</Link>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* assets */}
              {sel.id !== UNASSIGNED && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Assets {sel.kind === 'room' ? 'in this room' : 'located here'} ({selAssets.length})
                    </h3>
                    {sel.kind === 'room' && canEdit && (
                      <button onClick={() => setAssetModal({ roomId: sel.id })} className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-700">
                        <Plus className="h-3.5 w-3.5" /> Asset
                      </button>
                    )}
                  </div>
                  {selAssets.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-slate-700">
                      {sel.kind === 'room' ? 'No assets in this room.' : 'No assets yet. Open a room to add one.'}
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">
                          <tr>
                            <th className="px-3 py-2">Asset no.</th>
                            <th className="px-3 py-2">Name</th>
                            {sel.kind !== 'room' && <th className="px-3 py-2">Room</th>}
                            <th className="px-3 py-2">Parent</th>
                            <th className="px-3 py-2">Criticality</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {selAssets.slice(0, 200).map((a) => (
                            <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="px-3 py-2 font-mono">
                                <Link to={`/assets/${a.id}`} className="text-teal-600 hover:underline">{a.asset_number}</Link>
                              </td>
                              <td className="px-3 py-2">{a.name}</td>
                              {sel.kind !== 'room' && <td className="px-3 py-2 text-slate-500">{h.rooms.find((r) => r.id === a.location_id)?.name}</td>}
                              <td className="px-3 py-2 text-slate-500">{h.assets.find((p) => p.id === a.parent_asset_id)?.asset_number || '—'}</td>
                              <td className="px-3 py-2">{a.criticality}</td>
                              <td className="px-3 py-2">{a.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {selAssets.length > 200 && (
                        <div className="p-2 text-center text-[11px] text-slate-500">
                          Showing 200 of {selAssets.length}. Use the <Link to="/assets" className="text-teal-600">Asset Registry</Link> to see all.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Node form */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={() => !saving && setForm(null)}>
          <form onSubmit={submitForm} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ocs-blue dark:text-white">
                {form.mode === 'create' ? 'Add' : 'Edit'} {KIND_META[form.kind].label.toLowerCase()}
                {form.parent && form.parent.id !== UNASSIGNED && <span className="font-normal text-slate-500"> in {record(form.parent)?.name}</span>}
              </h3>
              <button type="button" onClick={() => setForm(null)} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
            </div>
            {formError && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">{formError}</div>}

            {form.kind === 'floor' ? (
              <Field label="Floor number (0 = ground, -1 = basement)">
                <input type="number" value={form.values.floor_number} onChange={(e) => setValue('floor_number', e.target.value)} className="enterprise-input" />
              </Field>
            ) : (
              <Field label="Code">
                <input value={form.values.code || ''} onChange={(e) => setValue('code', e.target.value)} placeholder={{ facility: 'F010', building: 'BLK-A', zone: 'NW', room: 'R-101' }[form.kind as Exclude<NodeKind, 'floor'>]} className="enterprise-input font-mono uppercase" />
              </Field>
            )}
            <Field label="Name">
              <input value={form.values.name || ''} onChange={(e) => setValue('name', e.target.value)} className="enterprise-input" autoFocus />
            </Field>
            {(form.kind === 'facility' || form.kind === 'building') && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="City"><input value={form.values.city || ''} onChange={(e) => setValue('city', e.target.value)} className="enterprise-input" /></Field>
                <Field label="Address"><input value={form.values.address || ''} onChange={(e) => setValue('address', e.target.value)} className="enterprise-input" /></Field>
              </div>
            )}
            {form.kind === 'building' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Site contact"><input value={form.values.contact_person || ''} onChange={(e) => setValue('contact_person', e.target.value)} className="enterprise-input" /></Field>
                <Field label="Contact phone"><input value={form.values.contact_phone || ''} onChange={(e) => setValue('contact_phone', e.target.value)} className="enterprise-input" /></Field>
              </div>
            )}
            {form.kind === 'room' && (
              <div className="grid grid-cols-3 gap-3">
                <Field label="Space type">
                  <select value={form.values.space_type || ''} onChange={(e) => setValue('space_type', e.target.value)} className="enterprise-input">
                    <option value="">—</option>
                    {SPACE_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Room no."><input value={form.values.room_number || ''} onChange={(e) => setValue('room_number', e.target.value)} className="enterprise-input" /></Field>
                <Field label="Area (m²)"><input type="number" step="0.01" value={form.values.area_sqm ?? ''} onChange={(e) => setValue('area_sqm', e.target.value)} className="enterprise-input" /></Field>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setForm(null)} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
              <button disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
              </button>
            </div>
          </form>
        </div>
      )}

      {assetModal && (
        <AssetFormModal
          hierarchy={h}
          asset={assetModal.asset}
          defaultRoomId={assetModal.roomId}
          onClose={() => setAssetModal(null)}
          onSaved={async (a) => {
            setAssetModal(null);
            await load();
            notify(`Asset ${a.asset_number} saved.`);
          }}
        />
      )}

      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-xs font-semibold text-white shadow-lg ${toast.error ? 'bg-ocs-red' : 'bg-ocs-blue'}`}>
          {toast.error ? <X className="h-4 w-4" /> : <Boxes className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
    <div className="text-xl font-bold text-ocs-blue dark:text-white">{value}</div>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block space-y-1">
    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">{label}</span>
    {children}
  </label>
);
