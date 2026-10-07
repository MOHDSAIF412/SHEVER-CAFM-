import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { Hierarchy, hierarchyService } from '../../api/hierarchy';
import { cafmDataService, newId } from '../../api/supabase';
import { Category } from '../../types';

/**
 * Excel import for the location tree and asset register.
 *
 * One workbook, one sheet per level. Rows are matched to existing records by
 * code (floors by building + number), so re-importing the same file updates
 * instead of duplicating. Nothing is written until the preview has no errors
 * and the user confirms.
 */

const SHEETS = {
  Facilities: ['facility_code*', 'facility_name*', 'city', 'address'],
  Buildings: ['facility_code', 'building_code*', 'building_name*', 'city', 'address'],
  Floors: ['building_code*', 'floor_number*', 'floor_name*'],
  Zones: ['building_code*', 'floor_number*', 'zone_code*', 'zone_name*'],
  Rooms: ['building_code*', 'floor_number*', 'zone_code', 'room_code*', 'room_name*', 'space_type', 'room_number', 'area_sqm'],
  Assets: ['asset_number*', 'asset_name*', 'category*', 'building_code*', 'floor_number*', 'room_code*', 'parent_asset_number',
    'manufacturer', 'model', 'serial_number', 'nesting_reference', 'installation_date', 'warranty_expiry', 'criticality', 'status'],
} as const;
type SheetName = keyof typeof SHEETS;

const INSTRUCTIONS = [
  ['OCS CAFM — Facilities & Assets import template'],
  [''],
  ['1. Fill the sheets top to bottom: Facilities, Buildings, Floors, Zones, Rooms, Assets. Leave a sheet empty if you do not need it.'],
  ['2. Columns marked * are required. Do not rename or reorder the header row.'],
  ['3. Codes link the levels: a Building row names its facility_code; a Room names its building_code + floor_number (+ zone_code if it is in a zone).'],
  ['4. floor_number: 0 = Ground, 1 = Level 1, -1 = Basement 1.'],
  ['5. Assets: category is a category code or name from Settings → Trades & Types. criticality = Critical / High / Medium / Low. status = Active / Under Maintenance / Inactive / Disposed. Dates as YYYY-MM-DD.'],
  ['6. Re-importing the same codes UPDATES those records; it does not duplicate them.'],
  [''],
  ['Example (Rooms sheet):  building_code = BLK-A, floor_number = 0, zone_code = NW, room_code = R-001, room_name = Plant Room 1'],
];

type Action = 'create' | 'update';
interface Planned {
  sheet: SheetName;
  row: number;
  action: Action;
  label: string;
  record: Record<string, any>;
}
interface Issue {
  sheet: SheetName;
  row: number;
  message: string;
}
interface Plan {
  items: Planned[];
  issues: Issue[];
}

const str = (v: unknown) => (v == null ? '' : String(v).trim());
const up = (v: unknown) => str(v).toUpperCase();
const dateStr = (v: unknown): string | undefined => {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const d = new Date(v.getTime() - v.getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 10);
  }
  const s = str(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
};
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T | null => {
  const s = str(v);
  if (!s) return fallback;
  return allowed.find((a) => a.toLowerCase() === s.toLowerCase()) || null;
};

