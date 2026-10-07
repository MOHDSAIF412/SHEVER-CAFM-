import { supabase, isSupabaseConfigured, cloudRead, cloudWrite, newId, loadStore, saveStore, PHOTO_BUCKET } from './supabase';
import { workOrderService } from './workOrders';
import { PPMChecklist, PPMChecklistItem, SlaPolicy, WorkOrder } from '../types';

/**
 * PPM checklists: templates (ppm_checklists + ppm_checklist_items) and the
 * answers recorded on a PPM work order (wo_checklist_responses).
 * Checklists are for PPM jobs only.
 */

export interface ChecklistResponse {
  id: string;
  work_order_id: string;
  checklist_item_id: string;
  result?: 'Pass' | 'Fail' | 'N/A' | null;
  reading?: number | null;
  text_value?: string | null;
  photo_url?: string | null;
  is_out_of_range?: boolean;
  corrective_wo_id?: string | null;
  answered_by?: string | null;
  answered_at?: string | null;
}

export type Template = PPMChecklist & { items: PPMChecklistItem[] };

const T_KEY = 'shever_ppm_checklists';
const I_KEY = 'shever_ppm_checklist_items';
const rKey = (woId: string) => `shever_checklist_${woId}`;

const ITEM_COLUMNS = [
  'id', 'checklist_id', 'item_order', 'task_description', 'field_type', 'unit_of_measure', 'min_value', 'max_value',
  'is_mandatory', 'dropdown_options', 'photo_required', 'raise_corrective_on_fail', 'section', 'fail_priority',
] as const;

const pickItem = (i: Partial<PPMChecklistItem>) =>
  Object.fromEntries(ITEM_COLUMNS.filter((k) => k in i).map((k) => [k, (i as any)[k] ?? null]));

/** Is this answer a failure (failed check or reading outside its limits)? */
export const isFailure = (item: PPMChecklistItem, r?: ChecklistResponse) => {
  if (!r) return false;
  if (r.result === 'Fail') return true;
  if (item.field_type === 'numeric_reading' && r.reading != null) return outOfRange(item, r.reading);
  return false;
};

export const outOfRange = (item: PPMChecklistItem, value: number) =>
  (item.min_value != null && value < Number(item.min_value)) || (item.max_value != null && value > Number(item.max_value));

/** Does the answer satisfy the item (for progress and the Work Done gate)? */
export const isAnswered = (item: PPMChecklistItem, r?: ChecklistResponse) => {
  if (!r) return false;
  const needsPhoto = item.photo_required || item.field_type === 'photo_required';
  if (needsPhoto && r.result !== 'N/A' && !r.photo_url) return false;
  if (item.field_type === 'photo_required') return !!r.photo_url || r.result === 'N/A';
  return r.result != null || r.reading != null || !!(r.text_value && r.text_value.trim());
};

/** Items in order, grouped under their section headings. */
export const groupBySection = (items: PPMChecklistItem[]) => {
  const groups: { section: string; items: PPMChecklistItem[] }[] = [];
  items.forEach((i) => {
    const name = i.section || 'Checks';
    const g = groups.find((x) => x.section === name);
    if (g) g.items.push(i);
    else groups.push({ section: name, items: [i] });
  });
  return groups;
};

/** Progress of a checklist on a job: done / failed / required items still missing. */
export const checklistProgress = (template: Template, responses: ChecklistResponse[]) => {
  const by = new Map(responses.map((r) => [r.checklist_item_id, r]));
  return {
    total: template.items.length,
    answered: template.items.filter((i) => isAnswered(i, by.get(i.id))).length,
    failed: template.items.filter((i) => isFailure(i, by.get(i.id))).length,
    missing: template.items.filter((i) => (i.is_mandatory || i.photo_required || i.field_type === 'photo_required') && !isAnswered(i, by.get(i.id))),
  };
};

