# Cyberpunk Design System: Style Guide

## 1. Design Philosophy
This system implements a **Diegetic Interface** philosophy. The UI is not an invisible layer; it is a physical "user terminal" existing within the narrative logic of the game world. It combines **Neo-Brutalism 2.0** (structural aggression, raw utility) with **Liquid Glass** physics (optical depth, refraction) to create a "High-Tech, Low-Life" aesthetic.

---

## 2. Typography
The typographic system contrasts cinematic, geometric headers with raw, monospaced data streams to reinforce the "terminal" metaphor.

### Primary Display: `Orbitron`
* **Usage:** Section headers, module titles, status indicators (e.g., "SECTOR 7", "INVENTORY").
* **Style Rules:**
    * **Case:** Always **UPPERCASE**.
    * **Tracking:** `tracking-widest` (Extended letter-spacing) to evoke a cinematic sci-fi feel.
    * **Weights:** Variable, typically Bold or Black for emphasis.

### Functional Data: `Space Mono` (or `IBM Plex Mono`)
* **Usage:** Item statistics, lore descriptions, tables, and body text.
* **Rationale:** Ensures numbers align perfectly in tables and mimics legacy CRT terminal displays.
* **Style Rules:**
    * **Case:** Sentence case or lowercase for code snippets.
    * **Readability:** Maintain high contrast against dark backgrounds.

---

## 3. Color System: "Neon Noir"
The palette balances OLED energy efficiency ("Void") with high-energy neon accents.

### Base Layers
| Token | Hex | Usage | Rationale |
| :--- | :--- | :--- | :--- |
| **Deep Void** | `#050505` | App Background | Prevents OLED "smearing" (black trails) while saving battery. |
| **Obsidian Glass** | `#121212` | Card/Panel Backgrounds | Used with `backdrop-filter` to create the tinted glass surface. |
| **Dimming Layer** | `rgba(18,18,18, 0.65)` | Text Backdrops | Interpolated behind text to ensure WCAG contrast against bright game scenes. |

### Accent Colors
| Token | Hex | Usage | Rationale |
| :--- | :--- | :--- | :--- |
| **Electric Cyan** | `#00FFF1` | Primary Actions, Safe State | Represents clean data streams and high-energy plasma. |
| **Neon Magenta** | `#FF008D` | Highlights, "Critical" Status | Represents warning lights or biological/organic data. |
| **System Red** | `#FF2A6D` | Errors, Destructive Actions | Universal signifier of danger or system lockout. |
| **Terminal Green** | `#00FF9F` | Console Text, Success | Nods to legacy monochrome CRT phosphors. |
| **Retro Amber** | `#FFB000` | Warnings, Legacy Tech | Secondary terminal text color. |

---

## 4. Materiality & Effects

### Liquid Glass (The Surface)
The primary surface is not opaque plastic but a refractive glass pane.
* **CSS Composition:** `backdrop-filter: blur(16px) saturate(180%)`.
    * *Note:* The 180% saturation boost is critical to prevent the UI from looking "gray" or muddy. It allows background colors to "bleed" through with intensified vibrancy.
* **Optical Refraction:** Background elements should appear slightly distorted behind panels to imply mass and index of refraction.

### Digital Decay (The Texture)
The interface must feel "lived-in" and scavenged.
* **Chromatic Aberration:** Text and borders should occasionally split into RGB channels (Red/Cyan offset) on hover or error states.
* **Scanlines:** Overlay a subtle linear-gradient scanline grid (<5% opacity) to add texture to flat colors.
* **Noise:** Apply a dynamic film grain or static noise SVG filter to backgrounds to prevent color banding.

---

## 5. Component Architecture

### Buttons & Interactables (Neo-Brutalist)
* **Shape:** Strictly rectangular or chamfered (45-degree cuts). **No rounded "pill" shapes**.
* **Borders:** Thick, hard-edged borders (2px-4px) in high-contrast colors.
* **Shadows ("The Chip"):**
    * **Static:** Solid color shadow (black), offset 45 degrees, **zero blur**.
    * **Active:** On click, the shadow disappears and the element translates (`4px, 4px`) into the screen.

### Layout: The Bento Grid
* **Structure:** Content is strictly compartmentalized into cells (1x1, 2x2, 2x4) with visible borders/gutters acting as "struts".
* **Hero Cells:** The largest central block is reserved for the primary subject (e.g., Character Model), with data orbiting in smaller cells.
* **Card Play:** Hovering a cell may expand it (e.g., revealing a sparkline graph) to increase information density without initial clutter.

---

## 6. Interaction & Animation

### Micro-Interactions
* **Kinetic Type:** Numbers must "tick" up using a ticker animation rather than appearing instantly.
* **Loading States:** Replace circular spinners with raw data streams, hex dumps, or "initialization sequences".
* **Error States:** Errors are "System Failures" characterized by high-contrast red visuals, screen shake, or chromatic aberration.

### Accessibility Rules
* **Hyper-Focus:** Focus states must use a thick, blinking neon outline (`outline: 2px solid`) combined with a brightness boost to be visible against chaotic backgrounds.
* **Touch Targets:** All interactive elements must maintain a minimum 48x48dp hit area via invisible padding, even if the visual icon is smaller.
* **Hover Paradox:** Glitch/Glow hover effects must be wrapped in `@media (hover: hover)` queries to prevent sticky states on mobile touchscreens.