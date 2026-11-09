"use client";
/**
 * Protein food table (stream 09 — plans/fitness/09-nutrition.md): search in both languages (diacritics folded, so
 * "kofte" finds köfte), group and cuisine chips, three protein sorts (per 100 kcal, per 100 g, per serving), and a
 * tap on a food opens its full macros, serving and source. Fixed four-column layout that fits a 360 px phone.
 */
import { Fragment, useState } from "react";
import type { Lang } from "@/lib/fitness/types";
import { keepUnits, pick, t2 } from "@/lib/fitness/i18n";
import { CUISINES, FOODS, FOOD_GROUPS, matchesFood, sortFoods, type Food, type FoodSort } from "@/lib/fitness/nutrition.mjs";
import { Refs, fmtUpTo } from "./ui";

const TOP = 15;

export function FoodTable({ lang }: { lang: Lang }) {
  const T = (en: string, ru: string) => keepUnits(pick(lang, en, ru));
  const [query, setQuery] = useState("");
  const [facet, setFacet] = useState("all");
  const [sort, setSort] = useState<FoodSort>("per100kcal");
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const inFacet = (f: Food) =>
    facet === "all" ? true : facet.startsWith("cuisine:") ? f.cuisine === facet.slice(8) : f.group === facet;
  const found = sortFoods(FOODS.filter((f) => inFacet(f) && matchesFood(f, query)), sort);
  const narrowed = query.trim() !== "" || facet !== "all";
  const rows = narrowed || showAll ? found : found.slice(0, TOP);

  const facets: { id: string; label: string }[] = [
    { id: "all", label: T(`All ${FOODS.length}`, `Все ${FOODS.length}`) },
    ...FOOD_GROUPS.map((g) => ({ id: g.id, label: t2(lang, g.name) })),
    ...CUISINES.map((c) => ({ id: `cuisine:${c.id}`, label: t2(lang, c.name) })),
  ];
  const sorts: { id: FoodSort; label: string; head: [string, string] }[] = [
    { id: "per100kcal", label: T("per 100 kcal", "на 100 ккал"), head: [T("g per", "г на"), T("100 kcal", "100 ккал")] },
    { id: "per100g", label: T("per 100 g", "на 100 г"), head: [T("g per", "г на"), T("100 g", "100 г")] },
    { id: "perServing", label: T("per serving", "на порцию"), head: [T("g per", "г на"), T("serving", "порцию")] },
  ];
  const order: FoodSort[] = ["per100g", "per100kcal", "perServing"];

  return (
    <section className="nut-foodsec" aria-labelledby="nut-foods-title">
      <h2 id="nut-foods-title">{T("Protein foods", "Белковые продукты")}</h2>
      <p className="nut-lede">
        {T(
          "In a deficit, protein per 100 kcal is the number that matters: the higher, the more protein for the calories. Meat and fish are weighed raw unless marked cooked (cooked meat has about 1.3 × the protein per 100 g).",
          "В дефиците главное — белок на 100 ккал: чем выше, тем больше белка за те же калории. Мясо и рыба — в сыром виде, если не указано иное (в готовом мясе белка на 100 г примерно в 1,3 раза больше).",
        )}
      </p>

      <div className="fit-card nut-food-tools">
        <label className="nut-search">
          <span className="sr-only">{T("Search foods", "Поиск продуктов")}</span>
          <input
            type="search"
            value={query}
            enterKeyHint="search"
            placeholder={T("Search: köfte, tvorog, tofu…", "Поиск: творог, кёфте, тофу…")}
            onChange={(e) => setQuery(e.target.value.slice(0, 40))}
          />
        </label>
        <div className="nut-chips" role="group" aria-label={T("Food groups", "Группы продуктов")}>
          {facets.map((f) => (
            <button key={f.id} type="button" aria-pressed={facet === f.id} onClick={() => setFacet(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="fit-seg nut-sorts" role="group" aria-label={T("Sort by protein", "Сортировка по белку")}>
          {sorts.map((s) => (
            <button key={s.id} type="button" aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length ? (
        <table className="nut-foods fit-num">
          <caption className="sr-only">
            {T("Protein in grams per 100 g, per 100 kcal and per typical serving", "Белок в граммах на 100 г, на 100 ккал и на обычную порцию")}
          </caption>
          <colgroup>
            <col className="nut-col-name" />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">{T("Food · tap for details", "Продукт · нажмите")}</th>
              {order.map((id) => {
                const s = sorts.find((x) => x.id === id) ?? sorts[0];
                return (
                  <th key={id} scope="col" aria-sort={sort === id ? "descending" : "none"} className={sort === id ? "is-sorted" : undefined}>
                    <button type="button" onClick={() => setSort(id)}>
                      {s.head[0]}
                      <br />
                      {s.head[1]}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => {
              const isOpen = open === f.id;
              const per = f.unit === "ml" ? T("100 ml", "100 мл") : T("100 g", "100 г");
              return (
                <Fragment key={f.id}>
                  <tr className={isOpen ? "is-open" : undefined}>
                    <th scope="row">
                      <button type="button" aria-expanded={isOpen} aria-controls={`nut-food-${f.id}`} onClick={() => setOpen(isOpen ? null : f.id)}>
                        <span className="nut-food-name">{keepUnits(t2(lang, f.name))}</span>
                        <small>{keepUnits(t2(lang, f.serving.label))}</small>
                      </button>
                    </th>
                    <td className={sort === "per100g" ? "is-sorted" : undefined}>{fmtUpTo(f.per100.protein, lang, 1)}</td>
                    <td className={sort === "per100kcal" ? "is-sorted" : undefined}>{fmtUpTo(f.proteinPer100kcal, lang, 1)}</td>
                    <td className={sort === "perServing" ? "is-sorted" : undefined}>{fmtUpTo(f.serving.protein, lang, 1)}</td>
                  </tr>
                  {isOpen ? (
                    <tr id={`nut-food-${f.id}`} className="nut-food-detail">
                      <td colSpan={4}>
                        <p>
                          <b>{T(`Per ${per}:`, `На ${per}:`)}</b> {f.per100.kcal}{"\u00a0"}{T("kcal", "ккал")} · {T("protein", "белок")} {fmtUpTo(f.per100.protein, lang, 1)} ·{" "}
                          {T("fat", "жиры")} {fmtUpTo(f.per100.fat, lang, 1)} · {T("carbs", "углеводы")} {fmtUpTo(f.per100.carbs, lang, 1)} · {T("fibre", "клетчатка")}{" "}
                          {f.per100.fibre == null ? "—" : fmtUpTo(f.per100.fibre, lang, 1)}{"\u00a0"}{T("g", "г")}
                        </p>
                        <p>
                          <b>{keepUnits(t2(lang, f.serving.label))}:</b> {f.serving.kcal}{"\u00a0"}{T("kcal", "ккал")} · {fmtUpTo(f.serving.protein, lang, 1)}{"\u00a0"}{T("g protein", "г белка")}
                        </p>
                        <p className="nut-small fit-muted">
                          {keepUnits(f.source)} <Refs ids={[f.ref]} lang={lang} />
                        </p>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="fit-note">{T("Nothing found. Try another word or group.", "Ничего не найдено. Попробуйте другое слово или группу.")}</p>
      )}

      {!narrowed && found.length > TOP ? (
        <button type="button" className="fit-button quiet nut-more" onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
          {showAll ? T(`Show the top ${TOP}`, `Показать первые ${TOP}`) : T(`Show all ${found.length}`, `Показать все ${found.length}`)}
        </button>
      ) : null}
      <p className="nut-small fit-muted">
        {T(
          "Carbs include fibre; “—” means the database does not report fibre. Values from USDA FoodData Central unless a food says otherwise; dishes are recipe estimates.",
          "Углеводы включают клетчатку; «—» — в базе нет данных о клетчатке. Значения из USDA FoodData Central, если у продукта не указано иное; блюда — оценки по рецепту.",
        )}{" "}
        <Refs ids={["usda-fdc", "mext-2020", "turkomp", "skurikhin-2002"]} lang={lang} />
      </p>
    </section>
  );
}
