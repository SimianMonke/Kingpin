# Cyberpunk Diegetic Interface Design Checklist

## I. Core Design Philosophy & Strategy

* [ ] **Diegetic Materiality:** The interface must not act as an invisible layer but as a physical "user terminal" existing within the narrative logic of the game universe.
* [ ] **High-Tech, Low-Life Aesthetic:** Reconcile the tension between advanced technology (holography, neon, glass) and systemic decay (glitch, noise, industrial roughness).
* [ ] **Heavy Interaction Optimization:** Prioritize "expert" workflows and efficiency for complex tasks like inventory sorting over simplicity.
* [ ] **Performance Parity:** The web app must use Optimistic UI patterns to match the 60 FPS responsiveness of the native game client.
* [ ] **Visual Honesty:** System states should be transparent; loading screens are "initialization sequences" and errors are "system failures," avoiding polite corporate aesthetics.
* [ ] **Accessibility in Chaos:** Ensure WCAG 2.2 compliance (contrast) even against chaotic, high-contrast game backgrounds using adaptive dimming.

## II. Design System Foundation (Tokens & Core Components)

* [ ] **Define the "Neon Noir" Color Palette:** 
    * [ ] **Background Base:** `Deep Void` (#050505) to prevent OLED smearing.
    * [ ] **Surface Layer:** `Obsidian Glass` (#121212) with high saturation blur.
    * [ ] **Primary Accent:** `Electric Cyan` (#00FFF1) for "safe" states and clean data.
    * [ ] **Secondary Accent:** `Neon Magenta` (#FF008D) for critical status or organic data.
    * [ ] **Error State:** `System Red` (#FF2A6D) for destructive actions and lockouts.
* [ ] **Establish the "Liquid Glass" Materiality:**
    * [ ] **Composition:** Use `backdrop-filter: blur(16px) saturate(180%)` to allow background colors to "bleed" through vibrantly.
    * [ ] **Adaptive Dimming:** Interpolate a dark dimming layer (35-50% opacity) to ensure text contrast against bright backgrounds.
    * [ ] **Optical Refraction:** Simulate distortion of background elements behind UI panels to imply mass and separate control layers from the world.
* [ ] **Establish Neo-Brutalist Structuralism:**
    * [ ] **Hard Edges:** Use sharp or chamfered (45-degree cut) corners; reject rounded "pill" buttons.
    * [ ] **Thick Borders:** Define elements with 2px-4px high-contrast borders (Cyan/Green).
    * [ ] **Hard Shadows:** Use solid, 45-degree offset shadows (no blur) to create a "chip" or cartridge metaphor.
    * [ ] **Exposed Grid:** Make layout grid lines visible as "struts" to imply access to the system's underlying structure.
* [ ] **Typographic System:**
    * [ ] **Headings:** `Orbitron` (Geometric Sans), uppercase, with wide tracking for a cinematic feel.
    * [ ] **Data/Body:** `Space Mono` (Monospaced) to align numbers in tables and reinforce the terminal aesthetic.
    * [ ] **Kinetic Text:** Use number tickers for stats to make data feel "live" rather than static.

## III. Layout, Visual Hierarchy & Structure

* [ ] **Modular Information Density (Bento Grids):**
    * [ ] **Compartmentalization:** Every distinct data context lives in its own cell; no floating content.
    * [ ] **Variable Scale:** Use varying cell sizes (1x1, 2x2, 2x4) to imply hierarchy, with "Hero" cells occupying central blocks.
    * [ ] **Interactive Cells:** Implement "Card Play" where hovering expands a cell (e.g., revealing a sparkline graph) without cluttering the initial view.
* [ ] **Adaptive Navigation Patterns:**
    * [ ] **Desktop (Rail):** Use a persistent vertical Navigation Rail on the left edge for stability and deep hierarchy navigation.
    * [ ] **Mobile (Hybrid Bar):** Use a bottom bar for the top 4 actions, with a 5th "System/More" slot opening a drawer for secondary items.
    * [ ] **Drill-Down Navigation:** Replace breadcrumbs with a Master-Detail slide-over pattern on mobile to save vertical space.
* [ ] **Digital Decay & Imperfection:**
    * [ ] **Chromatic Aberration:** Trigger RGB shifts (Red/Cyan offset) on interactions like hover or error to simulate signal interference.
    * [ ] **Scanlines & Vignette:** Overlay subtle scanlines (<5% opacity) and vignettes to texture flat colors.
    * [ ] **Noise Texture:** Apply static noise to backgrounds to prevent color banding and add grit.

## IV. Interaction Design & Animations

* [ ] **Tactile Feedback (The "Chip" Metaphor):**
    * [ ] **Physical Depress:** On click, hard shadows should disappear, and the element should translate (`4px, 4px`) to mimic a mechanical keypress.
    * [ ] **Haptic/Visual Response:** All actions must trigger feedback (glitch, flash, border color change).
* [ ] **Optimistic UI (Zero Latency Illusion):**
    * [ ] **Immediate Mutation:** Visually update state (e.g., move an item) instantly before server confirmation.
    * [ ] **Glitch Rollback:** If the API call fails, snap the item back and trigger a "glitch" visual effect as a narrative justification for the error.
* [ ] **Input Physics:**
    * [ ] **Touch Targets:** Maintain 48x48dp touch targets using invisible padding, even for smaller "dense" icons.
    * [ ] **Hover Paradox:** Use `@media (hover: hover)` to ensure hover effects (glows, glitches) do not stick on touch devices.

## V. Specific Module Design Tactics

### A. Inventory Management (The "Tetris" Grid)

* [ ] **Desktop Paradigm (Collision-Aware):**
    * [ ] Implement drag-and-drop mechanics that mimic the in-game cursor.
    * [ ] Use 2D bin-packing logic to highlight valid slots in green and invalid overlaps in red (ghosting).
* [ ] **Mobile Paradigm (Tap-to-Move):**
    * [ ] Abandon drag-and-drop for a "Tap-to-Select, Tap-to-Move" model to avoid "fat finger" errors.
    * [ ] Tapping an item opens an action bar; tapping a destination executes the transfer.
* [ ] **State Preservation:** The "Back" button must return users to the exact scroll position in the master list to prevent disorientation.

### B. Data & Terminal Interfaces

* [ ] **Generative Streaming:** "Stream" search results or data using typing effects or skeleton loaders to mimic data processing.
* [ ] **Hyper-Focus States:** Use a blinking neon outline (`outline: 2px solid`) and background brightness boost for keyboard/gamepad focus states.
* [ ] **Command Line Aesthetic:** Utilize `Terminal` components for power-user features, styled with "Matrix Green" text and boot sequence animations.

## VI. CSS & Styling Architecture

* [ ] **Tech Stack:**
    * [ ] **Framework:** React 19 (leveraging `useOptimistic` hook).
    * [ ] **Styling:** Tailwind CSS v4 with `@theme` directives for cyberpunk variables.
    * [ ] **Component Libraries:** Magic UI (for high-fidelity animations) and 21st.dev.
* [ ] **Data Architecture (Manifest Pattern):**
    * [ ] Decouple static data (lore, icons) from dynamic state using a locally cached "Manifest" database to reduce API payloads by ~90%.
* [ ] **Agentic Development Workflow:**
    * [ ] **Design Tokens:** Define semantic tokens (e.g., `{{terminal-accent-primary}}`) for AI agents to prevent color hallucinations.
    * [ ] **MCP Integration:** Configure Claude Code with `mcp-magic-ui` to automate component construction.

## VII. Testing & Validation Strategy

* [ ] **Visual Regression Testing:**
    * [ ] Use Playwright MCP to snapshot "Static," "Hover," and "Active" states[cite: 317].
    * [ ] Perform pixel-diffing to ensure CSS updates do not break rendering-intensive effects like blur filters or neon glows.
* [ ] **Interaction Testing:**
    * [ ] Automate "Tetris" grid testing: Simulate drag events to assert "Invalid Drop" (red glow) and "Success" (green glow) states.