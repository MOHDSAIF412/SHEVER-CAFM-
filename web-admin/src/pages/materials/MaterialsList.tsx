import React, { useEffect, useState } from 'react';
import {
  Package,
  Search,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Edit2,
  Trash2,
  X,
  ArrowDownToLine,
  ArrowUpFromLine,
} from 'lucide-react';
import { cafmDataService } from '../../api/supabase';
import { Material } from '../../types';
import { useAuth } from '../../context/AuthContext';

const UNITS = ['pcs', 'meters', 'kg', 'liters', 'box', 'roll', 'set'];

export const MaterialsList: React.FC = () => {
  const { canEdit, canDelete } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<Material | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [stockFor, setStockFor] = useState<Material | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    item_code: '',
    name: '',
    category: 'General',
    unit: 'pcs',
    quantity_in_stock: 0,
    min_stock_level: 5,
    unit_cost: 0,
    location: 'Central Store',
  });

  const [stockDelta, setStockDelta] = useState(0);
  const [stockNote, setStockNote] = useState('');

  const load = async () => {
    setMaterials(await cafmDataService.getMaterials());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      item_code: '',
      name: '',
      category: 'General',
      unit: 'pcs',
      quantity_in_stock: 0,
      min_stock_level: 5,
      unit_cost: 0,
      location: 'Central Store',
    });
    setError('');
    setShowForm(true);
  };

  const openEdit = (m: Material) => {
    setEditing(m);
    setForm({
      item_code: m.item_code,
      name: m.name,
      category: m.category,
      unit: m.unit,
      quantity_in_stock: m.quantity_in_stock,
      min_stock_level: m.min_stock_level,
      unit_cost: m.unit_cost,
      location: m.location || 'Central Store',
    });
    setError('');
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) await cafmDataService.updateMaterial(editing.id, form);
      else await cafmDataService.createMaterial(form);
      setShowForm(false);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not save to the database.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m: Material) => {
    if (!confirm(`Delete ${m.name}? This cannot be undone.`)) return;
    try {
      await cafmDataService.deleteMaterial(m.id);
      await load();
    } catch (err: any) {
      alert(err?.message || 'Could not delete this material.');
    }
  };

  const handleStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockFor || stockDelta === 0) return;
    setSaving(true);
    setError('');
    try {
      await cafmDataService.adjustMaterialStock(
        stockFor.id,
        stockDelta,
        stockDelta > 0 ? 'IN' : 'OUT',
        stockNote
      );
      setStockFor(null);
      setStockDelta(0);
      setStockNote('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not update the stock level.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = materials.filter(
    (m) =>
      m.item_code.toLowerCase().includes(search.toLowerCase()) ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.category.toLowerCase().includes(search.toLowerCase())
  );

  const lowStock = materials.filter((m) => m.quantity_in_stock <= m.min_stock_level);
  const stockValue = materials.reduce((sum, m) => sum + m.quantity_in_stock * m.unit_cost, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Spare Parts &amp; Materials
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Warehouse stock, reorder thresholds and consumption
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 self-start rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-teal-500"
          >
            <Plus className="h-3.5 w-3.5" /> Add Material
          </button>
        )}
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            label: 'Line Items',
            value: materials.length,
            icon: Package,
            tone: 'text-teal-600 dark:text-teal-400',
          },
          {
            label: 'Below Reorder Level',
            value: lowStock.length,
            icon: AlertTriangle,
            tone: lowStock.length ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400',
          },
          {
            label: 'Stock Value',
            value: `${stockValue.toLocaleString('en-AE', { maximumFractionDigits: 0 })} AED`,
            icon: CheckCircle2,
            tone: 'text-emerald-600 dark:text-emerald-400',
          },
        ].map((tile) => (
          <div
            key={tile.label}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {tile.label}
              </span>
              <tile.icon className={`h-4 w-4 ${tile.tone}`} />
            </div>
            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{tile.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by code, name or trade…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading stock…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Package className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-700" />
            <p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-300">
              {materials.length === 0 ? 'No materials yet' : 'Nothing matches that search'}
            </p>
            {materials.length === 0 && canEdit && (
              <button
                onClick={openCreate}
                className="mt-3 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-500"
              >
                Add your first material
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200/80 bg-slate-50 font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3.5">Item Code</th>
                  <th className="px-5 py-3.5">Description</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">In Stock</th>
                  <th className="px-5 py-3.5">Min</th>
                  <th className="px-5 py-3.5">Unit Cost</th>
                  <th className="px-5 py-3.5">Store</th>
                  <th className="px-5 py-3.5">Health</th>
                  {canEdit && <th className="px-5 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filtered.map((mat) => {
                  const isLow = mat.quantity_in_stock <= mat.min_stock_level;
                  return (
                    <tr
                      key={mat.id}
                      className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-4 font-bold text-teal-700 dark:text-teal-400">
                        {mat.item_code}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-800 dark:text-slate-200">
                        {mat.name}
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                        {mat.category}
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-900 dark:text-slate-100">
                        {mat.quantity_in_stock} {mat.unit}
                      </td>
                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                        {mat.min_stock_level}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-800 dark:text-slate-200">
                        {Number(mat.unit_cost).toFixed(2)} AED
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                        {mat.location}
                      </td>
                      <td className="px-5 py-4">
                        {isLow ? (
                          <span className="inline-flex items-center rounded border border-rose-200 bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-400">
                            <AlertTriangle className="mr-1 h-3 w-3" /> Reorder
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Healthy
                          </span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setStockFor(mat);
                                setStockDelta(0);
                                setStockNote('');
                                setError('');
                              }}
                              title="Adjust stock"
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-teal-600 dark:hover:bg-slate-800"
                            >
                              <ArrowDownToLine className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => openEdit(mat)}
                              title="Edit"
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-teal-600 dark:hover:bg-slate-800"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(mat)}
                                title="Delete"
                                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / edit dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {editing ? 'Edit Material' : 'Add Material'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 p-4 text-xs">
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Item Code *">
                  <input
                    required
                    value={form.item_code}
                    onChange={(e) => setForm({ ...form, item_code: e.target.value })}
                    placeholder="MAT-ELE-001"
                    className={inputCls}
                  />
                </Field>
                <Field label="Category *">
                  <input
                    required
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Electrical"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Description *">
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="LED 18W Downlight"
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Unit">
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className={inputCls}
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="In Stock">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.quantity_in_stock}
                    onChange={(e) =>
                      setForm({ ...form, quantity_in_stock: Number(e.target.value) })
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="Min Level">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.min_stock_level}
                    onChange={(e) => setForm({ ...form, min_stock_level: Number(e.target.value) })}
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Unit Cost (AED)">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.unit_cost}
                    onChange={(e) => setForm({ ...form, unit_cost: Number(e.target.value) })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Store Location">
                  <input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-teal-600 px-4 py-2 font-bold text-white hover:bg-teal-500 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock movement dialog */}
      {stockFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Adjust Stock</h3>
              <button
                onClick={() => setStockFor(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleStock} className="space-y-3 p-4 text-xs">
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
                  {error}
                </div>
              )}

              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
                <p className="font-bold text-slate-900 dark:text-white">{stockFor.name}</p>
                <p className="text-slate-500">
                  Currently {stockFor.quantity_in_stock} {stockFor.unit}
                  {stockDelta !== 0 && (
                    <>
                      {' '}
                      &rarr;{' '}
                      <span className="font-bold text-teal-600 dark:text-teal-400">
                        {Math.max(0, stockFor.quantity_in_stock + stockDelta)} {stockFor.unit}
                      </span>
                    </>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStockDelta((d) => (d <= 0 ? Math.abs(d) || 1 : d))}
                  className={`flex items-center justify-center gap-1 rounded-xl border py-2 font-bold transition-colors ${
                    stockDelta > 0
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : 'border-slate-200 text-slate-500 dark:border-slate-700'
                  }`}
                >
                  <ArrowDownToLine className="h-3.5 w-3.5" /> Receive
                </button>
                <button
                  type="button"
                  onClick={() => setStockDelta((d) => (d >= 0 ? -(Math.abs(d) || 1) : d))}
                  className={`flex items-center justify-center gap-1 rounded-xl border py-2 font-bold transition-colors ${
                    stockDelta < 0
                      ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                      : 'border-slate-200 text-slate-500 dark:border-slate-700'
                  }`}
                >
                  <ArrowUpFromLine className="h-3.5 w-3.5" /> Issue
                </button>
              </div>

              <Field label={`Quantity (${stockFor.unit})`}>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={Math.abs(stockDelta) || ''}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setStockDelta(stockDelta < 0 ? -v : v);
                  }}
                  className={inputCls}
                  placeholder="0"
                />
              </Field>

              <Field label="Reference / note">
                <input
                  value={stockNote}
                  onChange={(e) => setStockNote(e.target.value)}
                  placeholder="e.g. PO-2026-118, or WO-2026-000042"
                  className={inputCls}
                />
              </Field>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStockFor(null)}
                  className="rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || stockDelta === 0}
                  className="rounded-xl bg-teal-600 px-4 py-2 font-bold text-white hover:bg-teal-500 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Apply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">{label}</label>
    {children}
  </div>
);
