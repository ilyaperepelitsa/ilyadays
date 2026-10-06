# ilyadays.com

Static site: **Food** (`/food/`, the recipe site from `../recipes`) and **Travel** (`/travel/`, trip apps such as
`../istanbul_trip`). Vercel serves `public/` as is (no build step, see `vercel.json`) and deploys every push to `main`.

```
./publish.sh          # rebuild public/ from the sibling projects (check: python3 -m http.server -d public 8100)
./publish.sh --push   # rebuild, commit, push → live in a minute or two
```

- `src/site/` — home page, travel index, shared style.
- `src/covers/` — home-page covers made with `src/make_covers.py` (gpt-image-2, same look as the recipes; prompts in `prompts.json`).
- Recipes are edited in `../recipes` (the local service at http://localhost:8000 rebuilds on change); publish when happy.
- Adding a trip: put its page at `public/travel/<trip>/` via `publish.sh` and add a card to `src/site/travel/index.html`.
