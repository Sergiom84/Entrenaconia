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
  - `GET /active-plan` - **⭐ NEW**: Auto-recovery of active routine after login
  - `GET /progress-data` - **NEW**: Real-time progress analytics for ProgressTab
  - `GET /plan-status/:methodologyPlanId` - **NEW**: Check if routine confirmed
  - `POST /sessions/:sessionId/exercise/:exerciseOrder/feedback` - **NEW**: Save exercise feedback
  - `GET /sessions/:sessionId/feedback` - **NEW**: Load exercise feedback
  - `GET /sessions/:sessionId/progress` - **ENHANCED**: Now includes exercise feedback via LEFT JOIN
- `/api/methodologie/*` - AI methodology generation (now includes user feedback data for better recommendations)
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
- **NEW**: Repeat training functionality with confirmation modal
- **Complete workout reset**: Reset all series, time, and progress to start over
- **Confirmation system**: "¿Quieres repetir el entrenamiento?" with "¿Estás seguro?" confirmation

### 2. **Methodology System** (`/methodologies`)
- **Weider**: Muscle group split training
- **Full Body**: Complete body workouts
- **Push/Pull/Legs**: Functional movement patterns
- **Upper/Lower**: Upper and lower body split
- **HIIT**: High-intensity interval training
- **Functional**: Movement-based training

### 3. **Routine Management** (`/routines`)
- Structured gym routines with progression
- **Tab-based interface**: Today Training, Calendar View, Progress Analytics
- Session tracking and exercise logging with persistence
- Performance analytics and statistics
- Custom routine creation and modification
- **Today Training Tab**: Current day exercises with completion tracking
- **Calendar View**: Google Calendar-style workout planning with visual indicators starting Monday
- **Progress Tab**: Real-time historical data and performance metrics from database
- **⭐ NEW: Exercise Feedback System**: Persistent user ratings (love/normal/hard) with comments
- **⭐ NEW: Smart Modal State**: No repeated confirmation modals after routine completion
- **⭐ NEW: Complete Progress Tracking**: Exercise completion data flows to ProgressTab automatically

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
- Project Name: `Entrena_con_IA`
- Database: `postgres`
- Main schema: `app`
- Connection: Pool-based with SSL
- Supabase URL: `https://lhsnmjgdtjalfcsurxvg.supabase.co`
- **Development** (Pooler): `postgresql://postgres.lhsnmjgdtjalfcsurxvg:Xe05Klm563kkjL@aws-1-eu-north-1.pooler.supabase.com:6543/postgres`
- **Production** (Direct): `postgresql://postgres:Xe05Klm563kkjL@db.lhsnmjgdtjalfcsurxvg.supabase.co:5432/postgres`

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

### Tab-Based Routine Interface

The Routines section now features a modern tab-based interface with three distinct views:

#### 1. **Today Training Tab** (`TodayTrainingTab.jsx`)
- Current day workout display with AI-generated exercises
- Real-time exercise completion tracking (completed/skipped/pending states)
- Session persistence across browser sessions and tab switches
- Exercise modal integration with series, reps, rest times, and notes
- Visual indicators: Green (completed), Orange (skipped), Default (pending)

#### 2. **Calendar Tab** (`CalendarTab.jsx`)
- Google Calendar-style weekly view of workout schedule
- Color-coded training days: Yellow (today), Green (past), Blue (future)
- Exercise count and completion status indicators
- Interactive day selection and session overview
- Past/present/future workout visualization

