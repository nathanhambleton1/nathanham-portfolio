// PTO — the calendar, and the plan behind the balance.
//
// Paychecks already carries the real ledger: what accrued, what payroll says
// you used, and the year-end projection (see ptoState in lib/paychecks.ts).
// What that page can't show is a vacation you're only thinking about, or which
// upcoming Monday is actually a holiday. This page adds both: a month grid
// with federal holidays marked, planned time off logged against it, and — for
// any day you click — what the balance will be once you get there.

import { useState } from "react";
import PageFrame from "../components/PageFrame";
import {
  Advisory, Button, Card, Field, FormActions, Metric, Modal, PageHead, SectionHead, Tag,
} from "../components/ui";
import { useAction } from "../lib/actions";
import { createPtoEntry, removePtoEntry, updatePtoEntry } from "../lib/mutations";
import { ptoState } from "../lib/paychecks";
import {
  BALANCE_EXEMPT_LEAVE_TYPES, entriesOn, entryHours, flexMakeupPerDay, FLEX_MAX_HOURS_PER_DAY,
  FLEX_MAX_HOURS_PER_PERIOD, payPeriodContaining, payPeriodStartsInRange, periodAccrual,
  ptoAvailableDatesInRange, projectedBalance,
} from "../lib/ptoCalendar";
import { holidaysForYears, isWeekend } from "../lib/holidays";
import {
  addDays, addMonths, daysInMonth, fmtDate, fmtLongDay, fmtMonth, parts, planMonthOf,
  toISO, todayISO, weekdayOf, yearOf, type ISODate,
} from "../lib/dates";
import { dec, ZERO } from "../lib/money";
import { PTO_LEAVE_TYPES, PTO_LEAVE_TYPE_LABELS } from "../lib/types";
import type { PtoEntry } from "../lib/types";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Stable colours, reused from Savings so an entry's color means the same thing everywhere. */
const LEAVE_TYPE_COLORS: Record<string, string> = {
  vacation: "#4d7c6f",
  sick: "#a35d4a",
  flex: "#4a6f8a",
  paid_holiday: "#b98d3e",
  unpaid: "#8f8e87",
};

const BLANK_ENTRY = {
  start_date: todayISO(),
  end_date: todayISO(),
  hours_per_day: "8",
  leave_type: "vacation",
  notes: "",
};

/** The 6-week grid a month calendar draws, including the days it borrows from its neighbors. */
function buildCalendarCells(monthStart: ISODate): ISODate[] {
  const { year, month } = parts(monthStart);
  const start = addDays(monthStart, -weekdayOf(monthStart));
  const lastOfMonth = toISO(year, month, daysInMonth(year, month));
  const end = addDays(lastOfMonth, 6 - weekdayOf(lastOfMonth));
  const cells: ISODate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) cells.push(d);
  return cells;
}

