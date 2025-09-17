# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ IMPORTANT: MANDATORY RULES

**ALWAYS read and follow the rules in `CLAUDE_RULES.md` before any action. These are OBLIGATORY guidelines that must be respected in every interaction.**

## Development Commands

### Frontend Development

```bash
# Start frontend dev server (default port 5173)
npm run dev

# Start both frontend and backend concurrently
npm run dev:all

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint

# Install all dependencies (frontend + backend)
npm install:all
```

### Backend Development

```bash
# Start backend dev server (port 3003 by default)
cd backend && npm run dev

# Or from root directory
npm run dev:backend

# Start production backend
cd backend && npm start
```

### Port Configuration

- Frontend: Port 5173 (configurable via VITE_PORT)
- Backend: Port 3003 (configurable via PORT)
- Alternative ports supported: 5174, 5175, 3000
- Use environment variables: `VITE_API_PORT=3004 VITE_PORT=5177 npm run dev`

## Project Architecture

### Technology Stack

- **Frontend**: React 19 + Vite + TailwindCSS
- **Backend**: Node.js + Express + PostgreSQL
- **Database**: Supabase PostgreSQL (schema: `app,public`)
- **AI Integration**: OpenAI API for routine generation
- **Authentication**: JWT tokens

### High-Level Architecture

This is a fitness AI application with a consolidated architecture:

1. **Unified Route System**: All training-related functionality has been consolidated into three main route groups:
   - `/api/routine-generation` - AI and manual routine generation (methodologies, calisthenics, gym)
   - `/api/training-session` - Active training session management
   - `/api/exercise-catalog` - Exercise database and catalog management

2. **Legacy Compatibility**: Older routes are maintained through aliases that redirect to the new consolidated system

3. **Frontend Module Organization**:
   - `components/routines/` - Main routine management interface
   - `components/HomeTraining/` - Home workout sessions
   - `components/Methodologie/` - AI methodology generation
   - `components/auth/` - Authentication
   - `components/ui/` - Reusable UI components

### Key Backend Components

#### Database Configuration (`backend/db.js`)

- Uses PostgreSQL with search_path set to `app,public`
- Connection pooling with SSL support for Supabase
- Automatic search_path configuration per connection

#### Server Entry Point (`backend/server.js`)

- Unified routing system with backward compatibility
- AI prompt preloading and API key validation
- Session maintenance system
- CORS configured for multiple frontend ports

#### Route Consolidation

- **NEW**: `/api/routine-generation/*` handles all routine generation (AI + manual)
- **NEW**: `/api/training-session/*` handles active workout sessions
- **NEW**: `/api/exercise-catalog/*` handles exercise database operations
- **LEGACY**: Older routes maintained for compatibility via aliases

### Frontend Architecture

#### Component Structure

- **Lazy Loading**: All major routes use React.lazy() for code splitting
- **Error Boundaries**: Each route wrapped with error handling
- **Context Providers**: Auth, User, Workout, and Trace contexts
- **Protected Routes**: Authentication-based route protection

#### Key Frontend Files

- `src/App.jsx` - Main application with lazy loading and route configuration
- `src/components/routines/RoutineScreen.jsx` - Primary routine management interface
- `src/contexts/` - Application state management
- `src/hooks/` - Custom React hooks

### Database Schema

The application uses a consolidated database structure:

#### Core Tables

- `users` / `user_profiles` - User authentication and profile data
- `methodology_plans` - Consolidated methodology and routine plans
- `historico_ejercicios` - Exercise history tracking
- `progreso_usuario` - User progress tracking

#### Exercise Catalogs

- `Ejercicios_Calistenia` - Calisthenics exercise database
- `Ejercicios_Hipertrofia` - Hypertrophy exercise database
- `hometraining_ejercicios` - Home training exercise database

#### Session Management

- Automatic cleanup of expired sessions
- Real-time session status tracking
- Manual maintenance endpoints available

## Environment Configuration

### Required Environment Variables

#### Backend (.env in backend/)

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:port/db
DB_SEARCH_PATH=app,public

# Authentication
JWT_SECRET=your_jwt_secret

# OpenAI Integration
OPENAI_API_KEY=sk-proj-your-key

# Server
PORT=3003
NODE_ENV=development
```

#### Frontend (.env in root)

```bash
# API Configuration
VITE_API_URL=http://localhost:3003
VITE_API_PORT=3003
VITE_PORT=5173
```

## AI Integration

### OpenAI Features

- **Routine Generation**: AI-powered workout routine creation
- **Exercise Analysis**: Video and photo correction
- **Nutrition Planning**: AI-generated nutrition advice
- **Methodology Creation**: Specialized training methodologies

### Prompt System

- Centralized prompt registry (`backend/lib/promptRegistry.js`)
- Feature-specific prompts for different AI modules
- Automatic prompt preloading on server startup

## Development Guidelines

### Code Style

- ESLint configuration with React hooks and refresh plugins
- Prettier for code formatting (runs on lint-staged)
- TailwindCSS for styling with dark theme customization

### File Organization

- Backend routes in `backend/routes/`
- Frontend components organized by feature in `src/components/`
- Shared utilities in `src/utils/` and `backend/utils/`
- Database queries and business logic separated

### Bundle Optimization

- Manual chunk splitting for vendor libraries (React, UI, charts, forms)
- Feature-based chunks (home-training, routines, methodologies, etc.)
- Lazy loading with Suspense boundaries
- Terser optimization with console removal in production

## Common Development Tasks

### Adding a New Exercise Type

1. Add to appropriate exercise catalog table
2. Update `backend/routes/exerciseCatalog.js`
3. Add frontend components in relevant module
4. Update AI prompts if needed

### Creating New Training Methodology

1. Use consolidated `routineGeneration.js` route
2. Add prompt to prompt registry
3. Update frontend methodology selection
4. Test with AI generation endpoint

### Database Schema Changes

1. Update schema SQL files
2. Run migrations through database client
3. Update relevant model interfaces
4. Test with existing data

### Debugging Common Issues

- **Port conflicts**: Check environment variables and running processes
- **Database connection**: Verify search_path and credentials
- **AI features**: Check API keys and prompt loading
- **CORS issues**: Verify frontend URL in backend CORS config
