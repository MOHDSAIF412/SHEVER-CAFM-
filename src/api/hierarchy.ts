import { supabase, isSupabaseConfigured, newId, cloudRead, cloudWrite, toRow, loadStore, saveStore } from './supabase';
import { Asset, Building, Facility, Floor, Location, Zone } from '../types';

/**
 * The location tree: Facility -> Building -> Floor -> Zone -> Room.
 * Rooms are the `locations` table. A Zone is optional: a room can sit directly
 * on a floor. Buildings with no facility show under "Unassigned".
 *
 * Same contract as cafmDataService: cloud first and awaited, with a
 * localStorage copy for offline demo mode.
 */
export type HierarchyTable = 'facilities' | 'buildings' | 'floors' | 'zones' | 'locations';

type RowFor<T extends HierarchyTable> = T extends 'facilities'
  ? Facility
  : T extends 'buildings'
    ? Building
    : T extends 'floors'
      ? Floor
      : T extends 'zones'
        ? Zone
        : Location;

const cacheKey = (table: HierarchyTable) => `shever_${table}`;

const LABEL: Record<HierarchyTable, string> = {
  facilities: 'facility',
  buildings: 'building',
  floors: 'floor',
  zones: 'zone',
  locations: 'room',
};

export interface Hierarchy {
  facilities: Facility[];
  buildings: Building[];
  floors: Floor[];
  zones: Zone[];
  rooms: Location[];
  assets: Asset[];
}

export const hierarchyService = {
  async list<T extends HierarchyTable>(table: T): Promise<RowFor<T>[]> {
    const cloud = await cloudRead<RowFor<T>>(table, (q) => q, cacheKey(table));
    return cloud || loadStore<RowFor<T>[]>(cacheKey(table), []);
  },

  /** Everything the tree needs, in parallel. */
  async loadAll(): Promise<Hierarchy> {
    const [facilities, buildings, floors, zones, rooms, assets] = await Promise.all([
      this.list('facilities'),
      this.list('buildings'),
      this.list('floors'),
      this.list('zones'),
      this.list('locations'),
      cloudRead<Asset>('assets', (q) => q.order('asset_number'), 'shever_assets').then(
        (rows) => rows || loadStore<Asset[]>('shever_assets', [])
      ),
    ]);
    const byCode = <R extends { code?: string }>(a: R, b: R) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true });
    return {
      facilities: [...facilities].sort(byCode),
      buildings: [...buildings].sort(byCode),
      floors: [...floors].sort((a, b) => a.floor_number - b.floor_number),
      zones: [...zones].sort(byCode),
      rooms: [...rooms].sort(byCode),
      assets,
    };
  },

  async create<T extends HierarchyTable>(table: T, data: Partial<RowFor<T>>): Promise<RowFor<T>> {
    const row = { id: newId(), created_at: new Date().toISOString(), ...data } as RowFor<T>;
    const saved = await cloudWrite(`Creating ${LABEL[table]}`, () =>
      supabase.from(table).insert(toRow(row)).select().single()
    );
    const result = (saved as RowFor<T>) || row;
    if (!isSupabaseConfigured()) {
      const local = loadStore<RowFor<T>[]>(cacheKey(table), []);
      saveStore(cacheKey(table), [...local, result]);
    }
    return result;
  },

  async update<T extends HierarchyTable>(table: T, id: string, data: Partial<RowFor<T>>): Promise<void> {
    const patch: Record<string, unknown> = { ...data };
    delete patch.id;
    delete patch.created_at;
    await cloudWrite(`Updating ${LABEL[table]}`, () => supabase.from(table).update(toRow(patch)).eq('id', id));
    if (!isSupabaseConfigured()) {
      const local = loadStore<RowFor<T>[]>(cacheKey(table), []);
      saveStore(cacheKey(table), local.map((r) => (r.id === id ? { ...r, ...data } : r)));
    }
  },

  /**
   * Insert-or-update many rows by id, in chunks. Columns missing from a new
   * row take their database default; rows being updated should carry their
   * full current record so nothing is reset.
   */
  async bulkUpsert(table: HierarchyTable | 'assets', rows: Record<string, any>[], onProgress?: (done: number) => void): Promise<void> {
    const CHUNK = 250;
    if (!isSupabaseConfigured()) {
      const key = table === 'assets' ? 'shever_assets' : cacheKey(table);
      const local = loadStore<Record<string, any>[]>(key, []);
      const byId = new Map(local.map((r) => [r.id, r]));
      rows.forEach((r) => byId.set(r.id, { ...byId.get(r.id), ...r }));
      saveStore(key, [...byId.values()]);
      onProgress?.(rows.length);
      return;
    }
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK).map((r) => toRow(r));
      await cloudWrite(`Importing ${table} (rows ${i + 1}–${i + chunk.length})`, () =>
        supabase.from(table).upsert(chunk, { onConflict: 'id', defaultToNull: false })
      );
      onProgress?.(Math.min(i + CHUNK, rows.length));
    }
  },

  async remove(table: HierarchyTable, id: string): Promise<void> {
    await cloudWrite(`Deleting ${LABEL[table]}`, () => supabase.from(table).delete().eq('id', id));
    if (!isSupabaseConfigured()) {
      const local = loadStore<{ id: string }[]>(cacheKey(table), []);
      saveStore(cacheKey(table), local.filter((r) => r.id !== id));
    }
  },
};

