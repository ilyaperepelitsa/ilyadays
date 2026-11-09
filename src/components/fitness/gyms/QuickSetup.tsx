/**
 * Quick setup by equipment type (stream 05): one chip per type, on while anything of that type is here. Turning a
 * chip off marks every exercise on that equipment "not here"; turning it back on restores them (gyms-core quickSetup).
 */
import { t2 } from "@/lib/fitness/i18n";
import { QUICK_TYPES, presentTypes, quickSetup } from "@/lib/fitness/gyms-core.mjs";
import { type SectionProps, tr } from "./shared";

export function QuickSetup({ lang, gym, catalog, canWrite, write }: Omit<SectionProps, "plan">) {
  const T = tr(lang);
  const present = presentTypes(gym, catalog);
  const toggle = (type: string) =>
    write((g, now) => {
      const current: string[] = presentTypes(g, catalog);
      const next = current.includes(type) ? current.filter((t) => t !== type) : [...current, type];
      return quickSetup(g, next, now, catalog);
    });
  return (
    <section className="fit-gym-block" aria-labelledby="fit-gym-quick">
      <h3 id="fit-gym-quick">{T("Quick setup by equipment type", "Быстрая настройка по типу оборудования")}</h3>
      <p className="fit-gym-hint">
        {T(
          "Untick what this gym does not have: every exercise on that equipment is marked “not here”. Tick it again to bring them back.",
          "Снимите отметку с того, чего в зале нет: все упражнения на этом оборудовании станут «нет». Повторное нажатие вернёт их.",
        )}
      </p>
      <div className="fit-seg fit-gym-types" role="group" aria-label={T("Equipment types at this gym", "Оборудование в этом зале")}>
        {QUICK_TYPES.map((type) => {
          const on = present.includes(type.id);
          return (
            <button
              key={type.id}
              type="button"
              aria-pressed={on}
              data-testid="quick-type"
              data-type={type.id}
              title={t2(lang, type.name)}
              disabled={!canWrite}
              onClick={() => toggle(type.id)}
            >
              <span className="fit-gym-tick" aria-hidden="true">{on ? "✓" : "✕"}</span>
              {t2(lang, type.short)}
            </button>
          );
        })}
      </div>
    </section>
  );
}
