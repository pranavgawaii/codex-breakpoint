# Breakpoint Design System Specification

## Visual Architecture

Breakpoint uses a modern dark theme inspired by high-precision observability runtimes and telemetry cockpits.

### Color Tokens

- **Canvas & Backgrounds**:
  - Base canvas: `#090D16` (Deep Obsidian Sapphire)
  - Subtle background: `#0D1322`
  - Surfaces: `#121A2D` (Primary panel surface)
  - Elevated surfaces: `#18233C`
  - Surface glass: `rgba(18, 26, 45, 0.85)` with blur filter

- **Ink & Typography**:
  - Primary ink: `#F8FAFC` (Slate 50)
  - Secondary ink: `#CBD5E1` (Slate 300)
  - Muted ink: `#94A3B8` (Slate 400)
  - Faint ink: `#64748B` (Slate 500)

- **Accents & Signals**:
  - Primary accent: `#38BDF8` (Electric Cobalt / Sky 400)
  - Accent secondary: `#0EA5E9` (Sky 500)
  - Success signal: `#10B981` (Emerald 500)
  - Warning signal: `#F59E0B` (Amber 500)
  - Danger signal: `#F43F5E` (Rose 500)

### Accessibility & Navigation

- **Skip to Content Link**: An accessible skip link (`.skip-link`) is embedded at the top of all workflow pages. It remains off-screen by default and smoothly reveals itself on keyboard tab focus (`:focus-visible`), ensuring screen reader accessibility without disrupting visual hierarchy.
- **Micro-Interactions**: Metric cards feature GPU-accelerated elevation transforms (`translateY(-2px)`) and luminous border hover glows.
