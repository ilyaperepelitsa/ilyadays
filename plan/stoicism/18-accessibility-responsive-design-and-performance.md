# Accessibility, responsive design and performance

## A dense research tool that remains readable

The user wants an efficient modern workbench, not a sparse landing page or a web of unreadable arrows. Density should support comparing evidence and editing meaning. It must not make text, focus targets or review states too small to use.

Use the site’s existing React/Tailwind/Radix conventions and shared visual tokens where appropriate. Add specialized editor/map components without replacing the whole design system or requiring paid editor services.

## Reading hierarchy

Distinguish source text, editorial meaning and reader-facing expression through spacing, labels and restrained typography. Keep canonical references, edition and review state close to the relevant text. A compact source card can expose context progressively without hiding that context behind several unrelated menus.

The selected teaching and corpus mode should remain apparent after scrolling. The default view should make source/meaning relationships visible immediately. Color is useful, but textual references and relation labels must carry the meaning without it.

## Keyboard and screen-reader paths

All source spans, target clauses, inspectors, map selections, review controls, pane resize controls and navigation should have keyboard equivalents. Use appropriate focus order and visible focus styles. Do not rely on hovering a one-pixel underline.

Expose source references, relationship types, review states and contributor sets in accessible text. Avoid announcing long repeated labels on every cursor movement. A focused inspector or linked list can provide detail without flooding the editing experience.

Use native semantic controls where they fit, and tested Radix-style primitives for more complex selection behavior. Mark an SVG connector overlay decorative while exposing its relationships through the inspector/list. A scatter plot needs a table or list alternative rather than thousands of inaccessible visual dots.

## Color and contrast

Source and concept modes have separate legends and encodings. Ensure readable foreground contrast on soft highlight backgrounds in both light and dark themes. Rejected, stale and unsupported states need text/icons or patterns as well as color.

Support a plain-reading mode with references intact. Check high-contrast settings and color-vision simulations. Avoid making a red/green distinction the only way to identify review outcomes.

A gradient is a contributor-set display, not a measured attribution ratio. Do not add percentage labels or tooltips that imply otherwise. Hover and keyboard focus should reveal exactly the same contributor identities and relations.

## Responsive workspace

Desktop supports resizable two/three panes. Tablet should preserve comparison where practical and offer a focused pane switch when three narrow columns become unreadable. Phone layout needs a persistent selected-teaching summary and quick movement between source, meaning and expression.

Do not solve mobile by stacking three extremely tall independent panels with the important actions several screens apart. Use compact context previews, explicit jump actions and a stable inspector. Preserve selection and draft state when changing layout.

Test long references, long Russian labels, large text, browser zoom, landscape orientation and virtual-keyboard behavior. A pane should not widen the entire page because a source locator or model ID cannot wrap.

## Map accessibility and interaction

Points can be explored via a linked list with canonical references, cluster labels and search. Keyboard selection should reveal the same source detail as pointer selection. Zoom/pan must have reset controls and a selected-item route that does not require precise dragging.

Do not make lasso selection the only way to gather passages. A cluster/list selection can offer an equivalent set operation. Color changes should not erase the selected source’s identity.

## Performance boundaries

The five-passage fixture is not a corpus-scale performance test. Before the real import is the default working set, add source pagination or virtualization, bounded context loading and efficient selection rendering. Keep every passage accessible even when only a window is mounted.

Recompute connector geometry on relevant changes with scheduled layout work. Avoid continuously measuring every node on every frame. Virtualized/offscreen sources need explicit behavior; do not draw arrows to recycled DOM elements.

Large vectors and fitted analysis state belong outside ordinary React component state. Send the chart only the data it needs, with run identity and selection metadata. Preserve the full matrices privately for computation and retrieval.

## Motion and interaction continuity

Use motion only when it explains a structural transition: opening context, moving to a selected point, or adopting a new layout. Respect reduced-motion preferences. Avoid decorative pulsing/glowing source highlights that distract from reading or imply scientific certainty.

Keep focus after save, review, resize and map-to-editor navigation. An error should retain the local draft and point to a corrective action, not unexpectedly reset the workspace.

## Verification and completion

Review real screenshots at phone/tablet/desktop widths in light/dark modes. Run keyboard-only and screen-reader-oriented checks for the central workflow. Measure representative full-corpus interactions rather than only page load on a tiny fixture.

This workstream is complete when the user can inspect, correct and write source-grounded material comfortably across layouts and interaction modes, while provenance and review meaning remain understandable without color or decorative graphs.
