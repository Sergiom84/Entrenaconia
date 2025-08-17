import { useEffect, useState } from 'react';
import { ArrowLeft, User, Activity, Target, Heart, Settings, Ruler } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProfileState } from '../../hooks/useProfileState';
import { useAuth } from '../../contexts/AuthContext';

// Importar todos los tabs
import { BasicInfoTab } from './BasicInfoTab';
import { BodyCompositionTab } from './BodyCompositionTab';
import { ExperienceTab } from './ExperienceTab';
import { GoalsTab } from './GoalsTab';
import { HealthTab } from './HealthTab';
import { SettingsTab } from './SettingsTab';

const ProfileSection = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('basic');

  // Usar el hook personalizado para manejar el estado del perfil
  const profileState = useProfileState();

  const tabs = [
    {
      id: 'basic',
      label: 'Información Básica',
      icon: User,
      component: BasicInfoTab
    },
    {
      id: 'body',
      label: 'Composición Corporal',
      icon: Activity,
      component: BodyCompositionTab
    },
    {
      id: 'experience',
      label: 'Experiencia',
      icon: Ruler,
      component: ExperienceTab
    },
    {
      id: 'goals',
      label: 'Objetivos',
      icon: Target,
      component: GoalsTab
    },
    {
      id: 'health',
      label: 'Salud',
      icon: Heart,
      component: HealthTab
    },
    {
      id: 'settings',
      label: 'Preferencias',
      icon: Settings,
      component: SettingsTab
    }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  // Calcular progreso del perfil
  const calculateProfileProgress = () => {
    let completedSections = 0;
    const totalSections = 6;

    // Verificar información básica
    if (profileState.userProfile?.nombre && profileState.userProfile?.edad &&
        profileState.userProfile?.peso && profileState.userProfile?.altura) {
      completedSections++;
    }

    // Verificar composición corporal (al menos IMC calculado)
    if (profileState.userProfile?.peso && profileState.userProfile?.altura) {
      completedSections++;
    }

    // Verificar experiencia
    if (profileState.userProfile?.años_entrenando && profileState.userProfile?.nivel_actividad) {
      completedSections++;
    }

    // Verificar objetivos
    if (profileState.userProfile?.objetivo_principal) {
      completedSections++;
    }

    // Verificar salud (al menos una métrica)
    if (profileState.userProfile?.frecuencia_cardiaca_reposo ||
        profileState.userProfile?.condiciones_medicas?.length > 0) {
      completedSections++;
    }

    // Verificar preferencias
    if (profileState.userProfile?.duracion_preferida &&
        profileState.userProfile?.horario_preferido) {
      completedSections++;
    }

    return Math.round((completedSections / totalSections) * 100);
  };

  const profileProgress = calculateProfileProgress();

  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-6 py-8">
        {/* Header con navegación */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-gray-300 hover:text-white transition-colors duration-200"
          >
            <ArrowLeft size={24} className="mr-2" />
            Volver al inicio
          </button>

          {/* Indicador de progreso */}
          <div className="flex items-center">
            <span className="text-sm text-gray-400 mr-3">Perfil completado:</span>
            <div className="flex items-center">
              <div className="w-24 bg-gray-700 rounded-full h-2 mr-2">
                <div 
                  className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${profileProgress}%` }}
                ></div>
              </div>
              <span className="text-sm font-medium text-yellow-400">{profileProgress}%</span>
            </div>
          </div>
        </div>

        {/* Título principal */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-yellow-400">
            Mi Perfil
          </h1>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto">
            Completa tu información personal para obtener entrenamientos más precisos y personalizados
          </p>
        </div>

        {/* Navegación por tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-yellow-400 text-black'
                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              <tab.icon size={18} className="mr-2" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* Contenido del tab activo */}
        <div className="max-w-6xl mx-auto">
          {ActiveComponent && (
            <ActiveComponent
              {...profileState}
              currentUser={JSON.parse(localStorage.getItem('user') || '{}')}
            />
          )}
        </div>


      </div>
    </div>
  );
};

export default ProfileSection;
