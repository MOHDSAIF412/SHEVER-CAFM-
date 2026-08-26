import React, { useEffect, useState } from 'react';
import { Layers, Plus, Edit2, Trash2, X, ChevronRight, Tag } from 'lucide-react';
import { cafmDataService } from '../../api/supabase';
import { Category, Subcategory } from '../../types';
import { useAuth } from '../../context/AuthContext';

/**
 * Trades (categories) and the equipment types beneath them (subcategories).
 *
 * These drive the dropdowns on every asset and work order, but until now there
 * was no screen for them at all - they could only be changed through the
 * Supabase table editor.
 */
export const CategoriesList: React.FC = () => {
  const { canEdit, canDelete } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [catForm, setCatForm] = useState<{ open: boolean; editing: Category | null; name: string; code: string; description: string }>(
    { open: false, editing: null, name: '', code: '', description: '' }
  );
  const [subForm, setSubForm] = useState<{ open: boolean; editing: Subcategory | null; name: string; code: string }>(
    { open: false, editing: null, name: '', code: '' }
  );

  const load = async () => {
    const [c, s] = await Promise.all([
      cafmDataService.getCategories(),
      cafmDataService.getSubcategories(),
    ]);
    setCategories(c);
    setSubcategories(s);
    setSelected((prev) => prev ?? c[0]?.id ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const saveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (catForm.editing) {
        await cafmDataService.updateCategory(catForm.editing.id, {
          name: catForm.name,
          code: catForm.code.toUpperCase(),
          description: catForm.description,
        });
      } else {
        await cafmDataService.createCategory({
          name: catForm.name,
          code: catForm.code.toUpperCase(),
          description: catForm.description,
        });
      }
      setCatForm({ open: false, editing: null, name: '', code: '', description: '' });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const saveSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      if (subForm.editing) {
        await cafmDataService.updateSubcategory(subForm.editing.id, {
          name: subForm.name,
          code: subForm.code.toUpperCase(),
        });
      } else {
        await cafmDataService.createSubcategory({
          category_id: selected,
          name: subForm.name,
          code: subForm.code.toUpperCase(),
        });
      }
      setSubForm({ open: false, editing: null, name: '', code: '' });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const removeCategory = async (c: Category) => {
    const children = subcategories.filter((s) => s.category_id === c.id).length;
    if (
      !confirm(
        `Delete "${c.name}"?${children ? ` Its ${children} equipment type(s) go too.` : ''}\n\nAssets or work orders already using it will block the delete.`
      )
    )
      return;
    try {
      await cafmDataService.deleteCategory(c.id);
      if (selected === c.id) setSelected(null);
      await load();
    } catch (err: any) {
      alert(err?.message || 'Could not delete this trade.');
    }
  };

  const removeSub = async (s: Subcategory) => {
    if (!confirm(`Delete "${s.name}"?`)) return;
    try {
      await cafmDataService.deleteSubcategory(s.id);
      await load();
    } catch (err: any) {
      alert(err?.message || 'Could not delete this equipment type.');
    }
  };

  const activeSubs = subcategories.filter((s) => s.category_id === selected);
  const activeCat = categories.find((c) => c.id === selected);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Trades &amp; Equipment Types</h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            The categories every asset and work order is filed under
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() =>
              setCatForm({ open: true, editing: null, name: '', code: '', description: '' })
            }
            className="flex items-center gap-1.5 self-start rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-teal-500"
          >
            <Plus className="h-3.5 w-3.5" /> Add Trade
          </button>
        )}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900">
          Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
          {/* Trades */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <h2 className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Layers className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                Trades ({categories.length})
              </h2>
            </div>

            {categories.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400">No trades yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {categories.map((c) => {
                  const count = subcategories.filter((s) => s.category_id === c.id).length;
                  const isActive = c.id === selected;
                  return (
                    <li key={c.id}>
                      <div
                        className={`flex items-center gap-2 px-4 py-3 transition-colors ${
                          isActive
                            ? 'bg-teal-50 dark:bg-teal-950/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <button
                          onClick={() => setSelected(c.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <span className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {c.code}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-bold text-slate-900 dark:text-white">
                              {c.name}
                            </span>
                            <span className="text-[10px] text-slate-500">{count} equipment type(s)</span>
                          </span>
                        </button>

                        {canEdit && (
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              onClick={() =>
                                setCatForm({
                                  open: true,
                                  editing: c,
                                  name: c.name,
                                  code: c.code,
                                  description: c.description || '',
                                })
                              }
                              title="Edit"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-teal-600 dark:hover:bg-slate-800"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => removeCategory(c)}
                                title="Delete"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                        <ChevronRight
                          className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-teal-600' : 'text-slate-300'}`}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Equipment types */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <h2 className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Tag className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                {activeCat ? `${activeCat.name} — Equipment Types` : 'Equipment Types'}
              </h2>
              {canEdit && selected && (
                <button
                  onClick={() => setSubForm({ open: true, editing: null, name: '', code: '' })}
                  className="flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-teal-500"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              )}
            </div>

            {!selected ? (
              <p className="p-8 text-center text-xs text-slate-400">Pick a trade on the left.</p>
            ) : activeSubs.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-400">
                No equipment types under {activeCat?.name} yet.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {activeSubs.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <span className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {s.code}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {s.name}
                    </span>
                    {canEdit && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          onClick={() =>
                            setSubForm({ open: true, editing: s, name: s.name, code: s.code })
                          }
                          title="Edit"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-teal-600 dark:hover:bg-slate-800"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => removeSub(s)}
                            title="Delete"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Trade dialog */}
      {catForm.open && (
        <Dialog
          title={catForm.editing ? 'Edit Trade' : 'Add Trade'}
          onClose={() => setCatForm({ ...catForm, open: false })}
        >
          <form onSubmit={saveCategory} className="space-y-3 p-4 text-xs">
            {error && <ErrorBox>{error}</ErrorBox>}
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <Field label="Trade Name *">
                <input
                  required
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  placeholder="HVAC"
                  className={inputCls}
                />
              </Field>
              <Field label="Code *">
                <input
                  required
                  value={catForm.code}
                  onChange={(e) => setCatForm({ ...catForm, code: e.target.value.toUpperCase() })}
                  placeholder="HVAC"
                  className={`${inputCls} font-mono uppercase`}
                />
              </Field>
            </div>
            <Field label="Description">
              <input
                value={catForm.description}
                onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                placeholder="Heating, ventilation and air conditioning"
                className={inputCls}
              />
            </Field>
            <FormActions
              onCancel={() => setCatForm({ ...catForm, open: false })}
              saving={saving}
              label={catForm.editing ? 'Save Changes' : 'Add Trade'}
            />
          </form>
        </Dialog>
      )}

      {/* Equipment type dialog */}
      {subForm.open && (
        <Dialog
          title={subForm.editing ? 'Edit Equipment Type' : `Add to ${activeCat?.name ?? 'Trade'}`}
          onClose={() => setSubForm({ ...subForm, open: false })}
        >
          <form onSubmit={saveSub} className="space-y-3 p-4 text-xs">
            {error && <ErrorBox>{error}</ErrorBox>}
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <Field label="Name *">
                <input
                  required
                  value={subForm.name}
                  onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
                  placeholder="Air Handling Unit (AHU)"
                  className={inputCls}
                />
              </Field>
              <Field label="Code *">
                <input
                  required
                  value={subForm.code}
                  onChange={(e) => setSubForm({ ...subForm, code: e.target.value.toUpperCase() })}
                  placeholder="AHU"
                  className={`${inputCls} font-mono uppercase`}
                />
              </Field>
            </div>
            <FormActions
              onCancel={() => setSubForm({ ...subForm, open: false })}
              saving={saving}
              label={subForm.editing ? 'Save Changes' : 'Add Type'}
            />
          </form>
        </Dialog>
      )}
    </div>
  );
};

/* ---------------------------------------------------------------- shared bits */

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">{label}</label>
    {children}
  </div>
);

const ErrorBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
    {children}
  </div>
);

const Dialog: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  onClose,
  children,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const FormActions: React.FC<{ onCancel: () => void; saving: boolean; label: string }> = ({
  onCancel,
  saving,
  label,
}) => (
  <div className="flex justify-end gap-2 pt-1">
    <button
      type="button"
      onClick={onCancel}
      className="rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      Cancel
    </button>
    <button
      type="submit"
      disabled={saving}
      className="rounded-xl bg-teal-600 px-4 py-2 font-bold text-white hover:bg-teal-500 disabled:opacity-60"
    >
      {saving ? 'Saving…' : label}
    </button>
  </div>
);
