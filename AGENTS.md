# Repository Guidelines

## Project Structure & Module Organization

- `src/` React SPA agrupada por feature: UI en `components/`, estado en `contexts/`, llamadas en `services/`, helpers en `utils/`.
- `backend/` API Express: entrypoints en `routes/`, lógica de dominio en `services/`, guardias en `middleware/`, SQL versionado en `migrations/` y `sql/`.
- Assets en `public/`; Vite compila a `dist/` (no versionar).
- Revisa `docs/` y playbooks raíz antes de tocar entrenamientos, nutrición o rutinas.
- Scripts operativos (`scripts/`, `check_*.mjs`, `apply_db_*.mjs`) gestionan puertos y parches; ejecútalos desde la raíz.

## Build, Test, and Development Commands

- `npm run install:all` instala dependencias frontend + backend en una sola pasada.
- `npm run dev` inicia Vite en 5173; `npm --prefix backend run dev` levanta la API en 3003 con nodemon.
- Usa `npm run dev:all` para levantar ambos servicios; `npm run dev:sync` añade la verificación de puertos previa.
- `npm run build` genera el bundle productivo y `npm run preview` permite validarlo localmente.
- Calidad: `npm run lint` (ESLint), `npm run monitor` (salud servicios), `node scripts/check-ports.js` antes de sesiones.

## Coding Style & Naming Conventions

- JavaScript/JSX con indentación de 2 espacios, comillas dobles y punto y coma; ESLint (`eslint.config.js`) es la fuente de verdad.
- Componentes en PascalCase (`components/ProfileSection.jsx`), hooks/utilidades en camelCase, context providers en `contexts/` con sufijo `Provider`.
- Backend: controladores en `routes/`, dominio en `services/`, utilidades compartidas en `utils/`.
- Prettier corre vía lint-staged; no omitas el hook salvo casos documentados.

## Testing Guidelines

- `npm test` retorna placeholder; registra pruebas manuales o scripts específicos en tu PR.
- `node test_refactorization.mjs` valida el flujo completo de entrenamiento (requiere `DATABASE_URL` y `JWT_SECRET`).
- `node test-routine-fixes.js` verifica endpoints críticos; define `AUTH_TOKEN` con un JWT válido antes de correrlo.
- Añade pruebas automatizadas en cambios críticos y describe la cobertura lograda.

## Commit & Pull Request Guidelines

- Usa Conventional Commits en español como en `feat(ui): feedback ejercicios en pestaña hoy`.
- Los PRs deben incluir resumen, instrucciones de validación local, issues vinculadas y capturas o gifs para cambios visuales.
- Documenta migraciones o scripts requeridos e indica impactos front-back.

## Environment & Configuration Tips

- Crea `.env` para frontend y backend con `VITE_*`, `DATABASE_URL`, `JWT_SECRET`, `DB_SEARCH_PATH`; dotenv se carga fuera de producción.
- Mantén `logs.txt` y `backend/logs.txt` fuera de commits, pero utilízalos para diagnósticos y comparte fragmentos relevantes.