/** Room QR codes point at the (future) QR complaint portal. */
export const roomQrValue = (token: string) => `${window.location.origin}/r/${token}`;
/** Phone-scannable link for an asset label (opens /a/:code). */
export const assetQrValue = (assetNumber: string) => `${window.location.origin}/a/${encodeURIComponent(assetNumber)}`;

// ---------------------------------------------------------------------------
// Tree helpers (pure)
// ---------------------------------------------------------------------------

export type NodeKind = 'facility' | 'building' | 'floor' | 'zone' | 'room';

export interface NodeRef {
  kind: NodeKind;
  id: string;
}

/** Breadcrumb for a room: Facility / Building / Floor / Zone / Room. */
export const roomPath = (h: Hierarchy, roomId: string): string[] => {
  const room = h.rooms.find((r) => r.id === roomId);
  if (!room) return [];
  const floor = h.floors.find((f) => f.id === room.floor_id);
  const building = floor && h.buildings.find((b) => b.id === floor.building_id);
  const facility = building?.facility_id ? h.facilities.find((f) => f.id === building.facility_id) : undefined;
  const zone = room.zone_id ? h.zones.find((z) => z.id === room.zone_id) : undefined;
  return [facility?.name, building?.name, floor?.name, zone?.name, room.name].filter(Boolean) as string[];
};

/** Room ids under any node, used for asset counts and filters. */
export const roomIdsUnder = (h: Hierarchy, node: NodeRef): string[] => {
  switch (node.kind) {
    case 'room':
      return [node.id];
    case 'zone':
      return h.rooms.filter((r) => r.zone_id === node.id).map((r) => r.id);
    case 'floor':
      return h.rooms.filter((r) => r.floor_id === node.id).map((r) => r.id);
    case 'building': {
      const floorIds = new Set(h.floors.filter((f) => f.building_id === node.id).map((f) => f.id));
      return h.rooms.filter((r) => floorIds.has(r.floor_id)).map((r) => r.id);
    }
    case 'facility': {
      const bIds = new Set(h.buildings.filter((b) => b.facility_id === node.id).map((b) => b.id));
      const floorIds = new Set(h.floors.filter((f) => bIds.has(f.building_id)).map((f) => f.id));
      return h.rooms.filter((r) => floorIds.has(r.floor_id)).map((r) => r.id);
    }
  }
};

/**
 * Fill an asset's denormalised location columns from its room, so work
 * orders and reports can filter by facility/building/floor without joins.
 */
export const placeAssetInRoom = (h: Hierarchy, roomId: string): Partial<Asset> => {
  const room = h.rooms.find((r) => r.id === roomId);
  const floor = room && h.floors.find((f) => f.id === room.floor_id);
  const building = floor && h.buildings.find((b) => b.id === floor.building_id);
  return {
    location_id: roomId,
    floor_id: floor?.id || '',
    building_id: building?.id || '',
    zone_id: room?.zone_id || null,
    facility_id: building?.facility_id || null,
  };
};
