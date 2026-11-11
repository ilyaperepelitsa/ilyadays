const QUANTITY = /<span\b(?=[^>]*\bclass="q")(?=[^>]*\bdata-k=)[^>]*>[\s\S]*?<\/span>/g;
const isTemperature = html => /\bdata-k="temp"/.test(html);
const temperatureKey = html => ['u', 'a', 'b'].map(key => html.match(new RegExp(`data-${key}="([^"]*)"`))?.[1] ?? '').join('/');

/** Keep existing heat instructions and surface any additional temperature-bearing sentences.
 * Quantity spans are retained verbatim for the portions and °C/°F controls.
 * @param {Pick<import('../content').Step, 'heat' | 'body_html'>} step
 * @returns {{kind: 'heat' | 'temperature', html: string}[]}
 */
export function stepConditions(step) {
  const rows = [];
  const heat = step.heat?.label_html;
  if (heat) rows.push({ kind: 'heat', html: heat });
  const known = new Set((heat?.match(QUANTITY) ?? []).filter(isTemperature).map(temperatureKey));
  const quantities = [];
  const text = step.body_html
    .replace(QUANTITY, html => {
      const index = quantities.push(html) - 1;
      return `\uE000${index}\uE001`;
    })
    .replace(/<\/(?:p|li|div)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  const notes = text.split(/\n+|(?<=[.!?])\s+(?=[A-ZА-ЯЁ])/u)
    .map(sentence => sentence.trim()).filter(Boolean)
    .filter(sentence => [...sentence.matchAll(/\uE000(\d+)\uE001/g)].some(([, index]) => {
      const html = quantities[Number(index)];
      return isTemperature(html) && !known.has(temperatureKey(html));
    }))
    .map(sentence => sentence.replace(/\uE000(\d+)\uE001/g, (_, index) => quantities[Number(index)]));
  if (notes.length) rows.push({ kind: 'temperature', html: [...new Set(notes)]
    .map(note => `<span class="step-condition-detail">${note}</span>`).join('') });
  return rows;
}
