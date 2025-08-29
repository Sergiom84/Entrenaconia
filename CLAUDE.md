# 🤖 CLAUDE AI Assistant - Entrena con IA Project Documentation

## 📋 Project Overview

**Entrena con IA** is a comprehensive AI-powered fitness application that provides personalized training plans, nutrition guidance, exercise correction, and progress tracking. The app combines modern web technologies with AI capabilities to deliver a complete fitness experience.

## 🏗️ Technology Stack

### Frontend (React + Vite)
- **Framework**: React 19.1.0 with Vite 6.3.5
- **Routing**: React Router DOM 7.6.1
- **UI Components**: 
  - Radix UI components (@radix-ui/react-*)
  - Tailwind CSS 3.4.17
  - Framer Motion 12.23.12
  - Lucide React icons
- **State Management**: React Context API
- **Form Handling**: React Hook Form 7.56.3
- **Charts**: Recharts 2.15.3
- **Validation**: Zod 3.24.4

### Backend (Node.js + Express)
- **Runtime**: Node.js with ES modules
- **Framework**: Express 4.21.2
- **Database**: PostgreSQL with pg 8.16.3
- **Authentication**: JWT + bcryptjs
- **AI Integration**: OpenAI 4.104.0
- **File Handling**: Multer 2.0.2, PDF Parse 1.1.1
- **Environment**: dotenv 16.6.1
- **CORS**: cors 2.8.5

### Database
- **Type**: PostgreSQL (local instance)
- **Schema**: `app` (main schema with search_path configuration)
- **Connection**: Pool-based with automatic schema switching

## 📁 Project Structure

```
Entrena_con_IA/
├── src/                          # Frontend source code
│   ├── components/               # React components
│   │   ├── auth/                # Authentication components
│   │   ├── HomeTraining/        # Home training modules
│   │   ├── Methodologie/        # Training methodologies
│   │   ├── nutrition/           # Nutrition tracking
│   │   ├── profile/             # User profile management
│   │   ├── routines/            # Routine management
│   │   ├── VideoCorrection/     # AI video analysis
│   │   └── ui/                  # Reusable UI components
│   ├── contexts/                # React contexts
│   ├── hooks/                   # Custom React hooks
│   ├── config/                  # Configuration files
│   └── lib/                     # Utility libraries
├── backend/                     # Backend API server
│   ├── routes/                  # API endpoints
│   ├── lib/                     # Backend libraries
│   ├── middleware/              # Express middleware
│   ├── prompts/                 # AI prompts
│   ├── sql/                     # Database migration scripts
│   └── utils/                   # Backend utilities
├── database_scripts/            # Database setup scripts
└── dist/                        # Build output
```

## 🔗 Main API Endpoints

### Authentication & Users
- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - User registration
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

### Training Systems
- `/api/home-training/*` - Home training plans and sessions
- `/api/ia-home-training/*` - AI-powered home training
- `/api/routines/*` - Gym routines and methodology plans
- `/api/methodologie/*` - AI methodology generation
- `/api/methodology-manual/*` - Manual methodology configuration

### AI Features
- `/api/ai/*` - Video correction analysis
- `/api/ai-photo-correction/*` - Photo analysis
- `/api/nutrition/*` - AI nutrition guidance

### Data Management
- `/api/equipment/*` - Equipment management
- `/api/exercises/*` - Exercise catalog
- `/api/body-composition/*` - Body composition tracking
- `/api/uploads/*` - File upload handling

## 🎯 Key Features

### 1. **Home Training System** (`/home-training`)
- AI-generated personalized home workouts
- Equipment-based exercise selection
- Progress tracking and history
- Combination-based training plans (12 combinations: equipment × training type)
- Exercise feedback and difficulty adjustment

### 2. **Methodology System** (`/methodologies`)
- **Weider**: Muscle group split training
- **Full Body**: Complete body workouts
- **Push/Pull/Legs**: Functional movement patterns
- **Upper/Lower**: Upper and lower body split
- **HIIT**: High-intensity interval training
- **Functional**: Movement-based training

### 3. **Routine Management** (`/routines`)
- Structured gym routines with progression
- Session tracking and exercise logging
- Performance analytics and statistics
- Custom routine creation and modification

