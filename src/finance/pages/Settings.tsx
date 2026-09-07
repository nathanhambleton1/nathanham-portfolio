// Settings - every assumption the app uses. Ported from templates/settings.html.
//
// The whole point of this page is that no recommendation input is hidden in the
// source. Anything the planning math reads is editable here.

import { useState } from "react";
import { Link } from "react-router-dom";
import PageFrame from "../components/PageFrame";
import { Button, Field, FormActions, PageHead, SectionHead, Tag } from "../components/ui";
import { useAction } from "../lib/actions";
import { createRecurringExpense, removeRecurringExpense, saveSetting, ValidationError } from "../lib/mutations";
import { currentAccountBalances, projectedInterest } from "../lib/finance";
import { getTaxRules } from "../lib/taxRules";
import { updateRow, T } from "../lib/db";
import { dec, fmtMoney, toNumeric, ZERO } from "../lib/money";
import { APP_VERSION } from "../lib/version";
import { FREQUENCIES, type Frequency, type RecurringExpense } from "../lib/types";

/** Frequencies the settings page allows, including the escape hatch. */
const SETTING_FREQUENCIES = [...FREQUENCIES, "custom"] as const;

const BLANK_EXPENSE = { name: "", amount: "", frequency: "monthly" };

/** Percentage-ish settings are capped, matching validate_named_setting. */
function validateSetting(key: string, value: string, valueType: string): void {
  if (valueType === "boolean" || valueType === "string") return;

  if (valueType === "date") {
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new ValidationError(`${key} must be a date.`);
    }
    return;
  }

  const parsed = dec(value || "0");
  if (!parsed.isFinite()) throw new ValidationError(`${key} must be a number.`);
  if (parsed.lessThan(0)) throw new ValidationError(`${key} cannot be negative.`);
  if ((key.includes("percent") || key.endsWith("_apy")) && parsed.greaterThan(100)) {
    throw new ValidationError("Percentage settings cannot exceed 100.");
  }
}

function inputType(valueType: string): string {
  if (valueType === "string") return "text";
  if (valueType === "date") return "date";
  return "number";
}

