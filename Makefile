.PHONY: help install dev backend frontend migrate demo-data test test-backend test-frontend lint e2e clean

BACKEND  := cd backend && uv run
FRONTEND := npm --prefix frontend

help:
	@grep -E '^[a-z-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install backend and frontend dependencies
	cd backend && uv sync
	$(FRONTEND) install

migrate: ## Apply database migrations (also seeds the four categories)
	$(BACKEND) python manage.py migrate

demo-data: ## Seed demo@turbo.notes / cozy-notes-2024 with a full grid of notes
	$(BACKEND) python manage.py demo_data

backend: ## Run the Django API on :8000
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
