// Recipe-site building blocks. The markup mirrors recipes/build.py one to one, so food.css (a copy of
// recipes/static/style.css) renders these pages exactly like the original static site.
import type { Hero } from "@/lib/content";
import { media } from "@/lib/paths";

type Tag = "span" | "div" | "p" | "b" | "h3" | "h4" | "small" | "em" | "li";

/** Trusted HTML from the recipe export (our own content, built from the recipes repo). */
export function Html({ as: As = "span", html, className }: { as?: Tag; html: string; className?: string }) {
  return <As className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** The 600 px card copy of a recipe picture (scripts/card-thumbnails.py); it keeps the picture's `?v=`. */
export const cardPicture = (src: string) => (/^illustrations\/[^?]+\.webp(\?|$)/.test(src) ? `thumbs/${src}` : src);

/** A generated illustration (`img.art.illo`), lazy like the original. `eager` marks the picture that is the page's
 *  largest paint (hero, first cards): it loads at once with high priority. Card copies are 600×400. */
export function Illo({ src, alt, eager, card }: { src: string; alt: string; eager?: boolean; card?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static pictures, pre-sized webp; no optimizer needed
    <img
      className="art illo"
      src={media(card ? cardPicture(src) : src)}
      alt={alt}
      width={card ? 600 : undefined}
      height={card ? 400 : undefined}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      decoding="async"
    />
  );
}

/** The drawn SVG used where there's no generated picture. Contains its own <svg class="art">. */
export function Svg({ svg }: { svg: string }) {
  return <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** Hero/card art: the picture, else the drawing. `card` uses the small copy. */
export function HeroArt({ hero, eager, card }: { hero: Hero; eager?: boolean; card?: boolean }) {
  if (hero.image) return <Illo src={hero.image} alt={hero.alt} eager={eager} card={card} />;
  if (hero.svg_fallback) return <Svg svg={hero.svg_fallback} />;
  return null;
}

/** Shared gradients and filters for the SVG drawings — once per page, only if a drawing is shown. */
export function SvgDefs({ svg }: { svg: string }) {
  return <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
