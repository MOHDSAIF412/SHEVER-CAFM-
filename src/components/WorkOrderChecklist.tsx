import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Camera, CheckCircle2, Loader2, Wrench, X } from 'lucide-react';
import { ChecklistResponse, Template, checklistProgress, groupBySection, checklistService, isAnswered, isFailure, outOfRange } from '../api/checklists';
import { PPMChecklistItem, SlaPolicy, WorkOrder } from '../types';
import { PRIORITY_META } from '../utils/woFlow';

/**
 * The PPM checklist on a work order. Every answer saves as soon as it is
 * given. Failed checks and out-of-range readings are flagged, and a
 * corrective job can be raised from the item in one click.
 */
interface Props {
  wo: WorkOrder;
  template: Template;
  editable: boolean;
  policies: SlaPolicy[];
  userName?: string;
  /** Reports progress so the page can block "Work done" until finished. */
  onProgress?: (p: { total: number; answered: number; failed: number; missing: PPMChecklistItem[] }) => void;
}

export const WorkOrderChecklist: React.FC<Props> = ({ wo, template, editable, policies, userName, onProgress }) => {
  const [responses, setResponses] = useState<ChecklistResponse[] | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [raising, setRaising] = useState<PPMChecklistItem | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    checklistService.responses(wo.id).then(setResponses).catch((e) => setError(e.message));
  }, [wo.id]);

  const byItem = useMemo(() => new Map((responses || []).map((r) => [r.checklist_item_id, r])), [responses]);

  const stats = useMemo(() => checklistProgress(template, responses || []), [template, responses]);

  useEffect(() => {
    if (responses) onProgress?.(stats);
  }, [stats, responses]);

  const save = async (item: PPMChecklistItem, patch: Partial<ChecklistResponse>) => {
    setSaving(item.id);
    setError('');
    try {
      const saved = await checklistService.answer(wo.id, item, patch, byItem.get(item.id), userName);
      setResponses((rs) => [...(rs || []).filter((r) => r.checklist_item_id !== item.id), saved]);
    } catch (e: any) {
      setError(e?.message || 'Could not save the answer.');
    } finally {
      setSaving(null);
    }
  };

  const upload = async (item: PPMChecklistItem, file: File) => {
    setSaving(item.id);
    setError('');
    try {
      const url = await checklistService.uploadPhoto(wo.id, item.id, file);
      await save(item, { photo_url: url });
    } catch (e: any) {
      setError(e?.message || 'Photo upload failed.');
      setSaving(null);
    }
  };

  const raise = async () => {
    if (!raising) return;
    const r = byItem.get(raising.id);
    if (!r) return;
    setSaving(raising.id);
    try {
      const { response } = await checklistService.raiseCorrective(wo, raising, r, policies, note.trim(), userName);
      setResponses((rs) => [...(rs || []).filter((x) => x.checklist_item_id !== raising.id), response]);
      setRaising(null);
      setNote('');
    } catch (e: any) {
      setError(e?.message || 'Could not raise the corrective job.');
    } finally {
      setSaving(null);
    }
  };

  if (!responses) {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading checklist…
      </div>
    );
  }

  const pct = stats.total ? Math.round((stats.answered / stats.total) * 100) : 100;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-ocs-blue dark:text-white">{template.title}</span>
          <span className="flex items-center gap-3">
            <span className="text-slate-500">{stats.answered} / {stats.total} done</span>
            {stats.failed > 0 && <span className="font-semibold text-ocs-red">{stats.failed} failed</span>}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className={`h-full ${stats.missing.length ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
        </div>
        {editable && stats.missing.length > 0 && (
          <p className="mt-2 text-[11px] text-slate-500">{stats.missing.length} required item(s) left before the job can be marked work done.</p>
        )}
        {!editable && <p className="mt-2 text-[11px] text-slate-500">Read only — the checklist is filled while the job is In Progress.</p>}
      </div>
      {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}

      {groupBySection(template.items).map((g) => (
        <section key={g.section} className="space-y-2">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-orange-500">{g.section}</h4>
          {g.items.map((item) => {
            const n = template.items.indexOf(item) + 1;
            const r = byItem.get(item.id);
            const failed = isFailure(item, r);
            const done = isAnswered(item, r);
            return (
              <div key={item.id} className={`rounded-lg border p-3 ${failed ? 'border-rose-300 bg-rose-50/40 dark:border-rose-900 dark:bg-rose-950/20' : done ? 'border-emerald-200 dark:border-emerald-900' : 'border-slate-200 dark:border-slate-700'}`}>
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${done ? (failed ? 'bg-ocs-red text-white' : 'bg-emerald-500 text-white') : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                    {done ? (failed ? '!' : <CheckCircle2 className="h-3.5 w-3.5" />) : n}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {item.task_description}
                      {item.is_mandatory && <span className="ml-1 text-ocs-red">*</span>}
                      {saving === item.id && <Loader2 className="ml-2 inline h-3 w-3 animate-spin text-slate-400" />}
                    </div>
                    <ItemField item={item} r={r} disabled={!editable || saving === item.id} onChange={(patch) => save(item, patch)} onPhoto={(f) => upload(item, f)} />

                    {failed && item.raise_corrective_on_fail !== false && (
                      r?.corrective_wo_id ? (
                        <Link to={`/work-orders/${r.corrective_wo_id}`} className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-600">
                          <Wrench className="h-3.5 w-3.5" /> Corrective job raised — open it
                        </Link>
                      ) : editable ? (
                        <button onClick={() => { setRaising(item); setNote(''); }} className="inline-flex items-center gap-1.5 rounded-lg bg-ocs-red px-2.5 py-1.5 text-[11px] font-semibold text-white">
                          <AlertTriangle className="h-3.5 w-3.5" /> Raise corrective job ({item.fail_priority || 'P3'})
                        </button>
                      ) : null
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      ))}

      {raising && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={() => setRaising(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ocs-blue dark:text-white">Raise corrective job</h3>
              <button onClick={() => setRaising(null)} className="text-slate-400"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              A new <b>Corrective</b> job will be created for the same room and asset, linked to this PPM, at priority{' '}
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${PRIORITY_META[raising.fail_priority || 'P3'].chip}`}>{raising.fail_priority || 'P3'}</span>.
            </p>
            <div className="rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800">{raising.task_description}</div>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you find? (e.g. belt cracked, needs replacing)" className="enterprise-input" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRaising(null)} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600">Back</button>
              <button onClick={raise} disabled={saving === raising.id} className="inline-flex items-center gap-1.5 rounded-lg bg-ocs-red px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">
                {saving === raising.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Raise job
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- inputs
const seg = (on: boolean, tone: string) =>
  `rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${on ? tone : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'}`;

/** One item's answer control. Also used read-only for template previews. */
export const ItemField: React.FC<{
  item: PPMChecklistItem;
  r?: ChecklistResponse;
  disabled?: boolean;
  onChange: (patch: Partial<ChecklistResponse>) => void;
  onPhoto?: (f: File) => void;
}> = ({ item, r, disabled, onChange, onPhoto }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string>(r?.reading != null ? String(r.reading) : r?.text_value || '');
  useEffect(() => setDraft(r?.reading != null ? String(r.reading) : r?.text_value || ''), [r?.reading, r?.text_value]);

  const needsPhoto = item.photo_required || item.field_type === 'photo_required';
  const options: string[] = Array.isArray(item.dropdown_options) ? item.dropdown_options : [];
  const bad = item.field_type === 'numeric_reading' && draft !== '' && !isNaN(Number(draft)) && outOfRange(item, Number(draft));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {item.field_type === 'pass_fail' && (
        <>
          <button disabled={disabled} onClick={() => onChange({ result: 'Pass' })} className={seg(r?.result === 'Pass', 'border-emerald-500 bg-emerald-500 text-white')}>Pass</button>
          <button disabled={disabled} onClick={() => onChange({ result: 'Fail' })} className={seg(r?.result === 'Fail', 'border-ocs-red bg-ocs-red text-white')}>Fail</button>
          <button disabled={disabled} onClick={() => onChange({ result: 'N/A' })} className={seg(r?.result === 'N/A', 'border-slate-500 bg-slate-500 text-white')}>N/A</button>
        </>
      )}
      {item.field_type === 'yes_no' && (
        <>
          {['Yes', 'No'].map((v) => (
            <button key={v} disabled={disabled} onClick={() => onChange({ text_value: v, result: null })} className={seg(r?.text_value === v, 'border-ocs-blue bg-ocs-blue text-white')}>{v}</button>
          ))}
          <button disabled={disabled} onClick={() => onChange({ result: 'N/A', text_value: null })} className={seg(r?.result === 'N/A', 'border-slate-500 bg-slate-500 text-white')}>N/A</button>
        </>
      )}
      {item.field_type === 'numeric_reading' && (
        <>
          <input
            type="number"
            step="any"
            disabled={disabled}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => draft !== '' && !isNaN(Number(draft)) && Number(draft) !== r?.reading && onChange({ reading: Number(draft), result: null })}
            className={`enterprise-input w-32 ${bad ? 'border-ocs-red text-ocs-red' : ''}`}
            placeholder="Reading"
          />
          {item.unit_of_measure && <span className="text-xs text-slate-500">{item.unit_of_measure}</span>}
          {(item.min_value != null || item.max_value != null) && (
            <span className={`text-[11px] ${bad ? 'font-semibold text-ocs-red' : 'text-slate-500'}`}>
              {bad ? 'Outside limits: ' : 'Limits: '}
              {item.min_value ?? '–'} to {item.max_value ?? '–'}
            </span>
          )}
        </>
      )}
      {item.field_type === 'text' && (
        <input
          disabled={disabled}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== (r?.text_value || '') && onChange({ text_value: draft })}
          className="enterprise-input"
          placeholder="Note"
        />
      )}
      {item.field_type === 'dropdown' && (
        <select disabled={disabled} value={r?.text_value || ''} onChange={(e) => onChange({ text_value: e.target.value })} className="enterprise-input w-auto">
          <option value="">Choose…</option>
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
      )}

      {needsPhoto && (
        <>
          {r?.photo_url ? (
            <a href={r.photo_url} target="_blank" rel="noreferrer" className="block h-12 w-12 overflow-hidden rounded border border-slate-200 dark:border-slate-700">
              <img src={r.photo_url} alt="" className="h-full w-full object-cover" />
            </a>
          ) : null}
          {onPhoto && (
            <button disabled={disabled} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300">
              <Camera className="h-3.5 w-3.5" /> {r?.photo_url ? 'Replace photo' : 'Add photo'}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && onPhoto?.(e.target.files[0])} />
          {item.field_type === 'photo_required' && (
            <button disabled={disabled} onClick={() => onChange({ result: 'N/A' })} className={seg(r?.result === 'N/A', 'border-slate-500 bg-slate-500 text-white')}>N/A</button>
          )}
        </>
      )}
    </div>
  );
};
