# Study Partner - Premium Educational SaaS

Study Partner is a modern learning and question paper management system built with Django (REST API) and React (Vite/TypeScript).

## 🚀 Getting Started

### 1. Backend Setup
Navigate to the backend directory and set up the environment:

```bash
cd backend
# Virtual environment is already created in 'venv'
source venv/bin/activate

# Install dependencies if not already installed
pip install -r requirements.txt

# Run database migrations
python manage.py migrate

# Create the default QBank Pro admin account
python manage.py ensure_admin
# Email: admin@qbankpro.com  |  Password: Admin@123

# Seed complete ICAI CA master database (3 levels, 18 papers, 249+ chapters, 700+ topics)
python manage.py seed_icai_master
# Use --reset to rebuild from scratch

# Start the server
python manage.py runserver
```
The API will be available at `http://localhost:8000/`.

---

### 2. Frontend Setup
Navigate to the frontend directory and start the dev server:

```bash
cd frontend

# Install dependencies (already done during scaffolding)
npm install

# Start development server
npm run dev
```
The application will be available at `http://localhost:5173/`.

## 🛠 Tech Stack
- **Frontend**: React, Vite, TypeScript, Tailwind CSS, Framer Motion, Zustand, React Query.
- **Backend**: Django, Django REST Framework, PostgreSQL (or SQLite for local), JWT Auth.
- **Security**: JWT tokens, Protected Routes, CSRF/XSS protection.

## 🏛 ICAI Master Database

Hierarchy: **CA Level → Paper → Chapter → Topic → Questions**

| Level | Papers |
|-------|--------|
| CA Foundation | 4 papers |
| CA Intermediate | 8 papers |
| CA Final | 6 papers |

API: `GET /api/master/tree/`, `GET /api/master/levels/`, cascade filters via `?level_id=`, `?paper_id=`, `?chapter_id=`

Admin UI: `/admin/master` — browse full ICAI structure and add questions per chapter.

## 📁 Key Directories
- `backend/authentication`: User registration & JWT login.
- `backend/master_data`: ICAI CA Levels, Papers, Chapters, Topics (enterprise master DB).
- `backend/courses`: Legacy syllabus and Course hierarchy.
- `backend/materials`: Question papers, Answers, Notes.
- `frontend/src/pages`: User & Admin dashboard views.
- `frontend/src/components`: Premium UI components (Sidebar, Topbar, etc.).
