# Student Feedback

A responsive text-first student feedback platform. Students write natural-language feedback, while administrators review sentiment, topics, priority, trends, and follow-up actions.

## Tech stack

- Frontend: React 18, Vite, Recharts, responsive CSS
- Backend: Python, FastAPI, Uvicorn
- ML analysis: lightweight multilingual sentiment scoring, keyword topic detection, and rule-based priority scoring
- Data and authentication: Supabase PostgreSQL, Supabase Auth, Row Level Security
- Deployment: Vercel frontend and Vercel Python backend
- API: REST/JSON

The lightweight analyzer is intentional: the original Transformers/PyTorch model exceeded Vercel's 500 MB serverless function limit. The API preserves the same sentiment, confidence, scores, aspect, priority, and pipeline-stage response fields without the oversized runtime.

## Features

- Student signup and email confirmation
- Student login and private feedback history
- English and Telugu text input
- Automatic sentiment: positive, neutral, or negative
- Automatic topic detection: Teaching, Labs, Infrastructure, Canteen, Exams, Library, or General
- Automatic priority: High, Medium, or Low
- Protected HOD/Admin login
- Admin dashboard with search, filters, charts, topic trends, and action tracking
- Student and admin password recovery through Supabase Auth email links
- Light and dark themes

## Admin access

Create the administrator in Supabase Auth rather than through student signup:

- Email: `admin@studentfeedback.in`
- Password: set this privately in Supabase Auth; do not commit it to GitHub

The application recognizes this reserved email as the admin account, and the database trigger creates its `profiles.role` as `admin`.

## Local setup

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env
python main.py
```

### Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Set `VITE_ML_API_URL=http://127.0.0.1:8000` for local development.

## Supabase setup

1. Run `supabase_schema.sql` in the Supabase SQL Editor.
2. Create the admin Auth user privately.
3. Enable Email Auth and custom SMTP if password emails are required.
4. Add the local and deployed `/reset-password` URLs under Auth URL Configuration.
5. Never expose a service-role key, SMTP password, or admin password in frontend code or GitHub.

## Deployment

The frontend is a Vite static deployment. The backend is a separate Vercel Python deployment using `backend/api/index.py` and `backend/vercel.json`.

Required frontend environment variables:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_ML_API_URL=https://your-backend.vercel.app
```

Required backend environment variables:

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
FRONTEND_ORIGINS=https://your-frontend.vercel.app
```

The Vercel frontend deployment also includes `vercel.json` so direct auth callback routes resolve to `index.html`.
