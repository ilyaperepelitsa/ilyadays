import Link from "next/link";
import { type Lang, localPath, strings } from "@/lib/i18n";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { RecentlyAdded } from "@/components/food/RecentlyAdded";
import { ActionIcon } from "@/components/site/ActionIcon";

export function HomeView({ lang }: { lang: Lang }) {
  const t = strings(lang);
  return (
    <>
      <SiteHeader lang={lang} path="/" section="home" />
      <main className="home-main">
        <section className="hello home-hello">
          <p className="home-eyebrow">{lang === "ru" ? "Личные заметки и полезные инструменты" : "Personal notes & useful tools"}</p>
          <h1>{t.homeTitle}</h1>
          <p className="lede">{t.homeLede}</p>
          <div className="home-actions" aria-label={lang === "ru" ? "С чего начать" : "Start here"}>
            <Link prefetch={false} className="home-action primary" href={localPath(lang, "/fitness")}>{lang === "ru" ? "Настроить тренировки" : "Make a training plan"}<ActionIcon name="arrow" /></Link>
            <Link prefetch={false} className="home-action" href={localPath(lang, "/travel/new")}>{lang === "ru" ? "Спланировать поездку" : "Plan a trip"}<ActionIcon name="arrow" /></Link>
            <Link prefetch={false} className="home-action" href={localPath(lang, "/food")}>{lang === "ru" ? "Выбрать рецепт" : "Find a recipe"}<ActionIcon name="arrow" /></Link>
          </div>
        </section>
        <section className="home-sections" aria-labelledby="home-sections-title">
          <div className="home-section-head"><h2 id="home-sections-title">{lang === "ru" ? "Готовить. Исследовать. Тренироваться." : "Cook. Explore. Train."}</h2><p>{lang === "ru" ? "Три части повседневной жизни" : "Three parts of everyday life"}</p></div>
        <div className="tiles home-tiles">
          <Link prefetch={false} className="tile" href={localPath(lang, "/food")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static cover */}
            <img src="/covers/food.webp" alt={t.foodCardAlt} width={800} height={534} fetchPriority="high" />
            <div className="tile-body">
              <span className="home-card-label">{lang === "ru" ? "На своей кухне" : "In the kitchen"}</span>
              <h3>{t.food}</h3>
              <p>{t.foodCardText}</p>
              <span className="tile-go">{t.foodCardGo}</span>
            </div>
          </Link>
          <Link prefetch={false} className="tile" href={localPath(lang, "/travel")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static cover */}
            <img src="/covers/travel.webp" alt={t.travelCardAlt} width={800} height={534} />
            <div className="tile-body">
              <span className="home-card-label">{lang === "ru" ? "В незнакомом городе" : "Out in the world"}</span>
              <h3>{t.travel}</h3>
              <p>{lang === "ru" ? "Пешие маршруты, даты поездки и события, ради которых стоит свернуть с пути." : "Walking routes, stay dates and events worth making room for."}</p>
              <span className="tile-go">{t.travelCardGo}</span>
            </div>
          </Link>
          <Link prefetch={false} className="tile" href={localPath(lang, "/fitness")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static cover */}
            <img src="/covers/fitness.webp" alt={t.fitnessCardAlt} width={800} height={534} />
            <div className="tile-body">
              <span className="home-card-label">{lang === "ru" ? "В своём темпе" : "At your own pace"}</span>
              <h3>{t.fitness}</h3>
              <p>{lang === "ru" ? "Свои цели и программа, рабочие веса, журнал тренировок и замеры тела." : "Your goals and program, working weights, workout log and body measurements."}</p>
              <span className="tile-go">{t.fitnessCardGo}</span>
            </div>
          </Link>
        </div>
        </section>
        <RecentlyAdded lang={lang} linked />
        <section className="about" id="about">
          <h2>{t.aboutTitle}</h2>
          <p>{t.aboutText}</p>
          <h3>{t.madeTitle}</h3>
          <ul className="projects">
            <li>
              <a href="https://typekana.com">TypeKana</a> — {t.typekana}
            </li>
            <li>
              <Link prefetch={false} href={localPath(lang, "/food")}>{t.recipesProject}</Link> — {t.recipesProjectText}
            </li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
