// @ts-check
/**
 * Muscle map geometry (stream 02, plans/fitness/02-exercise-catalog-and-alternatives.md). Two 200 × 420 views,
 * front and back, of one simplified figure. Only the viewer's LEFT half is authored (x ≤ 100); the right half is
 * its mirror image, so the figure is symmetric. Shapes are point lists `[x, y, sharp?]` turned into smooth closed
 * Catmull-Rom curves (a `1` in third place makes a corner); the rectus abdominis is raw path data. Neighbouring
 * muscles keep a ≈ 1-unit gutter, so the map reads as clean segments at any size.
 * One entry per registry muscle id and view; `group` is the registry's coarse group (tests check both against
 * content/fitness/registry.json). `deep`: lies under other muscles, drawn only when highlighted, dashed.
 * Pure data: no imports, safe for client bundles.
 */

export const VIEW_W = 200;
export const VIEW_H = 420;

/** @typedef {[number, number] | [number, number, number]} Pt */
/** @typedef {{ muscle: string, group: string, parts?: Pt[][], d?: string, deep?: boolean }} MuscleSource */
/** @typedef {[number, number, number, number]} Box  x0, y0, x1, y1 */
/** @typedef {{ muscle: string, group: string, d: string, box: Box, area: number, deep?: boolean }} MuscleShape */

/** @param {number} n */
const fmt = (n) => String(Math.round(n * 10) / 10);

/**
 * Catmull-Rom spline through the points as cubic Béziers; a point with a truthy third value is a corner.
 * @param {Pt[]} points @param {boolean} [closed]
 */
