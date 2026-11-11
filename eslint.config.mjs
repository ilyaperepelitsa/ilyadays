import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-aurelius/**",
    ".next-aurelius-test/**",
    ".aurelius/**",
    "apps/aurelius/.venv/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "test-results/**",
    "playwright-report/**",
    // Generated / vendored: the Istanbul app bundle, exported recipe content, sibling-repo art scripts.
    "public/**",
    "content/**",
    "art/**",
    // Local QA screenshots, logs and one-off browser scripts (gitignored).
    "output/**",
  ]),
  {
    // content/fitness/exercises.json (all exercises, ~590 KB) reaches the browser through any client component that
    // imports catalog.mjs; catalog.mjs itself says client code imports catalog-core.mjs. Most files in this folder are
    // client code without their own "use client" (they are imported by one), so the rule covers the whole folder and
    // lists who may import the catalog.
    files: ["src/components/fitness/**/*.{ts,tsx}"],
    ignores: [
      // Server components: the catalog stays on the server.
      "src/components/fitness/Shell.tsx",
      "src/components/fitness/exercises/ExerciseDetail.tsx",
      // Client screens that run the training engine (tracker / session / progression / templates .mjs), which imports
      // the catalog itself: the JSON is in their bundle either way. Do not add files to this list — to shrink it, give
      // the engine a catalog-free core first, then pass these components trimmed data from their server views.
      "src/components/fitness/home/HomePanel.tsx",
      "src/components/fitness/train/{ExerciseBlock,SessionSummary,SessionTracker,StartPanel,SwapSheet}.tsx",
      "src/components/fitness/program/{DayCard,DaysSwitch,PlanConstructor,ProgramEditor,ProgressionSettings,SlotRow}.tsx",
      "src/components/fitness/profile/{PlanPreview,ProfilePanel}.tsx",
      "src/components/fitness/tools/LoadCalculator.tsx",
      // Rendered inside the program and profile screens above (needs: first picture's thumbnail URL and the name's
      // initials per exercise id).
      "src/components/fitness/ExerciseThumbnail.tsx",
    ],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@/lib/fitness/catalog.mjs", "**/lib/fitness/catalog.mjs"],
          message: "Client components must not import the full exercise catalog: use catalog-core.mjs, or pass the data as props from the server view.",
        }],
      }],
    },
  },
]);

export default eslintConfig;
