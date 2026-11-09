import { exerciseById, thumbUrl } from "@/lib/fitness/catalog.mjs";

/** Adjacent text names the exercise; the technique picture is a decorative recognition aid. */
export function ExerciseThumbnail({ id }: { id: string }) {
  const exercise = exerciseById(id);
  const image = exercise?.images?.[0];
  return <span className="fit-exercise-thumb" aria-hidden="true">
    {image ? (
      // eslint-disable-next-line @next/next/no-img-element -- existing pre-sized static thumbnail, no image proxy
      <img src={thumbUrl(image.src)} alt="" width={48} height={48} loading="lazy" decoding="async" />
    ) : <span>{exercise?.name.en.slice(0, 2).toUpperCase() ?? "—"}</span>}
  </span>;
}
