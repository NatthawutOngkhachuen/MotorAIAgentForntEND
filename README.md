# MotoAI Frontend

React + Vite frontend for MotoAI.

## Local Development

```bash
npm ci
npm run dev
```

Create `.env` from `.env.example` and point the frontend to the deployed backend:

```env
VITE_API_BASE_URL=https://motoraiagent.onrender.com
```

## CI/CD and Render Deploy

This repository includes:

- `.github/workflows/frontend-ci-cd.yml` for lint, build, and Render deploy trigger.
- `render.yaml` for the Render Static Site configuration.

Required GitHub repository secret:

```text
RENDER_DEPLOY_HOOK_URL
```

Get this value from the Render frontend service deploy hook, then save it in:

```text
GitHub repository > Settings > Secrets and variables > Actions > Repository secrets
```

Render also needs this environment variable on the frontend service:

```text
VITE_API_BASE_URL=https://motoraiagent.onrender.com
```

For this Vite app, the backend URL is baked into the frontend at build time, so redeploy the frontend after changing `VITE_API_BASE_URL`.

## Useful Commands

```bash
npm run lint
npm run build
npm run preview
```
