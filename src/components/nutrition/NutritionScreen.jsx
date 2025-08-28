import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserContext } from '@/contexts/UserContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Calendar,
  Utensils,
  Target,
  Zap,
  ShoppingCart,
  TrendingUp,
  Activity,
  Apple
} from 'lucide-react';

// Importar componentes individuales
import NutritionCalendar from './NutritionCalendar';
import FoodDatabase from './FoodDatabase';
import MacroTracker from './MacroTracker';
import SupplementsSection from './SupplementsSection';
import NutritionAI from './NutritionAI';
import MealPlanner from './MealPlanner';

export default function NutritionScreen() {
  const { currentUser, user } = useAuth();
  const { userData } = useUserContext();
  const [activeTab, setActiveTab] = useState('overview');
  const [nutritionPlan, setNutritionPlan] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Obtener información del usuario y rutina actual
  useEffect(() => {
    fetchUserNutritionData();
  }, []);

  const fetchUserNutritionData = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      // Obtener datos nutricionales del usuario (si existen)
      const response = await fetch('/api/nutrition/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserStats(data.stats);
        setNutritionPlan(data.currentPlan);
      }
    } catch (error) {
      console.error('Error fetching nutrition data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calcular macros básicos basados en el perfil del usuario
  const calculateBasicMacros = () => {
    if (!userData) return null;

    const weight = parseFloat(userData.peso) || 70;
    const height = parseFloat(userData.altura) || 170;
    const age = parseInt(userData.edad) || 30;
    const activityLevel = userData.nivel_actividad || 'moderado';
    const goal = userData.objetivo_principal || 'mantener';

    // Cálculo de TMB (Tasa Metabólica Basal) usando fórmula Mifflin-St Jeor
    const isMale = userData.sexo === 'masculino';
    let bmr;
    
    if (isMale) {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
    } else {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
    }

    // Factor de actividad
    const activityFactors = {
      'bajo': 1.2,
      'moderado': 1.55,
      'alto': 1.9
    };

    const tdee = bmr * (activityFactors[activityLevel] || 1.55);

    // Ajustar según objetivo
    let calories = tdee;
    if (goal === 'perder_peso') {
      calories = tdee * 0.85; // Déficit del 15%
    } else if (goal === 'ganar_peso') {
      calories = tdee * 1.15; // Superávit del 15%
    }

    // Distribución de macros según metodología
    const methodology = userData.metodologia_preferida || 'hipertrofia';
    let proteinRatio, carbRatio, fatRatio;

    switch (methodology) {
      case 'crossfit':
        proteinRatio = 0.30;
        carbRatio = 0.40;
        fatRatio = 0.30;
        break;
      case 'powerlifting':
        proteinRatio = 0.25;
        carbRatio = 0.45;
        fatRatio = 0.30;
        break;
      case 'bodybuilding':
      case 'hipertrofia':
        proteinRatio = 0.35;
        carbRatio = 0.40;
        fatRatio = 0.25;
        break;
      default:
        proteinRatio = 0.30;
        carbRatio = 0.40;
        fatRatio = 0.30;
    }

    return {
      calories: Math.round(calories),
      protein: Math.round((calories * proteinRatio) / 4), // 4 kcal por gramo
      carbs: Math.round((calories * carbRatio) / 4),
      fat: Math.round((calories * fatRatio) / 9), // 9 kcal por gramo
      bmr: Math.round(bmr),
      tdee: Math.round(tdee)
    };
  };

  const basicMacros = calculateBasicMacros();

  const nutritionTabs = [
    {
      id: 'overview',
      label: 'Resumen',
      icon: Target,
      description: 'Vista general de tu nutrición'
    },
    {
      id: 'calendar',
      label: 'Calendario',
      icon: Calendar,
      description: 'Plan semanal de comidas'
    },
    {
      id: 'planner',
      label: 'Planificador',
      icon: Utensils,
      description: 'Crear planes de comidas'
    },
    {
      id: 'tracker',
      label: 'Macros',
      icon: Activity,
      description: 'Seguimiento de macronutrientes'
    },
    {
      id: 'database',
      label: 'Alimentos',
      icon: Apple,
      description: 'Base de datos nutricional'
    },
    {
      id: 'supplements',
      label: 'Suplementos',
      icon: Zap,
      description: 'Recomendaciones y compras'
    },
    {
      id: 'ai',
      label: 'IA Nutricional',
      icon: TrendingUp,
      description: 'Asistente inteligente'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                Nutrición Deportiva
              </h1>
              <p className="text-gray-300 text-lg">
                Plan nutricional personalizado para tu entrenamiento
              </p>
            </div>
            <div className="flex items-center gap-4">
              {basicMacros && (
                <Card className="bg-gray-800/70 border-gray-600">
                  <CardContent className="p-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-400">
                        {basicMacros.calories}
                      </p>
                      <p className="text-sm text-gray-300">kcal/día</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="flex flex-wrap gap-2 mb-6">
            {nutritionTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-yellow-400 text-black font-semibold'
                      : 'bg-gray-800/70 text-gray-300 hover:bg-gray-700/70 hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                  <span className="hidden sm:block">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Macros Overview */}
              {basicMacros && (
                <Card className="bg-gray-800/70 border-gray-600 lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Target className="text-yellow-400" size={24} />
                      Objetivos Nutricionales
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-blue-500/20 rounded-lg border border-blue-500/30">
                        <p className="text-2xl font-bold text-blue-400">
                          {basicMacros.calories}
                        </p>
                        <p className="text-sm text-gray-300">Calorías</p>
                      </div>
                      <div className="text-center p-4 bg-red-500/20 rounded-lg border border-red-500/30">
                        <p className="text-2xl font-bold text-red-400">
                          {basicMacros.protein}g
                        </p>
                        <p className="text-sm text-gray-300">Proteína</p>
                      </div>
                      <div className="text-center p-4 bg-green-500/20 rounded-lg border border-green-500/30">
                        <p className="text-2xl font-bold text-green-400">
                          {basicMacros.carbs}g
                        </p>
                        <p className="text-sm text-gray-300">Carbohidratos</p>
                      </div>
                      <div className="text-center p-4 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                        <p className="text-2xl font-bold text-yellow-400">
                          {basicMacros.fat}g
                        </p>
                        <p className="text-sm text-gray-300">Grasas</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Quick Actions */}
              <Card className="bg-gray-800/70 border-gray-600">
                <CardHeader>
                  <CardTitle className="text-white">Acciones Rápidas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    onClick={() => setActiveTab('ai')}
                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-black"
                  >
                    <TrendingUp size={16} className="mr-2" />
                    Generar Plan con IA
                  </Button>
                  <Button 
                    onClick={() => setActiveTab('planner')}
                    variant="outline" 
                    className="w-full border-gray-600 text-white hover:bg-gray-700"
                  >
                    <Utensils size={16} className="mr-2" />
                    Planificar Comidas
                  </Button>
                  <Button 
                    onClick={() => setActiveTab('supplements')}
                    variant="outline" 
                    className="w-full border-gray-600 text-white hover:bg-gray-700"
                  >
                    <ShoppingCart size={16} className="mr-2" />
                    Ver Suplementos
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'calendar' && (
            <NutritionCalendar 
              nutritionPlan={nutritionPlan}
              userMacros={basicMacros}
              onPlanUpdate={setNutritionPlan}
            />
          )}

          {activeTab === 'planner' && (
            <MealPlanner 
              userMacros={basicMacros}
              userData={userData}
              onPlanCreated={setNutritionPlan}
            />
          )}

          {activeTab === 'tracker' && (
            <MacroTracker 
              targetMacros={basicMacros}
              userStats={userStats}
            />
          )}

          {activeTab === 'database' && (
            <FoodDatabase />
          )}

          {activeTab === 'supplements' && (
            <SupplementsSection 
              userData={userData}
              userMacros={basicMacros}
            />
          )}

          {activeTab === 'ai' && (
            <NutritionAI 
              userData={userData}
              currentRoutine={null} // TODO: Obtener rutina actual
              userMacros={basicMacros}
              onPlanGenerated={setNutritionPlan}
            />
          )}
        </div>
      </div>
    </div>
  );
}