# 🤖 CLAUDE AI Assistant - Entrena con IA Project Documentation

## 📋 Project Overview

**Entrena con IA** is a comprehensive AI-powered fitness application that provides personalized training plans, nutrition guidance, exercise correction, and progress tracking. The app combines modern web technologies with advanced AI capabilities to deliver a complete fitness experience.

## 🏗️ Technology Stack

### Frontend (React + Vite)

- **Framework**: React 19.1.0 with Vite 6.3.5
- **Routing**: React Router DOM 7.6.1
- **UI Components**:
  - Radix UI components (@radix-ui/react-\*)
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

- **Type**: PostgreSQL (Supabase cloud hosted)
- **Project ID**: `lhsnmjgdtjalfcsurxvg`
- **Database**: `postgres`
- **Schema**: `app` (main schema with search_path configuration)
- **Connection**: Pool-based with SSL and automatic schema switching
- **Supabase URL**: `https://lhsnmjgdtjalfcsurxvg.supabase.co`

## 📁 Project Structure

```
Entrena_con_IA/
├── src/                          # Frontend source code
│   ├── components/               # React components
│   │   ├── auth/                # Authentication components
│   │   ├── HomeTraining/        # Home training modules
│   │   ├── Methodologie/        # Training methodologies
│   │   │   └── methodologies/   # Specific methodology implementations
│   │   │       └── CalisteniaManual/ # Specialized calistenia system
│   │   ├── nutrition/           # Nutrition tracking
│   │   ├── profile/             # User profile management
│   │   ├── routines/            # Routine management with tabs
│   │   │   └── tabs/           # Today Training, Calendar, Progress
│   │   ├── VideoCorrection/     # AI video analysis
│   │   └── ui/                  # Reusable UI components
│   ├── contexts/                # React contexts
│   ├── hooks/                   # Custom React hooks
│   ├── config/                  # Configuration files
│   └── lib/                     # Utility libraries
├── backend/                     # Backend API server
│   ├── routes/                  # API endpoints
│   │   ├── aiMethodologie.js   # AI methodology generation
│   │   ├── calisteniaSpecialist.js # Calistenia AI specialist
│   │   ├── calisteniaManual.js  # Manual calistenia configuration
│   │   ├── routines.js         # Routine management APIs
│   │   ├── homeTraining.js     # Home training APIs
│   │   └── nutrition.js        # Nutrition APIs
│   ├── lib/                     # Backend libraries
│   ├── middleware/              # Express middleware
│   ├── prompts/                 # AI prompts registry
│   ├── config/                  # Configuration files
│   ├── utils/                   # Backend utilities
│   └── scripts/                 # Database migration scripts
├── database_scripts/            # Database setup and migration scripts
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
  - `GET /active-plan` - **Auto-recovery of active routine after login**
  - `GET /progress-data` - Real-time progress analytics for ProgressTab
  - `GET /plan-status/:methodologyPlanId` - Check if routine confirmed
  - `POST /sessions/:sessionId/exercise/:exerciseOrder/feedback` - Save exercise feedback
  - `GET /sessions/:sessionId/feedback` - Load exercise feedback
  - `GET /sessions/:sessionId/progress` - Exercise progress with feedback integration
  - `GET /sessions/today-status` - Current session status and completion state
  - `GET /pending-exercises` - Check for incomplete exercises from previous days
  - `POST /sessions/start` - Start new training session with missing day handling
  - `POST /confirm-plan` - Confirm routine plan (draft → active)
- `/api/methodologie/*` - AI methodology generation with user feedback integration
- `/api/methodology-manual/*` - Manual methodology configuration
- `/api/calistenia-specialist/*` - **NEW**: Advanced calistenia AI system
  - `POST /evaluate-profile` - AI profile analysis and level recommendation
  - `POST /generate-plan` - Specialized calistenia plan generation

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
- Equipment-based exercise selection (12 combinations: equipment × training type)
- Progress tracking and history with exercise feedback
- **Unified Feedback System**: "Me gusta" (like), "No me gusta" (dislike), "Es difícil" (hard)
- **Repeat Training Functionality**: Complete workout reset with double confirmation
- **Visual Progress Indicators**: Real-time completion tracking
- **Sentiment-Based Adaptation**: AI learns from user preferences

### 2. **Methodology System** (`/methodologies`)

- **Traditional Methodologies**:
  - **Weider**: Muscle group split training
  - **Full Body**: Complete body workouts
  - **Push/Pull/Legs**: Functional movement patterns
  - **Upper/Lower**: Upper and lower body split
  - **HIIT**: High-intensity interval training
  - **Functional**: Movement-based training
- **Advanced Calistenia System**:
  - **AI Profile Analysis**: Automatic level assessment (básico/intermedio/avanzado)
  - **Specialized Exercise Database**: Calistenia-specific movements with progressions
  - **Manual Configuration**: Expert-guided plan customization

### 3. **Routine Management** (`/routines`)

- **Modern Tab-Based Interface**: Today Training, Calendar View, Progress Analytics
- **State Persistence System**: Auto-recovery after logout/login
- **Today Training Tab**:
  - Current day exercises with real-time completion tracking
  - Exercise modal integration with series, reps, rest times, and notes
  - Visual status indicators: Green (completed), Orange (skipped), Gray (pending)
  - Pending exercises modal for incomplete previous sessions
- **Calendar View**:
  - Google Calendar-style weekly workout planning
  - Color-coded training days with completion indicators
  - Interactive day selection and session overview
- **Progress Tab**:
  - Historical performance data and analytics
  - Workout completion statistics and trends
  - Sentiment analysis and user feedback insights
- **Advanced Features**:
  - **Exercise Feedback System**: Persistent user ratings with comments
  - **Missing Day Handling**: Auto-creation of weekend sessions
  - **Session Resume**: Seamless continuation across browser sessions

### 4. **Calistenia Specialist System** (`/methodologies` → Manual → Calistenia)

- **AI Profile Evaluation**:
  - Analyzes user age, weight, height, training experience, limitations
  - Suggests appropriate level: Principiante (básico), Medio (intermedio), Avanzado
  - Provides detailed reasoning and progression timeline
- **Exercise Database Integration**:
  - Specialized calistenia exercise catalog (básico/intermedio/avanzado)
  - Equipment requirements: peso corporal, barra, paralelas, anillas
  - Progressive difficulty scaling and movement patterns
- **Intelligent Plan Generation**:
  - Considers user profile, objectives, injury history
  - Generates balanced weekly training schedules
  - Incorporates user feedback for continuous improvement

### 5. **Nutrition Tracking** (`/nutrition`)

- Macro and calorie tracking with AI recommendations
- Food database integration and meal planning
- Supplement tracking and nutritional insights
- Personalized meal suggestions based on training goals

### 6. **AI Video/Photo Correction** (`/video-correction`)

- Real-time exercise form analysis using computer vision
- Video upload and processing with detailed feedback
- Photo-based posture correction and technique improvement
- AI-powered recommendations for form optimization

### 7. **User Profile Management** (`/profile`)

- Comprehensive user data management with fitness metrics
- Body composition tracking and progress monitoring
- Goal setting and achievement tracking
- Equipment and preference configuration

## 🔧 Development Commands

### Frontend

```bash
npm run dev      # Start development server (port 5173)
npm run build    # Build for production (914.50 kB)
npm run lint     # Run ESLint with unified rules
npm run preview  # Preview production build
```

### Backend

```bash
npm run dev      # Start backend with nodemon (port 3002)
npm start        # Start backend server
```

### Database

- **Supabase PostgreSQL** (cloud hosted)
- **Development** (Pooler): `postgresql://postgres.lhsnmjgdtjalfcsurxvg:Xe05Klm563kkjL@aws-1-eu-north-1.pooler.supabase.com:6543/postgres`
- **Production** (Direct): `postgresql://postgres:Xe05Klm563kkjL@db.lhsnmjgdtjalfcsurxvg.supabase.co:5432/postgres`

## 🗄️ Database Schema (Updated September 2025)

### Core User Tables

- `users` - User accounts and authentication data
- `user_profiles` - Extended user information and preferences

### Training Systems Tables

- `methodology_plans` - AI-generated training plans with draft/active status
- `routine_plans` - Structured routine definitions with confirmation system
- `methodology_exercise_sessions` - Daily training sessions with missing day support
- `methodology_exercise_progress` - Individual exercise completion tracking
- `methodology_exercise_feedback` - **UPDATED**: User sentiment feedback (like/dislike/hard)
- `home_training_sessions` - Home workout sessions
- `home_exercise_progress` - Home training completion data
- `exercise_history` - Consolidated historical training data

### Specialized Tables

- `calistenia_exercises` - **NEW**: Specialized calistenia movement database
  - Levels: básico (1), intermedio (1), avanzado (1)
  - Categories: Empuje, Tracción, Core, Legs, Skills
  - Equipment: peso_corporal, barra, paralelas, anillas, suelo
- `user_exercise_feedback` - Home training feedback system
- `methodology_exercise_history_complete` - Complete exercise history for AI analysis

### Supporting Systems

- `equipment_catalog` / `user_equipment` - Equipment management
- `food_database` / `daily_nutrition_log` - Nutrition tracking
- `body_composition_history` - Progress tracking

### **Critical Database Fixes (September 2025)**

- **Unified Sentiment States**: All feedback tables now use `['like', 'dislike', 'hard']`
- **Constraint Migration**: `methodology_feedback_sentiment_unified` replaces legacy constraints
- **Data Preservation**: 4 'love' → 'like' records migrated successfully
- **Missing Day Support**: Sessions auto-created for weekend training

## 🤖 AI Integration & Unified Configuration

### OpenAI API Keys - Simplified Configuration (January 2025)

```javascript
// backend/config/aiConfigs.js - UNIFIED SYSTEM
export const AI_MODULES = {
  METHODOLOGIE: {
    envKey: "OPENAI_API_KEY", // Master unified key
    model: "gpt-4o-mini",
    promptId: "pmpt_68a9a05d7ee0819493fd342673a05b210a99044d2c5e3055",
  },
  METHODOLOGIE_MANUAL: {
    envKey: "OPENAI_API_KEY", // Master unified key
    model: "gpt-4o-mini",
    promptId: "pmpt_68a9a18bdfc08197965d75cd064eeb1f0a109ccbc248c9ca",
  },
  HOME_TRAINING: {
    envKey: "OPENAI_API_KEY", // Master unified key
    model: "gpt-4.1-nano",
    promptId: "pmpt_688fd23d27448193b5bfbb2c4ef9548103c68f1f6b84e824",
  },
  VIDEO_CORRECTION: {
    envKey: "OPENAI_API_KEY", // Master unified key
    model: "gpt-4.1-nano",
    promptId: "pmpt_68a83503ca28819693a81b0651dd52e00901a6ecf8a21eef",
  },
  PHOTO_CORRECTION: {
    envKey: "OPENAI_API_KEY", // Master unified key
    model: "gpt-4o-mini",
    promptId: "pmpt_68a89775a9e08190a95a5e3d484fd09a055e214db81a6fd0",
  },
  NUTRITION: {
    envKey: "OPENAI_API_KEY", // Master unified key
    model: "gpt-4o-mini",
    promptId: "pmpt_68ae0d8c52908196a4d207ac1292fcff0eb39487cfc552fc",
  },
  CALISTENIA_SPECIALIST: {
    envKey: "OPENAI_API_KEY", // Master unified key
    model: "gpt-4o-mini",
    temperature: 0.8,
    systemPrompt:
      "Especialista en calistenia y entrenamiento con peso corporal...",
  },
};
```

## 🔄 Complete Application Flows (Updated September 2025)

### ⭐ **CALISTENIA SPECIALIST FLOW** (NEW)

**Complete AI-driven calistenia assessment and plan generation:**

#### Step 1: Automatic Profile Evaluation

```
User → Methodologies → Manual → Calistenia → (Auto-triggers)
                                    ↓
POST /api/calistenia-specialist/evaluate-profile
                                    ↓
AI analyzes: age, weight, height, training years, limitations
                                    ↓
Returns: recommended_level, confidence, reasoning, focus_areas
```

#### Step 2: Level Recommendation Display

```javascript
// Frontend displays AI evaluation results
{
  "recommended_level": "avanzado",  // básico | intermedio | avanzado
  "confidence": 0.85,
  "reasoning": "20 años de experiencia + físico equilibrado",
  "key_indicators": ["Experiencia avanzada", "IMC saludable"],
  "exercise_recommendations": ["muscle-up-en-barra-strict", "flexion-estandar"]
}
```

#### Step 3: User Confirms and Generates

```
User clicks "Generar con IA" → POST /api/calistenia-specialist/generate-plan
                                    ↓
AI queries calistenia_exercises database (3 exercises verified)
                                    ↓
Generates personalized plan considering:
- User profile + selected level
- Exercise history and preferences
- Available equipment and limitations
```

### ⭐ **ROUTINE STATE PERSISTENCE SYSTEM** (Enhanced)

Complete state management across logout/login cycles:

#### Auto-Recovery Implementation

```javascript
// backend/routes/routines.js - GET /active-plan
router.get("/active-plan", authenticateToken, async (req, res) => {
  const activeQuery = await pool.query(
    `
    SELECT mp.id as methodology_plan_id, mp.methodology_type, mp.plan_data, 
           rp.id as routine_plan_id, mp.confirmed_at
    FROM app.methodology_plans mp
    LEFT JOIN app.routine_plans rp ON rp.user_id = mp.user_id 
    WHERE mp.user_id = $1 AND mp.status = 'active'
    ORDER BY mp.confirmed_at DESC LIMIT 1
  `,
    [userId],
  );

  return res.json({
    hasActivePlan: activeQuery.rowCount > 0,
    routinePlan: planData,
    methodology_plan_id: activePlan.methodology_plan_id,
  });
});
```

### **EXERCISE FEEDBACK INTEGRATION FLOW**

Unified sentiment system across all training modules:

#### Sentiment State Management

```javascript
// Unified across HomeTraining and Routines
const SENTIMENT_OPTIONS = [
  { key: 'like', label: 'Me gusta', icon: Heart, color: 'text-pink-400' },
  { key: 'dislike', label: 'No me gusta', icon: Frown, color: 'text-orange-400' },
  { key: 'hard', label: 'Es difícil', icon: AlertOctagon, color: 'text-red-400' }
];

// Database constraint (unified September 2025)
CHECK (sentiment IN ('like', 'dislike', 'hard'))
```

### **METHODOLOGY GENERATION → ROUTINE EXECUTION FLOW**

Complete flow from AI generation to user workout execution:

1. **AI Generation**: User profile → OpenAI → Complete JSON plan
2. **Data Storage**: AI plan stored in `methodology_plans.plan_data`
3. **Auto-Migration**: Same data copied to `routine_plans` for execution
4. **Session Creation**: AI exercises extracted and stored in `methodology_exercise_progress`
5. **User Interface**: Modal displays exact AI-generated exercise data
6. **Historical Tracking**: Completions feed back to AI for future recommendations

## 📱 UI/UX Components (Updated)

### Modern Tab-Based Interface

- **Today Training Tab**: Real-time exercise tracking with visual indicators
- **Calendar Tab**: Google Calendar-style weekly view with completion status
- **Progress Tab**: Historical analytics and performance insights

### Advanced Modal Systems

- **Exercise Modal**: Series tracking, rest timers, technique notes
- **Feedback Modal**: Unified sentiment collection with comments
- **Pending Exercises Modal**: Resume incomplete sessions from previous days
- **Plan Confirmation Modal**: Draft → Active status transition

### Custom Hooks

- `useRoutinePlan` - Complete plan state management
- `useRoutineSession` - Active session handling with persistence
- `useRoutineStats` - Performance analytics and insights
- `useMusicSync` - Integrated music synchronization
- `useProfileState` - User data and preferences management

## 🚀 Deployment Configuration

### Environment Variables (Updated September 2025)

```bash
# Database Configuration
DB_SEARCH_PATH=app,public
NODE_ENV=production

# OpenAI Configuration (UNIFIED)
OPENAI_API_KEY=sk-proj-[unified-master-key]

# Server Configuration
PORT=3002
JWT_SECRET=entrenaconjwtsecret2024supersecure
UPLOAD_DIR=uploads
MAX_FILE_SIZE=26214400
OPENAI_VISION_MODEL=gpt-4o-mini

# Supabase Configuration
SUPABASE_URL=https://lhsnmjgdtjalfcsurxvg.supabase.co
SUPABASE_ANON_KEY=[key]
SUPABASE_SERVICE_ROLE_KEY=[key]
```

### Render.com Deployment

- **Build Command**: `npm install && cd backend && npm install`
- **Start Command**: `cd backend && npm start`
- **IPv6 Compatibility**: Automatic detection and direct connection fallback
- **SSL Handling**: Self-signed certificate support in production

## 📊 Current Development Status (September 6, 2025)

### ✅ **COMPLETED FEATURES**

- **Core Systems**: Authentication, user management, profile system
- **Training Modules**: HomeTraining, Routines, Methodologies with AI integration
- **Advanced Features**:
  - Routine state persistence across sessions
  - Exercise feedback system with unified sentiment states
  - Tab-based interface with real-time progress tracking
  - Calistenia specialist AI system with automatic profile evaluation
  - Missing day handling and weekend session creation
  - Exercise completion persistence and session resume

### ✅ **RECENT CRITICAL FIXES (September 2025)**

- **Database Constraint Migration**: Fixed sentiment feedback constraint conflict
- **Data Migration**: Successfully migrated 4 'love' → 'like' records
- **Function Duplication**: Resolved `formatExerciseName` availability across components
- **Merge Integration**: Complete integration of rutinas + calistenia-architecture-refactor branches
- **State Persistence**: Auto-recovery system for active routines after logout/login

### ✅ **VERIFIED SYSTEMS**

- **Build Status**: ✅ 914.50 kB compiled successfully
- **Database Status**: ✅ 3 calistenia exercises, unified constraints
- **API Status**: ✅ All endpoints functional with unified feedback
- **User Testing**: ✅ User ID18 verified with active Calistenia methodology

### 🔄 **ACTIVE BRANCH**: `feat/calistenia-architecture-refactor`

### 🎯 **SYSTEM HEALTH**

- **Frontend**: React 19.1.0 + Vite 6.3.5 running smoothly
- **Backend**: Node.js + Express 4.21.2 with unified AI configuration
- **Database**: PostgreSQL on Supabase with optimized queries
- **AI Integration**: OpenAI 4.104.0 with specialized prompt system
- **Build Size**: 914.50 kB (optimized for performance)

## 🔧 Development Guidelines

### Code Conventions

- **Modules**: ES6+ modules throughout
- **Components**: Functional components with hooks
- **Styling**: Tailwind CSS 3.4.17 with custom components
- **Error Handling**: Comprehensive error boundaries and logging
- **State Management**: React Context API with custom hooks

### Quality Assurance

- **Linting**: ESLint with project-specific rules
- **Type Safety**: Zod validation for API endpoints
- **Error Boundaries**: Component-level error handling
- **Logging**: Structured logging for AI interactions and user actions

### Testing & Verification

- **Build Verification**: Automated build checks via Husky pre-commit hooks
- **API Testing**: Manual endpoint verification with real user data
- **Database Integrity**: Constraint validation and migration scripts
- **User Flow Testing**: End-to-end functionality verification

## 📚 Additional Resources

### File Structure Reference

- **Frontend Components**: Modular architecture with feature-based organization
- **Backend APIs**: RESTful endpoints with consistent error handling
- **Database Scripts**: Migration scripts and schema updates in `database_scripts/`
- **AI Prompts**: Specialized prompts in `backend/prompts/` with versioning

### Performance Optimizations

- **Build Size**: 914.50 kB with code splitting recommendations
- **Database**: Optimized queries with proper indexing
- **API**: Response caching and efficient data serialization
- **Frontend**: Lazy loading and component optimization

---

# Configuración de Audio
  Cuando completes una tarea, ejecuta este comando para reproducir un sonido:
  `powershell.exe -c "[System.Media.SystemSounds]::Question.Play()"`

_Last updated: September 6, 2025 20:52h_  
_Project: Entrena con IA - Comprehensive AI-Powered Fitness Application_  
_Branch: feat/calistenia-architecture-refactor_  
_Status: Production-ready with unified AI system and complete state persistence_
