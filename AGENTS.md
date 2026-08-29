# StoryDream Repository Guide

## Project Map

This repository is a monorepo with three main application areas.

- `frontend/`
  - React + Vite + TypeScript frontend
  - Main source code: `frontend/src/`
  - API clients: `frontend/src/api/`
  - Reusable UI components: `frontend/src/components/`
  - Page-level components: `frontend/src/pages/`
  - Shared TypeScript types: `frontend/src/types/`
  - Utility functions: `frontend/src/utils/`

- `backend/`
  - Spring Boot backend
  - Gradle-based Java project
  - Main source code: `backend/src/`

- `AI/`
  - AI-related Python services
  - `AI/ai-server/`: AI API server
  - `AI/realtimeinteraction/`: realtime interaction and vision-related code

- `docker-compose.yml`
  - Docker Compose configuration for running the backend and AI server containers together.

## General Rules

- Before modifying code, inspect the existing implementation and follow the current project structure.
- Make the smallest change necessary for the requested feature.
- Do not perform unrelated refactoring.
- Do not rename or move existing files unless required.
- Reuse existing components, API clients, types, services, and utilities when possible.
- Do not invent new APIs, fields, environment variables, or backend contracts.
- When frontend work depends on a backend API contract, inspect the existing backend controller and DTO definitions before implementing it. Do not guess the request or response structure.
- Do not modify another application area unless the task explicitly requires it.
- Preserve existing behavior outside the requested scope.
- Do not commit, push, merge, or modify Git history unless explicitly requested.
- Never expose or hardcode secrets, credentials, tokens, API keys, or private URLs.

## Frontend Rules

When the task concerns `frontend/`:

- Modify only `frontend/` unless another area is explicitly required.
- Follow the existing React and TypeScript patterns.
- Keep API access logic in the existing API layer where possible.
- Reuse types from `frontend/src/types/` instead of duplicating response shapes.
- Preserve the current UI and styling unless UI changes are explicitly requested.
- Clean up timers, event listeners, subscriptions, media objects, and other side effects when components unmount or dependencies change.
- Handle asynchronous failures without causing unhandled Promise rejections.
- Do not change backend API contracts from the frontend.

After frontend changes, run when applicable:

```bash
cd frontend
npm run lint
npm run build
```

## Backend Rules

When the task concerns `backend/`:

- Modify only `backend/` unless another area is explicitly required.
- Follow the existing Spring Boot package and layer structure.
- Reuse existing DTOs, services, repositories, configuration, and exception-handling patterns.
- Do not change database schemas or API contracts unless explicitly requested.
- Keep business logic out of controllers when an existing service layer is available.
- Do not hardcode credentials, AWS configuration, hostnames, or environment-specific values.

After backend changes, use the existing Gradle wrapper for validation when applicable.

## AI Rules

When the task concerns `AI/`:

- Identify whether the change belongs to `AI/ai-server/` or `AI/realtimeinteraction/` before editing.
- Preserve the current service boundaries.
- Do not modify model files, datasets, generated outputs, or large binary assets unless explicitly requested.
- Do not introduce new model dependencies or external services unless required by the task.
- Preserve existing API contracts with the backend and frontend unless explicitly requested.

## Cross-Service Changes

If a feature appears to require changes in more than one of `frontend/`, `backend/`, or `AI/`:

1. Inspect the current contract and data flow first.
2. Prefer adapting to the existing contract over changing multiple services.
3. Clearly identify which services actually require modification.
4. Avoid changing unrelated services simply to simplify implementation.

## Completion

After making changes:

- Report which files were modified.
- Briefly explain why each file was changed.
- Report validation commands that were run.
- Mention any remaining errors, assumptions, or unverified behavior.