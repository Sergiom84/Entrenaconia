# 🔄 Routine Persistence System - Quick Reference Guide

## 📋 Overview
**Date**: September 1, 2025  
**Feature**: Automatic routine state recovery after logout/login  
**Status**: ✅ IMPLEMENTED & TESTED  

## 🎯 Problem Solved
- **Before**: Users lost routine progress after logout/login → redirected to methodologies
- **After**: Users automatically recover their active routine with complete progress intact

## 🔧 Key Components

### Backend Endpoint
**File**: `backend/routes/routines.js:1003-1053`
```javascript
// GET /api/routines/active-plan
router.get('/active-plan', authenticateToken, async (req, res) => {
  // Queries methodology_plans WHERE status = 'active'
  // Returns: { hasActivePlan, routinePlan, methodology_plan_id, planSource }
});
```

### Frontend API Function
**File**: `src/components/routines/api.js:105-113`
```javascript
export async function getActivePlan() {
  // Calls /api/routines/active-plan endpoint
  // Returns active routine data for recovery
}
```

### Auto-Recovery Logic
**File**: `src/components/routines/RoutineScreen.jsx:46-71`
```javascript
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
        setIsCheckingPlanStatus(false); // ⭐ CRITICAL: Prevents infinite loading
      });
  }
}, []);

// Use effective plan (incoming or recovered)
const effectivePlan = incomingPlan || recoveredPlan;
```

## 🐛 Critical Bug Fixes Applied

### 1. Fixed Hardcoded 'Adaptada' Methodology
**File**: `backend/routes/routines.js:92`
```javascript
// ❌ Before: VALUES ($1, $2, 'Adaptada', $3, ...)
// ✅ After: VALUES ($1, $2, $3, $4, ...)  // Uses realMethodology
const realMethodology = planDataJson?.selected_style || 'Adaptada';
```

### 2. Fixed Session Summary Display
**File**: `src/components/routines/RoutineSessionSummaryCard.jsx:69-84`
```javascript
// ❌ Before: <h2>HIIT en Casa</h2>
// ✅ After: <h2>{plan?.selected_style || session?.methodology_type}</h2>
```

### 3. Fixed Exercise Feedback Integration  
**File**: `backend/routes/routines.js:572-585`
```javascript
// ✅ Added LEFT JOIN to include exercise feedback
SELECT mep.*, mef.sentiment, mef.comment
FROM methodology_exercise_progress mep
LEFT JOIN methodology_exercise_feedback mef 
  ON mep.methodology_session_id = mef.methodology_session_id 
  AND mep.exercise_order = mef.exercise_order
```

### 4. Fixed AI Historical Data Access
**File**: `backend/routes/aiMethodologie.js:118`
```javascript
// ❌ Before: FROM app.exercise_history (empty table)
// ✅ After: FROM app.methodology_exercise_history_complete (populated)
```

## 🎨 UI Enhancements

### Exercise Feedback Display
**File**: `src/components/routines/RoutineSessionSummaryCard.jsx:148-150`
```javascript
{sentiment === 'love' && <span>❤️ Le encanta</span>}
{sentiment === 'hard' && <span>⚠️ Es difícil</span>}
{sentiment === 'normal' && <span>👍 Normal</span>}
```

### Removed Exercise Limit
**File**: `src/components/routines/tabs/TodayTrainingTab.jsx:414`
```javascript
// ❌ Before: {todaySession.ejercicios.slice(0, 5).map(...)}
// ✅ After: {todaySession.ejercicios.map(...)}
```

## 📊 Database Schema Dependencies

### Required Tables:
- `app.methodology_plans` - Must have `status` column ('draft'/'active')
- `app.methodology_exercise_sessions` - Stores session data
- `app.methodology_exercise_progress` - Exercise completion data
- `app.methodology_exercise_feedback` - User feedback (sentiment, comments)
- `app.methodology_exercise_history_complete` - Historical data for AI

### Critical Status Flow:
1. Plan created → `status = 'draft'`
2. User confirms routine → `status = 'active'` (via `app.confirm_routine_plan()`)
3. Recovery queries → `WHERE status = 'active'`

## 🧪 Testing Checklist

✅ **Logout/Login Recovery**: User maintains routine state  
✅ **Exercise Progress**: All completed exercises show in green  
✅ **Feedback Display**: Sentiment indicators visible in session summary  
✅ **Correct Titles**: Shows actual methodology (not "HIIT en Casa")  
✅ **All Exercises**: No 5-exercise limit, shows complete workout  
✅ **AI Variation**: Future routines avoid repeated exercises using correct history  

## 🚨 Common Issues & Solutions

### Issue: Infinite "Verificando estado del plan..."
**Cause**: `setIsCheckingPlanStatus(false)` missing in recovery flow  
**Fix**: Added in `finally()` block of `getActivePlan()` call  

### Issue: Wrong methodology displayed  
**Cause**: Hardcoded 'Adaptada' in session creation  
**Fix**: Use `realMethodology` from plan JSON data  

### Issue: Missing exercise feedback  
**Cause**: API not joining feedback table  
**Fix**: LEFT JOIN with `methodology_exercise_feedback`  

### Issue: AI repeating exercises  
**Cause**: Reading from empty `exercise_history` table  
**Fix**: Read from `methodology_exercise_history_complete`  

## 📚 Related Files

**Backend**: `routes/routines.js`, `routes/aiMethodologie.js`  
**Frontend**: `RoutineScreen.jsx`, `TodayTrainingTab.jsx`, `api.js`, `RoutineSessionSummaryCard.jsx`  
**Prompts**: `prompts/Methodologie_(Auto).md`  
**Database**: All `app.methodology_*` tables  

---
*Quick Reference Guide - September 1, 2025*  
*For detailed technical documentation, see CLAUDE.md*