# Apex Log UI direction

Researched and implemented September 14, 2026.

## Research

- [TradeZella: Getting started](https://help.tradezella.com/en/articles/13863136-getting-started-with-tradezella): persistent left navigation, top-level filters, overview metrics, and separate journal/report workflows. This informed the workspace shell and clear overview → journal → analytics navigation.
- [TradeZella: Dashboard widgets](https://help.tradezella.com/en/articles/7118437-understanding-dashboard-widgets-and-stats): profit/loss, win percentage, and profit factor are prominent summary metrics. This informed the four-card performance row.
- [TraderSync: Features](https://tradersync.com/features/): configurable dashboards, filtering, trade context, analytics, and risk tracking. This informed the emphasis on legible data and fast movement from a summary into detailed review.
- [TradesViz: Forex journal](https://www.tradesviz.com/forex/): customizable analytics and analysis of setups, mistakes, and trading periods. This reinforced surfacing patterns alongside the trade history.

These sources informed the information hierarchy. The visual identity is an original direction for Apex Log; competitor features are not promises of Apex Log functionality.

## Approved visual reference

The September 14 Studio Black dashboard supplied by the user is the implementation reference. The former mint direction is replaced by charcoal surfaces, amber controls and charts, periwinkle glass, a cinematic mountain header, and the folded glass Apex emblem.

Core tokens are in `src/styles/studio.css`, imported after the shared base stylesheet: background #0d1013, surface #14181d, border #2b3440, amber #f1b657, green #67dfa0, coral #f08086, blue #99b1ed, primary text #f1f3f8. Interface text uses Inter with local sans-serif fallbacks.

## Implemented

- Slim icon navigation rail, Apex wordmark, account menu, date filter, and amber Log trade action.
- Mountain greeting header, integrated performance strip, amber equity chart, compact recent-trades table, glass session-review card, daily focus checklist, and weekly P&L bars.
- All-time, 7/30/90-day, and current-month dashboard filters. Cumulative, daily, weekly, and monthly chart grouping operates on actual completed journal entries.
- Current/previous-week bar chart, persisted daily checklist progress, and links that open the selected trade's details.
- Session review page summarizing calculated setup, mistake, risk, and note statistics; it retains the dashboard's selected period.
- Settings page with account context and a persisted animation preference. System reduced-motion preferences always take priority.
- Shared charcoal/amber styling for analytics, journal, playbooks, trade entry, administration, authentication, and the landing page.
- Responsive mobile drawer, stacked dashboard cards, horizontally scrollable trade tables, keyboard focus states, and reduced-motion support.

Values are derived from the journal rather than reproducing the illustration's fictional account figures. Session observations use deterministic calculations. Existing voice entry retains its transcription integration; no new remote AI service is introduced.

## Artwork

Created using the built-in image-generation tool, guided by the supplied dashboard image. These decorative images contain no interface labels or statistics:

- `public/images/studio-mountains.png`: dark cinematic mountain range at dusk, warm horizon, near-black foreground, wide composition suitable for the shallow greeting banner.
- `public/images/studio-prism.png`: folded translucent amber and cool-blue glass chevrons forming an abstract Apex emblem, dark studio backdrop, reflected floor, right-weighted composition for the session-review card.

CSS handles masking, lighting overlays, glass surfaces, entrance transitions, responsive layout, and the emblem's perspective hover movement. Essential interface content remains live HTML and SVG.

## Verification

- Production build passed.
- 62 tests passed, including nine new tests for date boundaries, chart grouping, completed-trade handling, and current/previous-week aggregation.
- ESLint: run `npm run lint`; auth context access and the provider now live in separate modules.
- Browser checks in demo mode: date filters, daily chart grouping, previous-week selection, checklist persistence and restoration, filtered session review, expanded trade deep links, animation preference, and mobile navigation.
- Visual inspection at 1586px desktop and 390px mobile widths. Dashboard and analytics had no document-level horizontal overflow; wide trade tables scroll within their containers.
- No browser console errors observed during the checks.

Preview uses the existing `VITE_DEMO_MODE=true` flag in the dev process only. No environment file was changed. Live account authentication and microphone transcription were not exercised as part of the visual checks.
