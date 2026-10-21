# Spatial XI — Football Spatial Analysis

A small, static football analytics portfolio built with React, Python and StatsBomb Open Data.

## Run locally

```bash
npm install
python scripts/download_data.py
npm run dev
```

## Data

The Python script downloads a small set of publicly available StatsBomb matches, extracts passes and shots, and writes compact JSON files to `public/data/`. Missing locations are never invented. An unavailable download does not overwrite existing JSON files.

## Deployment

Enable **Settings → Pages → Build and deployment → GitHub Actions**. The deployment workflow builds the Vite site and publishes it automatically. The data workflow runs daily, updates JSON when possible, and commits changes. You can also launch it manually in the Actions tab.

StatsBomb Open Data: https://github.com/statsbomb/open-data — comply with its data attribution requirements.

## Roadmap

The first release includes a module overview and Match Explorer with passing and shooting events. Other modules are planned, not simulated.
