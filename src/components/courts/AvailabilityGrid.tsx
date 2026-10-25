import React from 'react';
import { Check } from 'lucide-react';
import type { AvailabilityCell, CourtAvailability, VenueAvailability } from '../../types/courts';
import { cx } from '../public/home/ui';
import { formatPrice, formatTime, formatTimeRange } from './courtFormat';

export interface SlotSelection {
  courtId: string;
  /** Inclusive indexes into the court's `cells`. */
  start: number;
  end: number;
}

interface Props {
  availability: VenueAvailability;
  selection: SlotSelection | null;
  onTap: (court: CourtAvailability, index: number) => void;
  /** Court shown on phones (one court at a time). */
  phoneCourtId: string;
  onPhoneCourtChange: (courtId: string) => void;
  busy?: boolean;
}

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sportsBlue';

const stateText = (cell: AvailabilityCell, selected: boolean) =>
  selected ? 'selected' : cell.state === 'free' ? `${formatPrice(cell.price)}, available` : cell.state === 'past' ? 'time has passed' : 'not available';

/**
 * Times × courts. Wide screens: a table (rows = times, columns = courts). Phones: a court switcher
 * and the list of times for that court. Who booked a slot is never shown — only "Not available".
 */
export const AvailabilityGrid: React.FC<Props> = ({ availability, selection, onTap, phoneCourtId, onPhoneCourtChange, busy }) => {
  const courts = availability.courts;
  const rowCount = courts[0]?.cells.length || 0;
  // Leading rows where every court's time has passed are folded into one line.
  let firstOpenRow = 0;
  while (firstOpenRow < rowCount && courts.every((c) => c.cells[firstOpenRow]?.state === 'past')) firstOpenRow++;
  const rows = Array.from({ length: rowCount - firstOpenRow }, (_, i) => i + firstOpenRow);
  const isSelected = (courtId: string, i: number) => !!selection && selection.courtId === courtId && i >= selection.start && i <= selection.end;
  const phoneCourt = courts.find((c) => c.courtId === phoneCourtId) || courts[0];

  const passedNote =
    firstOpenRow > 0 && firstOpenRow < rowCount ? (
      <p className="text-[14px] text-ink-muted">Times before {formatTime(courts[0].cells[firstOpenRow].start)} have passed.</p>
    ) : null;

  if (rowCount === 0 || firstOpenRow >= rowCount) {
    return (
      <div className="rounded-xl border border-line bg-paper px-5 py-6 text-[15px] text-ink-soft">
        {rowCount === 0 ? 'No times are open on this day.' : "Today's times have all passed. Choose another day."}
      </div>
    );
  }

  return (
    <div className={cx('transition-opacity', busy && 'pointer-events-none opacity-60')} aria-busy={busy || undefined}>
      {/* Legend */}
      <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink-muted" aria-label="Key">
        <li className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="h-4 w-4 rounded border border-ink/25 bg-white" />
          Free — tap to choose
        </li>
        <li className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="h-4 w-4 rounded bg-ink" />
          Your choice
        </li>
        <li className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="h-4 w-4 rounded bg-paper-deep" />
          Not available
        </li>
      </ul>

      {/* Wide screens: table */}
      <div className="hidden md:block">
        {passedNote && <div className="mb-3">{passedNote}</div>}
        <table className="w-full table-fixed border-separate border-spacing-x-2 border-spacing-y-1.5 -mx-2">
          <caption className="sr-only">Court times. Free times can be chosen.</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[150px] px-2 pb-1 text-left text-[13px] font-semibold text-ink-muted">
                Time
              </th>
              {courts.map((c) => (
                <th key={c.courtId} scope="col" className="px-1 pb-1 text-left align-bottom">
                  <span className="block text-[15px] font-semibold text-ink">{c.courtName}</span>
                  {c.surface && <span className="block text-[12px] font-normal text-ink-muted">{c.surface}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const cell0 = courts[0].cells[i];
              return (
                <tr key={i}>
                  <th scope="row" className="whitespace-nowrap px-2 text-left text-[14px] font-medium tabular-nums text-ink-soft">
                    {formatTimeRange(cell0.start, cell0.end)}
                  </th>
                  {courts.map((c) => {
                    const cell = c.cells[i];
                    return (
                      <td key={c.courtId} className="p-0">
                        {cell && <SlotButton court={c} cell={cell} selected={isSelected(c.courtId, i)} onTap={() => onTap(c, i)} />}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phones: one court at a time */}
      <div className="md:hidden">
        {courts.length > 1 && (
          <div role="group" aria-label="Court" className="mb-4 grid gap-1 rounded-xl bg-paper-deep p-1" style={{ gridTemplateColumns: `repeat(${Math.min(courts.length, 4)}, minmax(0, 1fr))` }}>
            {courts.map((c) => {
              const active = c.courtId === phoneCourt.courtId;
              const hasSelection = selection?.courtId === c.courtId;
              return (
                <button
                  key={c.courtId}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onPhoneCourtChange(c.courtId)}
                  className={cx(
                    'relative min-h-[44px] truncate rounded-lg px-2 text-[15px] font-semibold transition-colors',
                    focusRing,
                    active ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink',
                  )}
                >
                  {c.courtName}
                  {hasSelection && !active && <span aria-label="(your choice)" className="ml-1.5 inline-block h-2 w-2 rounded-full bg-accent align-middle" />}
                </button>
              );
            })}
          </div>
        )}
        {courts.length === 1 && (
          <p className="mb-3 text-[15px] font-semibold text-ink">
            {phoneCourt.courtName}
            {phoneCourt.surface && <span className="font-normal text-ink-muted"> · {phoneCourt.surface}</span>}
          </p>
        )}
        {courts.length > 1 && phoneCourt.surface && <p className="-mt-2 mb-3 text-[13px] text-ink-muted">{phoneCourt.courtName}: {phoneCourt.surface}</p>}
        {passedNote && <div className="mb-3">{passedNote}</div>}
        <ul className="space-y-1.5" aria-label={`${phoneCourt.courtName} times`}>
          {rows.map((i) => {
            const cell = phoneCourt.cells[i];
            if (!cell) return null;
            const selected = isSelected(phoneCourt.courtId, i);
            const free = cell.state === 'free';
            return (
              <li key={i}>
                <button
                  type="button"
                  disabled={!free && !selected}
                  onClick={() => onTap(phoneCourt, i)}
                  aria-pressed={free || selected ? selected : undefined}
                  aria-label={`${formatTimeRange(cell.start, cell.end)}, ${stateText(cell, selected)}`}
                  className={cx(
                    'flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl border px-4 text-left text-[15px] transition-colors',
                    focusRing,
                    selected
                      ? 'border-ink bg-ink text-white'
                      : free
                        ? 'border-line bg-white text-ink hover:border-ink/40'
                        : cell.state === 'past'
                          ? 'border-transparent bg-transparent text-ink-muted/60'
                          : 'border-transparent bg-paper-deep text-ink-muted',
                  )}
                >
                  <span className="font-medium tabular-nums">{formatTimeRange(cell.start, cell.end)}</span>
                  <span className={cx('inline-flex items-center gap-1.5 text-[14px]', (free || selected) && 'font-semibold tabular-nums')}>
                    {selected && <Check className="h-4 w-4" aria-hidden="true" />}
                    {free || selected ? formatPrice(cell.price) : cell.state === 'past' ? 'Passed' : 'Not available'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

const SlotButton: React.FC<{ court: CourtAvailability; cell: AvailabilityCell; selected: boolean; onTap: () => void }> = ({
  court,
  cell,
  selected,
  onTap,
}) => {
  const free = cell.state === 'free';
  return (
    <button
      type="button"
      disabled={!free && !selected}
      onClick={onTap}
      aria-pressed={free || selected ? selected : undefined}
      aria-label={`${court.courtName}, ${formatTimeRange(cell.start, cell.end)}, ${stateText(cell, selected)}`}
      className={cx(
        'flex h-11 w-full items-center justify-between gap-2 rounded-lg border px-3 text-[14px] transition-colors',
        focusRing,
        selected
          ? 'border-ink bg-ink text-white'
          : free
            ? 'border-ink/15 bg-white text-ink hover:border-ink/50 hover:bg-paper'
            : cell.state === 'past'
              ? 'cursor-default border-transparent bg-transparent text-ink-muted/50'
              : 'cursor-default border-transparent bg-paper-deep text-ink-muted',
      )}
    >
      {free || selected ? (
        <>
          <span className="font-semibold tabular-nums">{formatPrice(cell.price)}</span>
          {selected ? <Check className="h-4 w-4" aria-hidden="true" /> : <span className="text-[12px] text-ink-muted">Free</span>}
        </>
      ) : (
        <span className="truncate">{cell.state === 'past' ? 'Passed' : 'Not available'}</span>
      )}
    </button>
  );
};
