/** Match a recipe search against a title, a blurb, and ingredient names. */

/**
 * @param {string} html
 * @returns {string}
 */
export function stripHtml(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&apos;/g, "'").replace(/&nbsp;/g, " ");
}

/**
 * @param {string} text
 * @returns {string}
 */
export function normalize(text) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ё/g, "е")
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04ff]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * One substitution, insertion, or deletion. Words shorter than 4 letters must match exactly.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function oneEditApart(a, b) {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  let edits = 0;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length === b.length) {
      i += 1;
      j += 1;
    } else if (a.length > b.length) i += 1;
    else j += 1;
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * @param {string} token
 * @param {string[]} words
 * @returns {boolean}
 */
function tokenHits(token, words) {
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word === token || word === `${token}s` || word === `${token}es`) return true;
    if (oneEditApart(token, word)) return true;
    const next = words[i + 1];
    if (next && oneEditApart(token, word + next)) return true;
  }
  return false;
}

/**
 * Every word of the query has to show up. "bok choi" matches "bok choy".
 *
 * @param {string} query
 * @param {string} haystack
 * @returns {boolean}
 */
export function matchesQuery(query, haystack) {
  const needle = normalize(query);
  if (!needle) return true;
  const text = normalize(haystack);
  if (text.includes(needle)) return true;
  const words = text.split(" ");
  return needle.split(" ").every((token) => tokenHits(token, words));
}
