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
import { errorMessage, inputClass } from './shared';

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

const describeAccept = (accept?: string): string => {
  if (!accept) return 'any file';
  const parts = accept.split(',').map((t) => t.trim().toLowerCase());
  const out: string[] = [];
  parts.forEach((p) => {
    if (p === 'image/*') out.push('images (JPG, PNG, WebP)');
    else if (p === 'application/pdf' || p === '.pdf') out.push('PDF');
    else out.push(p.replace(/^\./, '').toUpperCase());
  });
  return Array.from(new Set(out)).join(' or ');
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
      setLocalError(`"${file.name}" isn't supported. Please choose ${describeAccept(accept)}.`);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setLocalError(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_MB} MB.`);
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
      setLocalError('Enter a full link starting with https:// (or a site path starting with /).');
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
      <div className="flex items-center justify-between gap-2 mb-1">
        <span id={`${id}-label`} className="block text-xs font-semibold text-slate-700">
          {label}
          {required && <span className="text-rose-600 ml-0.5" aria-hidden="true">*</span>}
        </span>
        {allowUrl && !disabled && (
          <button
            type="button"
            onClick={() => {
              setUrlMode((m) => !m);
              setLocalError(null);
            }}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 min-h-[32px] px-1"
          >
            {urlMode ? (
              <>
                <Upload className="w-3.5 h-3.5" /> Upload instead
              </>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5" /> Paste a link
              </>
            )}
          </button>
        )}
      </div>

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
            placeholder="https://… or /images/…"
            className={inputClass}
            aria-describedby={describedBy}
          />
          <button
            type="button"
            onClick={applyUrl}
            className="shrink-0 min-h-[42px] px-4 rounded-xl bg-sportsBlue text-white text-sm font-semibold hover:bg-badmintonNavy"
          >
            Use link
          </button>
        </div>
      ) : shownUrl ? (
        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
          {showsImage ? (
            <div className={`relative ${aspectClass} ${compact ? 'max-h-40' : ''} w-full ${contain ? 'bg-white' : 'bg-slate-100'}`}>
              <img
                src={shownUrl}
                alt={`${label} preview`}
                loading="lazy"
                className={`absolute inset-0 w-full h-full ${contain ? 'object-contain p-2' : 'object-cover'}`}
              />
              {uploading && (
                <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center gap-2" aria-live="polite">
                  <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
                  <span className="text-xs font-semibold text-slate-700">Uploading…</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                ) : (
                  <FileText className="w-5 h-5 text-blue-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 truncate">{uploading ? 'Uploading…' : displayName}</p>
                {!uploading && value && (
                  <a
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:underline"
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}
          {!uploading && !disabled && (
            <div className="flex border-t border-slate-100 divide-x divide-slate-100">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[40px] text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Replace
              </button>
              {!required && (
                <button
                  type="button"
                  onClick={() => {
                    setLastFileName(null);
                    setLastContentType(null);
                    onChange(null);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[40px] text-xs font-semibold text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
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
          className={`w-full ${compact ? 'py-5' : 'py-8'} px-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 text-center transition-colors disabled:opacity-60 ${
            dragOver
              ? 'border-blue-500 bg-blue-50'
              : shownError
                ? 'border-rose-300 bg-rose-50/40 hover:bg-rose-50'
                : 'border-slate-300 bg-slate-50/60 hover:bg-slate-50 hover:border-slate-400'
          }`}
        >
          {uploading ? (
            <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
          ) : kind === 'image' ? (
            <ImagePlus className="w-7 h-7 text-slate-400" />
          ) : (
            <Upload className="w-7 h-7 text-slate-400" />
          )}
          <span className="text-sm font-semibold text-slate-700">
            {uploading ? 'Uploading…' : (
              <>
                <span className="text-blue-700">Tap to choose</span>
                <span className="hidden sm:inline"> or drag a file here</span>
              </>
            )}
          </span>
          <span className="text-[11px] text-slate-500">
            {describeAccept(accept)} · max {MAX_MB} MB
          </span>
        </button>
      )}

      <div id={describedBy}>
        {shownError ? (
          <p className="text-[11px] text-rose-600 mt-1 font-medium" role="alert">
            {shownError}
          </p>
        ) : hint ? (
          <p className="text-[11px] text-slate-500 mt-1 leading-snug">{hint}</p>
        ) : null}
      </div>
    </div>
  );
};

export default MediaUpload;
