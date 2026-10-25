import React from 'react';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../common/Badge';
import { Button } from '../common/Button';
import { RequestProgress } from './RequestProgress';
import { useRequestPhotos } from '../../hooks/useRequestPhotos';
import { phoneDisplay, telHref, useShopSettings } from '../../hooks/useShopSettings';
import {
  ArrowLeft,
  Wrench,
  MapPin,
  CalendarDays,
  ShieldAlert,
  Star,
  User,
  Phone,
  Wallet,
  CheckCircle2,
  ClipboardCheck,
  AlertCircle,
} from 'lucide-react';
import { formatDate, formatDateTime, formatINR } from '../../utils/format';
import { ServiceTypeTile, declinedRepairFeeOf, gettingTierName, isRepairDeclined, realPhotos, splitNotes } from './requestDisplay';

const REVIEW_MIN = 10;
const REVIEW_MAX = 1500;

const Row: React.FC<{ label: string; children: React.ReactNode; strong?: boolean }> = ({ label, children, strong }) => (
  <div className="flex justify-between items-baseline gap-4 py-2">
    <span className={strong ? 'font-bold text-slate-900' : 'text-slate-600'}>{label}</span>
    <span className={`text-right ${strong ? 'text-base font-extrabold text-ink' : 'font-semibold text-slate-900'}`}>{children}</span>
  </div>
);

const Card: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }> = ({
  title,
  icon,
  children,
  className = '',
}) => (
  <section className={`bg-white rounded-2xl border border-line p-4 sm:p-5 shadow-2xs ${className}`}>
    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
      {icon}
      {title}
    </h2>
    {children}
  </section>
);