export const checklistService = {
  // ------------------------------------------------------------ templates
  async templates(): Promise<Template[]> {
    const [lists, items] = await Promise.all([
      cloudRead<PPMChecklist>('ppm_checklists', (q) => q.order('title'), T_KEY),
      cloudRead<PPMChecklistItem>('ppm_checklist_items', (q) => q.order('item_order'), I_KEY),
    ]);
    const ls = lists || loadStore<PPMChecklist[]>(T_KEY, []);
    const is = items || loadStore<PPMChecklistItem[]>(I_KEY, []);
    return ls.map((l) => ({
      ...l,
      items: is.filter((i) => i.checklist_id === l.id).sort((a, b) => a.item_order - b.item_order),
    }));
  },

  async template(id: string): Promise<Template | undefined> {
    return (await this.templates()).find((t) => t.id === id);
  },

  /**
   * Save a template and its full item list in one go: new and changed items
   * are upserted, items no longer in the list are removed.
   */
  async saveTemplate(t: Template, removedItemIds: string[] = []): Promise<Template> {
    const header = {
      id: t.id,
      title: t.title.trim(),
      description: t.description || null,
      category_id: t.category_id || null,
      is_active: t.is_active ?? true,
      applies_to: 'PPM',
      updated_at: new Date().toISOString(),
    };
    const items = t.items.map((i, n) => pickItem({ ...i, checklist_id: t.id, item_order: n + 1 }));

    if (!isSupabaseConfigured()) {
      const ls = loadStore<PPMChecklist[]>(T_KEY, []).filter((x) => x.id !== t.id);
      saveStore(T_KEY, [...ls, { ...header, created_at: t.created_at || new Date().toISOString() } as any]);
      const is = loadStore<PPMChecklistItem[]>(I_KEY, []).filter((x) => x.checklist_id !== t.id);
      saveStore(I_KEY, [...is, ...(items as any)]);
      return { ...t, ...header } as Template;
    }

    await cloudWrite('Saving checklist', () => supabase.from('ppm_checklists').upsert(header, { onConflict: 'id' }));
    if (removedItemIds.length) {
      await cloudWrite('Removing checklist items', () => supabase.from('ppm_checklist_items').delete().in('id', removedItemIds));
    }
    if (items.length) {
      await cloudWrite('Saving checklist items', () =>
        supabase.from('ppm_checklist_items').upsert(items, { onConflict: 'id', defaultToNull: false })
      );
    }
    return (await this.template(t.id)) || t;
  },

  newTemplate(): Template {
    return { id: newId(), title: '', description: '', category_id: '', is_active: true, created_at: new Date().toISOString(), items: [] } as Template;
  },

  newItem(checklistId: string, section?: string | null): PPMChecklistItem {
    return {
      id: newId(),
      checklist_id: checklistId,
      item_order: 0,
      task_description: '',
      field_type: 'pass_fail',
      is_mandatory: true,
      photo_required: false,
      raise_corrective_on_fail: true,
      fail_priority: 'P3',
      section: section || null,
    } as PPMChecklistItem;
  },

  duplicate(t: Template): Template {
    const id = newId();
    return { ...t, id, title: `${t.title} (copy)`, created_at: new Date().toISOString(), items: t.items.map((i) => ({ ...i, id: newId(), checklist_id: id })) };
  },

  async deleteTemplate(id: string) {
    if (!isSupabaseConfigured()) {
      saveStore(T_KEY, loadStore<PPMChecklist[]>(T_KEY, []).filter((x) => x.id !== id));
      saveStore(I_KEY, loadStore<PPMChecklistItem[]>(I_KEY, []).filter((x) => x.checklist_id !== id));
      return;
    }
    await cloudWrite('Deleting checklist', () => supabase.from('ppm_checklists').delete().eq('id', id));
  },

  // ------------------------------------------------------------ responses
  async responses(woId: string): Promise<ChecklistResponse[]> {
    if (!isSupabaseConfigured()) return loadStore<ChecklistResponse[]>(rKey(woId), []);
    const { data, error } = await supabase.from('wo_checklist_responses').select('*').eq('work_order_id', woId);
    if (error) throw new Error(`Loading checklist answers failed: ${error.message}`);
    return (data || []) as ChecklistResponse[];
  },

  /** Save one answer (insert or update by work order + item). */
  async answer(woId: string, item: PPMChecklistItem, patch: Partial<ChecklistResponse>, existing?: ChecklistResponse, by?: string): Promise<ChecklistResponse> {
    const merged: ChecklistResponse = {
      id: existing?.id || newId(),
      work_order_id: woId,
      checklist_item_id: item.id,
      ...existing,
      ...patch,
      answered_by: by || existing?.answered_by || null,
      answered_at: new Date().toISOString(),
    };
    merged.is_out_of_range = item.field_type === 'numeric_reading' && merged.reading != null ? outOfRange(item, Number(merged.reading)) : false;

    if (!isSupabaseConfigured()) {
      const list = loadStore<ChecklistResponse[]>(rKey(woId), []).filter((r) => r.checklist_item_id !== item.id);
      saveStore(rKey(woId), [...list, merged]);
      return merged;
    }
    const row = { ...merged, updated_at: new Date().toISOString() };
    const saved = await cloudWrite('Saving checklist answer', () =>
      supabase.from('wo_checklist_responses').upsert(row, { onConflict: 'work_order_id,checklist_item_id' }).select().single()
    );
    return (saved as ChecklistResponse) || merged;
  },

  async uploadPhoto(woId: string, itemId: string, file: File): Promise<string> {
    if (!file.type.startsWith('image/')) throw new Error('Only image files can be attached.');
    if (file.size > 10 * 1024 * 1024) throw new Error(`That photo is ${(file.size / 1048576).toFixed(1)} MB. The limit is 10 MB.`);
    if (!isSupabaseConfigured()) {
      // Offline demo: keep a small inline copy.
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error('Could not read the photo.'));
        r.readAsDataURL(file);
      });
    }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${woId}/checklist-${itemId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(`Photo upload failed: ${error.message}`);
    return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
  },

  /**
   * Raise a corrective job for a failed item: same place and asset, linked to
   * the PPM job, priority from the item. Only once per item.
   */
  async raiseCorrective(
    wo: WorkOrder,
    item: PPMChecklistItem,
    response: ChecklistResponse,
    policies: SlaPolicy[],
    note: string,
    by?: string
  ): Promise<{ corrective: WorkOrder; response: ChecklistResponse }> {
    if (response.corrective_wo_id) throw new Error('A corrective job was already raised for this item.');
    const finding =
      item.field_type === 'numeric_reading' && response.reading != null
        ? `${item.task_description}: reading ${response.reading}${item.unit_of_measure ? ` ${item.unit_of_measure}` : ''} (limits ${item.min_value ?? '–'} to ${item.max_value ?? '–'})`
        : `${item.task_description}: failed`;
    const corrective = await workOrderService.create(
      {
        wo_type: 'Corrective',
        parent_wo_id: wo.id,
        sla_priority: (item as any).fail_priority || 'P3',
        problem_description: `Found during PPM ${wo.wo_number} — ${finding}.${note ? `\n${note}` : ''}`,
        category_id: wo.category_id,
        trade: wo.trade || null,
        building_id: wo.building_id,
        floor_id: wo.floor_id,
        location_id: wo.location_id,
        zone_id: wo.zone_id || null,
        facility_id: wo.facility_id || null,
        asset_id: wo.asset_id,
        contract_id: wo.contract_id || null,
        source: 'PPM',
        reported_by_name: by,
      },
      policies
    );
    const saved = await this.answer(wo.id, item, { corrective_wo_id: corrective.id }, response, by);
    return { corrective, response: saved };
  },
};
