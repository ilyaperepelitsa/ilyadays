/**
 * A citation such as "Title — outlet, year. https://…" with its URL as a link (new tab, no opener or referrer); a
 * citation without a URL stays text. Shared by the program page (goal sources) and the exercise pages. No imports,
 * so server and client components can both use it.
 */
export function SourceText({ text, className }: { text: string; className?: string }) {
  const m = /https?:\/\/\S+/.exec(text);
  if (!m) return <>{text}</>;
  const url = m[0].replace(/[).,;]+$/, "");
  return (
    <>
      {text.slice(0, m.index)}
      <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
        {url.replace(/^https?:\/\/(www\.)?/, "")}
      </a>
      {text.slice(m.index + url.length)}
    </>
  );
}
