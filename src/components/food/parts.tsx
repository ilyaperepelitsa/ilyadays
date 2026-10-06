// Recipe-site building blocks. The markup mirrors recipes/build.py one to one, so food.css (a copy of
// recipes/static/style.css) renders these pages exactly like the original static site.
import type { Hero } from "@/lib/content";
import { media } from "@/lib/content";

type Tag = "span" | "div" | "p" | "b" | "h3" | "small" | "em" | "li";

/** Trusted HTML from the recipe export (our own content, built from the recipes repo). */
export function Html({ as: As = "span", html, className }: { as?: Tag; html: string; className?: string }) {
  return <As className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** A generated illustration (`img.art.illo`), lazy like the original. */
export function Illo({ src, alt, eager }: { src: string; alt: string; eager?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static pictures, pre-sized webp; no optimizer needed
    <img className="art illo" src={media(src)} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" />
  );
}

/** The drawn SVG used where there's no generated picture. Contains its own <svg class="art">. */
export function Svg({ svg }: { svg: string }) {
  return <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** Hero/card art: the picture, else the drawing. */
export function HeroArt({ hero, eager }: { hero: Hero; eager?: boolean }) {
  if (hero.image) return <Illo src={hero.image} alt={hero.alt} eager={eager} />;
  if (hero.svg_fallback) return <Svg svg={hero.svg_fallback} />;
  return null;
}

/** Shared gradients and filters for the SVG drawings — once per page, only if a drawing is shown. */
export function SvgDefs({ svg }: { svg: string }) {
  return <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
