/**
 * Reusable upload control: click or drag-drop a file, validates type + size,
 * uploads via contentService.uploadMedia and hands the resulting URL back via onChange.
 * Also lets the admin paste an existing URL instead of uploading.
 */
import React, { useEffect, useId, useRef, useState } from 'react';
import { FileText, ImagePlus, Link2, Loader2, RefreshCw, Trash2, Upload, ExternalLink } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { contentService, MAX_UPLOAD_BYTES } from '../../../services/contentService';
import { UploadedMedia } from '../../../types/content';
import { FieldError, errorMessage, focusRing, hintClass, inputClass } from './shared';

export interface MediaUploadInfo {
  media?: UploadedMedia;
  file?: File;
}

interface MediaUploadProps {
  label: string;
  value: string | null | undefined;
  onChange: (url: string | null, info?: MediaUploadInfo) => void;
  /** Same syntax as <input accept>, e.g. "image/*" or "application/pdf,image/*". */
  accept?: string;
  /** 'image' shows an image preview; 'file' shows a file chip (image preview if the file is an image). */
  kind?: 'image' | 'file';
  hint?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  error?: string | null;
  /** Tailwind aspect class for the preview box, e.g. "aspect-[16/5]". */
  aspectClass?: string;
  /** White background + object-contain (e.g. string packs). Default true. */
  contain?: boolean;
  allowUrl?: boolean;
  /** Lets the parent form block saving while an upload is still in flight. */
  onUploadingChange?: (uploading: boolean) => void;
  /** File name to show for non-image files (e.g. a document's stored fileName). */
  fileName?: string | null;
  compact?: boolean;
}

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|svg)(\?.*)?$/i;

const matchesAccept = (file: File, accept?: string): boolean => {
  if (!accept) return true;
  const tokens = accept
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  return tokens.some((t) => {
    if (t.startsWith('.')) return name.endsWith(t);
    if (t.endsWith('/*')) return type.startsWith(t.slice(0, -1));
    return type === t;
  });
};

/** Short list of accepted formats, e.g. "JPG, PNG or WebP" or "PDF, JPG, PNG or WebP". */
const describeAccept = (accept?: string): string => {
  if (!accept) return 'any file';
  const parts = accept.split(',').map((t) => t.trim().toLowerCase());
  const out: string[] = [];
  parts.forEach((p) => {
    if (p === 'application/pdf' || p === '.pdf') out.push('PDF');
    else if (p === 'image/*') out.push('JPG', 'PNG', 'WebP');
    else out.push(p.replace(/^\./, '').toUpperCase());
  });
  const list = Array.from(new Set(out));
  return list.length > 1 ? `${list.slice(0, -1).join(', ')} or ${list[list.length - 1]}` : list[0];
};

const isValidUrl = (value: string): boolean => {
  const v = value.trim();
  if (v.startsWith('/')) return !/\s/.test(v);
  return /^https?:\/\/[^\s]+$/i.test(v);
};

const MAX_MB = Math.round((MAX_UPLOAD_BYTES / 1024 / 1024) * 10) / 10;