export function smooth(points, closed = true) {
  const n = points.length;
  /** @param {number} i */
  const at = (i) => points[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = `M ${fmt(points[0][0])} ${fmt(points[0][1])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const s1 = p1[2] ? 0 : 1 / 6;
    const s2 = p2[2] ? 0 : 1 / 6;
    d += ` C ${fmt(p1[0] + (p2[0] - p0[0]) * s1)} ${fmt(p1[1] + (p2[1] - p0[1]) * s1)}`
      + ` ${fmt(p2[0] - (p3[0] - p1[0]) * s2)} ${fmt(p2[1] - (p3[1] - p1[1]) * s2)} ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return closed ? `${d} Z` : d;
}

/** @param {Pt} p @returns {Pt} */
const flip = (p) => (p.length > 2 ? [VIEW_W - p[0], p[1], /** @type {number} */ (p[2])] : [VIEW_W - p[0], p[1]]);

/** Mirror absolute M/L/C/Q/Z path data across the vertical midline. @param {string} d */
export function mirror(d) {
  let pair = 0;
  return (d.match(/[MLCQZ]|-?\d*\.?\d+/g) ?? [])
    .map((t) => {
      if (/[MLCQZ]/.test(t)) {
        pair = 0;
        return t;
      }
      return fmt(pair++ % 2 === 0 ? VIEW_W - Number(t) : Number(t));
    })
    .join(" ");
}

/** Bounding box of path data (end and control points: a slight overestimate of the curve). @param {string} d @returns {Box} */
function boxOf(d) {
  const nums = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0);
  const ys = nums.filter((_, i) => i % 2 === 1);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** @param {MuscleSource} m @returns {MuscleShape} */
function build(m) {
  const left = m.d ?? (m.parts ?? []).map((pts) => smooth(pts)).join(" ");
  const d = `${left} ${mirror(left)}`;
  const half = boxOf(left);
  /** @type {MuscleShape} */
  const out = { muscle: m.muscle, group: m.group, d, box: boxOf(d), area: Math.round((half[2] - half[0]) * (half[3] - half[1])) };
  if (m.deep) out.deep = true;
  return out;
}

/* ------------------------------------------------------------------ silhouette */

/** Left contour, crown → down the outside → back up the inside of the leg → crotch. */
/** @type {Pt[]} */
const CONTOUR = [
  [100, 8], [90.4, 9.6], [84.6, 16], [83, 26], [83.6, 36], [86.4, 45.4], [89.6, 51.6], [90.4, 56.4], [89.8, 63],
  [88.6, 66.4], [80.6, 70.8], [70.6, 74.2], [62.4, 77.4], [54.6, 81.4], [49.8, 88.6], [48.4, 97], [48.6, 106],
  [47.4, 114], [44.4, 128], [41.4, 143], [38.6, 156], [37.4, 163], [36.2, 172], [33.4, 186], [30.2, 202],
  [27.6, 214], [26.2, 222], [23.4, 232], [21.6, 243], [22.4, 253], [25.6, 260], [29.4, 262.4], [33, 260.4],
  [35, 254], [35.6, 246], [36.2, 236], [37, 228], [40.2, 213], [44.4, 195], [48.2, 180], [51.2, 168], [54.2, 152],
  [57.6, 136], [60.8, 122], [63, 114], [66, 108, 1], [67.6, 120], [69.2, 136], [70.4, 152], [70.8, 166], [70, 178],
  [67.6, 189], [64.6, 199], [62.2, 210], [61.4, 222], [61.6, 236], [62.4, 252], [63.8, 268], [65.6, 284],
  [67.8, 300], [69.4, 312], [69.8, 320], [67.8, 330], [66, 342], [66.6, 354], [68.8, 366], [71.6, 378], [73.8, 388],
  [74.6, 394], [73.2, 401], [72.2, 407], [73.4, 411.6], [78, 414.6], [84.6, 414.8], [88.6, 413.4], [89.6, 409],
  [88.8, 402], [88.2, 395], [88.8, 384], [90.6, 370], [92.4, 356], [93.2, 344], [92.8, 333], [91.6, 324], [92, 316],
  [93.6, 300], [95.4, 284], [96.8, 268], [98, 254], [99, 242], [100, 232, 1],
];

/** The whole silhouette as one closed path (left contour + its mirror image, reversed). */
export const BODY = smooth([...CONTOUR, ...CONTOUR.slice(1, -1).map(flip).reverse()]);

/* ------------------------------------------------------------------ front view */

/** @type {MuscleSource[]} */
const FRONT_SRC = [
  { muscle: "neck-flexors", group: "neck", parts: [[[89.4, 50.6], [91.6, 56.6], [94.6, 65.6], [97.6, 74.6, 1], [95, 76.2, 1], [91.6, 67], [88.6, 58.6], [87.6, 53.4]]] },
  { muscle: "traps-upper", group: "back", parts: [[[88.6, 63.2], [85.4, 67.4], [77.6, 71.6], [68.8, 75], [72.6, 77.4], [78.6, 77.6], [85.2, 74], [89.8, 69.4]]] },
  { muscle: "delt-side", group: "shoulders", parts: [[[62.6, 78.8, 1], [55.6, 81.2], [51, 87.6], [49.6, 96], [50, 105.6], [51.4, 114.4], [53, 121.8, 1], [55, 108.6], [57.8, 94.4]]] },
  { muscle: "delt-front", group: "shoulders", parts: [[[64.4, 78.8, 1], [69.2, 79.4], [72.2, 83.4], [71.8, 90], [69.4, 97.6], [64.6, 106.4], [58.4, 115.2], [54.6, 121.2, 1], [56.8, 107.6], [59.8, 93.2]]] },
  { muscle: "pec-clavicular", group: "chest", parts: [[[97.4, 82.8, 1], [89.2, 81.2], [81.4, 81.6], [74.8, 83.8], [73.4, 89.2], [71, 95.4, 1], [79.2, 92.8], [88.2, 91.6], [97.4, 92, 1]]] },
  { muscle: "pec-sternal", group: "chest", parts: [[[97.4, 94, 1], [88, 93.6], [79, 95.2], [70.2, 98.4, 1], [68.6, 101.6], [67.2, 105.4, 1], [77, 108.4], [87.6, 112.6], [97.4, 116.6, 1]]] },
  { muscle: "pec-costal", group: "chest", parts: [[[97.4, 118.6, 1], [87.8, 114.4], [77.2, 110.4], [67.4, 107.8, 1], [70.8, 114.8], [77.6, 121.4], [86.6, 124.8], [92.6, 125.6], [97.4, 125.2, 1]]] },
  {
    muscle: "serratus-anterior", group: "chest", parts: [
      [[68.2, 118.6, 1], [73.4, 119.2], [78.4, 122.4, 1], [73, 123.4]],
      [[68.8, 126.8, 1], [74, 127.4], [79.4, 131, 1], [74, 131.8]],
      [[69.6, 135, 1], [74.8, 135.8], [80.2, 139.6, 1], [74.8, 140.2]],
    ],
  },
  {
    muscle: "rectus-abdominis", group: "abs",
    d: "M 99 129 L 99 143.4 C 95.4 144.2 91.6 144.2 88 143.4 C 87.4 138.4 87.4 133.6 88.2 129.8 C 91.8 128.6 95.4 128.4 99 129 Z"
      + " M 99 146.4 L 99 160.8 C 95.4 161.4 91.8 161.4 88.2 160.8 C 87.8 155.8 87.8 151 88.2 146.8 C 91.8 146 95.4 145.8 99 146.4 Z"
      + " M 99 163.8 L 99 178.4 C 95.6 179 92 179 88.6 178.4 C 88.2 173.6 88.2 168.8 88.4 164.2 C 91.8 163.4 95.4 163.2 99 163.8 Z"
      + " M 99 181.6 L 99 224.4 C 97.6 226.4 95.8 226.6 94.6 225 C 91.8 212 89.8 197.6 88.8 182.2 C 92.2 181.2 95.6 181 99 181.6 Z",
  },
  { muscle: "obliques", group: "abs", parts: [[[81.8, 137.4], [85.2, 139.6], [86.4, 145], [86.8, 160], [87.4, 176], [88.4, 192], [90.2, 207], [92.6, 220.6, 1], [86.4, 213], [80, 204.4], [74, 195.6, 1], [74.6, 186], [74.4, 176], [73.4, 164], [72.4, 152], [71.6, 143.4]]] },
  { muscle: "transverse-abdominis", group: "abs", deep: true, parts: [[[75.2, 166.4], [87, 167.4], [99, 167.4, 1], [99, 221, 1], [92, 217.4], [84.4, 210], [76.2, 199.6], [76.4, 183]]] },
  { muscle: "biceps", group: "biceps", parts: [[[59.2, 121.6], [58.8, 128], [57, 135.6], [55, 143.6], [51.6, 152.4], [47.6, 159.6, 1], [46, 154], [46, 146], [47, 137.4], [49.8, 129], [53.2, 124.4], [56.4, 121.4]]] },
  { muscle: "brachialis", group: "biceps", parts: [[[44.4, 139.6], [44.4, 147], [43.4, 154.4], [42, 160.8, 1], [40.8, 155], [41.4, 148], [42.6, 142.4]]] },
  { muscle: "brachioradialis", group: "forearms", parts: [[[41.6, 160.6], [43.2, 166], [42.6, 173.6], [40.2, 183.6], [36.8, 194.6], [33, 205.6, 1], [31.8, 199.4], [33.6, 190], [35.8, 180], [37.8, 170.4], [39, 164.4]]] },
  { muscle: "forearm-flexors", group: "forearms", parts: [[[49.4, 168.4], [48.2, 176], [45.6, 186.4], [42.6, 198.6], [39.8, 211.4], [37, 222.6], [35.8, 227.4, 1], [34, 222.4], [34, 214.6], [35.8, 204], [38.4, 193], [41.4, 182], [44.4, 173.4], [46.8, 169.6]]] },
  { muscle: "hip-flexors", group: "quads", parts: [[[73.4, 199.6], [78.4, 204.4], [84.6, 212.2], [90, 221], [93.4, 228.2], [94.8, 233.4, 1], [92.2, 239.2], [89.8, 245], [88.2, 250.4, 1], [85.6, 241.6], [81.4, 231.4], [76.8, 221.4], [74, 211.6]]] },
  {
    muscle: "quads", group: "quads", parts: [
      [[66, 218.6], [68.8, 222.6], [71, 230.4], [72.8, 244], [73.6, 260], [73.6, 276], [72.8, 290.6], [71.6, 303.6], [71, 310.4, 1], [68.6, 298], [66.4, 282], [64.6, 264], [63.2, 246], [62.8, 230.6]],
      [[73.6, 213.6], [75.4, 220.4], [79.6, 231.2], [83.6, 241.4], [86.4, 251], [86.8, 264], [85.6, 278.4], [83.4, 292.4], [80.6, 304.4], [78.4, 308.2, 1], [76.2, 304.4], [75.2, 290], [75.2, 274], [75, 258], [74.4, 242], [73.6, 228]],
      [[90.2, 276], [92.4, 284.6], [92.6, 294], [90.8, 303.4], [87.6, 310.8], [83.6, 315.6], [82, 316, 1], [81.8, 308], [83.2, 297.6], [85.4, 287.6], [87.8, 280]],
    ],
  },
  { muscle: "adductors", group: "adductors", parts: [[[96.8, 240.2], [97.4, 247.6], [96.8, 257.6], [95.2, 266.8], [93.4, 273.6, 1], [91.6, 268], [90.8, 260.4], [91.4, 252.4], [93.6, 245.6]]] },
  { muscle: "gastrocnemius", group: "calves", parts: [[[90.4, 329.4], [91.8, 337], [92.2, 346.6], [91.2, 356.6], [89.4, 364.6], [87.4, 369.6, 1], [86.6, 360.4], [86.8, 349.4], [87.8, 339.4], [89, 333]]] },
  { muscle: "soleus", group: "calves", parts: [[[68.8, 350], [70.2, 358], [71.4, 368], [72.6, 376, 1], [71, 370], [69.2, 361]]] },
];

/** Clavicles, kneecaps (stroke only); the navel is on the midline. */
const FRONT_DETAILS_LEFT =
  "M 97.2 79.8 C 89.6 78.6 81.4 78.6 73.8 80.6"
  + " M 80.6 314 C 79.6 318.6 80.2 323.6 83.2 326.6 C 86.2 327.8 88.8 326 89.6 322 C 90 317.8 88.4 313.8 85.8 312.4 C 83.6 311.8 81.8 312.4 80.6 314 Z";

/* ------------------------------------------------------------------ back view */

/** @type {MuscleSource[]} */
const BACK_SRC = [
  { muscle: "neck-extensors", group: "neck", parts: [[[99, 47.6, 1], [99, 70.4, 1], [96.4, 69.6], [94.2, 67.2], [93.6, 60], [94, 53.2], [95.8, 49.4]]] },
  { muscle: "traps-upper", group: "back", parts: [[[92.8, 52], [91.8, 59.4], [91.8, 66.6], [93.6, 70.4], [96.4, 72.4], [99, 73.4, 1], [99, 75.6, 1], [90.4, 77], [80, 78.4], [69.2, 79.4], [65.8, 78], [70.4, 75.6], [80.4, 71.8], [87.6, 67.4], [90.4, 60]]] },
  { muscle: "traps-mid", group: "back", parts: [[[99, 77.8, 1], [99, 95.4, 1], [94.8, 94], [89.6, 92], [83, 89.6], [75.2, 87], [69.6, 85], [69, 82.8], [70, 81.4], [79.4, 80.6], [89.6, 79.4]]] },
  { muscle: "traps-lower", group: "back", parts: [[[99, 97.4, 1], [99, 150, 1], [97.6, 143.6], [95.8, 133.4], [93.8, 121.4], [92, 109], [90.6, 97.6], [94.6, 96.6]]] },
  { muscle: "rhomboids", group: "back", parts: [[[88.6, 98.4], [89.6, 107], [91, 116.4], [92.4, 124.4, 1], [89.8, 126], [87.4, 124], [86.4, 116], [86.8, 106.4]]] },
  { muscle: "rotator-cuff", group: "shoulders", parts: [[[85.4, 96.4], [84.8, 104], [84.6, 112], [84.4, 118.4, 1], [79, 117.8], [73.6, 115.6], [69.4, 111.8], [67.6, 105], [68, 98.6], [72.4, 94.4], [78.6, 94.2]]] },
  { muscle: "teres-major", group: "back", parts: [[[85.4, 121.6, 1], [85.6, 127.2, 1], [79.2, 127.6], [72.8, 125.6], [67.6, 122], [66.6, 119], [69.6, 117.6], [75.4, 120.2], [80.6, 121.6]]] },
  { muscle: "delt-side", group: "shoulders", parts: [[[62.6, 79, 1], [55.6, 81.4], [51, 87.6], [49.6, 96], [50, 105.6], [51.4, 114.4], [53, 121.8, 1], [55, 108.6], [57.8, 94.4]]] },
  { muscle: "delt-rear", group: "shoulders", parts: [[[64.4, 79, 1], [66.4, 80.6], [67, 85], [66.6, 92], [64.8, 100.4], [60.6, 110], [54.6, 121.2, 1], [56.8, 107.6], [59.8, 93.2]]] },
  { muscle: "lats", group: "back", parts: [[[66.6, 124.6], [72.6, 129], [79.4, 131], [86, 131], [90.4, 135.4], [94, 141.4], [96.4, 148.4], [94.2, 157], [90.6, 166], [87.2, 175], [82.6, 184.8], [77.4, 192.4], [74.6, 196, 1], [74.8, 186], [74.2, 176], [73.2, 164], [72, 150], [70.4, 138], [68.4, 129]]] },
  { muscle: "erectors", group: "lower-back", parts: [[[99, 152, 1], [99, 214, 1], [95.6, 213.2], [92.4, 210.6], [90.6, 206], [90, 196], [90.4, 184], [91.8, 172], [94, 162], [96.6, 154]]] },
  { muscle: "quadratus-lumborum", group: "lower-back", parts: [[[89.6, 176.4, 1], [88.8, 186], [88.6, 196], [89, 206.8, 1], [84.6, 204.8], [80.4, 202], [77.4, 198.4, 1], [80.6, 192.8], [84.8, 184.4]]] },
  { muscle: "obliques", group: "abs", parts: [[[71.6, 176], [72.8, 186], [73, 195.4], [72.2, 200.4, 1], [69.4, 199.6], [68.6, 192], [69.8, 184]]] },
  { muscle: "glute-med", group: "glutes", parts: [[[67.2, 207], [72.6, 204.6], [80, 205.2], [87.4, 208.8], [90.6, 211.6, 1], [85, 214.8], [77.8, 219.6], [71.8, 224.4, 1], [68.2, 218.8], [66.6, 212.6]]] },
  { muscle: "glute-max", group: "glutes", parts: [[[99, 217.4, 1], [99, 246.6, 1], [94.8, 251.6], [87.6, 253.4], [80.4, 251.6], [74, 247.4], [69.4, 241.4], [67.6, 234.4], [68.8, 228], [73.2, 225.4], [78.4, 222.2], [85.4, 218.8], [92.2, 216.8]]] },
  {
    muscle: "hamstrings", group: "hamstrings", parts: [
      [[82.8, 256.6], [83, 266], [82.4, 278.6], [80.8, 292.4], [77.4, 305], [73, 312.6, 1], [70.2, 306.4], [68.4, 295], [66.8, 282.4], [67.4, 272], [70.6, 263.2], [76, 258]],
      [[86.8, 256.4], [89.2, 262], [90.6, 270], [91.6, 280], [91.6, 292], [90, 303.4], [86.6, 314.2, 1], [83.2, 310.2], [82.4, 300], [83.2, 288], [84.6, 276], [85.2, 264]],
    ],
  },
  { muscle: "adductors", group: "adductors", parts: [[[93.6, 253.8], [96.2, 258.4], [97.2, 265], [96.4, 272.8], [94.6, 278, 1], [93.6, 271], [93.2, 262.4]]] },
  { muscle: "triceps-long", group: "triceps", parts: [[[61.2, 118.2], [59.2, 125], [57.4, 133.4], [55.2, 142.6], [52.6, 151.4], [49.6, 158.6, 1], [48.6, 150.8], [49.6, 141.8], [51.8, 132.6], [54.8, 124.6], [58.2, 119.6]]] },
  { muscle: "triceps-lateral", group: "triceps", parts: [[[52.4, 125.6], [50.2, 131.6], [47.8, 139.8], [46.2, 148.6], [46, 157], [46.8, 163.6, 1], [43, 162.6], [40.6, 159.2], [40.8, 151.4], [42.6, 141.4], [45, 132.8], [48.4, 126.8]]] },
  { muscle: "forearm-extensors", group: "forearms", parts: [[[42.4, 166.4], [47.4, 168.6], [48.2, 174.4], [45.8, 184.6], [43, 197.4], [39.4, 210.6], [36, 222], [33.6, 226.6, 1], [31.2, 221.6], [30.8, 213.4], [32.6, 202.6], [35.4, 190.6], [37.8, 179], [39.2, 170.6]]] },
  {
    muscle: "gastrocnemius", group: "calves", parts: [
      [[75.4, 326], [78.6, 329.4], [80, 338], [79.8, 348.6], [78.4, 358.8], [76.6, 366.4, 1], [73.4, 363.4], [71, 355], [70.4, 344.4], [71.8, 334.4]],
      [[83.4, 325.8], [87.6, 330], [90.8, 338.4], [91.8, 349], [90.8, 359.8], [88.2, 367.4], [85, 372.6, 1], [83, 363.4], [82.2, 351], [82.2, 338.6], [82.6, 331]],
    ],
  },
  { muscle: "soleus", group: "calves", parts: [[[70.6, 362.4], [72.8, 368.6], [76.8, 371.8], [80.6, 372.8], [84.6, 376.6], [88.8, 371], [90.6, 365.6], [89.4, 374.4], [86.8, 383.2], [84.6, 389.4, 1], [79.6, 389.6, 1], [76, 382], [72.8, 372.6]]] },
];

/** Knee creases (stroke only). */
const BACK_DETAILS_LEFT = "M 79.2 317.6 C 82.6 319.2 86.4 319.2 89.6 318";

/** Front view, both halves; one entry per muscle. @type {readonly MuscleShape[]} */
export const FRONT = Object.freeze(FRONT_SRC.map(build));
/** Back view, both halves; one entry per muscle. @type {readonly MuscleShape[]} */
export const BACK = Object.freeze(BACK_SRC.map(build));
export const FRONT_DETAILS = `${FRONT_DETAILS_LEFT} ${mirror(FRONT_DETAILS_LEFT)} M 100 170.6 C 100.9 171.4 100.9 173.2 100 174 C 99.1 173.2 99.1 171.4 100 170.6 Z`;
export const BACK_DETAILS = `${BACK_DETAILS_LEFT} ${mirror(BACK_DETAILS_LEFT)} M 100 76 L 100 150 M 100 222 C 99.8 230 99.8 238 100 245`;

/**
 * Thumbnail crop: the view where the highlighted muscles show most (extent of one side, primary counted double; ties →
 * front: calves win the back view, obliques the front) and a viewBox around them with the given aspect
 * (width / height), padded and never smaller than `minH` units tall.
 * @param {(id: string) => "primary" | "secondary" | "none"} level @param {number} [aspect] @param {number} [minH]
 * @returns {{ view: "front" | "back", viewBox: string }}
 */
export function compactCrop(level, aspect = 1.5, minH = 120) {
  /** @param {readonly MuscleShape[]} list */
  const weight = (list) =>
    list.reduce((sum, m) => sum + ({ primary: 2, secondary: 1, none: 0 })[level(m.muscle)] * m.area, 0);
  const view = weight(BACK) > weight(FRONT) ? "back" : "front";
  const hits = (view === "back" ? BACK : FRONT).filter((m) => level(m.muscle) !== "none");
  if (!hits.length) return { view, viewBox: `0 0 ${VIEW_W} ${VIEW_H}` };
  const pad = 8;
  let x0 = Math.min(...hits.map((m) => m.box[0])) - pad;
  let y0 = Math.min(...hits.map((m) => m.box[1])) - pad;
  let x1 = Math.max(...hits.map((m) => m.box[2])) + pad;
  let y1 = Math.max(...hits.map((m) => m.box[3])) + pad;
  let h = Math.max(y1 - y0, minH, (x1 - x0) / aspect);
  let w = h * aspect;
  if (w > VIEW_W + 40) {
    w = VIEW_W + 40;
    h = w / aspect;
  }
  const cx = (x0 + x1) / 2;
  const cy = Math.min(Math.max((y0 + y1) / 2, h / 2), VIEW_H - h / 2);
  x0 = cx - w / 2;
  y0 = cy - h / 2;
  return { view, viewBox: [x0, y0, w, h].map(fmt).join(" ") };
}

/** Muscle id → coarse group, from the shapes (both views agree; checked by tests). */
export const SHAPE_GROUPS = Object.freeze(Object.fromEntries([...FRONT, ...BACK].map((m) => [m.muscle, m.group])));
