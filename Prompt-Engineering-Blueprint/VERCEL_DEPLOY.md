## Vercel Deploy (Frontend)

This project has:
- Frontend: Vite React app (`Prompt-Engineering-Blueprint`)
- Backend: Django API (`/api/...`)

Deploy frontend to Vercel, and host Django separately (Railway/Render/VM/etc).

### 1) Push code to GitHub

Push the `Prompt-Engineering-Blueprint` folder with `vercel.json`.

### 2) Import project in Vercel

- New Project -> Import Git repo
- Root Directory: `Prompt-Engineering-Blueprint`

### 3) Set environment variable in Vercel

In Project Settings -> Environment Variables, add:

- `VITE_DJANGO_API_BASE` = `https://<your-django-domain>`

Example:
- `https://api.yourdomain.com`

Do not include trailing slash.

### 4) Deploy

Vercel will use:
- Build command: `npx vite build`
- Output directory: `dist/public`
- SPA rewrite to `index.html` for routes like `/dashboard/:ulr`

### 5) Backend CORS

Allow your Vercel frontend domain in Django CORS settings if required.
