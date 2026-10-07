import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, Camera, ClipboardCheck, Copy, Eye, Loader2, Pencil, Plus, Search, Trash2, Wrench, X,
} from 'lucide-react';
import { Template, checklistService, groupBySection } from '../../api/checklists';
import { cafmDataService } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import { ItemField } from '../../components/WorkOrderChecklist';
import { Category, PPMChecklistItem, SlaPriority } from '../../types';

/**
 * PPM checklist templates. Items are grouped into sections; each item has an
 * answer type, optional limits, and flags for required / photo / raise a
 * corrective job when it fails. Edits are local until "Save".
 */

const FIELD_TYPES: { value: PPMChecklistItem['field_type']; label: string }[] = [
  { value: 'pass_fail', label: 'Pass / Fail' },
  { value: 'numeric_reading', label: 'Reading (number)' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'dropdown', label: 'Choose from list' },
  { value: 'text', label: 'Text note' },
  { value: 'photo_required', label: 'Photo only' },
];

export const PPMChecklists: React.FC = () => {
  const { canEdit, canDelete } = useAuth();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Template | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const open = (t: Template) => {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    setDraft(structuredClone(t));
    setRemoved([]);
    setDirty(false);
    setError('');
  };

  const load = async (selectId?: string) => {
    const [ts, cats] = await Promise.all([checklistService.templates(), cafmDataService.getCategories()]);
    const ppm = ts.filter((t) => !t.applies_to || t.applies_to === 'PPM' || t.applies_to === 'Any');
    setTemplates(ppm);
    setCategories(cats);
    const pick = ppm.find((t) => t.id === selectId) || (!draft ? ppm[0] : undefined);
    if (pick) open(pick);
  };

  useEffect(() => {
    load();
  }, []);

  const edit = (fn: (t: Template) => void) => {
    setDraft((d) => {
      if (!d) return d;
      const copy = structuredClone(d);
      fn(copy);
      return copy;
    });
    setDirty(true);
  };

  const setItem = (id: string, patch: Partial<PPMChecklistItem>) =>
    edit((t) => {
      const i = t.items.find((x) => x.id === id);
      if (i) Object.assign(i, patch);
    });

  const move = (id: string, dir: -1 | 1) =>
    edit((t) => {
      const i = t.items.findIndex((x) => x.id === id);
      const j = i + dir;
      if (j < 0 || j >= t.items.length) return;
      [t.items[i], t.items[j]] = [t.items[j], t.items[i]];
      // Moving across a section boundary adopts the neighbour's section.
      t.items[j].section = t.items[i].section;
    });

  const addItem = (section?: string | null) =>
    edit((t) => {
      const item = checklistService.newItem(t.id, section);
      // Insert after the last item of that section, so sections stay together.
      const lastIdx = t.items.map((x) => x.section || null).lastIndexOf(section || null);
      t.items.splice(lastIdx >= 0 ? lastIdx + 1 : t.items.length, 0, item);
    });

  const removeItem = (id: string) => {
    edit((t) => {
      t.items = t.items.filter((x) => x.id !== id);
    });
    setRemoved((r) => [...r, id]);
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim()) return setError('Give the checklist a name.');
    const blank = draft.items.findIndex((i) => !i.task_description.trim());
    if (blank >= 0) return setError(`Item ${blank + 1} has no description.`);
    const badRange = draft.items.find((i) => i.min_value != null && i.max_value != null && Number(i.min_value) > Number(i.max_value));
    if (badRange) return setError(`"${badRange.task_description}": minimum is above maximum.`);
    setSaving(true);
    setError('');
    try {
      await checklistService.saveTemplate(draft, removed.filter((id) => !draft.items.some((i) => i.id === id)));
      setDirty(false);
      setToast('Checklist saved.');
      setTimeout(() => setToast(''), 3000);
      await load(draft.id);
    } catch (e: any) {
      setError(e?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft || !confirm(`Delete checklist "${draft.title}"? PPM jobs that used it keep their answers.`)) return;
    try {
      await checklistService.deleteTemplate(draft.id);
      setDraft(null);
      setDirty(false);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not delete.');
    }
  };

  const shown = useMemo(
    () => (templates || []).filter((t) => t.title.toLowerCase().includes(query.trim().toLowerCase())),
    [templates, query]
  );

  if (!templates) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading checklists…
      </div>
    );
  }

  const isNew = draft && !templates.some((t) => t.id === draft.id);
  const readOnly = !canEdit;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ocs-blue dark:text-white">PPM Checklists</h1>
          <p className="text-xs text-slate-500">Templates technicians fill on planned-maintenance jobs. A failed check can raise a corrective job.</p>
        </div>
        {canEdit && (
          <button onClick={() => open(checklistService.newTemplate())} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700">
            <Plus className="h-4 w-4" /> New checklist
          </button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* List */}
        <div className="enterprise-card flex max-h-[calc(100vh-200px)] flex-col p-3">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search checklists…" className="enterprise-input pl-8" />
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto">
            {shown.length === 0 && <p className="py-8 text-center text-xs text-slate-500">No checklists yet.</p>}
            {shown.map((t) => (
              <button
                key={t.id}
                onClick={() => open(t)}
                className={`block w-full rounded-lg px-3 py-2 text-left ${draft?.id === t.id ? 'bg-teal-50 dark:bg-teal-500/15' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
                  <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                  <span className="truncate">{t.title}</span>
                </div>
                <div className="mt-0.5 text-[10px] text-slate-500">
                  {t.items.length} items · {categories.find((c) => c.id === t.category_id)?.name || 'Any trade'}
                  {!t.is_active && ' · inactive'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="enterprise-card p-5">
          {!draft ? (
            <div className="py-16 text-center text-sm text-slate-500">Choose a checklist, or create a new one.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[240px] flex-1 space-y-2">
                  <input
                    value={draft.title}
                    disabled={readOnly}
                    onChange={(e) => edit((t) => void (t.title = e.target.value))}
                    placeholder="Checklist name, e.g. Chiller — Quarterly PPM"
                    className="w-full border-0 border-b border-transparent bg-transparent p-0 text-lg font-bold text-ocs-blue focus:border-teal-500 focus:outline-none focus:ring-0 dark:text-white"
                  />
                  <div className="flex flex-wrap gap-2">
                    <select value={draft.category_id || ''} disabled={readOnly} onChange={(e) => edit((t) => void (t.category_id = e.target.value))} className="enterprise-input w-auto">
                      <option value="">Any trade</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <input type="checkbox" disabled={readOnly} checked={draft.is_active} onChange={(e) => edit((t) => void (t.is_active = e.target.checked))} /> Active
                    </label>
                  </div>
                  <input value={draft.description || ''} disabled={readOnly} onChange={(e) => edit((t) => void (t.description = e.target.value))} placeholder="Short description (optional)" className="enterprise-input" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setPreview((p) => !p)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    {preview ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {preview ? 'Edit' : 'Preview'}
                  </button>
                  {canEdit && !isNew && (
                    <button onClick={() => open(checklistService.duplicate(draft))} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                      <Copy className="h-3.5 w-3.5" /> Duplicate
                    </button>
                  )}
                  {canDelete && !isNew && (
                    <button onClick={remove} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:border-rose-900">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  )}
                  {canEdit && (
                    <button onClick={save} disabled={saving || (!dirty && !isNew)} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
                      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {dirty || isNew ? 'Save' : 'Saved'}
                    </button>
                  )}
                </div>
              </div>
              {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}

              {preview ? (
                <div className="space-y-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/40">
                  <p className="text-[11px] text-slate-500">This is what the technician sees on the PPM job.</p>
                  {groupBySection(draft.items).map((g) => (
                    <section key={g.section} className="space-y-2">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-orange-500">{g.section}</h4>
                      {g.items.map((i) => (
                        <div key={i.id} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                          <div className="text-xs font-semibold">{i.task_description || <i className="text-slate-400">No description</i>}{i.is_mandatory && <span className="ml-1 text-ocs-red">*</span>}</div>
                          <ItemField item={i} onChange={() => {}} onPhoto={() => {}} />
                        </div>
                      ))}
                    </section>
                  ))}
                </div>
              ) : (
                <>
                  {draft.items.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-slate-700">No items yet.</div>
                  )}
                  {groupBySection(draft.items).map((g) => (
                    <section key={g.section} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          value={g.section === 'Checks' && !g.items[0].section ? '' : g.section}
                          disabled={readOnly}
                          placeholder="Section name (e.g. Electrical checks)"
                          onChange={(e) => edit((t) => t.items.forEach((x) => { if ((x.section || 'Checks') === g.section) x.section = e.target.value || null; }))}
                          className="w-full border-0 bg-transparent p-0 text-[11px] font-bold uppercase tracking-wider text-orange-500 placeholder:normal-case placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:ring-0"
                        />
                      </div>
                      {g.items.map((item) => (
                        <ItemEditor
                          key={item.id}
                          item={item}
                          index={draft.items.indexOf(item)}
                          last={draft.items.length - 1}
                          readOnly={readOnly}
                          onChange={(p) => setItem(item.id, p)}
                          onMove={(d) => move(item.id, d)}
                          onRemove={() => removeItem(item.id)}
                        />
                      ))}
                      {canEdit && (
                        <button onClick={() => addItem(g.items[0].section)} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600">
                          <Plus className="h-3.5 w-3.5" /> Add item
                        </button>
                      )}
                    </section>
                  ))}
                  {canEdit && (
                    <div className="flex gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                      {draft.items.length === 0 && (
                        <button onClick={() => addItem(null)} className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white">
                          <Plus className="h-3.5 w-3.5" /> Add first item
                        </button>
                      )}
                      <button
                        onClick={() => addItem(`Section ${new Set(draft.items.map((i) => i.section || 'Checks')).size + 1}`)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add section
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {toast && <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-ocs-blue px-4 py-3 text-xs font-semibold text-white shadow-lg">{toast}</div>}
    </div>
  );
};

const Flag: React.FC<{ on: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }> = ({ on, disabled, onClick, children }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${on ? 'border-ocs-blue bg-ocs-blue text-white' : 'border-slate-200 text-slate-500 dark:border-slate-700'}`}
  >
    {children}
  </button>
);

const ItemEditor: React.FC<{
  item: PPMChecklistItem;
  index: number;
  last: number;
  readOnly: boolean;
  onChange: (p: Partial<PPMChecklistItem>) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
}> = ({ item, index, last, readOnly, onChange, onMove, onRemove }) => {
  const num = (v: string) => (v === '' ? undefined : Number(v));
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex items-start gap-2">
        <span className="mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 dark:bg-slate-800">{index + 1}</span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input value={item.task_description} disabled={readOnly} onChange={(e) => onChange({ task_description: e.target.value })} placeholder="What to check, e.g. Check belt tension" className="enterprise-input min-w-[200px] flex-1" />
            <select value={item.field_type} disabled={readOnly} onChange={(e) => onChange({ field_type: e.target.value as PPMChecklistItem['field_type'] })} className="enterprise-input w-auto">
              {FIELD_TYPES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          {item.field_type === 'numeric_reading' && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input value={item.unit_of_measure || ''} disabled={readOnly} onChange={(e) => onChange({ unit_of_measure: e.target.value })} placeholder="Unit (°C, bar, A)" className="enterprise-input w-28" />
              <span className="text-slate-500">Limits</span>
              <input type="number" step="any" value={item.min_value ?? ''} disabled={readOnly} onChange={(e) => onChange({ min_value: num(e.target.value) })} placeholder="Min" className="enterprise-input w-24" />
              <span className="text-slate-400">to</span>
              <input type="number" step="any" value={item.max_value ?? ''} disabled={readOnly} onChange={(e) => onChange({ max_value: num(e.target.value) })} placeholder="Max" className="enterprise-input w-24" />
              <span className="text-[11px] text-slate-500">A reading outside the limits counts as a fail.</span>
            </div>
          )}
          {item.field_type === 'dropdown' && (
            <input
              value={(item.dropdown_options || []).join(', ')}
              disabled={readOnly}
              onChange={(e) => onChange({ dropdown_options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              placeholder="Options, separated by commas: Good, Fair, Poor"
              className="enterprise-input"
            />
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <Flag on={item.is_mandatory} disabled={readOnly} onClick={() => onChange({ is_mandatory: !item.is_mandatory })}>Required</Flag>
            {item.field_type !== 'photo_required' && (
              <Flag on={!!item.photo_required} disabled={readOnly} onClick={() => onChange({ photo_required: !item.photo_required })}>
                <Camera className="h-3 w-3" /> Photo
              </Flag>
            )}
            {(item.field_type === 'pass_fail' || item.field_type === 'numeric_reading') && (
              <>
                <Flag on={item.raise_corrective_on_fail !== false} disabled={readOnly} onClick={() => onChange({ raise_corrective_on_fail: item.raise_corrective_on_fail === false })}>
                  <Wrench className="h-3 w-3" /> Corrective job on fail
                </Flag>
                {item.raise_corrective_on_fail !== false && (
                  <select value={item.fail_priority || 'P3'} disabled={readOnly} onChange={(e) => onChange({ fail_priority: e.target.value as SlaPriority })} className="rounded border border-slate-200 bg-transparent px-1 py-0.5 text-[10px] dark:border-slate-700">
                    {['P1', 'P2', 'P3', 'P4'].map((p) => <option key={p}>{p}</option>)}
                  </select>
                )}
              </>
            )}
          </div>
        </div>
        {!readOnly && (
          <div className="flex flex-col gap-0.5">
            <button disabled={index === 0} onClick={() => onMove(-1)} className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" title="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
            <button disabled={index === last} onClick={() => onMove(1)} className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" title="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
            <button onClick={onRemove} className="rounded p-1 text-slate-400 hover:text-rose-600" title="Remove"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>
    </div>
  );
};
