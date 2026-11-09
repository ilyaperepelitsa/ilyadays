# Shared UI foundation

Tailwind CSS 4 provides utilities. The site retains its warm palette, automatic light/dark scheme, density and authored layouts. No Tailwind preflight reset is applied: recipes and the embedded itinerary bring existing base styles.

`components.json` configures shadcn/ui with the New York Radix components, React Server Components and `@/` aliases. `src/components/ui/toggle.tsx` and `toggle-group.tsx` come from the official registry; local adaptations add border style/font inheritance without preflight, reduced-motion handling and 44px selection targets. `cn` merges Tailwind classes, and class-variance-authority defines variants. Dependencies are pinned in package-lock.json.

`SelectionGroup` composes the primitives for explorer muscles/goals, profile preferences and constructor preferences. Radix provides pressed states, disabled behavior, roving keyboard focus and arrow navigation. Primary goal cards remain native radios. Native selects, checkboxes and dialogs remain valid existing controls. This is an incremental shared system, not a claim that every existing component has been migrated to shadcn.

Semantic Tailwind colors map to existing CSS variables in globals.css. `accent` for a selected surface maps to the host's soft accent; its foreground and focus ring map to the host's strong accent. Avoid overwriting the site's CSS variables with a default shadcn theme. Do not run an initializer that replaces global CSS or introduces a blanket reset.

Choose shared primitives for future interactive controls; keep layout styles close to their domain. Prefer native controls when they already provide the right behavior. Validate keyboard focus, disabled/selected states, narrow screens and both color schemes.

Sources: [manual installation](https://ui.shadcn.com/docs/installation/manual), [Radix Toggle Group](https://ui.shadcn.com/docs/components/radix/toggle-group), [Tailwind v4 integration](https://ui.shadcn.com/docs/tailwind-v4).
