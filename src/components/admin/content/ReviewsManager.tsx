/**
 * Admin: customer review moderation (approve / hide / feature / reply / delete).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Check,
  EyeOff,
  MapPin,
  MessageSquareReply,
  RefreshCw,
  Star,
  Trash2,
  Wrench,
  Hash,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { contentService } from '../../../services/contentService';
import { CustomerReview, ReviewModerationUpdate, ReviewStatus } from '../../../types/content';
import { Button } from '../../common/Button';
import { EmptyState } from '../../common/EmptyStates';
import { ConfirmDialog, ErrorState, ListSkeleton, Pills, SectionHeader, cardClass, errorMessage, formatDate, inputClass } from './shared';

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  hidden: 'Hidden',
};

const Stars: React.FC<{ rating: number }> = ({ rating }) => {
  const r = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${r} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i <= r ? 'fill-brandYellow text-amber-500' : 'fill-slate-100 text-slate-300'}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
};

interface ReviewCardProps {
  review: CustomerReview;
  busyAction: string | null;
  onModerate: (update: ReviewModerationUpdate, action: string, successTitle: string) => Promise<boolean>;
  onDelete: () => void;
}

const ReviewCard: React.FC<ReviewCardProps> = ({ review: r, busyAction, onModerate, onDelete }) => {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState(r.adminReply ?? '');
  const busy = busyAction !== null;
  const replyId = `reply-${r.id}`;

  const saveReply = async () => {
    const text = replyDraft.trim();
    const ok = await onModerate({ adminReply: text ? text : null }, 'reply', text ? 'Reply saved' : 'Reply removed');
    if (ok) setReplyOpen(false); // on failure the draft stays in the box
  };

  return (
    <li className={`${cardClass} p-4 space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Stars rating={r.rating} />
            <span className="font-bold text-sm text-slate-900 break-words">{r.authorName}</span>
            {r.isVerified && (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <BadgeCheck className="w-3 h-3" /> Verified customer
              </span>
            )}
            {r.isFeatured && r.status === 'approved' && (
              <span className="inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded bg-brandYellow text-sportsBlue">
                <Star className="w-3 h-3" /> Featured
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
            <span>{formatDate(r.createdAt)}</span>
            {r.location && (
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="w-3 h-3" /> {r.location}
              </span>
            )}
            {r.serviceType && (
              <span className="inline-flex items-center gap-0.5">
                <Wrench className="w-3 h-3" /> {r.serviceType}
              </span>
            )}
            {r.requestId && (
              <span className="inline-flex items-center gap-0.5 font-mono">
                <Hash className="w-3 h-3" /> {r.requestId}
              </span>
            )}
          </div>
        </div>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
            r.status === 'pending'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : r.status === 'approved'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-line'
          }`}
        >
          {STATUS_LABEL[r.status]}
        </span>
      </div>

      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line break-words">{r.comment}</p>

      {r.adminReply && !replyOpen && (
        <div className="ml-3 pl-3 border-l-2 border-line">
          <p className="text-xs font-bold text-ink">Reply from GR Sports</p>
          <p className="text-xs text-slate-600 whitespace-pre-line break-words">{r.adminReply}</p>
        </div>
      )}

      {replyOpen && (
        <div className="space-y-2">
          <label htmlFor={replyId} className="block text-xs font-semibold text-slate-700">
            Public reply
          </label>
          <textarea
            id={replyId}
            rows={3}
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            className={`${inputClass} resize-y`}
            placeholder="Thank you for choosing GR Sports!"
            disabled={busyAction === 'reply'}
          />
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-[40px]"
              disabled={busyAction === 'reply'}
              onClick={() => {
                setReplyOpen(false);
                setReplyDraft(r.adminReply ?? '');
              }}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" className="min-h-[40px]" isLoading={busyAction === 'reply'} disabled={busy} onClick={saveReply}>
              {replyDraft.trim() ? 'Save reply' : r.adminReply ? 'Remove reply' : 'Save reply'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2 border-t border-line/70">
        {r.status !== 'approved' && (
          <Button
            type="button"
            size="sm"
            variant="success"
            className="min-h-[40px]"
            leftIcon={<Check className="w-4 h-4" />}
            isLoading={busyAction === 'approve'}
            disabled={busy}
            onClick={() => onModerate({ status: 'approved' }, 'approve', 'Review approved')}
          >
            Approve
          </Button>
        )}
        {r.status !== 'hidden' && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-[40px]"
            leftIcon={<EyeOff className="w-4 h-4" />}
            isLoading={busyAction === 'hide'}
            disabled={busy}
            onClick={() => onModerate({ status: 'hidden', isFeatured: false }, 'hide', 'Review hidden')}
          >
            Hide
          </Button>
        )}
        {r.status === 'approved' && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={`min-h-[40px] ${r.isFeatured ? 'text-amber-700' : ''}`}
            leftIcon={<Star className="w-4 h-4" />}
            isLoading={busyAction === 'feature'}
            disabled={busy}
            aria-pressed={r.isFeatured}
            onClick={() =>
              onModerate({ isFeatured: !r.isFeatured }, 'feature', r.isFeatured ? 'Removed from featured' : 'Review featured')
            }
          >
            {r.isFeatured ? 'Unfeature' : 'Feature'}
          </Button>
        )}
        {!replyOpen && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-[40px]"
            leftIcon={<MessageSquareReply className="w-4 h-4" />}
            disabled={busy}
            onClick={() => {
              setReplyDraft(r.adminReply ?? '');
              setReplyOpen(true);
            }}
          >
            {r.adminReply ? 'Edit reply' : 'Reply'}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-[40px] text-rose-600 ml-auto"
          leftIcon={<Trash2 className="w-4 h-4" />}
          disabled={busy}
          onClick={onDelete}
        >
          Delete
        </Button>
      </div>
    </li>
  );
};

export const ReviewsManager: React.FC<{ onPendingCountChange?: (count: number) => void }> = ({
  onPendingCountChange,
}) => {
  const { addToast } = useApp();
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<ReviewStatus>('pending');
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [toDelete, setToDelete] = useState<CustomerReview | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Load every status at once so tab counts are accurate.
      const list = await contentService.listReviews();
      setReviews([...list].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load reviews.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<ReviewStatus, number> = { pending: 0, approved: 0, hidden: 0 };
    reviews.forEach((r) => {
      if (c[r.status] !== undefined) c[r.status]++;
    });
    return c;
  }, [reviews]);

  useEffect(() => {
    if (!loading && !loadError) onPendingCountChange?.(counts.pending);
  }, [counts.pending, loading, loadError, onPendingCountChange]);

  const visible = reviews.filter((r) => r.status === status);

  const moderate = async (
    review: CustomerReview,
    update: ReviewModerationUpdate,
    action: string,
    successTitle: string
  ): Promise<boolean> => {
    setBusy((b) => ({ ...b, [review.id]: action }));
    try {
      const saved = await contentService.moderateReview(review.id, update);
      setReviews((list) => list.map((r) => (r.id === review.id ? { ...r, ...saved } : r)));
      const moved = update.status && update.status !== review.status;
      addToast(
        'success',
        successTitle,
        moved ? `${review.authorName}'s review moved to ${STATUS_LABEL[update.status as ReviewStatus]}.` : `${review.authorName}'s review updated.`
      );
      return true;
    } catch (err) {
      addToast('error', 'Could not update review', errorMessage(err));
      return false;
    } finally {
      setBusy((b) => {
        const next = { ...b };
        delete next[review.id];
        return next;
      });
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await contentService.deleteReview(toDelete.id);
      setReviews((list) => list.filter((r) => r.id !== toDelete.id));
      addToast('success', 'Review deleted', `${toDelete.authorName}'s review was removed.`);
      setToDelete(null);
    } catch (err) {
      addToast('error', 'Delete failed', errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const emptyCopy: Record<ReviewStatus, { title: string; description: string }> = {
    pending: { title: 'All caught up', description: 'No reviews are waiting for approval. New customer reviews will appear here.' },
    approved: { title: 'No approved reviews', description: 'Approved reviews are shown on the website.' },
    hidden: { title: 'No hidden reviews', description: 'Reviews you hide stay here and can be approved later.' },
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Customer reviews"
        description="New reviews wait here until you approve them. Approved reviews appear on the website; featured ones are shown first."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[40px]"
            leftIcon={<RefreshCw className="w-4 h-4" />}
            onClick={load}
            isLoading={loading && reviews.length > 0}
          >
            Refresh
          </Button>
        }
      />

      <Pills<ReviewStatus>
        ariaLabel="Filter reviews by status"
        value={status}
        onChange={setStatus}
        options={[
          { id: 'pending', label: 'Pending', count: counts.pending, highlight: true },
          { id: 'approved', label: 'Approved', count: counts.approved },
          { id: 'hidden', label: 'Hidden', count: counts.hidden },
        ]}
      />

      {loading && reviews.length === 0 ? (
        <ListSkeleton rows={3} withImage={false} />
      ) : loadError && reviews.length === 0 ? (
        <ErrorState message={loadError} onRetry={load} retrying={loading} />
      ) : (
        <>
          {loadError && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
              Refresh failed: {loadError}
            </div>
          )}
          {visible.length === 0 ? (
            <EmptyState title={emptyCopy[status].title} description={emptyCopy[status].description} />
          ) : (
            <ul className="space-y-3">
              {visible.map((r) => (
                <ReviewCard
                  key={r.id}
                  review={r}
                  busyAction={busy[r.id] ?? null}
                  onModerate={(update, action, title) => moderate(r, update, action, title)}
                  onDelete={() => setToDelete(r)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete review?"
        message={
          <>
            {toDelete?.authorName}'s {toDelete?.rating}-star review will be permanently deleted.
            <span className="block mt-2 text-xs text-slate-500">Tip: “Hide” removes it from the website but keeps it here.</span>
          </>
        }
        confirmLabel="Delete review"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
};

export default ReviewsManager;