export default function Pto() {
  const action = useAction();
  const [cursor, setCursor] = useState(planMonthOf(todayISO()));
  const [selected, setSelected] = useState(todayISO());
  const [modal, setModal] = useState<{ mode: "add" | "edit"; entry?: PtoEntry } | null>(null);
  const [draft, setDraft] = useState(BLANK_ENTRY);

  return (
    <PageFrame title="PTO" message={action.message} error={action.error}>
      {(data) => {
        const today = todayISO();
        const settings = data.settings;
        const pto = ptoState(data, settings, yearOf(today));
        const entries = [...data.ptoEntries].sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
        const upcoming = entries.filter((entry) => entry.end_date >= today);
        const past = [...entries.filter((entry) => entry.end_date < today)].reverse();
        // Flex doesn't draw from the bank — it's made up as extra work — so it's
        // left out of what "planned ahead" means here.
        const plannedPto = upcoming.filter((entry) => !BALANCE_EXEMPT_LEAVE_TYPES.has(entry.leave_type));
        const plannedHours = plannedPto.reduce((total, entry) => total.plus(entryHours(entry)), ZERO);
        const configured = Boolean(settings.paycheck_schedule_start) && dec(settings.annual_pto_hours ?? "0").greaterThan(0);

        const cells = buildCalendarCells(cursor);
        const holidayMap = holidaysForYears(cells.map((date) => yearOf(date)));
        const payPeriodStarts = payPeriodStartsInRange(settings, cells[0], cells[cells.length - 1]);
        const ptoAvailableDates = ptoAvailableDatesInRange(settings, cells[0], cells[cells.length - 1]);

        // Flex owed is spread per pay period, so gather every distinct period the
        // visible grid touches and merge each one's make-up days into one map.
        const makeupByDate = new Map<ISODate, ReturnType<typeof entryHours>>();
        const periodsSeen = new Set<ISODate>();
        for (const date of cells) {
          const bounds = payPeriodContaining(settings, date);
          if (!bounds || periodsSeen.has(bounds.start)) continue;
          periodsSeen.add(bounds.start);
          for (const [day, hours] of flexMakeupPerDay(entries, bounds.start, bounds.end)) {
            makeupByDate.set(day, hours);
          }
        }

        const selectedHoliday = holidayMap.get(selected) ?? null;
        const selectedEntries = entriesOn(entries, selected);
        const selectedBalance = projectedBalance(pto.current, entries, settings, selected, today);
        const selectedPaidHoliday = selectedEntries.find((entry) => entry.leave_type === "paid_holiday") ?? null;

        const openAdd = (startDate: ISODate) => {
          setDraft({ ...BLANK_ENTRY, start_date: startDate, end_date: startDate });
          setModal({ mode: "add" });
        };
        const openEdit = (entry: PtoEntry) => {
          setDraft({
            start_date: entry.start_date,
            end_date: entry.end_date,
            hours_per_day: dec(entry.hours_per_day).toFixed(2),
            leave_type: entry.leave_type,
            notes: entry.notes ?? "",
          });
          setModal({ mode: "edit", entry });
        };
        const closeModal = () => setModal(null);

        const submit = async (event: React.FormEvent) => {
          event.preventDefault();
          await action.run(async (current) => {
            const message =
              modal?.mode === "edit" && modal.entry
                ? await updatePtoEntry(current, modal.entry.id, draft)
                : await createPtoEntry(current, draft);
            closeModal();
            return message;
          });
        };

        const remove = (entry: PtoEntry) => action.run((current) => removePtoEntry(current, entry.id));

        const markHolidayPaid = () => {
          if (!selectedHoliday) return;
          void action.run((current) =>
            createPtoEntry(current, {
              start_date: selected,
              end_date: selected,
              hours_per_day: "8",
              leave_type: "paid_holiday",
              notes: selectedHoliday,
            }),
          );
        };

        const renderEntryRow = (entry: PtoEntry) => {
          const bounds = ["flex", "unpaid"].includes(entry.leave_type) ? payPeriodContaining(settings, entry.start_date) : null;
          const periodMakeup = bounds && entry.leave_type === "flex" ? flexMakeupPerDay(entries, bounds.start, bounds.end) : null;
          const makeupPerDay = periodMakeup && periodMakeup.size > 0 ? [...periodMakeup.values()][0] : null;
          const accrualCut =
            bounds && entry.leave_type === "unpaid"
              ? pto.accrual.minus(
                  periodAccrual(entries, pto.accrual, dec(settings.regular_hours_per_period ?? "80"), bounds.start, bounds.end),
                )
              : null;

          return (
            <div className="plan-row" key={entry.id}>
              <div className="plan-row-label">
                <strong>{PTO_LEAVE_TYPE_LABELS[entry.leave_type]}</strong>
                <span className="flow-note">
                  {entry.start_date === entry.end_date
                    ? fmtDate(entry.start_date)
                    : `${fmtDate(entry.start_date)} – ${fmtDate(entry.end_date)}`}
                  {" · "}
                  {entryHours(entry).toFixed(2)} hrs
                  {entry.notes ? ` · ${entry.notes}` : ""}
                  {makeupPerDay &&
                    ` · period owes +${makeupPerDay.toFixed(2)} hrs/day across ${periodMakeup!.size} other workday${periodMakeup!.size === 1 ? "" : "s"}`}
                  {accrualCut &&
                    accrualCut.greaterThan(0) &&
                    ` · cuts this period's accrual by ${accrualCut.toFixed(2)} hrs`}
                </span>
              </div>
              <div className="button-row">
                <Button variant="secondary" small onClick={() => openEdit(entry)}>
                  Edit
                </Button>
                <Button variant="secondary" small onClick={() => remove(entry)} disabled={action.busy}>
                  Delete
                </Button>
              </div>
            </div>
          );
        };

        return (
          <>
            <PageHead
              eyebrow="Time off"
              title="PTO"
              subtitle="Where your paid time off stands, which holidays fall where, and what a planned vacation will cost you."
              actions={<Button onClick={() => openAdd(selected)}>+ Log PTO</Button>}
            />

            {!configured && (
              <Advisory style={{ marginBottom: 18 }}>
                Balance projections need your PTO accrual configured — set the annual PTO hours and pay
                schedule start on Settings. Today&rsquo;s balance and logged entries still work without it.
              </Advisory>
            )}

            <section className="grid metrics">
              <Metric
                label="Current balance"
                value={`${pto.current.toFixed(2)} hrs`}
                note={`Projected year-end ${pto.projected.toFixed(2)} hrs`}
              />
              <Metric label="Accrual" value={`${pto.accrual.toFixed(2)} hrs`} note="Per paycheck" />
              <Metric
                label="Planned ahead"
                value={`${plannedHours.toFixed(2)} hrs`}
                note={`Across ${plannedPto.length} logged entr${plannedPto.length === 1 ? "y" : "ies"} · flex, paid holidays & unpaid excluded`}
              />
              <Metric
                label={selected === today ? "Balance today" : `Balance on ${fmtDate(selected)}`}
                value={`${selectedBalance.toFixed(2)} hrs`}
                note={selected > today ? "Projected" : "Current"}
              />
            </section>

            <div className="pto-layout">
              <Card>
                <div className="calendar-nav">
                  <Button variant="secondary" small onClick={() => setCursor(addMonths(cursor, -1))}>
                    ← Prev
                  </Button>
                  <h2>{fmtMonth(cursor)}</h2>
                  <div className="button-row">
                    <Button
                      variant="secondary"
                      small
                      onClick={() => {
                        setCursor(planMonthOf(today));
                        setSelected(today);
                      }}
                    >
                      Today
                    </Button>
                    <Button variant="secondary" small onClick={() => setCursor(addMonths(cursor, 1))}>
                      Next →
                    </Button>
                  </div>
                </div>

                <div className="calendar-grid">
                  {WEEKDAY_LABELS.map((label) => (
                    <div className="calendar-weekday" key={label}>
                      {label}
                    </div>
                  ))}
                  {cells.map((date) => {
                    const outside = parts(date).month !== parts(cursor).month;
                    const holidayName = holidayMap.get(date);
                    const dayEntries = entriesOn(entries, date);
                    const classes = [
                      "calendar-day",
                      outside && "outside",
                      isWeekend(date) && "weekend",
                      date === today && "today",
                      date === selected && "selected",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <button type="button" key={date} className={classes} onClick={() => setSelected(date)}>
                        {payPeriodStarts.has(date) && (
                          <span className="calendar-payday-mark" title="Pay period starts">
                            $
                          </span>
                        )}
                        {ptoAvailableDates.has(date) && (
                          <span className="calendar-pto-mark" title="PTO from this period becomes available">
                            +
                          </span>
                        )}
                        <span className="calendar-day-num">{parts(date).day}</span>
                        {holidayName && (
                          <span className="calendar-holiday" title={holidayName}>
                            {holidayName}
                          </span>
                        )}
                        {dayEntries.slice(0, 2).map((entry) => (
                          <span
                            key={entry.id}
                            className="calendar-entry"
                            style={{ background: LEAVE_TYPE_COLORS[entry.leave_type] }}
                            title={`${PTO_LEAVE_TYPE_LABELS[entry.leave_type]}${entry.notes ? ` · ${entry.notes}` : ""}`}
                          >
                            {PTO_LEAVE_TYPE_LABELS[entry.leave_type]}
                          </span>
                        ))}
                        {dayEntries.length > 2 && <span className="calendar-more">+{dayEntries.length - 2} more</span>}
                        {makeupByDate.has(date) && (
                          <span className="calendar-makeup" title="Extra time owed this day to make up flexed hours">
                            +{makeupByDate.get(date)!.toFixed(2)}h owed
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="pto-legend">
                  {PTO_LEAVE_TYPES.map((type) => (
                    <span key={type}>
                      <i style={{ background: LEAVE_TYPE_COLORS[type] }} />
                      {PTO_LEAVE_TYPE_LABELS[type]}
                    </span>
                  ))}
                  <span>
                    <i className="holiday-dot" />
                    Federal holiday
                  </span>
                  <span>
                    <i style={{ background: "var(--ink)" }} />
                    Pay period starts
                  </span>
                  <span>
                    <i style={{ background: "var(--gold)" }} />
                    PTO becomes available
                  </span>
                  <span>
                    <i className="makeup-dot" />
                    Extra time owed (flex make-up)
                  </span>
                </div>
              </Card>

              <Card>
                <SectionHead
                  title={fmtDate(selected)}
                  caption={[
                    fmtLongDay(selected).split(",")[0],
                    selectedHoliday,
                    isWeekend(selected) && !selectedHoliday ? "Weekend" : null,
                    payPeriodStarts.has(selected) ? "Pay period starts" : null,
                    ptoAvailableDates.has(selected) ? "PTO becomes available" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
                <div className="day-detail-value">{selectedBalance.toFixed(2)} hrs</div>
                <div className="day-detail-sub">
                  {selected > today ? "Projected balance" : "Current balance"} as of this date
                </div>
                {makeupByDate.has(selected) && (
                  <div className="day-detail-sub" style={{ marginTop: 4, color: "#8a682d" }}>
                    +{makeupByDate.get(selected)!.toFixed(2)} hrs extra owed this day (flex make-up)
                  </div>
                )}

                {selectedEntries.length > 0 ? (
                  <div className="plan-rows" style={{ marginTop: 16 }}>
                    {selectedEntries.map(renderEntryRow)}
                  </div>
                ) : (
                  <p className="empty">Nothing logged on this day.</p>
                )}

                {selectedHoliday && !selectedPaidHoliday && (
                  <Button
                    variant="secondary"
                    style={{ marginTop: 16, width: "100%" }}
                    onClick={markHolidayPaid}
                    disabled={action.busy}
                  >
                    Mark {selectedHoliday} as paid holiday
                  </Button>
                )}

                <Button
                  variant="secondary"
                  style={{ marginTop: 16, width: "100%" }}
                  onClick={() => openAdd(selected)}
                >
                  + Log PTO starting here
                </Button>
              </Card>
            </div>

            <Card>
              <SectionHead
                title="Logged time off"
                caption="Everything you've recorded, upcoming first"
                aside={<Tag tone="gold">{entries.length}</Tag>}
              />
              {entries.length === 0 ? (
                <p className="empty">No PTO logged yet.</p>
              ) : (
                <div className="plan-rows">{[...upcoming, ...past].map(renderEntryRow)}</div>
              )}
            </Card>

            <Modal
              open={Boolean(modal)}
              onClose={closeModal}
              eyebrow="Time off"
              title={modal?.mode === "edit" ? "Edit logged PTO" : "Log PTO"}
            >
              <form onSubmit={submit}>
                <div className="form-grid">
                  <Field label="Starts">
                    <input
                      type="date"
                      value={draft.start_date}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          start_date: event.target.value,
                          end_date: draft.end_date < event.target.value ? event.target.value : draft.end_date,
                        })
                      }
                      required
                    />
                  </Field>
                  <Field label="Ends">
                    <input
                      type="date"
                      min={draft.start_date}
                      value={draft.end_date}
                      onChange={(event) => setDraft({ ...draft, end_date: event.target.value })}
                      required
                    />
                  </Field>
                  <Field
                    label="Hours per day"
                    hint={
                      draft.leave_type === "flex"
                        ? `Up to ${FLEX_MAX_HOURS_PER_DAY} hrs, made up as extra work the same pay period.`
                        : undefined
                    }
                  >
                    <input
                      type="number"
                      min="0.25"
                      step="0.25"
                      max={draft.leave_type === "flex" ? FLEX_MAX_HOURS_PER_DAY : undefined}
                      value={draft.hours_per_day}
                      onChange={(event) => setDraft({ ...draft, hours_per_day: event.target.value })}
                      required
                    />
                  </Field>
                  <Field
                    label="Type"
                    hint={draft.leave_type === "flex" ? `Max ${FLEX_MAX_HOURS_PER_PERIOD} hrs flexed per pay period.` : undefined}
                  >
                    <select
                      value={draft.leave_type}
                      onChange={(event) => setDraft({ ...draft, leave_type: event.target.value })}
                    >
                      {PTO_LEAVE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {PTO_LEAVE_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Notes (optional)" full>
                    <input
                      value={draft.notes}
                      onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                    />
                  </Field>
                </div>
                <FormActions>
                  <Button variant="secondary" onClick={closeModal}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={action.busy}>
                    {modal?.mode === "edit" ? "Save" : "Log it"}
                  </Button>
                </FormActions>
              </form>
            </Modal>
          </>
        );
      }}
    </PageFrame>
  );
}
