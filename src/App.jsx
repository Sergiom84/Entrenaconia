import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './components/HomePage'
import HomeTrainingSection from './components/HomeTraining/HomeTrainingSection'
import ProfileSection from './components/profile/ProfileSection'
import MethodologiesScreen from './components/Methodologie/MethodologiesScreen'
import RoutineScreen from './components/routines/RoutineScreen'
import NutritionScreen from './components/nutrition/NutritionScreen'
import VideoCorrection from './components/VideoCorrection'
import AudioBubble from './components/AudioBubble'
import LoginPage from './components/auth/LoginPage'
import RegisterPage from './components/auth/RegisterPage'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './contexts/AuthContext'
import { UserProvider } from './contexts/UserContext'
import { useMusicSync } from './hooks/useMusicSync'
import { useAuth } from './contexts/AuthContext'
import { useState, useEffect } from 'react'

function AppContent() {
  const { user, isAuthenticated } = useAuth();
  const [currentExercise, setCurrentExercise] = useState(null);
  const { musicConfig } = useMusicSync(user?.id);

  // Listen for exercise changes from various components
  useEffect(() => {
    const handleExerciseChange = (event) => {
      setCurrentExercise(event.detail);
    };

    window.addEventListener('exerciseChanged', handleExerciseChange);
    return () => window.removeEventListener('exerciseChanged', handleExerciseChange);
  }, []);

  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route
            index
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/home-training"
            element={
              <ProtectedRoute>
                <HomeTrainingSection />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfileSection />
              </ProtectedRoute>
            }
          />
          <Route
            path="/methodologies"
            element={
              <ProtectedRoute>
                <MethodologiesScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/routines"
            element={
              <ProtectedRoute>
                <RoutineScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/nutrition"
            element={
              <ProtectedRoute>
                <NutritionScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/video-correction"
            element={
              <ProtectedRoute>
                <VideoCorrection />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* Aquí se agregarán más rutas en el futuro */}
        </Route>
      </Routes>

      {/* Audio Bubble - Only show when authenticated and not on login/register pages */}
      {isAuthenticated && user && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/register') && (
        <AudioBubble 
          musicConfig={musicConfig}
          currentExercise={currentExercise}
        />
      )}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <UserProvider>
        <AppContent />
      </UserProvider>
    </AuthProvider>
  )
}

export default App
