"""Recipe data model + reusable scene builders shared by all recipe modules."""
import zlib
from dataclasses import dataclass, field
from typing import Callable

import art as A
from art import Scene

# ---------------------------------------------------------------- model


@dataclass
class Step:
    title: str
    body: str | list                # HTML, or bullet items (see prose.py)
    art: Callable[[], str] | None = None
    heat: str = ""                  # e.g. "medium-high"
    time: str = ""                  # e.g. "3–4 min"
    part: str = ""                  # component heading for multi-part recipes
    uses: list[str] = field(default_factory=list)  # ingredient names (as in the list) shown with amounts
    amounts: dict[str, str] = field(default_factory=dict)  # explicit amounts when a measured ingredient is split between steps
    diagram: Callable[[], str] | None = None  # exact hand-position blueprint, shown under the pictures


@dataclass
class Bowl:
    """One mise-en-place container, listed in the order it goes into the pan."""
    name: str
    items: str
    draw: list                      # [(kind, count)] for art.fill
    goes_in: str                    # which step uses it
    vessel: str = "bowl"            # bowl | plate | cup


@dataclass
class Task:
    """One bar on the prep-order timeline (minutes)."""
    label: str
    start: float
    dur: float
    where: str                      # board | bowl | pan | bath | wait


@dataclass
class Recipe:
    slug: str
    title: str
    group: str
    blurb: str
    yields: str
    total: str
    intro: str
    ingredients: list               # [(section title, [(name, amount), ...])]
    steps: list
    mise: list = field(default_factory=list)
    timeline: list = field(default_factory=list)
    timeline_note: str = ""
    equipment: list = field(default_factory=list)
    notes: list = field(default_factory=list)       # [(title, html)]
    sources: list = field(default_factory=list)     # [(label, url)]
    before_ingredients: str = ""    # extra HTML (e.g. the vinegar picker)
    hero: Callable[[], str] | None = None
    original: str = ""              # original-language text, shown collapsed
    vinegar_options: dict | None = None   # powers the vinegar picker (see content.VINEGARS)
    batch: dict | None = None             # batch calculator for the vinegar mix (see vinegar.batch)
    serves: float | None = None           # people the recipe feeds (portions control); None = scale by batches
    diagrams: bool = False                # keep each step's SVG under its generated pictures (hand positions etc.)


# ---------------------------------------------------------------- scene helpers

PX, PY = 130, 104   # pan centre; handle runs off to the right

TOOLS = {"spatula": A.spatula, "spoon": A.spoon, "whisk": A.whisk, "chopsticks": A.chopsticks}


def notes_to_tags(sc, notes, split_x=200):
    """Draw (x, y, text) notes as callout tags; consecutive lines at the same x merge into one tag."""
    groups = []
    for x, y, text in notes:
        if groups and groups[-1][0] == x and 0 < y - groups[-1][2] <= 20:
            groups[-1][3].append(text)
            groups[-1][2] = y
        else:
            groups.append([x, y, y, [text]])
    for x, y, _, lines in groups:
        A.label(sc, x, y, "\n".join(lines), anchor="start" if x > split_x else "middle")


def pan_scene(seed, items, title, *, r=80, lid=False, lid_dx=0, steam=False, sizzle=False,
              side=None, notes=(), egg=None, heat=None, tool=None):
    """heat: 0 (off) … 1 (high); defaults to high when sizzling, else medium."""
    sc = Scene(seed)
    region = A.pan(sc, PX, PY, r, heat=(1.0 if sizzle else .6) if heat is None else heat, fond=sizzle)
    A.fill(sc, region, items)
    if egg:
        egg(sc, region)
    if sizzle:
        A.sizzle(sc, PX, PY, r)
    if tool:
        name, *pos = tool
        TOOLS[name](sc, *pos)
    if lid:
        A.lid(sc, PX, PY, r - 8, dx=lid_dx)
    if steam:
        A.steam(sc, PX, 34, 3, 60)
    if side:
        side(sc)
    notes_to_tags(sc, notes)
    return sc.render(title)


def to_plate(items, text="→ plate"):
    def draw(sc):
        region = A.plate(sc, 276, 46, 32)
        A.fill(sc, region, items)
        A.arrow(sc, 176, 52, 238, 40, bend=-.25)
        A.label(sc, 276, 96, text)
    return draw


def from_bowl(items, text="", vessel="bowl"):
    def draw(sc):
        region = A.bowl(sc, 276, 46, 30) if vessel == "bowl" else A.plate(sc, 276, 46, 30)
        A.fill(sc, region, items)
        A.arrow(sc, 250, 66, 188, 86, bend=.2)
        if text:
            A.label(sc, 276, 96, text)
    return draw


def pour_from(items, text="", color="#f6c53a", edge="#d9a01c"):
    """Bowl top-right, pouring a stream into the pan."""
    def draw(sc):
        region = A.bowl(sc, 278, 44, 28, band="#b5413a")
        A.fill(sc, region, items)
        A.pour(sc, 256, 56, 150, 96, color, edge)
        if text:
            A.label(sc, 278, 92, text)
    return draw


def board_scene(seed, columns, title, knife=False):
    """columns: [(kind, count, label)] or [('bowl', [(kind, n)], label)]."""
    sc = Scene(seed)
    x, y, w, h = A.board(sc, 10, 12, 300, 176)
    colw = w / len(columns)
    for i, (kind, count, text) in enumerate(columns):
        cx = x + i * colw + colw / 2
        if kind == "bowl":
            region = A.bowl(sc, cx, y + (h - 22) / 2, min(colw / 2 - 4, 34))
            A.fill(sc, region, count)
        else:
            A.scatter_rect(sc, kind, x + i * colw + 8, y + 10, colw - 16, h - 48, count)
        stagger = 13 if len(columns) >= 5 and i % 2 else 0   # keep neighbouring tags from colliding
        A.label(sc, cx, y + h - 6 - stagger, text, size=10 if len(columns) < 5 else 9.5)
    if knife and columns[-1][0] != "bowl":
        A.knife(sc, 246, 176, a=-8, s=.75)
    return sc.render(title)


def soak_scene(seed, title="Rice noodles soaking"):
    sc = Scene(seed)
    region = A.bowl(sc, 120, 100, 84, band="#8a9aa6")
    A.water(sc, *region)
    A.noodles(sc, *region, 22, "soaked")
    A.label(sc, 262, 62, "packet:\nstir-fry prep")
    A.label(sc, 262, 110, "stop while\nstill a bit firm")
    A.arrow(sc, 262, 140, 262, 166, bend=0, dashed=False)
    A.label(sc, 262, 188, "drain well")
    return sc.render(title)


def two_bowls(seed, left, right, title, left_text="", right_text="", chop=False):
    sc = Scene(seed)
    A.fill(sc, A.bowl(sc, 88, 96, 64), left)
    A.fill(sc, A.bowl(sc, 232, 96, 64, band="#b5413a"), right)
    if chop:
        A.chopsticks(sc, 186, 52, a=-28)
    if left_text:
        A.label(sc, 88, 186, left_text)
    if right_text:
        A.label(sc, 232, 186, right_text)
    return sc.render(title)


def mise_art(bowl: Bowl):
    sc = Scene(zlib.crc32(bowl.name.encode()), w=120, h=120, texture=False)
    if bowl.vessel == "plate":
        region = A.plate(sc, 60, 60, 52)
    elif bowl.vessel == "cup":
        region = A.bowl(sc, 60, 60, 38, band="#b5413a")
    else:
        region = A.bowl(sc, 60, 60, 52)
    A.fill(sc, region, bowl.draw)
    return sc.render(bowl.name)
