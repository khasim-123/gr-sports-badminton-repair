import React, { useId, useRef, useState } from 'react';
import { BadgeCheck, CheckCircle2 } from 'lucide-react';
import type { CustomerReview, PublicReviewsResponse } from '../../../types/content';
import { ApiError } from '../../../services/apiClient';
import { contentService } from '../../../services/contentService';
import { Dialog } from './Dialog';
import { relativeDate } from './format';
import { SECTION_IDS, useShop } from './shop';
import { SectionHeader, Select, Stars, btn, container, cx, fieldControl, fieldHint, fieldLabel } from './ui';

const INITIAL_COUNT = 6;

interface ReviewsSectionProps {
  data: PublicReviewsResponse | undefined;
  status: 'loading' | 'ready' | 'error';
}

export const ReviewsSection: React.FC<ReviewsSectionProps> = ({ data, status }) => {
  const [writing, setWriting] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const reviews = (data?.reviews || [])
    .filter((r) => r.status === undefined || r.status === 'approved')
    .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || b.createdAt.localeCompare(a.createdAt));
  const summary = data?.summary;
  const count = summary?.count || 0;
  const average = Math.max(0, Math.min(5, summary?.average || 0));
  const shown = showAll ? reviews : reviews.slice(0, INITIAL_COUNT);

  return (
    <section id={SECTION_IDS.reviews} aria-labelledby="reviews-title" className="scroll-mt-20 bg-paper py-16 sm:py-24">
      <div className={cx(container, 'grid gap-10 lg:grid-cols-12 lg:gap-14')}>
        <div className="lg:col-span-4">
          <SectionHeader id="reviews-title" title="What customers say" />
          {status === 'ready' && count > 0 && (
            <div className="mt-6">
              <p className="flex items-end gap-3">
                <span className="font-display text-[64px] font-semibold leading-none text-ink tabular-nums">{average.toFixed(1)}</span>
                <span className="pb-2">
                  <Stars rating={average} className="h-5 w-5" />
                  <span className="mt-1 block text-[14px] text-ink-muted">
                    {count.toLocaleString('en-IN')} {count === 1 ? 'review' : 'reviews'}
                  </span>
                </span>
              </p>
              <p className="sr-only">
                Average rating {average.toFixed(1)} out of 5 from {count} reviews.
              </p>
              {count >= 5 && summary && (
                <ul className="mt-5 space-y-1.5" aria-label="Ratings breakdown">
                  {(['5', '4', '3', '2', '1'] as const).map((k) => {
                    const n = summary.distribution?.[k] || 0;
                    return (
                      <li key={k} className="flex items-center gap-3 text-[13px] text-ink-muted">
                        <span className="w-10 tabular-nums">{k} star</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
                          <span className="block h-full rounded-full bg-[#E3A008]" style={{ width: `${count ? (n / count) * 100 : 0}%` }} />
                        </span>
                        <span className="w-8 text-right tabular-nums">{n}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
          <p className="mt-6 text-[15px] leading-relaxed text-ink-soft">
            Every review is read by us before it appears here. We don't edit what you write.
          </p>
          <button type="button" onClick={() => setWriting(true)} className={cx(btn.base, btn.primary, 'mt-6')}>
            Write a review
          </button>
        </div>

        <div className="lg:col-span-8">
          {status === 'loading' && (
            <div className="grid gap-5 md:grid-cols-2" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-48 animate-pulse rounded-xl bg-paper-deep" />
              ))}
            </div>
          )}
          {status === 'error' && (
            <p className="rounded-xl border border-line bg-white px-5 py-4 text-[15px] text-ink-soft">Reviews aren't loading right now.</p>
          )}
          {status === 'ready' && reviews.length === 0 && (
            <div className="rounded-xl border border-dashed border-ink/20 bg-white px-6 py-10 sm:px-10">
              <h3 className="font-display text-[28px] font-semibold leading-tight text-ink">No reviews yet</h3>
              <p className="mt-2 max-w-lg text-[16px] leading-relaxed text-ink-soft">
                If we've strung or repaired a racket for you, tell other players how it went. Short and honest is perfect.
              </p>
            </div>
          )}
          {reviews.length > 0 && (
            <>
              <ul className="gap-5 md:columns-2">
                {shown.map((r) => (
                  <li key={r.id} className="mb-5 break-inside-avoid">
                    <ReviewCard review={r} />
                  </li>
                ))}
              </ul>
              {reviews.length > INITIAL_COUNT && (
                <button type="button" onClick={() => setShowAll((s) => !s)} className={cx(btn.base, btn.secondary)}>
                  {showAll ? 'Show fewer reviews' : `Show all ${reviews.length} reviews`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <ReviewDialog open={writing} onClose={() => setWriting(false)} />
    </section>
  );
};

const ReviewCard: React.FC<{ review: CustomerReview }> = ({ review: r }) => {
  const SHOP = useShop();
  const rating = Math.max(1, Math.min(5, Math.round(r.rating || 0)));
  const meta = [r.serviceType, r.location].filter(Boolean).join(' · ');
  return (
    <figure className="rounded-xl border border-line bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <Stars rating={rating} />
        <span className="sr-only">Rated {rating} out of 5</span>
        <span className="text-[13px] text-ink-muted">{relativeDate(r.createdAt)}</span>
      </div>
      <blockquote className="mt-3 whitespace-pre-line break-words text-[16px] leading-relaxed text-ink">{r.comment}</blockquote>
      <figcaption className="mt-4 text-[14px]">
        <span className="font-semibold text-ink">{r.authorName}</span>
        {r.isVerified && (
          <span className="ml-2 inline-flex items-center gap-1 text-[13px] text-[#1E7A44]">
            <BadgeCheck className="h-4 w-4" aria-hidden="true" />
            Booked with us
          </span>
        )}
        {meta && <span className="block text-ink-muted">{meta}</span>}
      </figcaption>
      {r.adminReply && (
        <div className="mt-4 border-l-2 border-accent pl-4">
          <p className="text-[13px] font-semibold text-ink">Reply from {SHOP.name}</p>
          <p className="mt-0.5 whitespace-pre-line break-words text-[14px] leading-relaxed text-ink-soft">{r.adminReply}</p>
        </div>
      )}
    </figure>
  );
};

// ---------------------------------------------------------------------------
// Write a review (POST /reviews → admin moderation)
// ---------------------------------------------------------------------------

const SERVICES = ['Racket Stringing', 'Racket Repair', 'Store Purchase', 'Other'];
const SERVICE_LABEL: Record<string, string> = {
  'Racket Stringing': 'Racket stringing',
  'Racket Repair': 'Racket repair',
  'Store Purchase': 'Bought something at the shop',
  Other: 'Something else',
};
const RATING_WORDS = ['', 'Poor', 'Not great', 'Okay', 'Good', 'Excellent'];

const ReviewDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const SHOP = useShop();
  const uid = useId();
  const firstRef = useRef<HTMLInputElement>(null);
  const [rating, setRating] = useState(0);
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [service, setService] = useState(SERVICES[0]);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const close = () => {
    onClose();
    if (sent) {
      setSent(false);
      setRating(0);
      setName('');
      setArea('');
      setService(SERVICES[0]);
      setComment('');
    }
    setError('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const authorName = name.trim();
    const text = comment.trim();
    if (!(rating >= 1 && rating <= 5)) return setError('Please choose a star rating.');
    if (authorName.length < 2) return setError('Please enter your name.');
    if (text.length < 10) return setError('Please write at least a sentence (10 characters or more).');
    if (text.length > 1000) return setError('Please keep your review under 1000 characters.');
    setError('');
    setSending(true);
    try {
      await contentService.submitReview({
        authorName,
        rating,
        comment: text,
        serviceType: service || undefined,
        location: area.trim() || undefined,
      });
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) setError('We couldn’t reach the server. Check your connection and try again.');
      else setError(err instanceof Error && err.message ? err.message : 'Could not send your review. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      size="md"
      title={sent ? 'Thank you' : 'Write a review'}
      description={sent ? undefined : 'Tell other players how your stringing, repair or visit went.'}
      initialFocusRef={sent ? undefined : firstRef}
    >
      {sent ? (
        <div role="status">
          <p className="flex items-start gap-3 text-[16px] leading-relaxed text-ink-soft">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#1E7A44]" aria-hidden="true" />
            Your review has been sent. It will appear on this page once we've read it.
          </p>
          <button type="button" onClick={close} className={cx(btn.base, btn.primary, 'mt-6')}>
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          <fieldset>
            <legend className={fieldLabel}>Your rating</legend>
            <div className="flex items-center gap-3">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label
                    key={n}
                    className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sportsBlue"
                  >
                    <input
                      ref={n === 1 ? firstRef : undefined}
                      type="radio"
                      name={`${uid}-rating`}
                      value={n}
                      checked={rating === n}
                      onChange={() => setRating(n)}
                      className="sr-only"
                      aria-label={`${n} ${n === 1 ? 'star' : 'stars'}, ${RATING_WORDS[n].toLowerCase()}`}
                    />
                    <svg viewBox="0 0 20 20" className={cx('h-8 w-8 transition-colors', n <= rating ? 'text-[#E3A008]' : 'text-line hover:text-[#E3A008]/50')} fill="currentColor" aria-hidden="true">
                      <path d="M10 1.8l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.42l-4.94 2.6.94-5.5-4-3.9 5.53-.8L10 1.8z" />
                    </svg>
                  </label>
                ))}
              </div>
              <span className="text-[14px] text-ink-muted" aria-hidden="true">
                {RATING_WORDS[rating]}
              </span>
            </div>
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-name`} className={fieldLabel}>
                Your name
              </label>
              <input id={`${uid}-name`} type="text" autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={fieldControl} />
            </div>
            <div>
              <label htmlFor={`${uid}-area`} className={fieldLabel}>
                Area <span className="font-normal text-ink-muted">(optional)</span>
              </label>
              <input id={`${uid}-area`} type="text" maxLength={80} placeholder="e.g. MVP Colony" value={area} onChange={(e) => setArea(e.target.value)} className={fieldControl} />
            </div>
          </div>

          <div>
            <label htmlFor={`${uid}-service`} className={fieldLabel}>
              What was it for?
            </label>
            <Select id={`${uid}-service`} value={service} onChange={(e) => setService(e.target.value)}>
              {SERVICES.map((s) => (
                <option key={s} value={s}>
                  {SERVICE_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label htmlFor={`${uid}-text`} className={fieldLabel}>
              Your review
            </label>
            <textarea
              id={`${uid}-text`}
              rows={4}
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="How was the stringing or repair? Was pickup on time?"
              aria-describedby={`${uid}-count`}
              className={cx(fieldControl, 'py-2.5 leading-relaxed')}
            />
            <p id={`${uid}-count`} className={fieldHint}>
              {comment.trim().length}/1000 · We read reviews before they're published.
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-[#F3C9C9] bg-[#FDF3F3] px-4 py-3 text-[14px] text-[#8A1F1F]">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={close} className={cx(btn.base, btn.secondary)}>
              Cancel
            </button>
            <button type="submit" disabled={sending} className={cx(btn.base, btn.primary, 'px-7')}>
              {sending ? 'Sending…' : 'Send review'}
            </button>
          </div>
          <p className="text-[13px] text-ink-muted">
            Problem with a booking? Call {SHOP.phoneDisplay} instead, so we can sort it out.
          </p>
        </form>
      )}
    </Dialog>
  );
};
