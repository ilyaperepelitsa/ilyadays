import type { Recipe } from "@/lib/content";
import { foodHref, getUi } from "@/lib/content";
import type { Lang } from "@/lib/i18n";

const FILLINGS = [
  "soy-cured-yolk-onigiri", "soboro-onigiri", "pork-kimchi-onigiri",
  "shiso-kombu-onigiri", "takana-onigiri", "peanut-miso-onigiri",
  "eggplant-tsukudani-onigiri", "pepperoncino-onigiri", "mentai-cream-cheese-onigiri",
];
const METHODS = ["onigiri-mold", "onigiri-plastic-wrap"];

export function OnigiriChoices({ r, lang }: { r: Recipe; lang: Lang }) {
  if (r.slug !== "onigiri") return null;
  const t = getUi(lang);
  return (
    <section className="block onigiri-choices" aria-labelledby="onigiri-choices-title">
      <h2 id="onigiri-choices-title">{t("Choose a filling")}</h2>
      <p>{t("Each filling opens a complete recipe with its own ingredients and steps.")}</p>
      <nav className="onigiri-options" aria-label={t("Filling recipes")}>
        {FILLINGS.map((slug) => {
          const recipe = r.siblings.find((x) => x.slug === slug);
          return recipe ? <a key={slug} href={foodHref(lang, slug)}>{recipe.title}<span aria-hidden="true">↗</span></a> : null;
        })}
      </nav>
      <h3>{t("Other shaping methods")}</h3>
      <nav className="onigiri-options" aria-label={t("Other shaping methods")}>
        {METHODS.map((slug) => {
          const recipe = r.siblings.find((x) => x.slug === slug);
          return recipe ? <a key={slug} href={foodHref(lang, slug)}>{recipe.title}<span aria-hidden="true">↗</span></a> : null;
        })}
      </nav>
    </section>
  );
}
