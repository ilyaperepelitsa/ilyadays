/** Add scroll frames and numeric alignment to trusted, flat recipe tables without changing their contents. */
export function cookingTablesHtml(html, lang = 'en') {
  const plain = (value) => value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const numeric = (value) => /^(?:[~≈±]?\s*\d|[¼½¾⅓⅔]|[—–-]$|(?:about|около|примерно)\s+\d)/iu.test(plain(value));
  return html.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (original) => {
    const body = original.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] ?? '';
    const rows = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) => [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => cell[1]));
    const columns = Math.max(0, ...rows.map((row) => row.length));
    const numericColumns = new Set(Array.from({ length: columns }, (_, i) => i).filter((i) => i > 0 && rows.every((row) => row[i] !== undefined && numeric(row[i]))));
    const table = original.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi, (row) => {
      let column = 0;
      return row.replace(/<(td|th)\b([^>]*)>/gi, (tag, name, attributes) => {
        if (!numericColumns.has(column++)) return tag;
        const styled = /\bclass=["']/i.test(attributes)
          ? attributes.replace(/\bclass=(["'])(.*?)\1/i, (_, quote, classes) => `class=${quote}${classes} cooking-number${quote}`)
          : `${attributes} class="cooking-number"`;
        return `<${name}${styled}>`;
      });
    });
    const label = lang === 'ru' ? 'Таблица приготовления' : 'Cooking reference table';
    const hint = columns > 2 ? `<p class="cooking-table-hint">${lang === 'ru' ? '↔ Прокрутите вбок, чтобы сравнить столбцы' : '↔ Scroll sideways to compare columns'}</p>` : '';
    return `${hint}<div class="cooking-table-frame${columns > 2 ? ' cooking-table-wide' : ''}" role="region" aria-label="${label}" tabindex="0">${table}</div>`;
  });
}
