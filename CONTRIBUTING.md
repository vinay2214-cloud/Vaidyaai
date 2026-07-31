# Contributing to VaidyaAI

Welcome to VaidyaAI! We are thrilled you're interested in contributing to our Enterprise AI-Powered Healthcare Platform.

## Getting Started

- Fork the repository
- Clone your fork
- Create a feature branch from `main`

## Development Setup

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Code Style

- **Python**: PEP 8, type hints required, docstrings on public functions
- **TypeScript**: strict mode, ESLint with next/core-web-vitals
- **SQL**: SQLAlchemy 2.0 ORM, no raw SQL in application code
- **Firestore**: Always use helper functions from `database/firestore.py`

## Testing Requirements

All PRs must pass:

```bash
# Backend
python3 -m pytest backend/tests/ -vv

# Frontend
npm run lint
npm run build

# E2E
python3 scripts/e2e_demo_test.py
```

## Branch Strategy

- `main` — stable release branch
- `develop` — integration branch
- `feature/*` — new features
- `fix/*` — bug fixes
- `docs/*` — documentation

## Commit Message Convention

Use conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`

## Pull Request Process

1. Create PR against `main`
2. Fill out the PR template
3. Ensure CI passes (pytest, lint, build)
4. Request review from maintainers
5. Squash and merge after approval

## Reporting Issues

- Use GitHub Issue templates (Bug Report or Feature Request)
- Include reproduction steps, environment details
- For security vulnerabilities, see SECURITY.md

## Healthcare-Specific Guidelines

- Never commit real patient data
- Use `anonymise_for_llm()` before passing text to AI models
- Use `mask_phone()` for all phone numbers in logs
- Test with seed data only (`scripts/seed_demo_data.py`)
- All database writes go through backend Admin SDK, never direct Firestore client writes