#### 3. **Progress Tab** (`ProgressTab.jsx`)
- Historical performance data and analytics
- Workout completion statistics
- Progress tracking over time
- Performance metrics and insights

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
    model: 'gpt-4o-mini',
    promptId: 'pmpt_68a9a05d7ee0819493fd342673a05b210a99044d2c5e3055'
  },
  METHODOLOGIE_MANUAL: {
    envKey: 'OPENAI_API_KEY_METHODOLOGIE_MANUAL', // Manual methodology generation
    model: 'gpt-4o-mini',
    promptId: 'pmpt_68a9a18bdfc08197965d75cd064eeb1f0a109ccbc248c9ca'
  },
  HOME_TRAINING: {
    envKey: 'OPENAI_API_KEY_HOME_TRAINING',       // Home workout generation
    model: 'gpt-4.1-nano',
    promptId: 'pmpt_688fd23d27448193b5bfbb2c4ef9548103c68f1f6b84e824'
  },
  VIDEO_CORRECTION: {
    envKey: 'OPENAI_API_KEY_CORRECTION_VIDEO',    // Video form analysis
    model: 'gpt-4.1-nano',
    promptId: 'pmpt_68a83503ca28819693a81b0651dd52e00901a6ecf8a21eef'
  },
  PHOTO_CORRECTION: {
    envKey: 'OPENAI_API_KEY_CORRECTION_PHOTO',    // Photo form analysis
    model: 'gpt-4o-mini',
    promptId: 'pmpt_68a89775a9e08190a95a5e3d484fd09a055e214db81a6fd0'
  },
  NUTRITION: {
    envKey: 'OPENAI_API_KEY_NUTRITION',           // Nutrition recommendations
    model: 'gpt-4o-mini',
    promptId: 'pmpt_68ae0d8c52908196a4d207ac1292fcff0eb39487cfc552fc'
  }
}
```

## 🔄 Complete Application Flows

### ⭐ Routine State Persistence System (NEW)

The application now maintains routine state across logout/login cycles, ensuring users can seamlessly return to their active training plans.

#### Key Features:
- **Automatic Recovery**: Active routines are automatically restored after login
- **Zero Data Loss**: All exercise progress, completion status, and feedback persist
- **Seamless UX**: Users directly access their routine tabs without re-generation
- **Smart Fallback**: Redirects to methodology generation only when no active routine exists

#### Implementation:

**Backend Endpoint (`/api/routines/active-plan`):**
```javascript
// GET /api/routines/active-plan - Recovers user's active routine
router.get('/active-plan', authenticateToken, async (req, res) => {
  const activeMethodologyQuery = await pool.query(`
    SELECT mp.id as methodology_plan_id, mp.methodology_type, mp.plan_data, mp.confirmed_at,
           rp.id as routine_plan_id
    FROM app.methodology_plans mp
    LEFT JOIN app.routine_plans rp ON rp.user_id = mp.user_id 
      AND rp.methodology_type = mp.methodology_type
      AND rp.status = 'active'
    WHERE mp.user_id = $1 AND mp.status = 'active'
    ORDER BY mp.confirmed_at DESC LIMIT 1
  `, [userId]);
  
  if (activeMethodologyQuery.rowCount === 0) {
    return res.json({ hasActivePlan: false });
  }
  
  const activePlan = activeMethodologyQuery.rows[0];
  res.json({
    hasActivePlan: true,
    routinePlan: planData,
    methodology_plan_id: activePlan.methodology_plan_id,
    planSource: { label: 'IA' }
  });
});
```

**Frontend Recovery (`RoutineScreen.jsx`):**
```javascript
// Auto-recovery logic when no incoming plan state
useEffect(() => {
  if (!incomingPlan) {
    setIsRecoveringPlan(true);
    
    getActivePlan()
      .then(activeData => {
        if (activeData.hasActivePlan) {
          setRecoveredPlan(activeData.routinePlan);
          setMethodologyPlanId(activeData.methodology_plan_id);
        } else {
          navigate('/methodologies', { replace: true });
        }
      })
      .finally(() => {
        setIsRecoveringPlan(false);
        setIsCheckingPlanStatus(false);
      });
  }
}, []);

// Effective plan selection (incoming or recovered)
const effectivePlan = incomingPlan || recoveredPlan;
```

#### User Experience Flow:
1. **User completes routine** → Plan marked as `status = 'active'` in database
2. **User logs out** → Browser state cleared
3. **User logs back in** → Session restored but routine state lost
4. **User navigates to /routines** → Auto-recovery triggered
5. **System queries database** → Finds active routine plan
6. **Routine restored** → User sees complete progress with all tabs functional

### Exercise Completion Persistence System

The application implements a comprehensive exercise completion persistence system that maintains user progress across browser sessions and tab switches.

#### Key Components:
- **Session Status API**: `GET /api/routines/sessions/today-status` loads current session state
- **Automatic Resume**: Incomplete sessions automatically restore exercise completion states  
- **Visual Feedback**: Completed (green), skipped (orange), pending (default) exercise states
- **Tab-Safe Persistence**: Exercise progress persists when switching between Today/Calendar/Progress tabs

#### Implementation Flow:
```javascript
// TodayTrainingTab.jsx - Load session status on component mount
useEffect(() => {
  const loadTodaySessionStatus = async () => {
    const sessionStatus = await getTodaySessionStatus({
      methodology_plan_id: mId,
      week_number: todaySession.weekNumber || 1,
      day_name: todaySession.dia
    });
    setTodaySessionStatus(sessionStatus); // Restores all exercise states
  };
  loadTodaySessionStatus();
}, [todaySession, methodologyPlanId]);

