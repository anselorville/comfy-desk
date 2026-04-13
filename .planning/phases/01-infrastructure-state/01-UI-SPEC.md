# UI Design Contract: Phase 1 - Infrastructure & State

## 1. Visual Identity & Color Palette
- **Theme Focus**: Fresh, minimal, and clean (explicitly redesigning away from the previous "dark purple heavy" theme).
- **Backgrounds**: Soft near-whites (e.g., `zinc-50` or `slate-50`) and crisp white (`bg-white`) for card surfaces.
- **Accents**: Replacing dark purple with a fresh primary accent (e.g., modern blue or vibrant emerald) that feels lightweight but technical.
- **Text**: `text-slate-900` for primary text, `text-slate-500` for secondary text.

## 2. Typography
- **Font Family**: Inter (Standardized via Next.js Google Fonts implementation).
- **Hierarchy**:
  - `h1`: 2xl, font-semibold (for page titles).
  - `h2`: lg, font-medium (for section headers).
  - `body`: text-sm or text-base tracking-normal.

## 3. Spacing & Layout
- **Containers**: Responsive max-width `max-w-7xl` with generous padding `px-4 sm:px-6 lg:px-8`.
- **Spacing Scale**: Strict adherence to Tailwind's 4-point spacing grid. Use `gap-6` for distinct component sections, and `gap-3` for tight groupings.
- **Micro-interactions**: Use generic Tailwind animations (`transition-all duration-200 ease-in-out`).

## 4. Design System Approach
- **CSS Strategy**: Move away from inline styles using `style={{...}}`. Strictly utilize Tailwind CSS 4 utility classes directly within JSX.
- **Custom Properties**: Ensure any custom CSS tokens (in `globals.css`) strictly map to the fresh/clean aesthetic and are aliased into Tailwind classes properly.

## 5. Copywriting & Tone
- **Tone**: Technical, approachable, minimal. 
- **Language**: English/Chinese mixed (retain existing navigation names: 生成 / 画廊 / 标注, but keep logic/API keys standard).
- **Status Indicators**:
  - "Idle" (空闲)
  - "Generating" (生成中...)
  - "Training" (训练中...)

## 6. Interaction & Component Contracts
- **System Mode Lock Widget**:
  - A prominent status badge or widget in the global `NavBar`.
  - Visual Feedback: Green pulse to indicate active ComfyUI/backend connection, amber/red for busy/offline.
- **Soft Lock Mechanism**:
  - When the system mode is `Training`, generation specific UI elements (Workflows, Prompts) are rendered as disabled (`opacity-50`, `cursor-not-allowed`).
  - Add a subtle tooltip or warning banner: "System occupied by training task. Generation disabled."
