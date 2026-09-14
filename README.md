# Campus Feedback

A premium, responsive, text-first student feedback platform with a real sentiment model and Supabase persistence.

## Product stack
- Frontend: React 18 + Vite
- UI/analytics: responsive CSS + Recharts
- Backend: Python + FastAPI + Uvicorn
- ML: Hugging Face Transformers + multilingual DistilBERT, PyTorch, NLTK, NumPy
- Data/Auth: Supabase PostgreSQL + Auth + Row Level Security
- API: REST/JSON

## Experience
Students simply write feedback in their own words. There are no stars, rating controls, or required categories. The system infers useful topics and assigns Positive/Neutral/Negative sentiment and High/Medium/Low priority from the submitted message.

A brand-new student account starts with an empty history. It sees only its own submissions after it submits one.

Administrators have a separate protected entry point and can review all submitted feedback, search/filter messages, monitor priority items, explore topic trends, and record follow-up actions.

## Admin demo account
Email: `admin@studentfeedback.in`
Password: `Admin123`

Do not add an administrator through the student sign-up form. The reserved administrator account is created/managed in Supabase Auth.

## Password recovery
The Forgot password flow preserves the selected account type:
- Student: reset link is requested for the student's entered email.
- HOD/Admin: reset link is requested for the authorized administrator email.

The reset link opens the app's password reset screen.

## Supabase
Review the application first. Then run `supabase_schema.sql` in the Supabase SQL Editor and create the authorized admin Auth user.

Never expose a Supabase secret/service-role key in frontend code.

## Run
### Backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

The interface supports both light and dark themes and is designed for phones, tablets and laptops.
