/**
 * Muscle map (stream 02, plans/fitness/02-exercise-catalog-and-alternatives.md): a front and a back figure, inline
 * SVG, one `path[data-muscle][data-group]` per registry muscle. Primary muscles (or every muscle of a highlighted
 * coarse group) are filled with the accent, secondary ones with the soft accent and an accent outline, the rest stay
 * neutral. Views sit side by side and stack when the container is narrow. No "use client": renders on the server
 * (exercise pages) or inside client components (catalog cards).
 *
 * `compact` (catalog cards) draws ONE view cropped to the worked muscles, from `<use>` references to the shapes in
 * <MuscleSprite/>, which must be rendered once on the page: 138 cards then cost a few hundred bytes each instead of
 * the full path data.
 */
import type { Lang } from "@/lib/fitness/types";
import { pick } from "@/lib/fitness/i18n";
import { BACK, BACK_DETAILS, BODY, FRONT, FRONT_DETAILS, SHAPE_GROUPS, VIEW_H, VIEW_W, compactCrop } from "./shapes.mjs";

type Level = "primary" | "secondary" | "none";

export type MuscleMapProps = {
  /** Muscle ids worked hardest (registry ids) */
  primary: readonly string[];
  /** Muscle ids that help */
  secondary: readonly string[];
  /** Coarse groups ("chest", "back", …) whose muscles are all highlighted as primary */
  groups?: readonly string[];
  /** Card thumbnail: one cropped view from the sprite, decorative (aria-hidden); needs <MuscleSprite/> on the page */
  compact?: boolean;
  lang: Lang;
  /** Muscle id → name in `lang` (catalog `muscleNames(lang)`) for the accessible title and hover titles */
  names?: Readonly<Record<string, string>>;
  className?: string;
};

const VIEWS = [
  { key: "front", prefix: "f", shapes: FRONT, details: FRONT_DETAILS, en: "Front", ru: "Спереди" },
  { key: "back", prefix: "b", shapes: BACK, details: BACK_DETAILS, en: "Back", ru: "Сзади" },
] as const;

const pretty = (id: string) => id.replace(/-/g, " ");

/** "Muscles worked — main: …; also: …" in the page language. */
function describe(lang: Lang, main: string[], also: string[], names?: Readonly<Record<string, string>>) {
  const list = (ids: string[]) => ids.map((id) => names?.[id] ?? pretty(id)).join(", ");
  if (!main.length && !also.length) return pick(lang, "Muscle map, front and back", "Карта мышц, вид спереди и сзади");
  const parts = [
    main.length ? `${pick(lang, "main", "основные")}: ${list(main)}` : "",
    also.length ? `${pick(lang, "also", "вспомогательные")}: ${list(also)}` : "",
  ].filter(Boolean);
  return `${pick(lang, "Muscles worked", "Работающие мышцы")} — ${parts.join("; ")}`;
}

/** Shapes referenced by compact maps. Render once per page that shows compact maps. */
export function MuscleSprite() {
  return (
    <svg className="fx-mm-sprite" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <path id="fx-mm-body" d={BODY} />
        {VIEWS.flatMap((view) => view.shapes.map((m) => <path key={`${view.prefix}-${m.muscle}`} id={`fx-mm-${view.prefix}-${m.muscle}`} d={m.d} />))}
      </defs>
    </svg>
  );
}

export function MuscleMap({ primary, secondary, groups, compact = false, lang, names, className }: MuscleMapProps) {
  const level = (id: string): Level =>
    primary.includes(id) || (groups?.includes(SHAPE_GROUPS[id] ?? "") ?? false) ? "primary" : secondary.includes(id) ? "secondary" : "none";
  const muscleClass = (deep?: boolean) => (deep ? "fx-mm-m deep" : "fx-mm-m");

  if (compact) {
    const { view, viewBox } = compactCrop(level);
    const v = VIEWS[view === "back" ? 1 : 0];
    const [x, y, w, h] = viewBox.split(" ").map(Number);
    const inside = (b: readonly number[]) => b[2] > x && b[0] < x + w && b[3] > y && b[1] < y + h;
    return (
      <svg className={["fx-mm-compact", className].filter(Boolean).join(" ")} viewBox={viewBox} aria-hidden="true" focusable="false">
        <use href="#fx-mm-body" className="fx-mm-body" />
        {v.shapes
          .filter((m) => inside(m.box) && !(m.deep && level(m.muscle) === "none"))
          .map((m) => (
            <use key={m.muscle} href={`#fx-mm-${v.prefix}-${m.muscle}`} className={muscleClass(m.deep)} data-muscle={m.muscle} data-level={level(m.muscle)} />
          ))}
      </svg>
    );
  }

  const drawn = Object.keys(SHAPE_GROUPS);
  const label = describe(lang, drawn.filter((id) => level(id) === "primary"), drawn.filter((id) => level(id) === "secondary"), names);
  return (
    <div className={["fx-mm", className].filter(Boolean).join(" ")} role="img" aria-label={label}>
      {VIEWS.map((view) => (
        <figure key={view.key} className="fx-mm-view">
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-hidden="true" focusable="false">
            <path className="fx-mm-body" d={BODY} />
            {view.shapes.map((m) => {
              const l = level(m.muscle);
              if (l === "none" && m.deep) return null;
              return (
                <path key={m.muscle} className={muscleClass(m.deep)} d={m.d} data-muscle={m.muscle} data-group={m.group} data-level={l}>
                  {names?.[m.muscle] ? <title>{names[m.muscle]}</title> : null}
                </path>
              );
            })}
            <path className="fx-mm-detail" d={view.details} />
          </svg>
          <figcaption>{pick(lang, view.en, view.ru)}</figcaption>
        </figure>
      ))}
    </div>
  );
}