// Backend API endpoint (routines.js)
router.get('/sessions/today-status', async (req, res) => {
  const session = await pool.query(`
    SELECT s.*, array_agg(json_build_object(
      'exercise_order', p.exercise_order,
      'exercise_name', p.exercise_name,
      'status', p.status,
      'series_completed', p.series_completed
    )) as exercises
    FROM app.methodology_exercise_sessions s
    LEFT JOIN app.methodology_exercise_progress p ON s.id = p.methodology_session_id
    WHERE s.methodology_plan_id = $1 AND s.week_number = $2 AND s.day_name = $3
    GROUP BY s.id
  `);
});
```

### 1. **METHODOLOGY GENERATION → ROUTINE EXECUTION FLOW** ⭐

**This is the main flow from AI generation to user workout execution:**

#### Step 1: AI Generation (`/methodologies` → AI)
```
User → MethodologiesScreen → POST /api/methodologie/generate → OpenAI API
                                    ↓
                            Uses OPENAI_API_KEY_METHODOLOGIE
                            Prompt ID: pmpt_68a9a05d7ee0819493fd342673a05b210a99044d2c5e3055
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
                            Prompt ID: pmpt_688fd23d27448193b5bfbb2c4ef9548103c68f1f6b84e824
                                    ↓
                        AI generates workout → home_training_sessions
                                    ↓
                        User executes → home_exercise_progress
                                    ↓
                        Completion data → exercise_history (AI memory)
```

#### Repeat Training Functionality:
```javascript
// HomeTrainingExerciseModal.jsx - Complete workout reset system
const confirmRepeatTraining = () => {
  setCurrentPhase('ready');           // Reset to initial phase
  setCurrentSeries(1);                // Reset series counter
  setIsRunning(false);               // Stop any running timers
  setTotalTimeSpent(0);              // Reset total time
  setTimeLeft(Number(exercise?.duracion_seg) || 45); // Reset exercise timer
  lastPhaseHandledRef.current = '';   // Clear phase tracking
  lastReportedSeriesRef.current = ''; // Clear series tracking
  setShowRepeatConfirm(false);       // Close confirmation modal
};

// UI Implementation with confirmation flow
<button onClick={() => setShowRepeatConfirm(true)}>
  ¿Quieres repetir el entrenamiento del día?
</button>

{showRepeatConfirm && (
  <div className="confirmation-modal">
    <p>¿Estás seguro?</p>
    <button onClick={confirmRepeatTraining}>Sí</button>
    <button onClick={() => setShowRepeatConfirm(false)}>No</button>
  </div>
)}
```

### 3. **VIDEO/PHOTO CORRECTION FLOW**

```
User uploads → VideoCorrection component → POST /api/ai/analyze-video
                                                    ↓
                                          Uses OPENAI_API_KEY_CORRECTION_VIDEO
                                          Prompt ID: pmpt_68a83503ca28819693a81b0651dd52e00901a6ecf8a21eef
                                                    ↓
                                          AI analyzes form → returns corrections
```

### 4. **NUTRITION FLOW**

```
User → Nutrition screen → POST /api/nutrition/generate-meal-plan
                                    ↓
                            Uses OPENAI_API_KEY_NUTRITION
                            Prompt ID: pmpt_68ae0d8c52908196a4d207ac1292fcff0eb39487cfc552fc
                                    ↓
                        AI generates meal plan → daily_nutrition_log
```

## � Deployment Configuration

### Render.com Environment Variables
Para desplegar en Render, configura estas variables de entorno:

```bash
# Database (usar configuración individual para evitar problemas IPv6 en Render)
DB_HOST=db.lhsnmjgdtjalfcsurxvg.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=Xe05Klm563kkjL
DB_SEARCH_PATH=app,public

# Supabase
SUPABASE_URL=https://lhsnmjgdtjalfcsurxvg.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxoc25tamdkdGphbGZjc3VyeHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0ODEzMjcsImV4cCI6MjA3MjA1NzMyN30.SNxXfC5C6vI8dmRZAlUvHicdpKAquciI4wg7oNvTB5M
SUPABASE_SERVICE_ROLE_KEY=sb_secret_IpeTiJWcnms06aO6jk9Jaw_JBmOKem5

# OpenAI API Keys
OPENAI_API_KEY_HOME_TRAINING=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
OPENAI_API_KEY_CORRECTION_VIDEO=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
OPENAI_API_KEY_CORRECTION_PHOTO=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
OPENAI_API_KEY_METHODOLOGIE=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
OPENAI_API_KEY_METHODOLOGIE_MANUAL=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
OPENAI_API_KEY_NUTRITION=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

