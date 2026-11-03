# Spatial XI — Football Spatial Analysis

A small, static football analytics portfolio built with React, Python and StatsBomb Open Data.

## Run locally

```bash
npm install
python scripts/download_data.py
npm run dev
```

## Data

The Python script downloads StatsBomb's available men's World Cup 2018 and 2022 matches (competition 43, seasons 3 and 106), extracts passes, shots and goalkeeper events, and writes compact JSON files to `public/data/`. Missing locations are never invented. An unavailable download does not overwrite existing JSON files.

## Deployment

Enable **Settings → Pages → Build and deployment → GitHub Actions**. The deployment workflow builds the Vite site and publishes it automatically. The data workflow runs daily, updates JSON when possible, and commits changes. You can also launch it manually in the Actions tab.

StatsBomb Open Data: https://github.com/statsbomb/open-data — comply with its data attribution requirements.

## Explorer and goalkeeper analysis

The **Matches** page offers match selection, passing and shot maps, player/period filters, recorded xG and a custom pass-efficiency index.

The separate **Goalkeepers** page offers:
- Observed goalkeeper event locations (2018 and 2022), mirrored into the shot map's attacking direction.
- Open-play shot origins by attacking left/centre/right channel, with goals and xG (team-level, **not** proof of an individual goalkeeper weakness).
- Goalkeeper depth and alignment with the shot-to-goal ray, plus nearest *visible* defender, when 2022 StatsBomb 360 shots have the required coordinates.
- Positions at opposing corner deliveries, when the goalkeeper is visible in 360.
- Period and goalkeeper selectors. Team-level shot data remains distinct from the individual player's logged events.

2018 does not have the same 360 coverage here; unavailable measurements display missing-data messaging rather than being estimated. A logged action near a corner is **not** proof of a successful claim. StatsBomb uses a 120 × 80 pitch; metre distances are approximations using a 105 × 68 m pitch.

Individual JSON files are cached between data refreshes; a failed download does not replace a valid cached match.