export const MediaUpload: React.FC<MediaUploadProps> = ({
  label,
  value,
  onChange,
  accept = 'image/*',
  kind = 'image',
  hint,
  required,
  disabled,
  error,
  aspectClass = 'aspect-[4/3]',
  contain = true,
  allowUrl = true,
  onUploadingChange,
  fileName,
  compact,
}) => {
  const { addToast } = useApp();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [lastFileName, setLastFileName] = useState<string | null>(null);
  const [lastContentType, setLastContentType] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  useEffect(() => {
    onUploadingChange?.(uploading);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploading]);

  const handleFile = async (file: File | undefined | null) => {
    if (!file || disabled || uploading) return;
    setLocalError(null);
    if (!matchesAccept(file, accept)) {
      setLocalError(`"${file.name}" can't be used here. Choose a ${describeAccept(accept)} file.`);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setLocalError(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. Files can be up to ${MAX_MB} MB.`);
      return;
    }
    const isImage = file.type.startsWith('image/');
    setLocalPreview(isImage ? URL.createObjectURL(file) : null);
    setUploading(true);
    try {
      const media = await contentService.uploadMedia(file);
      if (!mounted.current) return;
      setLastFileName(media.fileName || file.name);
      setLastContentType(media.contentType || file.type || null);
      setAnnounce(`${file.name} uploaded.`);
      onChange(media.url, { media, file });
    } catch (err) {
      if (!mounted.current) return;
      const msg = errorMessage(err, 'Upload failed. Please try again.');
      setLocalError(msg);
      addToast('error', 'Upload failed', msg);
    } finally {
      if (mounted.current) {
        setUploading(false);
        setLocalPreview(null);
      }
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const applyUrl = () => {
    const v = urlDraft.trim();
    if (!isValidUrl(v)) {
      setLocalError('Paste the full link, starting with https://');
      return;
    }
    setLocalError(null);
    setLastFileName(null);
    setLastContentType(null);
    onChange(v);
    setUrlMode(false);
    setUrlDraft('');
  };

  const shownUrl = localPreview || value || null;
  const showsImage =
    !!shownUrl &&
    (!!localPreview ||
      kind === 'image' ||
      (lastContentType ? lastContentType.startsWith('image/') : IMAGE_EXT.test(shownUrl)));
  const displayName =
    fileName || lastFileName || (value ? decodeURIComponent(value.split('?')[0].split('/').pop() || value) : '');
  const shownError = localError || error || null;
  const describedBy = `${id}-help`;

  return (
    <div className="min-w-0">
      <div className="flex items-end justify-between gap-2 mb-1.5">
        <span id={`${id}-label`} className="block text-[14px] font-medium leading-snug text-ink">
          {label}
          {required && <span className="text-rose-600 ml-0.5" aria-hidden="true">*</span>}
        </span>
        {allowUrl && !disabled && !uploading && (
          <button
            type="button"
            onClick={() => {
              setUrlMode((m) => !m);
              setLocalError(null);
            }}
            className={`-my-2.5 -mr-1.5 shrink-0 inline-flex items-center gap-1.5 min-h-[44px] px-1.5 rounded-lg text-[13px] font-medium text-ink-soft underline decoration-ink/25 underline-offset-4 hover:text-ink hover:decoration-ink ${focusRing}`}
          >
            {urlMode ? (
              <>
                <Upload className="w-3.5 h-3.5" aria-hidden="true" /> Upload instead
              </>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5" aria-hidden="true" /> Use a link
              </>
            )}
          </button>
        )}
      </div>
      <span className="sr-only" aria-live="polite">
        {uploading ? 'Uploading…' : announce}
      </span>

      <input
        ref={inputRef}
        id={`${id}-input`}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {urlMode ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <label htmlFor={`${id}-url`} className="sr-only">
            {label} link
          </label>
          <input
            id={`${id}-url`}
            type="url"
            inputMode="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyUrl();
              }
            }}
            placeholder="https://"
            autoComplete="off"
            className={inputClass}
            aria-invalid={localError ? true : undefined}
            aria-describedby={describedBy}
          />
          <button
            type="button"
            onClick={applyUrl}
            className={`shrink-0 min-h-[44px] px-5 rounded-xl bg-ink text-white text-[15px] font-semibold transition-colors duration-150 hover:bg-ink-hover ${focusRing}`}
          >
            Use this link
          </button>
        </div>
      ) : shownUrl ? (
        <div className="rounded-2xl border border-line overflow-hidden bg-white">
          {showsImage ? (
            <div className={`relative ${aspectClass} ${compact ? 'max-h-40' : ''} w-full ${contain ? 'bg-white' : 'bg-paper'}`}>
              <img
                src={shownUrl}
                alt={`${label} preview`}
                loading="lazy"
                className={`absolute inset-0 w-full h-full ${contain ? 'object-contain p-2' : 'object-cover'} ${uploading ? 'opacity-50' : ''}`}
              />
              {uploading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/95 border border-line px-3.5 py-2 text-[13px] font-semibold text-ink shadow-sm">
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Uploading…
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3">
              <div className="w-11 h-11 rounded-xl bg-paper border border-line flex items-center justify-center shrink-0">
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-ink" aria-hidden="true" />
                ) : (
                  <FileText className="w-5 h-5 text-ink" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-ink truncate">{uploading ? 'Uploading…' : displayName}</p>
                {!uploading && value && (
                  <a
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 text-[13px] text-ink-soft underline decoration-ink/25 underline-offset-4 hover:text-ink rounded ${focusRing}`}
                  >
                    Open file <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>
          )}
          {!uploading && !disabled && (
            <div className="flex border-t border-line divide-x divide-line">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] text-[14px] font-medium text-ink-soft transition-colors duration-150 hover:bg-paper hover:text-ink ${focusRing} focus-visible:outline-offset-[-2px]`}
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" /> Replace
              </button>
              {!required && (
                <button
                  type="button"
                  onClick={() => {
                    setLastFileName(null);
                    setLastContentType(null);
                    setAnnounce('Removed.');
                    onChange(null);
                  }}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] text-[14px] font-medium text-rose-700 transition-colors duration-150 hover:bg-rose-50 ${focusRing} focus-visible:outline-offset-[-2px]`}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" /> Remove
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          aria-labelledby={`${id}-label`}
          aria-describedby={describedBy}
          aria-busy={uploading || undefined}
          aria-invalid={shownError ? true : undefined}
          className={`w-full ${compact ? 'py-6' : 'py-9'} px-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 text-center transition-colors duration-150 disabled:cursor-wait ${focusRing} ${
            dragOver
              ? 'border-ink bg-paper-deep'
              : shownError
                ? 'border-rose-300 bg-rose-50/50 hover:bg-rose-50'
                : 'border-slate-300 bg-paper/70 hover:bg-paper hover:border-ink/40'
          }`}
        >
          <span className="mb-1.5 w-11 h-11 rounded-full bg-white border border-line inline-flex items-center justify-center">
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin text-ink" aria-hidden="true" />
            ) : kind === 'image' ? (
              <ImagePlus className="w-5 h-5 text-ink-soft" aria-hidden="true" />
            ) : (
              <Upload className="w-5 h-5 text-ink-soft" aria-hidden="true" />
            )}
          </span>
          <span className="text-[15px] font-semibold text-ink">
            {uploading ? (
              'Uploading…'
            ) : (
              <>
                {kind === 'image' ? 'Choose a photo' : 'Choose a file'}
                <span className="hidden sm:inline font-normal text-ink-muted"> or drop it here</span>
              </>
            )}
          </span>
          <span className="text-[13px] text-ink-muted">
            {describeAccept(accept)} · up to {MAX_MB} MB
          </span>
        </button>
      )}

      <div id={describedBy}>
        {shownError ? <FieldError>{shownError}</FieldError> : hint ? <p className={hintClass}>{hint}</p> : null}
      </div>
    </div>
  );
};

export default MediaUpload;
