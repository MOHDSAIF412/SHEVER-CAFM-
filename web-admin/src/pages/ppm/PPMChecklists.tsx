import React, { useEffect, useState } from 'react';
import {
  ClipboardCheck,
  Plus,
  Edit2,
  Trash2,
  X,
  ChevronRight,
  GripVertical,
} from 'lucide-react';
import { cafmDataService } from '../../api/supabase';
import { Category, PPMChecklist, PPMChecklistItem } from '../../types';
import { useAuth } from '../../context/AuthContext';

const FIELD_TYPES: { value: PPMChecklistItem['field_type']; label: string }[] = [
  { value: 'pass_fail', label: 'Pass / Fail' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'numeric_reading', label: 'Numeric reading' },
  { value: 'text', label: 'Free text' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'photo_required', label: 'Photo required' },
];

/**
 * PPM inspection checklists and the tasks inside them.
 *
 * Every PPM plan must reference a checklist, but there was no screen to create
 * one - they could only be added through the Supabase table editor.
 */
export const PPMChecklists: React.FC = () => {
  const { canEdit, canDelete } = useAuth();
  const [checklists, setChecklists] = useState<PPMChecklist[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [listForm, setListForm] = useState<{
    open: boolean;
    editing: PPMChecklist | null;
    title: string;
    category_id: string;
    description: string;
  }>({ open: false, editing: null, title: '', category_id: '', description: '' });

  const [taskForm, setTaskForm] = useState<{
    open: boolean;
    editing: PPMChecklistItem | null;
    task_description: string;
    field_type: PPMChecklistItem['field_type'];
    unit_of_measure: string;
    min_value: string;
    max_value: string;
    is_mandatory: boolean;
  }>({
    open: false,
    editing: null,
    task_description: '',
    field_type: 'pass_fail',
    unit_of_measure: '',
    min_value: '',
    max_value: '',
    is_mandatory: true,
  });

  const load = async () => {
    const [lists, cats] = await Promise.all([
      cafmDataService.getPPMChecklists(),
      cafmDataService.getCategories(),
    ]);
    setChecklists(lists);
    setCategories(cats);
    setSelected((prev) => prev ?? lists[0]?.id ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const active = checklists.find((c) => c.id === selected);

  const saveChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: listForm.title,
        category_id: listForm.category_id || categories[0]?.id,
        description: listForm.description,
      };
      if (listForm.editing) await cafmDataService.updatePPMChecklist(listForm.editing.id, payload);
      else {
        const created = await cafmDataService.createPPMChecklist(payload);
        setSelected(created.id);
      }
      setListForm({ open: false, editing: null, title: '', category_id: '', description: '' });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const saveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      const payload: Partial<PPMChecklistItem> = {
        checklist_id: selected,
        task_description: taskForm.task_description,
        field_type: taskForm.field_type,
        is_mandatory: taskForm.is_mandatory,
        unit_of_measure: taskForm.unit_of_measure || undefined,
        min_value: taskForm.min_value === '' ? undefined : Number(taskForm.min_value),
        max_value: taskForm.max_value === '' ? undefined : Number(taskForm.max_value),
      };
      if (taskForm.editing) await cafmDataService.updatePPMChecklistItem(taskForm.editing.id, payload);
      else await cafmDataService.createPPMChecklistItem(payload);
      setTaskForm({ ...taskForm, open: false, editing: null, task_description: '' });
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const removeChecklist = async (c: PPMChecklist) => {
    if (!confirm(`Delete "${c.title}" and its tasks?\n\nPPM plans already using it will block the delete.`))
      return;
    try {
      await cafmDataService.deletePPMChecklist(c.id);
      if (selected === c.id) setSelected(null);
      await load();
    } catch (err: any) {
      alert(err?.message || 'Could not delete this checklist.');
    }
  };

  const removeTask = async (t: PPMChecklistItem) => {
    if (!confirm('Remove this task?')) return;
    try {
      await cafmDataService.deletePPMChecklistItem(t.id);
      await load();
    } catch (err: any) {
      alert(err?.message || 'Could not remove the task.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">PPM Checklists</h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            The inspection tasks technicians complete on a planned maintenance visit
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() =>
              setListForm({
                open: true,
                editing: null,
                title: '',
                category_id: categories[0]?.id || '',
                description: '',
              })
            }
            className="flex items-center gap-1.5 self-start rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-teal-500"
          >
            <Plus className="h-3.5 w-3.5" /> New Checklist
          </button>
        )}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900">
          Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
          {/* Checklists */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <h2 className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <ClipboardCheck className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                Checklists ({checklists.length})
              </h2>
            </div>

            {checklists.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs text-slate-400">No checklists yet.</p>
                {canEdit && (
                  <button
                    onClick={() =>
                      setListForm({
                        open: true,
                        editing: null,
                        title: '',
                        category_id: categories[0]?.id || '',
                        description: '',
                      })
                    }
                    className="mt-3 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-500"
                  >
                    Create the first one
                  </button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {checklists.map((c) => {
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
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block truncate text-xs font-bold text-slate-900 dark:text-white">
                            {c.title}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {c.category?.name || 'Uncategorised'} · {c.items?.length ?? 0} task(s)
                          </span>
                        </button>

                        {canEdit && (
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              onClick={() =>
                                setListForm({
                                  open: true,
                                  editing: c,
                                  title: c.title,
                                  category_id: c.category_id,
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
                                onClick={() => removeChecklist(c)}
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

          {/* Tasks */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <h2 className="min-w-0 truncate text-xs font-bold text-slate-800 dark:text-slate-200">
                {active ? `${active.title} — Tasks` : 'Tasks'}
              </h2>
              {canEdit && selected && (
                <button
                  onClick={() =>
                    setTaskForm({
                      open: true,
                      editing: null,
                      task_description: '',
                      field_type: 'pass_fail',
                      unit_of_measure: '',
                      min_value: '',
                      max_value: '',
                      is_mandatory: true,
                    })
                  }
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-teal-500"
                >
                  <Plus className="h-3 w-3" /> Add Task
                </button>
              )}
            </div>

            {!active ? (
              <p className="p-8 text-center text-xs text-slate-400">Pick a checklist on the left.</p>
            ) : (active.items?.length ?? 0) === 0 ? (
              <p className="p-8 text-center text-xs text-slate-400">
                No tasks yet. Add the checks a technician should carry out.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {active.items!.map((t, i) => (
                  <li
                    key={t.id}
                    className="flex items-start gap-2.5 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
                    <span className="mt-0.5 w-5 shrink-0 text-[10px] font-bold text-slate-400">
                      {i + 1}.
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {t.task_description}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {FIELD_TYPES.find((f) => f.value === t.field_type)?.label ?? t.field_type}
                        </span>
                        {t.unit_of_measure && (
                          <span className="text-[10px] text-slate-500">in {t.unit_of_measure}</span>
                        )}
                        {(t.min_value != null || t.max_value != null) && (
                          <span className="text-[10px] text-slate-500">
                            range {t.min_value ?? '—'} to {t.max_value ?? '—'}
                          </span>
                        )}
                        {!t.is_mandatory && (
                          <span className="text-[10px] italic text-slate-400">optional</span>
                        )}
                      </div>
                    </div>

                    {canEdit && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          onClick={() =>
                            setTaskForm({
                              open: true,
                              editing: t,
                              task_description: t.task_description,
                              field_type: t.field_type,
                              unit_of_measure: t.unit_of_measure || '',
                              min_value: t.min_value?.toString() ?? '',
                              max_value: t.max_value?.toString() ?? '',
                              is_mandatory: t.is_mandatory,
                            })
                          }
                          title="Edit"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-teal-600 dark:hover:bg-slate-800"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => removeTask(t)}
                            title="Remove"
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

      {/* Checklist dialog */}
      {listForm.open && (
        <Dialog
          title={listForm.editing ? 'Edit Checklist' : 'New Checklist'}
          onClose={() => setListForm({ ...listForm, open: false })}
        >
          <form onSubmit={saveChecklist} className="space-y-3 p-4 text-xs">
            {error && <ErrorBox>{error}</ErrorBox>}
            <Field label="Title *">
              <input
                required
                value={listForm.title}
                onChange={(e) => setListForm({ ...listForm, title: e.target.value })}
                placeholder="AHU Monthly Inspection"
                className={inputCls}
              />
            </Field>
            <Field label="Trade">
              <select
                value={listForm.category_id}
                onChange={(e) => setListForm({ ...listForm, category_id: e.target.value })}
                className={inputCls}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description">
              <input
                value={listForm.description}
                onChange={(e) => setListForm({ ...listForm, description: e.target.value })}
                className={inputCls}
              />
            </Field>
            <FormActions
              onCancel={() => setListForm({ ...listForm, open: false })}
              saving={saving}
              label={listForm.editing ? 'Save Changes' : 'Create Checklist'}
            />
          </form>
        </Dialog>
      )}

      {/* Task dialog */}
      {taskForm.open && (
        <Dialog
          title={taskForm.editing ? 'Edit Task' : 'Add Task'}
          onClose={() => setTaskForm({ ...taskForm, open: false })}
        >
          <form onSubmit={saveTask} className="space-y-3 p-4 text-xs">
            {error && <ErrorBox>{error}</ErrorBox>}
            <Field label="Task *">
              <input
                required
                value={taskForm.task_description}
                onChange={(e) => setTaskForm({ ...taskForm, task_description: e.target.value })}
                placeholder="Check belt tension and condition"
                className={inputCls}
              />
            </Field>
            <Field label="Answer type">
              <select
                value={taskForm.field_type}
                onChange={(e) =>
                  setTaskForm({
                    ...taskForm,
                    field_type: e.target.value as PPMChecklistItem['field_type'],
                  })
                }
                className={inputCls}
              >
                {FIELD_TYPES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Field>

            {taskForm.field_type === 'numeric_reading' && (
              <div className="grid grid-cols-3 gap-3">
                <Field label="Unit">
                  <input
                    value={taskForm.unit_of_measure}
                    onChange={(e) => setTaskForm({ ...taskForm, unit_of_measure: e.target.value })}
                    placeholder="°C"
                    className={inputCls}
                  />
                </Field>
                <Field label="Min">
                  <input
                    type="number"
                    step="0.01"
                    value={taskForm.min_value}
                    onChange={(e) => setTaskForm({ ...taskForm, min_value: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field label="Max">
                  <input
                    type="number"
                    step="0.01"
                    value={taskForm.max_value}
                    onChange={(e) => setTaskForm({ ...taskForm, max_value: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>
            )}

            <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={taskForm.is_mandatory}
                onChange={(e) => setTaskForm({ ...taskForm, is_mandatory: e.target.checked })}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              Technician must answer this before completing the visit
            </label>

            <FormActions
              onCancel={() => setTaskForm({ ...taskForm, open: false })}
              saving={saving}
              label={taskForm.editing ? 'Save Changes' : 'Add Task'}
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
