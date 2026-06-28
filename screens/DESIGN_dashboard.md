---
name: DeFi & Fintech Protocol System
colors:
  surface: '#0f131c'
  surface-dim: '#0f131c'
  surface-bright: '#353943'
  surface-container-lowest: '#0a0e17'
  surface-container-low: '#181b25'
  surface-container: '#1c1f29'
  surface-container-high: '#262a34'
  surface-container-highest: '#31353f'
  on-surface: '#dfe2ef'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#dfe2ef'
  inverse-on-surface: '#2c303a'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#ca8100'
  on-tertiary-container: '#3e2400'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#0f131c'
  on-background: '#dfe2ef'
  surface-variant: '#31353f'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  data-lg:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 24px
  data-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding-mobile: 16px
  container-padding-desktop: 32px
  gutter: 24px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
  card-padding: 24px
---

## Brand & Style

The brand personality is rooted in **precision, institutional trust, and technological foresight**. This design system targets sophisticated DeFi users and fintech professionals who require high data density without the cognitive load often found in traditional trading platforms.

The design style is **Corporate Modern with a Technical Edge**. It utilizes a "Dark Mode First" philosophy to reduce eye strain during long sessions of market analysis. The aesthetic relies on high-contrast typography, strict grid alignment, and a sophisticated use of depth through subtle border strokes rather than heavy shadows. The emotional response should be one of "controlled power"—users should feel they are using a highly capable, secure, and professional-grade financial instrument.

## Colors

This design system utilizes a palette optimized for high-readability in low-light environments. 

- **Foundation**: The background uses a deep navy to provide a sense of infinite depth, while surfaces use a slightly lighter slate to create a clear container hierarchy.
- **Accents**: The Electric Blue primary color is reserved for high-intent actions and navigation highlights. 
- **Semantic Logic**: In a financial context, green is strictly reserved for positive yield, growth, and "success" states. Amber is used for risk warnings or pending transactions, while Red is used for critical errors or liquidations.
- **Contrast**: Headings must maintain a contrast ratio of at least 7:1 against the background for maximum legibility.

## Typography

The typography system is split into two distinct functional roles:
1.  **Narrative & UI (Inter):** Used for all interface labels, instructions, and headlines. It provides a human, approachable feel to an otherwise technical interface.
2.  **Tabular Data & Metrics (JetBrains Mono):** Used for wallet addresses, transaction hashes, asset balances, and price feeds. The monospaced nature ensures that numbers do not "jump" when values update rapidly (e.g., ticking price feeds) and improves character recognition for complex alphanumeric strings.

Use `label-caps` for table headers and section overlines to distinguish them from interactive content.

## Layout & Spacing

The design system employs a **Fluid-Fixed Hybrid Grid**. The main layout container follows a 12-column structure on desktop with a max-width of 1440px to ensure readability on ultra-wide monitors.

- **Rhythm**: All spacing is based on a 4px baseline grid. Components should use 16px (stack-md) or 24px (stack-lg) for vertical separation to maintain an uncluttered feel.
- **Density**: While the design is "generous," data tables may switch to a "compact" mode (8px padding) to allow for 15+ rows of visibility without scrolling.
- **Mobile**: On mobile, the 12-column grid collapses to a 4-column grid. Horizontal margins are reduced to 16px to maximize the utility of the limited screen width for data charts.

## Elevation & Depth

Depth in this system is achieved through **Tonal Layering and Low-Contrast Outlines**. 

- **Level 0 (Background):** #0A0E17. The lowest plane.
- **Level 1 (Cards/Surfaces):** #121826. Used for the main content areas. These surfaces must have a 1px solid border of #1F2937 to define their edges.
- **Level 2 (Modals/Popovers):** #1E293B. For elements that temporarily float above the UI. These receive a subtle, ultra-diffused 20% opacity black shadow with a 32px blur to separate them from Level 1.

Avoid the use of heavy shadows or glows, except for active state indicators on primary buttons where a soft blue outer glow (8px blur, 30% opacity) may be applied.

## Shapes

The shape language is consistently **Rounded**. 

- **Cards & Major Containers:** Use a 16px (`rounded-xl`) corner radius to soften the technical nature of the data.
- **Buttons & Inputs:** Use an 8px (`rounded-md`) radius to provide a distinct look from the larger containers they sit within.
- **Status Pills:** Use a fully rounded/pill-shaped radius for badges and tags to immediately distinguish them from interactive buttons.

Border weights are strictly 1px. Avoid 2px+ borders as they degrade the professional, high-precision aesthetic.

## Components

- **Buttons:** 
  - *Primary:* Electric Blue background, white text. High-emphasis.
  - *Secondary:* Transparent background, 1px #1F2937 border. For secondary actions.
- **Input Fields:** Use the #121826 surface color. Active state features a 1px Electric Blue border. Use JetBrains Mono for the input text when users are entering currency amounts.
- **Cards:** The central building block. Must include a consistent 24px internal padding. Title areas should be separated by a subtle 1px horizontal divider.
- **Data Tables:** Use alternating row highlights (zebra striping) only if the data exceeds 10 columns. Use JetBrains Mono for all numerical cells.
- **Yield Badges:** Small chips with #10B981 background at 15% opacity and solid #10B981 text.
- **Charts:** Use thin 1.5px lines for price action. Area charts should use a gradient fill from the accent color (20% opacity) to transparent.