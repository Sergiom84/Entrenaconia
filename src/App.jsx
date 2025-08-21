import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './components/HomePage'
import HomeTrainingSection from './components/HomeTraining/HomeTrainingSection'
import ProfileSection from './components/profile/ProfileSection'
import MethodologiesScreen from './components/Methodologie/MethodologiesScreen'
import VideoCorrectionSection from './components/VideoCorrectionSection/VideoCorrectionSection'
import LoginPage from './components/auth/LoginPage'
import RegisterPage from './components/auth/RegisterPage'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './contexts/AuthContext'
import { UserProvider } from './contexts/UserContext'

function App() {
  return (
    <AuthProvider>
      <UserProvider>
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
            path="/video-correction"
            element={
              <ProtectedRoute>
                <VideoCorrectionSection />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* Aquí se agregarán más rutas en el futuro */}
        </Route>
      </Routes>
      </UserProvider>
    </AuthProvider>
  )
}

export default App