export const RequestDetailView: React.FC = () => {
  const shop = useShopSettings();
  const {
    selectedRequestId,
    requests,
    setCustomerSubView,
    setRepairEstimateModalOpen,
    setRevisedEstimateModalOpen,
    setModalTargetRequestId,
    distanceConfig,
    submitReview,
    isDataLoading,
    dataLoaded,
    gettingServices,
    repairCategories,
  } = useApp();

  const [reviewRating, setReviewRating] = React.useState<number>(0);
  const [reviewComment, setReviewComment] = React.useState<string>('');
  const [hoverRating, setHoverRating] = React.useState<number>(0);
  const [reviewError, setReviewError] = React.useState<string | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = React.useState(false);

  const request = requests.find((r) => r.id === selectedRequestId);
  const loadedPhotos = useRequestPhotos(request);

  if (!request && isDataLoading && !dataLoaded) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading your request…</div>;
  }

  if (!request) {
    return (
      <div className="max-w-md mx-auto p-8 text-center space-y-4">
        <p className="text-slate-600">We couldn&apos;t find that request.</p>
        <Button onClick={() => setCustomerSubView('requests')} variant="outline" className="min-h-[44px]">
          Back to My Requests
        </Button>
      </div>
    );
  }

  const isRepair = request.serviceType === 'REPAIR';
  const isAwaitingApproval = request.status === 'Awaiting Customer Approval';
  const est = request.repairEstimate;
  const isRevised = !!est?.isRevised;
  const { slot, notes } = splitNotes(request.additionalNotes);
  const photos = loadedPhotos.batPhotos;
  const pickupPhotos = loadedPhotos.pickupPhotos;
  const address = request.pickupAddress;
  const addressLine = [address?.houseFlat, address?.street, address?.area, address?.city].filter(Boolean).join(', ');
  const deliveryCharge = request.pickupDeliveryCharge || 0;
  const isPaid = request.paymentStatus === 'Paid';
  const repairPriced = !isRepair || !!est;
  const declined = isRepairDeclined(request);

  const handleOpenApprovalModal = () => {
    setModalTargetRequestId(request.id);
    if (isRevised) setRevisedEstimateModalOpen(true);
    else setRepairEstimateModalOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!reviewRating) {
      setReviewError('Please choose a star rating.');
      return;
    }
    if (reviewComment.trim().length < REVIEW_MIN) {
      setReviewError(`Please write at least ${REVIEW_MIN} characters about your experience.`);
      return;
    }
    setReviewError(null);
    setReviewSubmitting(true);
    await submitReview(request.id, {
      rating: reviewRating,
      comment: reviewComment.trim(),
      createdAt: new Date().toISOString(),
    });
    setReviewSubmitting(false);
  };

  const shownRating = hoverRating || reviewRating;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:p-6 lg:p-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setCustomerSubView('requests')}
          className="inline-flex items-center gap-2 min-h-[40px] pr-3 text-sm font-semibold text-slate-600 hover:text-ink"
        >
          <ArrowLeft className="w-4 h-4" /> My Requests
        </button>
        <span className="text-xs text-slate-500">
          Booked {formatDateTime(request.createdAt)}
        </span>
      </div>

      {/* Header */}
      <section className="bg-white rounded-2xl border border-line p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <ServiceTypeTile type={request.serviceType} />
          <div className="min-w-0">
            <p className="text-xs text-slate-500">
              {isRepair ? 'Racket repair' : 'Racket stringing'} ·{' '}
              <span className="font-mono font-bold text-ink">{request.id}</span>
            </p>
            <h1 className="font-display tracking-[0.01em] text-2xl font-bold text-slate-900 truncate">
              {request.batBrand} {request.batModel}
            </h1>
          </div>
        </div>
        <StatusBadge status={request.status} size="lg" />
      </section>

      {/* Action needed: estimate approval */}
      {isAwaitingApproval && (
        <section
          className={`p-4 sm:p-5 rounded-2xl border-2 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            isRevised ? 'bg-amber-50 border-amber-300' : 'bg-paper border-line'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-2xl text-white shrink-0 ${isRevised ? 'bg-amber-600' : 'bg-ink'}`}>
              {isRevised ? <ShieldAlert className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Your approval is needed</p>
              <h2 className="text-base font-bold text-slate-900 mt-0.5">
                {isRevised ? 'We found more damage — the repair estimate has changed.' : 'Your repair estimate is ready.'}
              </h2>
              {est && (
                <p className="text-xs text-slate-700 mt-1">
                  {isRevised && est.originalEstimate != null
                    ? `Was ${formatINR(est.originalEstimate)}, now ${formatINR(est.totalEstimate)}.`
                    : `Repair estimate ${formatINR(est.totalEstimate)}.`}{' '}
                  Work continues only after you approve.
                </p>
              )}
            </div>
          </div>
          <Button
            onClick={handleOpenApprovalModal}
            size="lg"
            variant={isRevised ? 'secondary' : 'primary'}
            className="w-full md:w-auto shrink-0 font-bold min-h-[48px]"
          >
            Review estimate
          </Button>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
        {/* Left: what was booked, pickup, charges */}
        <div className="lg:col-span-3 space-y-5">
          <Card title="What you booked" icon={<ClipboardCheck className="w-4 h-4 text-ink" />}>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Racket</dt>
                <dd className="font-semibold text-slate-900">
                  {request.batBrand} {request.batModel}
                </dd>
                {request.batType && <dd className="text-xs text-slate-500">{request.batType}</dd>}
              </div>
              {isRepair ? (
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Problem</dt>
                  <dd className="font-semibold text-slate-900">{request.repairIssue || '—'}</dd>
                  {request.repairDescription && <dd className="text-xs text-slate-600 mt-0.5 whitespace-pre-line">{request.repairDescription}</dd>}
                </div>
              ) : (
                <>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Package</dt>
                    <dd className="font-semibold text-slate-900">{gettingTierName(request, gettingServices)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">String</dt>
                    <dd className="font-semibold text-slate-900">{request.stringPreference || request.stringType || "Technician's choice"}</dd>
                    {request.colour && <dd className="text-xs text-slate-600">Colour: {request.colour}</dd>}
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tension</dt>
                    <dd className="font-semibold text-slate-900">{request.stringTensionLbs ? `${request.stringTensionLbs} lbs` : '—'}</dd>
                  </div>
                </>
              )}
            </dl>

            {photos.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Your photos</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {photos.map((photo, i) => (
                    <a key={i} href={photo} target="_blank" rel="noreferrer" className="shrink-0">
                      <img src={photo} alt={`Photo ${i + 1} of your racket`} className="w-24 h-24 object-cover rounded-xl border border-line" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card title="Pickup & delivery" icon={<MapPin className="w-4 h-4 text-ink" />}>
            <div className="space-y-2 text-sm">
              <p className="text-slate-800">
                {addressLine || 'Address not recorded'}
                {address?.pincode ? ` – ${address.pincode}` : ''}
              </p>
              {address?.landmark && <p className="text-xs text-slate-500">Landmark: {address.landmark}</p>}
              <p className="text-xs text-slate-500">
                About {request.distanceKm} KM from our shop
                {address?.distanceSource === 'staff'
                  ? ' (corrected by our team)'
                  : address?.distanceSource === 'customer' && !isPaid
                  ? ' (as you entered it — we check it at pickup)'
                  : ''}
              </p>
              <div className="flex items-start gap-2 pt-2 text-slate-800">
                <CalendarDays className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <span>
                  {request.pickupDate ? (
                    <>
                      Pickup on <b>{formatDate(request.pickupDate)}</b>
                      {slot ? <>, <b>{slot}</b></> : null}
                    </>
                  ) : (
                    'Pickup date to be confirmed by our team'
                  )}
                </span>
              </div>
              {notes && (
                <p className="text-xs text-slate-600 bg-paper border border-line/70 rounded-xl p-2.5 whitespace-pre-line">
                  Your note: {notes}
                </p>
              )}
            </div>

            {request.pickupCondition && (
              <div className="mt-4 pt-4 border-t border-line/70 text-sm space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Condition when we collected it</p>
                <p className="font-semibold text-slate-900">{request.pickupCondition.condition}</p>
                {request.pickupCondition.notes && <p className="text-xs text-slate-600">{request.pickupCondition.notes}</p>}
                <p className="text-[11px] text-slate-500">
                  {[request.pickupCondition.collectedBy && `Collected by ${request.pickupCondition.collectedBy}`, request.pickupCondition.collectedAt && formatDateTime(request.pickupCondition.collectedAt)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {pickupPhotos.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pt-1">
                    {pickupPhotos.map((photo, i) => (
                      <img key={i} src={photo} alt={`Pickup photo ${i + 1}`} className="w-20 h-20 object-cover rounded-xl border border-line shrink-0" />
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card title="Charges" icon={<Wallet className="w-4 h-4 text-ink" />}>
            <div className="text-sm divide-y divide-line/70">
              {isRepair ? (
                <Row label={isAwaitingApproval ? 'Repair (estimate)' : 'Repair'}>
                  {declined ? (
                    <span className="text-slate-500">Declined — not charged</span>
                  ) : est ? (
                    formatINR(est.totalEstimate)
                  ) : (
                    <span className="text-amber-700">After inspection</span>
                  )}
                </Row>
              ) : (
                <Row label={gettingTierName(request, gettingServices)}>{formatINR(request.serviceCharge)}</Row>
              )}
              <Row label="Pickup & delivery">
                {request.isFreeDelivery || deliveryCharge === 0 ? (
                  <span className="text-emerald-700">Free (within {distanceConfig.freeRadiusKm} KM)</span>
                ) : (
                  formatINR(deliveryCharge)
                )}
              </Row>
              {declined && declinedRepairFeeOf(request) > 0 && (
                <Row label="Declined-repair fee">{formatINR(declinedRepairFeeOf(request))}</Row>
              )}
              {request.discount > 0 && <Row label="Discount">−{formatINR(request.discount)}</Row>}
              <Row label={isPaid ? 'Total' : 'Total to pay after delivery'} strong>
                {declined
                  ? formatINR(deliveryCharge + declinedRepairFeeOf(request))
                  : repairPriced
                  ? formatINR(request.totalAmount)
                  : `${formatINR(deliveryCharge)} + repair`}
              </Row>
            </div>
            <div
              className={`mt-3 p-3 rounded-2xl text-xs flex items-start gap-2 ${
                isPaid ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' : 'bg-paper border border-line text-slate-700'
              }`}
            >
              <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${isPaid ? 'text-emerald-600' : 'text-slate-400'}`} />
              {isPaid ? (
                <span>
                  Paid{request.paymentRecord ? ` ${formatINR(request.paymentRecord.amount)}` : ''}
                  {request.paymentRecord?.method ? ` by ${request.paymentRecord.method}` : ''}
                  {request.paymentRecord?.collectedAt ? ` on ${formatDate(request.paymentRecord.collectedAt)}` : ''}. Thank you!
                </span>
              ) : request.status === 'Cancelled' ? (
                <span>This request was cancelled — nothing to pay.</span>
              ) : (
                <span>Nothing to pay now. You pay our agent by cash or UPI when your racket is delivered back.</span>
              )}
            </div>
          </Card>
        </div>

        {/* Right: progress, technician, review */}
        <div className="lg:col-span-2 space-y-5">
          <Card title="Progress">
            <RequestProgress request={request} gettingServices={gettingServices} repairCategories={repairCategories} />
          </Card>

          {request.assignedEmployeeName && (
            <section className="bg-white rounded-2xl border border-line p-4 sm:p-5 shadow-2xs flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-paper-deep text-ink flex items-center justify-center shrink-0">
                <User className="w-5 h-5" />
              </span>
              <span>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Handled by</span>
                <span className="block text-sm font-bold text-slate-900">{request.assignedEmployeeName}</span>
              </span>
            </section>
          )}

          {request.status === 'Completed' && (
            <Card title="Your review" icon={<Star className="w-4 h-4 text-amber-500 fill-amber-500" />}>
              {request.review ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1" aria-label={`${request.review.rating} out of 5 stars`}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`w-5 h-5 ${s <= request.review!.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`} />
                    ))}
                    <span className="ml-2 text-sm font-bold text-slate-900">{request.review.rating} / 5</span>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-line">“{request.review.comment}”</p>
                  <p className="text-[11px] text-slate-500">
                    Sent {formatDate(request.review.createdAt)}. Thank you! Reviews are checked by the shop before they appear on our
                    website.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600">How was the {isRepair ? 'repair' : 'stringing'} and the pickup & delivery?</p>
                  <div className="flex items-center gap-1" role="radiogroup" aria-label="Star rating">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        role="radio"
                        aria-checked={reviewRating === star}
                        aria-label={`${star} star${star > 1 ? 's' : ''}`}
                        onClick={() => {
                          setReviewRating(star);
                          setReviewError(null);
                        }}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-amber-50"
                      >
                        <Star className={`w-6 h-6 ${star <= shownRating ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`} />
                      </button>
                    ))}
                    {shownRating > 0 && <span className="text-xs font-bold text-slate-700 ml-1">{shownRating} / 5</span>}
                  </div>
                  <div>
                    <label htmlFor="review-comment" className="block text-xs font-semibold text-slate-700 mb-1">
                      Your comments
                    </label>
                    <textarea
                      id="review-comment"
                      rows={3}
                      maxLength={REVIEW_MAX}
                      value={reviewComment}
                      onChange={(e) => {
                        setReviewComment(e.target.value);
                        if (reviewError) setReviewError(null);
                      }}
                      placeholder="e.g. tension felt right, pickup was on time…"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-ink/40 outline-none"
                    />
                  </div>
                  {reviewError && (
                    <p className="text-xs text-rose-700 flex items-center gap-1.5" role="alert">
                      <AlertCircle className="w-4 h-4 shrink-0" /> {reviewError}
                    </p>
                  )}
                  <Button
                    onClick={handleSubmitReview}
                    variant="primary"
                    size="md"
                    isLoading={reviewSubmitting}
                    disabled={reviewSubmitting}
                    className="w-full min-h-[44px]"
                    leftIcon={<Star className="w-4 h-4" />}
                  >
                    Send review
                  </Button>
                  <p className="text-[11px] text-slate-500">The shop checks reviews before they appear on our website.</p>
                </div>
              )}
            </Card>
          )}

          <section className="rounded-2xl border border-line bg-paper p-4 text-xs text-slate-600 flex items-center gap-3">
            <Phone className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              Questions about this request? Call{' '}
              <a href={telHref(shop.phone)} className="font-bold text-ink underline whitespace-nowrap">
                {phoneDisplay(shop.phone)}
              </a>{' '}
              and quote <span className="font-mono font-bold">{request.id}</span>.
            </span>
          </section>
        </div>
      </div>
    </div>
  );
};