### 4. **Nutrition Tracking** (`/nutrition`)
- Macro and calorie tracking
- AI-powered meal recommendations
- Food database integration
- Supplement tracking

### 5. **AI Video/Photo Correction** (`/video-correction`)
- Real-time exercise form analysis
- Video upload and processing
- Photo-based posture correction
- AI feedback and recommendations

### 6. **User Profile Management** (`/profile`)
- Comprehensive user data management
- Body composition tracking
- Goal setting and progress monitoring
- Equipment and preference configuration

## 🔧 Development Commands

### Frontend
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

### Backend
```bash
npm run dev      # Start backend with nodemon
npm start        # Start backend server
```

### Database
- **Supabase PostgreSQL** (cloud hosted)
- Project ID: `lhsnmjgdtjalfcsurxvg`
- Database: `postgres`
- Main schema: `app`
- Connection: Pool-based with SSL

## 🗄️ Database Schema Highlights

### Core Tables
- `users` - User accounts and authentication
- `user_profiles` - Extended user information
- `exercise_history` - Training session records
- `home_exercise_history` - Home training records
- `methodology_plans` - AI-generated training plans
- `routine_plans` - Structured routine definitions

### AI Integration Tables
- `exercise_ai_info` - Exercise metadata for AI
- `user_exercise_feedback` - User feedback on exercises
- `methodology_exercise_feedback` - Methodology-specific feedback

### Supporting Systems
- `equipment_catalog` / `user_equipment` - Equipment management
- `food_database` / `daily_nutrition_log` - Nutrition tracking
- `body_composition_history` - Progress tracking

## 🎨 UI/UX Components

### Custom Hooks
- `useRoutinePlan` - Routine plan state management
- `useRoutineSession` - Active session handling  
- `useRoutineStats` - Performance statistics
- `useMusicSync` - Music integration
- `useProfileState` - Profile data management

### Context Providers
- `AuthContext` - Authentication state
- `UserContext` - User data management
- `VideoAnalysisContext` - Video correction state

### Reusable UI Components
- Custom form components with validation
- Modal dialogs and overlays
- Progress indicators and charts
- Audio/music integration components
- Error handling and success notifications

## 🤖 AI Integration

### OpenAI Features
- **Video Analysis**: Exercise form correction
- **Photo Analysis**: Posture and form evaluation
- **Home Training**: Personalized workout generation
- **Methodology**: Training plan creation
- **Nutrition**: Meal planning and macro guidance

### Prompt System
- Modular prompt management in `/backend/prompts/`
- Feature-specific prompt files
- Cached prompt loading for performance
- Dynamic prompt generation based on user data

## 🔐 Security & Authentication

- JWT-based authentication with refresh tokens
- bcrypt password hashing
- Protected routes with middleware
- Input validation and sanitization
- CORS configuration for cross-origin requests

## 🎵 Additional Features

- **Music Integration**: Spotify/local music sync during workouts
- **Audio Feedback**: Voice-guided workout instructions
- **Progress Analytics**: Comprehensive workout statistics
- **Equipment Management**: Personal equipment tracking
- **Medical Documentation**: Health history integration

## 📊 Current Development Status

- ✅ Core authentication and user management
- ✅ Home training system with AI integration
- ✅ Methodology system with multiple training types
- ✅ Routine management and session tracking
- ✅ Nutrition tracking and AI recommendations
- ✅ Video/photo correction with AI analysis
- ✅ Profile management and progress tracking
- 🔄 Recent refactor: Extracted routine hooks for better modularity
- 🔄 Active branch: `feat/refactor-routine-hooks`

## 🛠️ Development Notes

### Recent Changes
- Refactored routine system with custom hooks (`useRoutinePlan`, `useRoutineSession`, `useRoutineStats`)
- Improved error handling and loading states
- Enhanced session management and persistence
- Fixed methodology plan integration issues

### Code Conventions
- ES6+ modules throughout
- Functional components with hooks
- Tailwind CSS for styling
- Consistent error handling patterns
- Comprehensive logging system

### Testing & Quality
- ESLint configuration for code quality
- Environment-based configuration
- Comprehensive error boundaries
- API health check endpoints

---

*Last updated: August 29, 2025*
*Project: Entrena con IA - AI-Powered Fitness Application*