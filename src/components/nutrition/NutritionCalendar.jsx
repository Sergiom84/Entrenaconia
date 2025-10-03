import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Utensils,
  Clock,
  Target,
  CheckCircle,
  Plus
} from 'lucide-react';

export default function NutritionCalendar({ nutritionPlan, userMacros, onPlanUpdate }) {
  const [currentWeek, setCurrentWeek] = useState(0);
  const [selectedDay, setSelectedDay] = useState(null);
  const [mealProgress, setMealProgress] = useState({});

  // Debug: Log de la estructura del plan
  useEffect(() => {
    if (nutritionPlan) {
      console.log('📅 NutritionCalendar - Plan recibido:', {
        hasDirectDays: !!nutritionPlan.Lunes,
        hasPlanData: !!nutritionPlan.plan_data,
        hasDailyPlans: !!nutritionPlan.plan_data?.daily_plans,
        dailyPlansLength: nutritionPlan.plan_data?.daily_plans?.length,
        structure: Object.keys(nutritionPlan)
      });
    } else {
      console.log('📅 NutritionCalendar - Sin plan, usando valores por defecto');
    }
  }, [nutritionPlan]);

  // Generar estructura de semana DESDE HOY (no desde el lunes)
  const generateWeekStructure = () => {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const today = new Date();

    // Si hay un plan nutricional con fecha de inicio, usar esa fecha
    let startDate = today;
    if (nutritionPlan?.created_at) {
      const planStartDate = new Date(nutritionPlan.created_at);
      // Solo usar la fecha del plan si es reciente (últimos 30 días)
      const daysSinceCreation = Math.floor((today - planStartDate) / (1000 * 60 * 60 * 24));
      if (daysSinceCreation >= 0 && daysSinceCreation < 30) {
        startDate = planStartDate;
      }
    }

    // Generar 7 días consecutivos desde la fecha de inicio + offset de semana
    return days.map((day, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index + (currentWeek * 7));

      return {
        name: day,
        date: date,
        dateString: date.toISOString().split('T')[0],
        isToday: date.toDateString() === new Date().toDateString(),
        dayIndex: index // Índice del día en el plan (0-6)
      };
    });
  };

  const weekDays = generateWeekStructure();

  // Plan de comidas por defecto si no hay plan personalizado
  const getDefaultMealPlan = (dayName) => {
    const baseCalories = userMacros?.calories || 2000;
    const protein = userMacros?.protein || 150;
    const carbs = userMacros?.carbs || 200;
    const fat = userMacros?.fat || 65;

    return {
      desayuno: {
        name: 'Desayuno',
        time: '08:00',
        calories: Math.round(baseCalories * 0.25),
        protein: Math.round(protein * 0.25),
        carbs: Math.round(carbs * 0.30),
        fat: Math.round(fat * 0.25),
        foods: [] // Comidas generadas por IA según perfil nutricional
      },
      almuerzo: {
        name: 'Almuerzo',
        time: '13:30',
        calories: Math.round(baseCalories * 0.35),
        protein: Math.round(protein * 0.40),
        carbs: Math.round(carbs * 0.35),
        fat: Math.round(fat * 0.30),
        foods: [] // Comidas generadas por IA según perfil nutricional
      },
      merienda: {
        name: 'Merienda',
        time: '17:00',
        calories: Math.round(baseCalories * 0.15),
        protein: Math.round(protein * 0.20),
        carbs: Math.round(carbs * 0.15),
        fat: Math.round(fat * 0.15),
        foods: [] // Comidas generadas por IA según perfil nutricional
      },
      cena: {
        name: 'Cena',
        time: '20:30',
        calories: Math.round(baseCalories * 0.25),
        protein: Math.round(protein * 0.15),
        carbs: Math.round(carbs * 0.20),
        fat: Math.round(fat * 0.30),
        foods: [] // Comidas generadas por IA según perfil nutricional
      }
    };
  };

  const getMealPlanForDay = (dayName, dayIndex) => {
    // Intentar obtener el plan del día desde diferentes estructuras posibles
    let dayPlan = null;

    // Estructura 1: nutritionPlan[dayName] (directo)
    if (nutritionPlan && nutritionPlan[dayName]) {
      dayPlan = nutritionPlan[dayName];
    }

    // Estructura 2: nutritionPlan.plan_data.daily_plans (array)
    if (!dayPlan && nutritionPlan?.plan_data?.daily_plans) {
      const dailyPlans = nutritionPlan.plan_data.daily_plans;

      // Usar el índice del día si está disponible, sino buscar por nombre
      let planDayIndex = dayIndex;
      if (planDayIndex === undefined) {
        planDayIndex = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
          .indexOf(dayName);
      }

      if (planDayIndex >= 0 && planDayIndex < dailyPlans.length && dailyPlans[planDayIndex]) {
        const planDay = dailyPlans[planDayIndex];
        console.log(`📅 Mapeando día ${dayName} (índice ${planDayIndex}):`, planDay);

        // Convertir estructura de meals a estructura esperada
        dayPlan = {};
        (planDay.meals || []).forEach(meal => {
          const mealType = (meal.meal_type || 'almuerzo').toLowerCase();
          const nutrition = meal.nutrition || {};
          dayPlan[mealType] = {
            name: meal.name || meal.title || meal.meal_name || mealType,
            time: meal.time || '12:00',
            calories: Math.round(nutrition.calories || 0),
            protein: Math.round(nutrition.protein || 0),
            carbs: Math.round(nutrition.carbs || 0),
            fat: Math.round(nutrition.fat || 0),
            foods: meal.ingredients || []
          };
        });
      }
    }

    // Si no hay plan, usar el plan por defecto
    return dayPlan || getDefaultMealPlan(dayName);
  };

  const handleMealComplete = (dayString, mealId) => {
    setMealProgress(prev => ({
      ...prev,
      [`${dayString}-${mealId}`]: !prev[`${dayString}-${mealId}`]
    }));
  };

  const isMealCompleted = (dayString, mealId) => {
    return mealProgress[`${dayString}-${mealId}`] || false;
  };

  const getDayProgress = (dayString) => {
    const dayMeals = Object.keys(getDefaultMealPlan()).length;
    let completed = 0;
    
    Object.keys(getDefaultMealPlan()).forEach(mealId => {
      if (isMealCompleted(dayString, mealId)) {
        completed++;
      }
    });
    
    return {
      completed,
      total: dayMeals,
      percentage: Math.round((completed / dayMeals) * 100)
    };
  };

  return (
    <div className="space-y-6">
      {/* Header del calendario */}
      <Card className="bg-gray-800/70 border-gray-600">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="text-yellow-400" size={24} />
              Calendario Nutricional
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentWeek(prev => prev - 1)}
                className="border-gray-600 text-white hover:bg-gray-700"
              >
                <ChevronLeft size={16} />
              </Button>
              <span className="text-white font-semibold px-4">
                Semana del {weekDays[0]?.date.toLocaleDateString('es-ES', { 
                  day: 'numeric', 
                  month: 'short' 
                })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentWeek(prev => prev + 1)}
                className="border-gray-600 text-white hover:bg-gray-700"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Vista semanal */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {weekDays.map((day) => {
          const dayMeals = getMealPlanForDay(day.name, day.dayIndex);
          const progress = getDayProgress(day.dateString);
          
          return (
            <Card 
              key={day.dateString}
              className={`bg-gray-800/70 border-gray-600 cursor-pointer transition-all duration-200 hover:bg-gray-700/70 ${
                day.isToday ? 'ring-2 ring-yellow-400' : ''
              } ${
                selectedDay === day.dateString ? 'ring-2 ring-blue-400' : ''
              }`}
              onClick={() => setSelectedDay(selectedDay === day.dateString ? null : day.dateString)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-semibold">{day.name}</h3>
                    <p className="text-gray-300 text-sm">
                      {day.date.getDate()} {day.date.toLocaleDateString('es-ES', { month: 'short' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-yellow-400">
                      {progress.percentage}%
                    </div>
                    <div className="w-16 h-2 bg-gray-600 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-yellow-400 transition-all duration-300"
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
                {day.isToday && (
                  <Badge className="bg-yellow-400 text-black text-xs w-fit">
                    Hoy
                  </Badge>
                )}
              </CardHeader>

              <CardContent>
                <div className="space-y-2">
                  {Object.entries(dayMeals).map(([mealId, meal]) => (
                    <div 
                      key={mealId}
                      className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                        isMealCompleted(day.dateString, mealId) 
                          ? 'bg-green-500/20 border border-green-500/30' 
                          : 'bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Utensils size={14} className={
                          isMealCompleted(day.dateString, mealId) ? 'text-green-400' : 'text-gray-400'
                        } />
                        <div>
                          <p className={`text-sm font-medium ${
                            isMealCompleted(day.dateString, mealId) ? 'text-green-300' : 'text-white'
                          }`}>
                            {meal.name}
                          </p>
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock size={10} />
                            {meal.time}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMealComplete(day.dateString, mealId);
                        }}
                        className={`p-1 rounded transition-colors ${
                          isMealCompleted(day.dateString, mealId)
                            ? 'text-green-400 hover:text-green-300'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <CheckCircle size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detalle del día seleccionado */}
      {selectedDay && (
        <Card className="bg-gray-800/70 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span>
                Detalle del {weekDays.find(d => d.dateString === selectedDay)?.name}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="border-gray-600 text-white hover:bg-gray-700"
              >
                <Plus size={16} className="mr-1" />
                Editar Plan
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Object.entries(getMealPlanForDay(weekDays.find(d => d.dateString === selectedDay)?.name)).map(([mealId, meal]) => (
                <div key={mealId} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Utensils className="text-yellow-400" size={18} />
                      {meal.name}
                    </h4>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Clock size={14} />
                      {meal.time}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-sm">
                    <div className="text-center p-2 bg-blue-500/20 rounded border border-blue-500/30">
                      <p className="font-bold text-blue-400">{meal.calories}</p>
                      <p className="text-gray-300 text-xs">kcal</p>
                    </div>
                    <div className="text-center p-2 bg-red-500/20 rounded border border-red-500/30">
                      <p className="font-bold text-red-400">{meal.protein}g</p>
                      <p className="text-gray-300 text-xs">Prot.</p>
                    </div>
                    <div className="text-center p-2 bg-green-500/20 rounded border border-green-500/30">
                      <p className="font-bold text-green-400">{meal.carbs}g</p>
                      <p className="text-gray-300 text-xs">Carb.</p>
                    </div>
                    <div className="text-center p-2 bg-yellow-500/20 rounded border border-yellow-500/30">
                      <p className="font-bold text-yellow-400">{meal.fat}g</p>
                      <p className="text-gray-300 text-xs">Gras.</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-300">Alimentos:</p>
                    <ul className="space-y-1">
                      {meal.foods.map((food, idx) => (
                        <li key={idx} className="text-sm text-white flex items-center gap-2">
                          <div className="w-1 h-1 bg-yellow-400 rounded-full"></div>
                          {food}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    onClick={() => handleMealComplete(selectedDay, mealId)}
                    variant={isMealCompleted(selectedDay, mealId) ? "default" : "outline"}
                    size="sm"
                    className={
                      isMealCompleted(selectedDay, mealId)
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "border-gray-600 text-white hover:bg-gray-700"
                    }
                  >
                    <CheckCircle size={14} className="mr-1" />
                    {isMealCompleted(selectedDay, mealId) ? 'Completado' : 'Marcar como hecho'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}