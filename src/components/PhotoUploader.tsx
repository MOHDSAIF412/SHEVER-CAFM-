import React, { useRef, useState } from 'react';
import { Camera, Loader2, Trash2, Upload, X } from 'lucide-react';
import { cafmDataService } from '../api/supabase';
import { WorkOrder, WorkOrderPhoto } from '../types';

interface PhotoUploaderProps {
  workOrder: WorkOrder;
  photoType: 'before' | 'progress' | 'after';
  label: string;
  canEdit: boolean;
  onChange: (updated: WorkOrder) => void;
}

/**
 * Uploads work-order photos to Supabase Storage.
 *
 * The data layer previously only accepted a URL, so photos could be referenced
 * but never actually stored - which meant before/after evidence never survived
 * beyond the device that "attached" it.
 */
export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  workOrder,
  photoType,
  label,
  canEdit,
  onChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<WorkOrderPhoto | null>(null);

  const photos = (workOrder.photos || []).filter((p) => p.photo_type === photoType);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError('');
    try {
      let latest = workOrder;
      // Sequential rather than parallel: a partial failure then leaves the
      // earlier uploads intact instead of an unclear mix.
      for (const file of Array.from(files)) {
        const updated = await cafmDataService.uploadWorkOrderPhoto(
          workOrder.id,
          file,
          photoType
        );
        if (updated) latest = updated;
      }
      onChange(latest);
    } catch (e: any) {
      setError(e?.message || 'Upload failed.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!confirm('Remove this photo?')) return;
    setError('');
    try {
      await cafmDataService.deleteWorkOrderPhoto(workOrder.id, photoId);
      onChange({
        ...workOrder,
        photos: (workOrder.photos || []).filter((p) => p.id !== photoId),
      });
    } catch (e: any) {
      setError(e?.message || 'Could not remove the photo.');
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2.5 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
          <Camera className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          {label}
          {photos.length > 0 && (
            <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {photos.length}
            </span>
          )}
        </h4>

        {canEdit && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1 text-[10px] font-bold text-white transition-colors hover:bg-teal-500 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            {busy ? 'Uploading…' : 'Upload'}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && (
        <p className="mb-2 rounded-lg bg-rose-50 p-2 text-[10px] text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
          {error}
        </p>
      )}

      {photos.length === 0 ? (
        <button
          type="button"
          onClick={() => canEdit && inputRef.current?.click()}
          disabled={!canEdit || busy}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 py-5 text-[10px] text-slate-400 transition-colors hover:border-teal-400 hover:text-teal-600 disabled:cursor-not-allowed disabled:hover:border-slate-300 disabled:hover:text-slate-400 dark:border-slate-700"
        >
          <Camera className="h-5 w-5" />
          {canEdit ? 'Tap to take or choose a photo' : 'No photo attached'}
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg">
              <img
                src={p.photo_url}
                alt={p.caption || label}
                loading="lazy"
                onClick={() => setPreview(p)}
                className="h-full w-full cursor-zoom-in object-cover transition-transform group-hover:scale-105"
              />
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  title="Remove photo"
                  className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute right-4 top-4 rounded-lg bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={preview.photo_url}
            alt={preview.caption || label}
            className="max-h-full max-w-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