const downloadTemplate = () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(INSTRUCTIONS), 'Instructions');
  (Object.keys(SHEETS) as SheetName[]).forEach((name) => {
    const ws = XLSX.utils.aoa_to_sheet([SHEETS[name] as unknown as string[]]);
    ws['!cols'] = SHEETS[name].map((h) => ({ wch: Math.max(14, h.length + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  XLSX.writeFile(wb, 'OCS_CAFM_Facilities_Assets_Template.xlsx');
};

/** Read a sheet into objects keyed by header without the trailing '*'. */
const readSheet = (wb: XLSX.WorkBook, name: SheetName): { row: number; data: Record<string, any> }[] => {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '', raw: true });
  if (rows.length < 2) return [];
  const headers = rows[0].map((h: any) => str(h).replace(/\*$/, '').toLowerCase());
  return rows
    .slice(1)
    .map((r, i) => {
      const data: Record<string, any> = {};
      headers.forEach((h: string, j: number) => (data[h] = r[j]));
      return { row: i + 2, data };
    })
    .filter(({ data }) => Object.values(data).some((v) => str(v) !== ''));
};

/** Validate the workbook against the database and decide create vs update. */
const buildPlan = (wb: XLSX.WorkBook, h: Hierarchy, categories: Category[]): Plan => {
  const items: Planned[] = [];
  const issues: Issue[] = [];
  const err = (sheet: SheetName, row: number, message: string) => issues.push({ sheet, row, message });

  // Working copies so later sheets can reference rows created earlier in the file.
  const facilities = new Map(h.facilities.map((f) => [up(f.code), f as Record<string, any>]));
  const buildings = new Map(h.buildings.map((b) => [up(b.code), b as Record<string, any>]));
  const floorKey = (bid: string, n: number) => `${bid}|${n}`;
  const floors = new Map(h.floors.map((f) => [floorKey(f.building_id, f.floor_number), f as Record<string, any>]));
  const zones = new Map(h.zones.map((z) => [`${z.floor_id}|${up(z.code)}`, z as Record<string, any>]));
  const rooms = new Map(h.rooms.map((r) => [`${r.floor_id}|${up(r.code)}`, r as Record<string, any>]));
  const assets = new Map(h.assets.map((a) => [up(a.asset_number), a as Record<string, any>]));
  const seen = new Set<string>();

  const once = (sheet: SheetName, row: number, key: string) => {
    if (seen.has(`${sheet}|${key}`)) {
      err(sheet, row, `Duplicate of an earlier row in this sheet (${key}).`);
      return false;
    }
    seen.add(`${sheet}|${key}`);
    return true;
  };

  const upsert = (sheet: SheetName, row: number, map: Map<string, Record<string, any>>, key: string, fields: Record<string, any>, label: string) => {
    const existing = map.get(key);
    const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== ''));
    const record = existing ? { ...existing, ...clean } : { id: newId(), created_at: new Date().toISOString(), ...fields };
    map.set(key, record);
    items.push({ sheet, row, action: existing ? 'update' : 'create', label, record });
    return record;
  };

  const floorOf = (sheet: SheetName, row: number, d: Record<string, any>) => {
    const b = buildings.get(up(d.building_code));
    if (!b) return void err(sheet, row, `Building "${str(d.building_code)}" not found (add it on the Buildings sheet).`);
    const n = Number(d.floor_number);
    if (str(d.floor_number) === '' || !Number.isInteger(n)) return void err(sheet, row, 'floor_number must be a whole number.');
    const f = floors.get(floorKey(b.id, n));
    if (!f) return void err(sheet, row, `Floor ${n} of building ${str(d.building_code)} not found (add it on the Floors sheet).`);
    return f;
  };

  for (const { row, data: d } of readSheet(wb, 'Facilities')) {
    const code = up(d.facility_code);
    if (!code || !str(d.facility_name)) { err('Facilities', row, 'facility_code and facility_name are required.'); continue; }
    if (!once('Facilities', row, code)) continue;
    upsert('Facilities', row, facilities, code, { code, name: str(d.facility_name), city: str(d.city) || undefined, address: str(d.address) || undefined }, `${code} · ${str(d.facility_name)}`);
  }

  for (const { row, data: d } of readSheet(wb, 'Buildings')) {
    const code = up(d.building_code);
    if (!code || !str(d.building_name)) { err('Buildings', row, 'building_code and building_name are required.'); continue; }
    let facility_id: string | null | undefined;
    if (str(d.facility_code)) {
      const f = facilities.get(up(d.facility_code));
      if (!f) { err('Buildings', row, `Facility "${str(d.facility_code)}" not found.`); continue; }
      facility_id = f.id;
    }
    if (!once('Buildings', row, code)) continue;
    const existing = buildings.get(code);
    upsert('Buildings', row, buildings, code, {
      code, name: str(d.building_name), facility_id: facility_id ?? existing?.facility_id ?? null,
      city: str(d.city) || existing?.city || 'Abu Dhabi', address: str(d.address) || undefined,
      total_floors: existing?.total_floors ?? 0,
    }, `${code} · ${str(d.building_name)}`);
  }

  for (const { row, data: d } of readSheet(wb, 'Floors')) {
    const b = buildings.get(up(d.building_code));
    if (!b) { err('Floors', row, `Building "${str(d.building_code)}" not found.`); continue; }
    const n = Number(d.floor_number);
    if (str(d.floor_number) === '' || !Number.isInteger(n)) { err('Floors', row, 'floor_number must be a whole number.'); continue; }
    if (!str(d.floor_name)) { err('Floors', row, 'floor_name is required.'); continue; }
    const key = floorKey(b.id, n);
    if (!once('Floors', row, key)) continue;
    upsert('Floors', row, floors, key, { building_id: b.id, floor_number: n, name: str(d.floor_name) }, `${b.code} · ${str(d.floor_name)}`);
  }

  for (const { row, data: d } of readSheet(wb, 'Zones')) {
    const f = floorOf('Zones', row, d);
    if (!f) continue;
    const code = up(d.zone_code);
    if (!code || !str(d.zone_name)) { err('Zones', row, 'zone_code and zone_name are required.'); continue; }
    const key = `${f.id}|${code}`;
    if (!once('Zones', row, key)) continue;
    upsert('Zones', row, zones, key, { floor_id: f.id, code, name: str(d.zone_name) }, `${str(d.building_code)} / ${f.name} / ${code}`);
  }

  for (const { row, data: d } of readSheet(wb, 'Rooms')) {
    const f = floorOf('Rooms', row, d);
    if (!f) continue;
    const code = up(d.room_code);
    if (!code || !str(d.room_name)) { err('Rooms', row, 'room_code and room_name are required.'); continue; }
    let zone: Record<string, any> | undefined;
    if (str(d.zone_code)) {
      zone = zones.get(`${f.id}|${up(d.zone_code)}`);
      if (!zone) { err('Rooms', row, `Zone "${str(d.zone_code)}" not found on that floor.`); continue; }
    }
    const area = str(d.area_sqm) === '' ? undefined : Number(d.area_sqm);
    if (area !== undefined && isNaN(area)) { err('Rooms', row, 'area_sqm must be a number.'); continue; }
    const key = `${f.id}|${code}`;
    if (!once('Rooms', row, key)) continue;
    const existing = rooms.get(key);
    upsert('Rooms', row, rooms, key, {
      floor_id: f.id, code, name: str(d.room_name), zone_id: zone?.id ?? existing?.zone_id ?? null,
      zone: zone?.name ?? existing?.zone ?? null, space_type: str(d.space_type) || existing?.space_type || null,
      room_number: str(d.room_number) || existing?.room_number || null, area_sqm: area ?? existing?.area_sqm ?? null,
      qr_token: existing?.qr_token || crypto.randomUUID().slice(0, 12),
    }, `${str(d.building_code)} / ${f.name} / ${code}`);
  }

  const assetRows = readSheet(wb, 'Assets');
  const pendingParents: { row: number; record: Record<string, any>; parent: string }[] = [];
  for (const { row, data: d } of assetRows) {
    const num = up(d.asset_number);
    if (!num || !str(d.asset_name)) { err('Assets', row, 'asset_number and asset_name are required.'); continue; }
    const cat = categories.find((c) => up(c.code) === up(d.category) || up(c.name) === up(d.category));
    if (!cat) { err('Assets', row, `Category "${str(d.category)}" not found. Use a code or name from Settings → Trades & Types.`); continue; }
    const f = floorOf('Assets', row, d);
    if (!f) continue;
    const room = rooms.get(`${f.id}|${up(d.room_code)}`);
    if (!room) { err('Assets', row, `Room "${str(d.room_code)}" not found on that floor.`); continue; }
    const crit = pick(d.criticality, ['Critical', 'High', 'Medium', 'Low'] as const, 'Medium');
    const status = pick(d.status, ['Active', 'Under Maintenance', 'Inactive', 'Disposed'] as const, 'Active');
    if (!crit) { err('Assets', row, 'criticality must be Critical, High, Medium or Low.'); continue; }
    if (!status) { err('Assets', row, 'status must be Active, Under Maintenance, Inactive or Disposed.'); continue; }
    const install = dateStr(d.installation_date);
    const warranty = dateStr(d.warranty_expiry);
    if (str(d.installation_date) && !install) { err('Assets', row, 'installation_date must be a date (YYYY-MM-DD).'); continue; }
    if (str(d.warranty_expiry) && !warranty) { err('Assets', row, 'warranty_expiry must be a date (YYYY-MM-DD).'); continue; }
    if (!once('Assets', row, num)) continue;

    const building = [...buildings.values()].find((b) => b.id === f.building_id)!;
    const existing = assets.get(num);
    const record = upsert('Assets', row, assets, num, {
      asset_number: num, name: str(d.asset_name), category_id: cat.id,
      subcategory_id: existing?.subcategory_id ?? null, type: existing?.type ?? null,
      building_id: building.id, floor_id: f.id, location_id: room.id, zone_id: room.zone_id ?? null,
      facility_id: building.facility_id ?? null,
      manufacturer: str(d.manufacturer) || existing?.manufacturer || null,
      model: str(d.model) || existing?.model || null,
      serial_number: str(d.serial_number) || existing?.serial_number || null,
      nesting_reference: str(d.nesting_reference) || existing?.nesting_reference || null,
      installation_date: install ?? existing?.installation_date ?? null,
      warranty_expiry: warranty ?? existing?.warranty_expiry ?? null,
      criticality: str(d.criticality) ? crit : existing?.criticality ?? crit,
      status: str(d.status) ? status : existing?.status ?? status,
      qr_code_url: num,
      parent_asset_id: existing?.parent_asset_id ?? null,
    }, `${num} · ${str(d.asset_name)}`);
    if (str(d.parent_asset_number)) pendingParents.push({ row, record, parent: up(d.parent_asset_number) });
  }
  // Parents can appear later in the sheet, so resolve them after all assets are known.
  for (const p of pendingParents) {
    const parent = assets.get(p.parent);
    if (!parent) err('Assets', p.row, `Parent asset "${p.parent}" not found.`);
    else if (parent.id === p.record.id) err('Assets', p.row, 'An asset cannot be its own parent.');
    else p.record.parent_asset_id = parent.id;
  }

  return { items, issues };
};

const TABLE_FOR: Record<SheetName, 'facilities' | 'buildings' | 'floors' | 'zones' | 'locations' | 'assets'> = {
  Facilities: 'facilities',
  Buildings: 'buildings',
  Floors: 'floors',
  Zones: 'zones',
  Rooms: 'locations',
  Assets: 'assets',
};

export const ImportHierarchy: React.FC = () => {
  const [fileName, setFileName] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState('');

  const onFile = async (file: File) => {
    setFileName(file.name);
    setPlan(null);
    setDone(null);
    setError('');
    setReading(true);
    try {
      const [buf, h, categories] = await Promise.all([file.arrayBuffer(), hierarchyService.loadAll(), cafmDataService.getCategories()]);
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const missing = (Object.keys(SHEETS) as SheetName[]).filter((s) => !wb.Sheets[s]);
      if (missing.length === Object.keys(SHEETS).length) {
        setError('This file has none of the template sheets. Download the template and fill it in.');
        return;
      }
      setPlan(buildPlan(wb, h, categories));
    } catch (e: any) {
      setError(`Could not read the file: ${e?.message || e}`);
    } finally {
      setReading(false);
    }
  };

  const runImport = async () => {
    if (!plan || plan.issues.length) return;
    setImporting(true);
    setError('');
    try {
      // Parents before children; within assets, parents before their children.
      for (const sheet of Object.keys(SHEETS) as SheetName[]) {
        let rows = plan.items.filter((i) => i.sheet === sheet).map((i) => i.record);
        if (!rows.length) continue;
        if (sheet === 'Assets') {
          // Insert without parent links first, then set them, so order never matters.
          const links = rows.filter((r) => r.parent_asset_id).map((r) => ({ id: r.id, parent: r.parent_asset_id }));
          rows = rows.map((r) => ({ ...r, parent_asset_id: links.some((l) => l.id === r.id) ? null : r.parent_asset_id }));
          await hierarchyService.bulkUpsert('assets', rows, (n) => setProgress(`Assets: ${n} / ${rows.length}`));
          if (links.length) {
            const withParents = rows.map((r) => ({ ...r, parent_asset_id: links.find((l) => l.id === r.id)?.parent ?? r.parent_asset_id }));
            await hierarchyService.bulkUpsert('assets', withParents, (n) => setProgress(`Linking parent assets: ${n} / ${rows.length}`));
          }
        } else {
          await hierarchyService.bulkUpsert(TABLE_FOR[sheet] as any, rows, (n) => setProgress(`${sheet}: ${n} / ${rows.length}`));
        }
      }
      const created = plan.items.filter((i) => i.action === 'create').length;
      const updated = plan.items.length - created;
      setDone(`Imported ${plan.items.length} rows: ${created} new, ${updated} updated.`);
      setPlan(null);
    } catch (e: any) {
      setError(`${e?.message || e}. Rows before this point were saved; fix the problem and import the same file again — existing codes will be updated, not duplicated.`);
    } finally {
      setImporting(false);
      setProgress('');
    }
  };

  const summary = plan
    ? (Object.keys(SHEETS) as SheetName[]).map((s) => ({
        sheet: s,
        create: plan.items.filter((i) => i.sheet === s && i.action === 'create').length,
        update: plan.items.filter((i) => i.sheet === s && i.action === 'update').length,
        issues: plan.issues.filter((i) => i.sheet === s).length,
      }))
    : [];

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <Link to="/facilities" className="mb-1 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-teal-600">
          <ArrowLeft className="h-3.5 w-3.5" /> Facility Hierarchy
        </Link>
        <h1 className="text-lg font-bold text-ocs-blue dark:text-white">Import facilities & assets from Excel</h1>
        <p className="text-xs text-slate-500">Download the template, fill it in, upload it, check the preview, then import. Nothing is saved until you click Import.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button onClick={downloadTemplate} className="enterprise-card flex items-center gap-3 p-4 text-left hover:border-teal-300">
          <Download className="h-6 w-6 text-orange-500" />
          <div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">1. Download template</div>
            <div className="text-xs text-slate-500">Sheets for facilities, buildings, floors, zones, rooms and assets, with instructions.</div>
          </div>
        </button>
        <label className="enterprise-card flex cursor-pointer items-center gap-3 p-4 hover:border-teal-300">
          {reading ? <Loader2 className="h-6 w-6 animate-spin text-orange-500" /> : <Upload className="h-6 w-6 text-orange-500" />}
          <div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">2. Upload filled file</div>
            <div className="text-xs text-slate-500">{fileName || '.xlsx — checked against existing data before anything is saved.'}</div>
          </div>
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} onClick={(e) => ((e.target as HTMLInputElement).value = '')} />
        </label>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}
      {done && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> {done} <Link to="/facilities" className="ml-auto underline">Open the hierarchy</Link>
        </div>
      )}

      {plan && (
        <div className="enterprise-card space-y-4 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <FileSpreadsheet className="h-4 w-4 text-orange-500" /> 3. Preview
          </div>
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-slate-500">
              <tr><th className="py-1">Sheet</th><th>New</th><th>Update</th><th>Problems</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {summary.map((s) => (
                <tr key={s.sheet}>
                  <td className="py-1.5 font-semibold">{s.sheet}</td>
                  <td>{s.create}</td>
                  <td>{s.update}</td>
                  <td className={s.issues ? 'font-semibold text-red-600' : 'text-slate-400'}>{s.issues}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {plan.issues.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-red-700 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" /> Fix these {plan.issues.length} problem(s) in the file and upload it again. Nothing has been saved.
              </div>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-red-100 dark:border-red-900">
                {plan.issues.slice(0, 300).map((i, n) => (
                  <div key={n} className="border-b border-red-50 px-3 py-1.5 text-xs last:border-0 dark:border-red-950">
                    <b>{i.sheet}</b> row {i.row}: {i.message}
                  </div>
                ))}
              </div>
            </div>
          ) : plan.items.length === 0 ? (
            <p className="text-xs text-slate-500">The file has no data rows.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={runImport} disabled={importing} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Import {plan.items.length} rows
              </button>
              {progress && <span className="text-xs text-slate-500">{progress}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
