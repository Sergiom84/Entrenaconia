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

## 🤖 AI Integration & Complete Application Flows

### OpenAI API Keys Configuration
```javascript
// backend/config/aiConfigs.js
AI_MODULES = {
  METHODOLOGIE: {
    envKey: 'OPENAI_API_KEY_METHODOLOGIE',        // Methodology generation (automatic)
    model: 'gpt-4o-mini'
  },
  METHODOLOGIE_MANUAL: {
    envKey: 'OPENAI_API_KEY_METHODOLOGIE_MANUAL', // Manual methodology generation
    model: 'gpt-4o-mini'
  },
  HOME_TRAINING: {
    envKey: 'OPENAI_API_KEY_HOME_TRAINING',       // Home workout generation
    model: 'gpt-4.1-nano'
  },
  VIDEO_CORRECTION: {
    envKey: 'OPENAI_API_KEY_CORRECTION_VIDEO',    // Video form analysis
    model: 'gpt-4.1-nano'
  },
  PHOTO_CORRECTION: {
    envKey: 'OPENAI_API_KEY_CORRECTION_PHOTO',    // Photo form analysis
    model: 'gpt-4.1-nano'
  },
  NUTRITION: {
    envKey: 'OPENAI_API_KEY_NUTRITION',           // Nutrition recommendations
    model: 'gpt-4o-mini'
  }
}
```

## 🔄 Complete Application Flows

### 1. **METHODOLOGY GENERATION → ROUTINE EXECUTION FLOW** ⭐

**This is the main flow from AI generation to user workout execution:**

#### Step 1: AI Generation (`/methodologies` → AI)
```
User → MethodologiesScreen → POST /api/methodologie/generate → OpenAI API
                                    ↓
                            Uses OPENAI_API_KEY_METHODOLOGIE
                                    ↓
                        AI generates complete JSON plan with:
                        - semanas[]: weeks of training
                        - sesiones[]: sessions per week  
                        - ejercicios[]: exercises with series, reps, rest, etc.
```

#### Step 2: Data Storage (AI → Database)
```javascript
// backend/routes/aiMethodologie.js:488-492
const insertResult = await pool.query(insertQuery, [
  userId,
  parsedPlan.selected_style,
  JSON.stringify(parsedPlan)  // ← Complete AI JSON stored in plan_data
]);
// Saves to: methodology_plans.plan_data
```

#### Step 3: Automatic Migration (Methodology → Routines)
```javascript
// backend/routes/aiMethodologie.js:528-534
const routinePlanResult = await pool.query(routinePlanQuery, [
  userId,
  parsedPlan.selected_style,
  JSON.stringify(parsedPlan),  // ← Same AI data copied
  // ... 
]);
// Creates: routine_plans record with same plan_data
```

#### Step 4: Navigation to Routines
```javascript
// src/components/Methodologie/MethodologiesScreen.jsx:292
navigate('/routines', { 
  state: { 
    routinePlan: generatedRoutinePlan,     // ← AI-generated plan
    planId: routinePlanId,                 // ← routine_plans.id
    methodology_plan_id: planId            // ← methodology_plans.id
  } 
});
```

#### Step 5: Session Creation (Routines → Database)
```javascript
// backend/routes/routines.js:197-298
// When user clicks "Start Training":
router.post('/sessions/start', (req, res) => {
  // 1. Gets plan_data from methodology_plans
  const planQ = await client.query(
    'SELECT plan_data FROM app.methodology_plans WHERE id = $1',
    [methodology_plan_id]
  );
  
  // 2. Extracts AI exercises from JSON
  const ejercicios = planData.semanas[0].sesiones[0].ejercicios; // ← AI data
  
  // 3. Creates methodology_exercise_progress records
  await client.query(`INSERT INTO app.methodology_exercise_progress (
     methodology_session_id, user_id, exercise_order, exercise_name,
     series_total, repeticiones, descanso_seg, intensidad, tempo, notas
   ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [
     session.id, userId, order, 
     ej.nombre,           // ← From AI JSON
     ej.series,           // ← From AI JSON  
     ej.repeticiones,     // ← From AI JSON
     ej.descanso_seg,     // ← From AI JSON
     ej.intensidad,       // ← From AI JSON
     ej.tempo,            // ← From AI JSON
     ej.notas             // ← From AI JSON
   ]);
});
```

#### Step 6: Modal Display (Database → UI)
```javascript
// backend/routes/routines.js:336-350
router.get('/sessions/:sessionId/progress', (req, res) => {
  const progress = await pool.query(`
    SELECT exercise_name, series_total, repeticiones, descanso_seg, 
           intensidad, tempo, notas  // ← All AI data from DB
      FROM app.methodology_exercise_progress
     WHERE methodology_session_id = $1
  `);
  // Returns AI exercise data to frontend modal
});
```

#### Step 7: Historical Data Storage (Completed → AI Memory)
```javascript
// When user completes exercises:
// Data flows to exercise_history and methodology_exercise_feedback
// for future AI recommendations to avoid repetition
```

### 2. **HOME TRAINING FLOW** 

```
User → HomeTrainingScreen → POST /api/ia-home-training/generate 
                                    ↓
                            Uses OPENAI_API_KEY_HOME_TRAINING
                                    ↓
                        AI generates workout → home_training_sessions
                                    ↓
                        User executes → home_exercise_progress
                                    ↓
                        Completion data → exercise_history (AI memory)
