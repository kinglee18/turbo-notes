.PHONY: help install dev backend frontend migrate demo-data superuser test test-backend test-frontend lint e2e clean

BACKEND  := cd backend && uv run
FRONTEND := npm --prefix frontend

help:
	@grep -E '^[a-z0-9-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# DEBUG defaults to False, which is the right default for anything real but
# means runserver refuses to serve static files — the Django admin and the DRF
# browsable API come out unstyled. Local dev gets a .env so that never happens
# to someone who just cloned the repo.
.env:
	@cp .env.example .env
	@echo "Created .env from .env.example (DEBUG=True for local development)."

install: .env ## Install backend and frontend dependencies
	cd backend && uv sync
	$(FRONTEND) install

migrate: .env ## Apply database migrations (also seeds the four categories)
	$(BACKEND) python manage.py migrate

demo-data: .env ## Seed demo@turbo.notes / cozy-notes-2024 with a full grid of notes
	$(BACKEND) python manage.py demo_data

superuser: .env ## Create an admin account for http://localhost:8000/admin/
	$(BACKEND) python manage.py createsuperuser

backend: .env ## Run the Django API on :8000
	$(BACKEND) python manage.py runserver 8000

frontend: ## Run the Next.js app on :3000
	$(FRONTEND) run dev

dev: ## Run both servers together
	@$(MAKE) -j2 backend frontend

test: test-backend test-frontend ## Run every test suite

test-backend: ## pytest with coverage
	$(BACKEND) pytest

test-frontend: ## vitest with coverage
	$(FRONTEND) run test:coverage

e2e: ## Playwright end-to-end tests (starts both servers itself)
	$(FRONTEND) run e2e

lint: ## Lint and typecheck both sides
	cd backend && uv run ruff check . && uv run ruff format --check .
	$(FRONTEND) run typecheck
	$(FRONTEND) run lint

clean: ## Remove build artefacts and the local database
	rm -rf frontend/.next frontend/coverage backend/htmlcov backend/.coverage
	rm -f backend/db.sqlite3
