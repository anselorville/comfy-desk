# UI Design Contract: Phase 2 - Generation Engine

## 1. Visual Identity & Color Palette
- **Theme Focus**: Continues the fresh, minimal, and clean aesthetic established in Phase 1.
- **Backgrounds**: Generation area uses `bg-white` inside a card structure (`shadow-sm`, `ring-1 ring-slate-200`). The gallery uses a slightly darker canvas `bg-zinc-50`.
- **Accents**: 
  - Primary actions (Generate button) use the consistent vibrant accent (e.g., `bg-blue-600 hover:bg-blue-700`).
  - Secondary actions (Prompt enhance) use soft tertiary styles (`text-blue-600 bg-blue-50 hover:bg-blue-100`).

## 2. Typography
- **Font Family**: Inter.
- **Hierarchy**:
  - `label`: text-sm, font-medium, text-slate-700 for configuration options.
  - Image Captions/Progress text: text-xs, text-slate-500.

## 3. Spacing & Layout
- **Generation View**: Split-pane or Sidebar layout.
  - Left/Sidebar: Workflow dropdown, Settings, Prompt Textarea, and nested dynamic parameters (width: `w-80` or `w-1/3`).
  - Right/Main: Real-time image preview and progress visualization.
- **Gallery**: Responsive grid matrix using `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5` with `gap-4`.

## 4. Design System Approach
- **Dynamic Forms**: Renders fields securely using Tailwind classes. Focus states must use standard ring offsets (`focus:ring-2 focus:ring-blue-500 focus:outline-none`).
- **Progress Animation**:
  - Smoothly transitioning width for the progress bar: `transition-[width] duration-300 ease-linear`.
  - Use a subtle pulse animation (`animate-pulse`) when connecting or in "Executing" states waiting for the first progress tick.

## 5. Copywriting & Tone
- **Prompt Enhancement**: "✨ Enhance Prompt" (✨ 扩写提示词).
- **Generation Button**: 
  - "Generate" (生成) when idle.
  - "Busy: Training" (训练占用中) when blocked by sys-mode (disabled).
  - "Generating... (x%)" (生成中...) when active.

## 6. Interaction & Component Contracts
- **Dynamic Workflow Selector**: A clean `<select>` or custom Tailwind Dropdown that instantly triggers a re-render of the parameter form below it with smooth transitons.
- **Real-Time Progress Bar**: A horizontal bar placed directly under the image preview area or floating near the action button, visualizing the SSE progress events (0-100%).
- **Lightbox Component**: When clicking a gallery image, use `yet-another-react-lightbox` to provide a full-screen overlay with zoom, pan, and a dark blurred backdrop (`backdrop-blur-sm bg-black/90`).