```

### 3. **VIDEO/PHOTO CORRECTION FLOW**

```
User uploads → VideoCorrection component → POST /api/ai/analyze-video
                                                    ↓
                                          Uses OPENAI_API_KEY_CORRECTION_VIDEO
                                                    ↓
                                          AI analyzes form → returns corrections
```

### 4. **NUTRITION FLOW**

```
User → Nutrition screen → POST /api/nutrition/generate-meal-plan
                                    ↓
                            Uses OPENAI_API_KEY_NUTRITION
                                    ↓
                        AI generates meal plan → daily_nutrition_log
```

## 🔧 Critical Technical Details

### Missing Day Handling
```javascript
// backend/routes/routines.js:65-109
// When user starts training on weekend (Sat/Sun) but AI plan only has weekdays:
async function createMissingDaySession(client, userId, methodologyPlanId, planDataJson, requestedDay) {
  // Takes first available session as template
  const templateSession = sesiones[0];
  // Creates new session for requested day using template exercises
}
```

### Day Name Normalization  
```javascript
// backend/routes/routines.js:11-25
function normalizeDayAbbrev(dayName) {
  const map = {
    'lunes': 'Lun', 'sábado': 'Sab', 'domingo': 'Dom', // ← Supports full Spanish names
    // ... etc
  };
  return map[stripDiacritics(dayName.toLowerCase())] || dayName;
}
```

### Database Constraints
```sql
-- Updated to support both abbreviated and full Spanish day names
ALTER TABLE app.methodology_exercise_sessions 
ADD CONSTRAINT methodology_sessions_day_valid 
CHECK (day_name IN ('Lun','Mar','Mie','Jue','Vie','Sab','Dom',
                    'Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'));
```

## 📊 Data Flow Summary

**AI GENERATES** → **DATABASE STORES** → **USER INTERFACE DISPLAYS** → **HISTORICAL TRACKING**

1. **AI generates** complete workout plans with all exercise details
2. **Database stores** AI data in `plan_data` JSON columns  
3. **Backend extracts** AI exercise data and creates individual progress records
4. **Frontend modals** display the exact AI-generated exercise data
5. **User completions** feed back into AI memory for future recommendations

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
- ✅ Recent refactor: Extracted routine hooks for better modularity
- ✅ Weekend session support: Fixed missing Saturday/Sunday training sessions
- ✅ Database constraints: Updated to support full Spanish day names
- 🔄 Active branch: `feat/refactor-routine-hooks`

## 🛠️ Development Notes

### Recent Critical Fixes (August 30, 2025)
- **Fixed null user_id constraint violation** in `methodology_exercise_progress` table
- **Added weekend session support**: When AI plans don't include Sat/Sun, system auto-creates sessions using weekday templates
- **Updated database constraints**: `methodology_sessions_day_valid` now accepts both abbreviated and full Spanish day names
- **Fixed starting day logic**: Training now starts on current day instead of defaulting to Monday

### Previous Changes
- Refactored routine system with custom hooks (`useRoutinePlan`, `useRoutineSession`, `useRoutineStats`)
- Improved error handling and loading states
- Enhanced session management and persistence
- Fixed methodology plan integration issues

### Known Working Flows
1. **Methodology Generation**: ✅ AI generates → DB stores → Routines display → User trains
2. **Weekend Training**: ✅ Saturday/Sunday sessions auto-created from templates
3. **Exercise Modal Display**: ✅ Shows AI-generated exercises, series, rest times, etc.
4. **Historical Tracking**: ✅ Completed exercises saved for AI memory

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

*Last updated: August 30, 2025*
*Project: Entrena con IA - AI-Powered Fitness Application*
*Documentation includes: Complete AI flows, API integration, database schema, recent fixes*