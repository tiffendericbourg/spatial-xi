# Spatial XI — Football Spatial Analysis

A small, static football analytics portfolio built with React, Python and StatsBomb Open Data.

## Run locally

```bash
npm install
python scripts/download_data.py
npm run dev
```

## Data

The Python script downloads all available matches from StatsBomb's men's 2018 World Cup competition (competition 43, season 3), extracts passes and shots, and writes compact JSON files to `public/data/`. Missing locations are never invented. An unavailable download does not overwrite existing JSON files.

## Deployment

Enable **Settings → Pages → Build and deployment → GitHub Actions**. The deployment workflow builds the Vite site and publishes it automatically. The data workflow runs daily, updates JSON when possible, and commits changes. You can also launch it manually in the Actions tab.

StatsBomb Open Data: https://github.com/statsbomb/open-data — comply with its data attribution requirements.

## Roadmap

The Match Explorer supports country and match selection, passes and shots on an interactive pitch, team and player filters, period selection, recorded xG and passing completion rate. Individual JSON files are cached between data refreshes; a failed download does not replace a valid cached match. Other modules are planned, not simulated.
