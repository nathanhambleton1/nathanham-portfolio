// Settings — the assumptions, and nothing else.
//
// This page used to double as a second, worse Bills editor: it listed every
// recurring expense with an amount and a frequency box, alongside the real one.
// Bills has that job now, and having it in one place is the whole point.
//
// What is left is the numbers the math reads — your pay, your tax situation,
// your retirement assumptions — plus the two account choices the money-flow
// engine used to guess at. Those two matter more than they look: they decide
// which account bills are held in and which one savings transfers land in, and
// leaving them to a fallback is how money ends up in the wrong place.

import { useState } from "react";
import PageFrame from "../components/PageFrame";
import { Advisory, Button, Field, FormActions, PageHead, SectionHead, Tag } from "../components/ui";
import { useAction } from "../lib/actions";
import { saveSetting, ValidationError } from "../lib/mutations";
import { checkingAccountId, defaultSavingsAccountId } from "../lib/allocation";
import { getTaxRules } from "../lib/taxRules";
import { dec } from "../lib/money";
import { APP_VERSION } from "../lib/version";
import type { FinanceData } from "../lib/data";
import type { Setting } from "../lib/types";

/** Category key → the heading and one-line explanation it gets. */
const GROUPS: [key: string, title: string, caption: string][] = [
  ["employment", "Your pay", "What payroll assumes when it fills a paycheck in for you"],
  ["cash", "Cash", "Interest and the day your card statement is due"],
  ["retirement", "Retirement", "Contribution rates and the growth the projections assume"],
  ["tax", "Tax", "The year, your filing status, and last year's numbers for the refund estimate"],
  ["targets", "Suggested monthly targets", "What Money Flow pre-fills a bucket with when it has no date to work from"],
];

/** Categories with no reader left in the app — kept in the database, off the page. */
const HIDDEN_CATEGORIES = new Set(["health"]);

