import Link from "next/link";
import { type Lang, localPath, strings } from "@/lib/i18n";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { AuthProvider } from "@/components/site/AuthProvider";
import { TripComposer } from "@/components/travel/TripComposer";
import { TripReader } from "@/components/travel/TripReader";

export function NewTripView({ lang }: { lang: Lang }) {
  const t = strings(lang);
  const say = (en: string, ru: string) => lang === "ru" ? ru : en;
  return (
    <AuthProvider>
      <SiteHeader lang={lang} path="/travel/new" section="travel" auth />
      <main className="trip-create">
        <section className="hello trip-create-heading">
          <p className="home-eyebrow">{say("Travel / Your next adventure", "Путешествия / Ваша следующая поездка")}</p>
          <h1>{t.makeTripTitle}</h1>
          <p className="lede">{say("A city, your dates, your kind of day. Build a walking plan around the places and events you want to experience.", "Город, даты и ваш ритм. Соберите прогулочный маршрут вокруг мест и событий, которые хотите увидеть.")}</p>
        </section>
        <div className="trip-workspace">
          <aside className="trip-guide" aria-label={say("Planning guide", "Этапы планирования")}>
            <h2>{say("Make it your kind of trip", "Поездка по вашим правилам")}</h2>
            <ol>
              <li><a href="#trip-basics"><span>01</span><div><strong>{say("Set your pace", "Выберите ритм")}</strong><p>{say("Your city, walking days and interests.", "Город, прогулочные дни и интересы.")}</p></div></a></li>
              <li><a href="#trip-dates"><span>02</span><div><strong>{say("Choose your dates", "Укажите даты")}</strong><p>{say("Find exhibitions and concerts during your stay.", "Найдите выставки и концерты на время поездки.")}</p></div></a></li>
              <li><a href="#trip-themes"><span>03</span><div><strong>{say("Shape your days", "Продумайте дни")}</strong><p>{say("Review your themes, then create the plan.", "Проверьте темы и создайте маршрут.")}</p></div></a></li>
            </ol>
            <p className="trip-guide-note">{say("You decide what makes the plan. Events are added only when you choose them.", "Вы решаете, что войдёт в план. События добавляются только по вашему выбору.")}</p>
          </aside>
          <TripComposer lang={lang} />
        </div>
      </main>
      <SiteFooter>
        <Link prefetch={false} href={localPath(lang, "/travel")}>{t.tripBack}</Link>
      </SiteFooter>
    </AuthProvider>
  );
}

export function MadeTripView({ lang, id }: { lang: Lang; id: string }) {
  const t = strings(lang);
  return (
    <AuthProvider>
      <SiteHeader lang={lang} path="/travel" section="travel" auth />
      <main>
        <TripReader lang={lang} id={id} />
      </main>
      <SiteFooter>
        <Link prefetch={false} href={localPath(lang, "/travel")}>{t.tripBack}</Link>
      </SiteFooter>
    </AuthProvider>
  );
}
