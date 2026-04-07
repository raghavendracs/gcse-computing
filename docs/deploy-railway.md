# Deploy to Railway

This guide walks through deploying all three services (API, Web, Python Sandbox) and a MongoDB database on [Railway](https://railway.com).

## Overview

Railway deploys each service from the same repo using per-service root directory and Dockerfile settings. The final setup looks like:

```
┌─────────────────────────────────────────────────┐
│  Railway Project                                │
│                                                 │
│  ┌───────────┐  ┌───────────┐  ┌────────────┐  │
│  │  MongoDB   │  │  Python   │  │    API     │  │
│  │  (plugin)  │  │  Sandbox  │  │  Express   │  │
│  └─────┬─────┘  └─────┬─────┘  └─────┬──────┘  │
│        │               │              │         │
│        │        private network       │         │
│        └───────────────┼──────────────┘         │
│                        │                        │
│                  ┌─────┴──────┐                  │
│                  │    Web     │                  │
│                  │  Next.js   │                  │
│                  └────────────┘                  │
└─────────────────────────────────────────────────┘
```

## Prerequisites

- A [Railway](https://railway.com) account
- This repo pushed to GitHub
- An [Anthropic API key](https://console.anthropic.com/)

## Step 1 — Create a Railway Project

1. Go to [railway.com/new](https://railway.com/new)
2. Select **Deploy from GitHub repo** and connect this repository
3. Railway will detect the monorepo — **don't deploy yet**, cancel the initial deploy

## Step 2 — Add MongoDB

1. In your project, click **+ New** → **Database** → **MongoDB**
2. Railway provisions a MongoDB instance and exposes a `MONGO_URL` variable
3. Note: Railway's MongoDB variable is called `MONGO_URL` — we'll map it to `MONGODB_URI` in the API service

## Step 3 — Deploy the Python Sandbox

1. Click **+ New** → **GitHub Repo** → select this repo
2. Go to the service **Settings**:
   - **Service Name**: `python-sandbox`
   - **Root Directory**: `/apps/python-sandbox`
   - **Builder**: Dockerfile
   - **Dockerfile Path**: `Dockerfile`
3. Add environment variables in the **Variables** tab:

   | Variable | Value |
   |----------|-------|
   | `MAX_TIMEOUT_MS` | `5000` |
   | `PORT` | `8000` |

4. In **Settings** → **Networking**:
   - **Do NOT** generate a public domain (this service should only be reachable internally)
   - Railway automatically assigns an internal hostname: `python-sandbox.railway.internal`

5. Deploy

## Step 4 — Deploy the API

1. Click **+ New** → **GitHub Repo** → select this repo
2. Go to the service **Settings**:
   - **Service Name**: `api`
   - **Root Directory**: `/` (root, because the Dockerfile needs the full monorepo context)
   - **Builder**: Dockerfile
   - **Dockerfile Path**: `apps/api/Dockerfile`
3. Add environment variables in the **Variables** tab:

   | Variable | Value |
   |----------|-------|
   | `PORT` | `3001` |
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | `${{MongoDB.MONGO_URL}}` (Railway variable reference) |
   | `JWT_SECRET` | Generate a random 32+ char string |
   | `ANTHROPIC_API_KEY` | `sk-ant-...` (your key) |
   | `PYTHON_SANDBOX_URL` | `http://python-sandbox.railway.internal:8000` |
   | `WEB_URL` | Set this after deploying the web service (Step 5) |

4. In **Settings** → **Networking**:
   - Generate a **public domain** (e.g. `api-production-xxxx.up.railway.app`)
   - Note this URL — you'll need it for the web service

5. In **Settings** → **Healthcheck**:
   - **Path**: `/health`

6. Deploy

## Step 5 — Deploy the Web Frontend

1. Click **+ New** → **GitHub Repo** → select this repo
2. Go to the service **Settings**:
   - **Service Name**: `web`
   - **Root Directory**: `/` (root, because the Dockerfile needs the full monorepo context)
   - **Builder**: Dockerfile
   - **Dockerfile Path**: `apps/web/Dockerfile`
3. Add environment variables and build arguments in the **Variables** tab:

   | Variable | Value |
   |----------|-------|
   | `PORT` | `3000` |
   | `NODE_ENV` | `production` |
   | `NEXT_PUBLIC_API_URL` | `https://api-production-xxxx.up.railway.app` (your API's public URL from Step 4) |

   > **Important**: `NEXT_PUBLIC_API_URL` is baked into the Next.js bundle at build time. If you change the API URL later, you must redeploy the web service.

4. In the Dockerfile build args section (or Railway's build config), ensure `NEXT_PUBLIC_API_URL` is passed as a build argument. Railway passes all variables as both runtime env vars and build args by default.

5. In **Settings** → **Networking**:
   - Generate a **public domain** (e.g. `web-production-xxxx.up.railway.app`)
   - Optionally add a custom domain

6. Deploy

## Step 6 — Update the API's WEB_URL

Now that the web service has a public URL:

1. Go back to the **api** service → **Variables**
2. Set `WEB_URL` to your web service's public URL (e.g. `https://web-production-xxxx.up.railway.app`)
3. This configures CORS to allow requests from the frontend
4. The API will automatically redeploy

## Step 7 — Seed the Database

After all services are running:

1. Go to the **api** service in Railway
2. Open the **Shell** tab
3. Run:

   ```bash
   node dist/seed/index.js
   ```

   Or alternatively, connect to the API container locally via Railway CLI:

   ```bash
   railway run --service api pnpm --filter @gcse/api seed
   ```

## Environment Variables Summary

### API Service
| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | `3001` |
| `NODE_ENV` | Yes | `production` |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Random secret, min 32 characters |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for AI features |
| `PYTHON_SANDBOX_URL` | Yes | Internal URL to Python sandbox |
| `WEB_URL` | Yes | Frontend URL (for CORS) |

### Web Service
| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | `3000` |
| `NODE_ENV` | Yes | `production` |
| `NEXT_PUBLIC_API_URL` | Yes | Public API URL (build-time) |

### Python Sandbox
| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | `8000` |
| `MAX_TIMEOUT_MS` | No | Code execution timeout (default: `5000`) |

## Custom Domain

To use a custom domain (e.g. `app.yourdomain.com`):

1. Go to the **web** service → **Settings** → **Networking**
2. Click **+ Custom Domain** and enter your domain
3. Add the CNAME record Railway provides to your DNS
4. Update the **api** service's `WEB_URL` to match the custom domain
5. If you also want a custom API domain, repeat for the api service and redeploy web with the updated `NEXT_PUBLIC_API_URL`

## Estimated Costs

Railway's pricing is usage-based. For a small deployment:

| Service | Estimated Monthly Cost |
|---------|----------------------|
| MongoDB | ~$5–10 |
| API | ~$5–7 |
| Web | ~$5–7 |
| Python Sandbox | ~$3–5 |
| **Total** | **~$18–29/month** |

Costs vary based on traffic and usage. Railway offers a $5 free trial credit for new accounts.

## Troubleshooting

### API can't connect to MongoDB
- Check that `MONGODB_URI` uses the Railway variable reference syntax: `${{MongoDB.MONGO_URL}}`
- Ensure MongoDB service is running and healthy

### Web shows network errors
- Verify `NEXT_PUBLIC_API_URL` points to the API's **public** domain with `https://`
- Check the API's `WEB_URL` matches the web service's domain (CORS)
- Remember: changing `NEXT_PUBLIC_API_URL` requires a **rebuild** of the web service

### Python sandbox unreachable from API
- Ensure `PYTHON_SANDBOX_URL` uses the **internal** hostname: `http://python-sandbox.railway.internal:8000`
- The sandbox should **not** have a public domain — it communicates over Railway's private network

### Build fails
- Railway needs the full monorepo context for API and Web builds. Ensure **Root Directory** is `/` (not `/apps/api`) for these services, with the Dockerfile path pointing to the correct Dockerfile