/** Percentage-ish settings are capped, matching the original validate_named_setting. */
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

  return (
    <PageFrame title="Settings" message={action.message} error={action.error}>
      {(data) => {
        const rows = data.settingRows.filter((row) => !HIDDEN_CATEGORIES.has(row.category));
        const current =
          values ??
          {
            ...Object.fromEntries(rows.map((row) => [row.key, row.value])),
            // These two have no seeded row, so their starting value is whatever
            // the engine would fall back to — shown, rather than left blank.
            flow_checking_account_id:
              data.settings.flow_checking_account_id ?? String(checkingAccountId(data, data.settings) ?? ""),
            flow_savings_account_id:
              data.settings.flow_savings_account_id ??
              String(defaultSavingsAccountId(data, data.settings) ?? ""),
            auto_allocate_enabled: data.settings.auto_allocate_enabled ?? "true",
          };

        const set = (key: string, value: string) => setValues({ ...current, [key]: value });

        const grouped = GROUPS.map(([key, title, caption]) => ({
          key,
          title,
          caption,
          settings: rows
            .filter((row) => row.category === key)
            .sort((a, b) => a.id - b.id),
        })).filter((group) => group.settings.length > 0);

        // Anything in a category GROUPS does not name still needs somewhere to go,
        // or a setting added by a later version would be invisible and unfixable.
        const named = new Set(GROUPS.map(([key]) => key));
        const other = rows.filter((row) => !named.has(row.category)).sort((a, b) => a.id - b.id);

        const save = async (event: React.FormEvent) => {
          event.preventDefault();
          await action.run(async (live) => {
            for (const row of live.settingRows) {
              if (HIDDEN_CATEGORIES.has(row.category)) continue;
              validateSetting(row.key, (current[row.key] ?? row.value).trim(), row.value_type);
            }
            // A tax year with no configured tables would break the Taxes page on
            // its next load, so it is rejected here rather than there.
            getTaxRules(Number(current.tax_year ?? "2026"), current.filing_status ?? "single");

            for (const row of live.settingRows) {
              if (HIDDEN_CATEGORIES.has(row.category)) continue;
              const raw = (current[row.key] ?? row.value).trim();
              if (raw !== row.value) await saveSetting(live, row.key, raw);
            }

            for (const key of ["flow_checking_account_id", "flow_savings_account_id", "auto_allocate_enabled"]) {
              const raw = (current[key] ?? "").trim();
              if (raw !== (live.settings[key] ?? "")) await saveSetting(live, key, raw);
            }

            setValues(null);
            return "Settings saved.";
          });
        };

        return (
          <>
            <PageHead
              eyebrow="Your assumptions"
              title="Settings"
              subtitle="Every input the math reads. Bills live on the Bills page; buckets live on Savings & Goals."
            />

            <form onSubmit={save}>
              <section className="card card-pad settings-section">
                <SectionHead
                  title="Where the money moves"
                  caption="Which real accounts the money-flow engine reserves from and transfers into"
                />
                <AccountSetting
                  label="Bills are paid from"
                  hint="Money reserved for bills and the card statement stays here."
                  data={data}
                  types={["checking"]}
                  value={current.flow_checking_account_id ?? ""}
                  onChange={(value) => set("flow_checking_account_id", value)}
                />
                <AccountSetting
                  label="Savings transfers land in"
                  hint="Used for any bucket that has no account of its own."
                  data={data}
                  types={["savings", "checking", "taxable_brokerage", "brokerage"]}
                  value={current.flow_savings_account_id ?? ""}
                  onChange={(value) => set("flow_savings_account_id", value)}
                />
                <div className="setting-row">
                  <div className="setting-copy">
                    <strong>Take bills out automatically</strong>
                    <span>
                      When a paycheck lands, reserve the month's bills without being asked. Savings
                      buckets are never automatic — those are always your call in Money Flow.
                    </span>
                  </div>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={current.auto_allocate_enabled !== "false"}
                      onChange={(event) =>
                        set("auto_allocate_enabled", event.target.checked ? "true" : "false")
                      }
                    />
                    Enabled
                  </label>
                </div>
              </section>

              {grouped.map((group) => (
                <section className="card card-pad settings-section" key={group.key}>
                  <SectionHead title={group.title} caption={group.caption} />
                  {group.settings.map((setting) => (
                    <SettingRow
                      key={setting.key}
                      setting={setting}
                      value={current[setting.key] ?? ""}
                      onChange={(value) => set(setting.key, value)}
                    />
                  ))}
                </section>
              ))}

              {other.length > 0 && (
                <section className="card card-pad settings-section">
                  <SectionHead title="Other" caption="Settings without a group of their own" />
                  {other.map((setting) => (
                    <SettingRow
                      key={setting.key}
                      setting={setting}
                      value={current[setting.key] ?? ""}
                      onChange={(value) => set(setting.key, value)}
                    />
                  ))}
                </section>
              )}

              <FormActions>
                <Button type="submit" loading={action.busy}>
                  Save settings
                </Button>
              </FormActions>
            </form>

            <section className="card card-pad settings-section">
              <SectionHead
                title="About NexaFi"
                caption="Track Today. Build Tomorrow."
                aside={<Tag>v{APP_VERSION}</Tag>}
              />
              <Advisory>
                Estimates here are educational and are not professional tax, legal, investment, or
                accounting advice.
              </Advisory>
            </section>
          </>
        );
      }}
    </PageFrame>
  );
}

function SettingRow({
  setting, value, onChange,
}: {
  setting: Setting;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="setting-row">
      <div className="setting-copy">
        <strong>{setting.label}</strong>
        <span>{setting.description}</span>
      </div>
      <div className="field">
        {setting.value_type === "boolean" ? (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={value === "true"}
              onChange={(event) => onChange(event.target.checked ? "true" : "false")}
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
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />
          </Field>
        )}
      </div>
    </div>
  );
}

function AccountSetting({
  label, hint, data, types, value, onChange,
}: {
  label: string;
  hint: string;
  data: FinanceData;
  types: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const accounts = data.accounts.filter(
    (account) => account.is_active && types.includes(account.account_type),
  );
  return (
    <div className="setting-row">
      <div className="setting-copy">
        <strong>{label}</strong>
        <span>{hint}</span>
      </div>
      <div className="field">
        <Field label="Account">
          <select value={value} onChange={(event) => onChange(event.target.value)}>
            <option value="">Let the app pick</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );
}