# Server Configuration
NODE_ENV=production
PORT=3002
JWT_SECRET=entrenaconjwtsecret2024supersecure
UPLOAD_DIR=uploads
MAX_FILE_SIZE=26214400
OPENAI_VISION_MODEL=gpt-4o-mini
```

### Importante para Render
- **Evitar DATABASE_URL**: No uses DATABASE_URL ya que puede resolver a IPv6 y causar errores ENETUNREACH
- **Usar configuración individual**: Configura DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD por separado
- **Conexión directa**: Usar `db.lhsnmjgdtjalfcsurxvg.supabase.co:5432` (directo) no el pooler
- **Variables de entorno**: Todas las variables deben configurarse en el dashboard de Render
- **Build Command**: `npm install && cd backend && npm install`
- **Start Command**: `cd backend && npm start`

## �🔧 Critical Technical Details

### Routine Confirmation System

The application implements a draft/active status system for routine plans to track user engagement and plan activation.

#### Database Schema:
```sql
-- Add status and confirmation timestamp to methodology_plans
ALTER TABLE app.methodology_plans 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft';
ALTER TABLE app.methodology_plans 
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP NULL;

-- Database function for atomic plan confirmation
CREATE OR REPLACE FUNCTION app.confirm_routine_plan(
    p_user_id INTEGER,
    p_methodology_plan_id INTEGER,
    p_routine_plan_id INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE app.methodology_plans 
    SET status = 'active', confirmed_at = NOW()
    WHERE id = p_methodology_plan_id AND user_id = p_user_id AND status = 'draft';
    
    IF p_routine_plan_id IS NOT NULL THEN
        UPDATE app.routine_plans 
        SET status = 'active', confirmed_at = NOW()
        WHERE id = p_routine_plan_id AND user_id = p_user_id AND status = 'draft';
    END IF;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;
```

#### Frontend Integration:
```javascript
// RoutineScreen.jsx - Confirm routine when user starts training
const handleStart = async () => {
  setIsConfirming(true);
  try {
    const methodologyId = methodologyPlanId || incomingState?.methodology_plan_id;
    const routineId = planId;
    
    if (methodologyId) {
      await confirmRoutinePlan({ 
        methodology_plan_id: methodologyId, 
        routine_plan_id: routineId 
      });
      console.log('✅ Rutina confirmada exitosamente');
    }
    setShowPlanModal(false);
    setActiveTab('today'); // Switch to training tab
  } catch (e) {
    console.error('❌ Error confirmando rutina:', e);
  } finally {
    setIsConfirming(false);
  }
};
```

#### API Endpoint:
```javascript
// backend/routes/routines.js - POST /api/routines/confirm-plan
router.post('/confirm-plan', authenticateToken, async (req, res) => {
  const { methodology_plan_id, routine_plan_id } = req.body;
  const userId = req.user.id;
  
  const confirmResult = await client.query(
    'SELECT app.confirm_routine_plan($1, $2, $3) as confirmed',
    [userId, methodology_plan_id, routine_plan_id || null]
  );
  
  if (confirmResult.rows[0]?.confirmed) {
    res.json({ success: true, message: 'Plan confirmado correctamente' });
  } else {
    res.status(400).json({ success: false, error: 'No se pudo confirmar el plan' });
  }
});
```

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
- ✅ **NEW**: Routine confirmation system with draft/active states
- ✅ **NEW**: Exercise completion persistence system
- ✅ **NEW**: Tab-based routine interface (Today/Calendar/Progress)
- ✅ **NEW**: Session resume functionality
- ✅ **NEW**: Repeat training functionality in HomeTraining
- ✅ **NEW**: ⭐ **Routine State Persistence** - Auto-recovery after logout/login
- ✅ **NEW**: Enhanced exercise feedback display with sentiment indicators
- ✅ **NEW**: Dynamic session summary titles based on actual methodology
- ✅ **NEW**: Complete exercise display (removed 5-exercise limit)
- ✅ **NEW**: Improved AI methodology generation using correct historical data
- 🔄 Active branch: `feat/refactor-routine-hooks`

## 🛠️ Development Notes

### Recent Critical Fixes (September 1, 2025) ⭐
- **NEW**: `/api/routines/active-plan` endpoint for routine state recovery
- **FIXED**: Routine persistence after logout/login with automatic recovery system
- **FIXED**: Hardcoded 'Adaptada' methodology bug → now uses correct plan methodology  
- **FIXED**: Session summary display showing proper titles instead of "HIIT en Casa"
- **FIXED**: Exercise feedback integration in session progress API (LEFT JOIN fix)
- **FIXED**: AI methodology generation reading from correct history table (`methodology_exercise_history_complete`)
- **ENHANCED**: Exercise feedback display with love/normal/hard visual indicators
- **ENHANCED**: Methodology prompts with gym-specific exercise guidelines
- **REMOVED**: Exercise display limitation (now shows all exercises generated)

### Previous Critical Fixes (August 30, 2025)
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

*Last updated: September 1, 2025*
*Project: Entrena con IA - AI-Powered Fitness Application*
*Documentation includes: Complete AI flows, API integration, database schema, routine persistence system, recent fixes*