export default function SettingsPage() {
  const action = useAction();
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [expenseDrafts, setExpenseDrafts] = useState<
    Record<number, { amount: string; frequency: string; is_active: boolean }>
  >({});
  const [newExpense, setNewExpense] = useState(BLANK_EXPENSE);

  return (
    <PageFrame title="Settings" message={action.message} error={action.error}>
      {(data) => {
        const settings = [...data.settingRows].sort((a, b) => {
          const byCategory = a.category.localeCompare(b.category);
          return byCategory !== 0 ? byCategory : a.id - b.id;
        });
        const expenses = [...data.recurringExpenses].sort(
          (a, b) => (a.due_day ?? 99) - (b.due_day ?? 99),
        );

        const current = values ?? Object.fromEntries(settings.map((row) => [row.key, row.value]));
        const draftFor = (expense: RecurringExpense) =>
          expenseDrafts[expense.id] ?? {
            amount: String(expense.amount),
            frequency: expense.frequency,
            is_active: expense.is_active,
          };

        const balances = currentAccountBalances(data);
        const savingsAccount = data.accounts.find((row) => row.account_type === "savings");
        const projected = projectedInterest(
          savingsAccount ? (balances.get(savingsAccount.id) ?? ZERO) : ZERO,
          dec(current.savings_apy ?? "0"),
        );

        const saveAll = async (event: React.FormEvent) => {
          event.preventDefault();
          await action.run(async (live) => {
            for (const row of live.settingRows) {
              const raw = (current[row.key] ?? row.value).trim();
              validateSetting(row.key, raw, row.value_type);
            }
            // A tax year with no configured tables would break the Taxes page
            // on its next load, so it is rejected here rather than there.
            getTaxRules(
              Number(current.tax_year ?? "2026"),
              current.filing_status ?? "single",
            );

            for (const row of live.settingRows) {
              const raw = (current[row.key] ?? row.value).trim();
              if (raw !== row.value) await saveSetting(live, row.key, raw);
            }

            for (const expense of live.recurringExpenses) {
              const draft = expenseDrafts[expense.id];
              if (!draft) continue;
              if (!(SETTING_FREQUENCIES as readonly string[]).includes(draft.frequency)) {
                throw new ValidationError(`Choose a valid frequency for ${expense.name}.`);
              }
              const updated = await updateRow<RecurringExpense>(T.recurringExpenses, expense.id, {
                amount: toNumeric(dec(draft.amount || "0")),
                frequency: draft.frequency,
                is_active: draft.is_active,
              });
              Object.assign(expense, updated);
            }

            setValues(null);
            setExpenseDrafts({});
            return "Assumptions saved.";
          });
        };

        const addExpense = async (event: React.FormEvent) => {
          event.preventDefault();
          await action.run(async (live) => {
            const name = newExpense.name.trim();
            if (live.recurringExpenses.some((row) => row.name === name)) {
              throw new ValidationError("An obligation with that name already exists.");
            }
            const message = await createRecurringExpense(live, {
              name,
              amount: newExpense.amount,
              frequency: newExpense.frequency as Frequency,
            });
            setNewExpense(BLANK_EXPENSE);
            return message;
          });
        };

        return (
          <>
            <PageHead
              eyebrow="Your assumptions"
              title="Settings"
              subtitle="Every recommendation input is editable here — nothing requires a source-code change."
              actions={
                <>
                  <Link className="button secondary" to="/finance/setup?rerun=1">
                    Rerun Setup
                  </Link>
                  <Link className="button" to="/finance/settings/data">
                    Data &amp; Backup
                  </Link>
                </>
              }
            />

            <div className="principle-banner">
              <div className="principle-icon">✓</div>
              <div>
                <strong>Rerunning setup preserves your data</strong>
                <span>
                  Existing accounts, transactions, imports, and history are updated only when you
                  explicitly edit them.
                </span>
              </div>
              <Tag tone="gold">Non-destructive</Tag>
            </div>

            <form onSubmit={saveAll}>
              <section className="card card-pad settings-section">
                <SectionHead
                  title="Targets & planning assumptions"
                  caption="Recommended baselines and your chosen targets stay visibly distinct"
                  aside={<Tag tone="gold">Projected annual interest {fmtMoney(projected)}</Tag>}
                />
                {settings.map((setting) => (
                  <div className="setting-row" key={setting.key}>
                    <div className="setting-copy">
                      <strong>{setting.label}</strong>
                      <span>{setting.description}</span>
                      <small className="muted">{setting.category}</small>
                    </div>
                    <div className="field">
                      {setting.value_type === "boolean" ? (
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={current[setting.key] === "true"}
                            onChange={(event) =>
                              setValues({
                                ...current,
                                [setting.key]: event.target.checked ? "true" : "false",
                              })
                            }
                          />
                          Enabled
                        </label>
                      ) : (
                        <Field label="Value">
                          <input
                            type={inputType(setting.value_type)}
                            min={["decimal", "money", "integer"].includes(setting.value_type) ? "0" : undefined}
                            step={
                              setting.value_type === "integer"
                                ? "1"
                                : ["decimal", "money"].includes(setting.value_type)
                                  ? "0.01"
                                  : undefined
                            }
                            value={current[setting.key] ?? ""}
                            onChange={(event) =>
                              setValues({ ...current, [setting.key]: event.target.value })
                            }
                          />
                        </Field>
                      )}
                    </div>
                  </div>
                ))}
              </section>

              <section className="card card-pad settings-section">
                <SectionHead
                  title="Recurring expenses"
                  caption="Amounts keep their real frequency; annual costs are not recorded as fake monthly spending"
                />
                {expenses.map((expense) => {
                  const draft = draftFor(expense);
                  const setDraft = (patch: Partial<typeof draft>) =>
                    setExpenseDrafts((state) => ({
                      ...state,
                      [expense.id]: { ...draft, ...patch },
                    }));

                  return (
                    <div className="setting-row" key={expense.id}>
                      <div className="setting-copy">
                        <strong>{expense.name}</strong>
                        <span>
                          Due day {expense.due_day ?? "—"} ·{" "}
                          {expense.is_variable ? "Variable budget" : "Fixed amount"}
                        </span>
                        <label className="checkbox" style={{ marginTop: 7 }}>
                          <input
                            type="checkbox"
                            checked={draft.is_active}
                            onChange={(event) => setDraft({ is_active: event.target.checked })}
                          />
                          Active
                        </label>
                      </div>
                      <div className="form-grid">
                        <Field label="Amount">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.amount}
                            onChange={(event) => setDraft({ amount: event.target.value })}
                          />
                        </Field>
                        <Field label="Frequency">
                          <select
                            value={draft.frequency}
                            onChange={(event) => setDraft({ frequency: event.target.value })}
                          >
                            {SETTING_FREQUENCIES.map((frequency) => (
                              <option key={frequency} value={frequency}>
                                {frequency.charAt(0).toUpperCase() + frequency.slice(1)}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Button
                          variant="secondary"
                          small
                          disabled={action.busy}
                          onClick={() => {
                            if (!window.confirm(`Delete the "${expense.name}" obligation?`)) return;
                            void action.run((live) => removeRecurringExpense(live, expense.id));
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {expenses.length === 0 && <p className="muted">No recurring obligations yet.</p>}
              </section>

              <FormActions>
                <Button type="submit" disabled={action.busy}>
                  Save all settings
                </Button>
              </FormActions>
            </form>

            <section className="card card-pad settings-section">
              <SectionHead
                title="Add obligation"
                caption="Create another recurring cost without editing code"
              />
              <form onSubmit={addExpense}>
                <div className="form-grid three">
                  <Field label="Name">
                    <input
                      maxLength={100}
                      value={newExpense.name}
                      onChange={(event) => setNewExpense({ ...newExpense, name: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Amount">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newExpense.amount}
                      onChange={(event) =>
                        setNewExpense({ ...newExpense, amount: event.target.value })
                      }
                      required
                    />
                  </Field>
                  <Field label="Frequency">
                    <select
                      value={newExpense.frequency}
                      onChange={(event) =>
                        setNewExpense({ ...newExpense, frequency: event.target.value })
                      }
                    >
                      {SETTING_FREQUENCIES.map((frequency) => (
                        <option key={frequency} value={frequency}>
                          {frequency.charAt(0).toUpperCase() + frequency.slice(1)}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <FormActions>
                  <Button variant="secondary" type="submit" disabled={action.busy}>
                    Add expense
                  </Button>
                </FormActions>
              </form>
            </section>

            <section className="card card-pad settings-section">
              <SectionHead
                title="About NexaFi"
                caption="Track Today. Build Tomorrow."
                aside={<Tag>v{APP_VERSION}</Tag>}
              />
              <p className="muted">
                NexaFi is a personal financial-planning application. Estimates are educational and
                are not professional tax, legal, investment, or accounting advice.
              </p>
            </section>
          </>
        );
      }}
    </PageFrame>
  );
}
