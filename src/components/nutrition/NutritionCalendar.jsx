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
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Debug: Log de la estructura del plan
  useEffect(() => {
    if (nutritionPlan) {
      console.log('📅 NutritionCalendar - Plan recibido:', {
        hasDirectDays: !!nutritionPlan.Lunes,
        hasPlanData: !!nutritionPlan.plan_data,
        hasDailyPlans: !!nutritionPlan.plan_data?.daily_plans,
        dailyPlansLength: nutritionPlan.plan_data?.daily_plans?.length,
        durationDays: nutritionPlan.duration_days || nutritionPlan.plan_data?.plan_summary?.duration_days,
        createdAt: nutritionPlan.created_at,
        structure: Object.keys(nutritionPlan)
      });

      // Log de los primeros 2 días del plan para verificar estructura
      if (nutritionPlan.plan_data?.daily_plans) {
        const dailyPlansObj = nutritionPlan.plan_data.daily_plans;
        console.log('📅 Primeros 2 días del plan:',
          Object.entries(dailyPlansObj).slice(0, 2).map(([key, day]) => ({
            dayIndex: key,
            mealsCount: day.meals?.length,
            mealTypes: day.meals?.map(m => m.meal_type)
          }))
        );
      }
    } else {
      console.log('📅 NutritionCalendar - Sin plan, usando valores por defecto');
    }
  }, [nutritionPlan]);

  // Cargar progreso guardado de la semana actual
  useEffect(() => {
    const loadWeekProgress = async () => {
      if (!nutritionPlan) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');

        // Generar las fechas de la semana actual
        const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let planStartDate = today;
        if (nutritionPlan?.created_at) {
          planStartDate = new Date(nutritionPlan.created_at);
          planStartDate.setHours(0, 0, 0, 0);
        }

        // Generar fechas de la semana actual
        const weekDates = [];
        for (let i = 0; i < 7; i++) {
          const date = new Date(planStartDate);
          date.setDate(planStartDate.getDate() + i + (currentWeek * 7));
          weekDates.push(date.toISOString().split('T')[0]);
        }

        // Cargar progreso de todos los días de la semana
        const progressPromises = weekDates.map(dateString =>
          fetch(`/api/nutrition/daily/${dateString}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
        );

        const results = await Promise.all(progressPromises);

        // Construir objeto de progreso
        const loadedProgress = {};
        results.forEach((data, idx) => {
          const dateString = weekDates[idx];
          console.log(`📥 Datos recibidos para ${dateString}:`, data);

          if (data?.success && data?.dailyLog?.mealProgress) {
            console.log(`  ✅ mealProgress encontrado:`, data.dailyLog.mealProgress);
            Object.entries(data.dailyLog.mealProgress).forEach(([mealId, completed]) => {
              if (completed) {
                const key = `${dateString}-${mealId}`;
                console.log(`    📌 Cargando: ${key} = ${completed}`);
                loadedProgress[key] = true;
              }
            });
          } else {
            console.log(`  ⚠️ No hay mealProgress para ${dateString}`);
          }
        });

        console.log('📥 Progreso total cargado:', loadedProgress);
        setMealProgress(loadedProgress);
      } catch (error) {
        console.error('❌ Error cargando progreso:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadWeekProgress();
  }, [currentWeek, nutritionPlan]);

  // Generar estructura de semana con mapeo correcto a la estructura del plan
  const generateWeekStructure = () => {
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar a medianoche

    // Determinar fecha de inicio del plan
    let planStartDate = today;
    if (nutritionPlan?.created_at) {
      planStartDate = new Date(nutritionPlan.created_at);
      planStartDate.setHours(0, 0, 0, 0);
    }

    // Calcular duración del plan (por defecto 7 días)
    const planDuration = nutritionPlan?.duration_days ||
                        nutritionPlan?.plan_data?.plan_summary?.duration_days ||
                        7;

    // Generar 7 días consecutivos desde el inicio de la semana actual + offset
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(planStartDate);
      date.setDate(planStartDate.getDate() + i + (currentWeek * 7));

      const dayOfWeek = date.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado
      const dayName = dayNames[dayOfWeek];

      // MAPEO CORRECTO: El plan en BD siempre sigue la estructura:
      // 0=Lunes, 1=Martes, 2=Miércoles, 3=Jueves, 4=Viernes, 5=Sábado, 6=Domingo
      // Convertir de dayOfWeek (0=Dom) a índice del plan (0=Lun)
      const planDayMapping = {
        0: 6, // Domingo -> índice 6 en el plan
        1: 0, // Lunes -> índice 0 en el plan
        2: 1, // Martes -> índice 1 en el plan
        3: 2, // Miércoles -> índice 2 en el plan
        4: 3, // Jueves -> índice 3 en el plan
        5: 4, // Viernes -> índice 4 en el plan
        6: 5  // Sábado -> índice 5 en el plan
      };

      const dayIndexInPlan = planDayMapping[dayOfWeek];

      // Calcular días desde el inicio del plan
      const daysSinceStart = Math.floor((date - planStartDate) / (1000 * 60 * 60 * 24));
      const isWithinPlan = daysSinceStart >= 0 && daysSinceStart < planDuration;

      weekDays.push({
        name: dayName,
        date: date,
        dateString: date.toISOString().split('T')[0],
        isToday: date.toDateString() === today.toDateString(),
        dayIndex: dayIndexInPlan, // Índice correcto según estructura del plan
        daysSinceStart: daysSinceStart,
        isWithinPlan: isWithinPlan
      });
    }

    return weekDays;
  };

  const weekDays = generateWeekStructure();

  // Calcular límites de navegación
  const planDuration = nutritionPlan?.duration_days ||
                      nutritionPlan?.plan_data?.plan_summary?.duration_days ||
                      7;
  const maxWeeks = Math.ceil(planDuration / 7);
  const canGoBack = currentWeek > 0;
  const canGoForward = currentWeek < maxWeeks - 1;

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

      // Acceder como objeto usando la clave como string (ej: "0", "1", "2", ...)
      const dayKey = planDayIndex.toString();
      if (dailyPlans[dayKey]) {
        const planDay = dailyPlans[dayKey];
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
            foods: (meal.ingredients || []).map(ing =>
              `${ing.food || ing.name || 'Alimento'} (${ing.amount || 'cantidad no especificada'})`
            )
          };
        });
      }
    }

    // Si no hay plan, usar el plan por defecto
    return dayPlan || getDefaultMealPlan(dayName);
  };

  const handleMealComplete = async (dayString, mealId) => {
    console.log(`🍽️ handleMealComplete llamado:`, { dayString, mealId, type: typeof mealId });

    // 1. Actualizar estado local inmediatamente (UX optimista)
    const newValue = !mealProgress[`${dayString}-${mealId}`];
    setMealProgress(prev => ({
      ...prev,
      [`${dayString}-${mealId}`]: newValue
    }));

    // 2. Guardar en BD
    setIsSaving(true);
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');

      // Construir el objeto de progreso del día
      const dayMealsProgress = {};
      Object.entries({...mealProgress, [`${dayString}-${mealId}`]: newValue})
        .filter(([key]) => key.startsWith(dayString))
        .forEach(([key, completed]) => {
          // Extraer mealId desde el final (después del último guion)
          // Ejemplo: "2025-10-03-cena" -> "cena"
          const parts = key.split('-');
          const mealKey = parts[parts.length - 1];
          dayMealsProgress[mealKey] = completed;
        });

      console.log(`📤 Enviando a BD:`, { date: dayString, mealProgress: dayMealsProgress });

      const response = await fetch('/api/nutrition/daily', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date: dayString,
          mealProgress: dayMealsProgress
        })
      });

      if (!response.ok) {
        throw new Error('Error al guardar progreso');
      }

      console.log('✅ Progreso guardado:', { date: dayString, meal: mealId, completed: newValue });
    } catch (error) {
      console.error('❌ Error guardando progreso de comida:', error);
      // Revertir cambio en UI si falla
      setMealProgress(prev => ({
        ...prev,
        [`${dayString}-${mealId}`]: !newValue
      }));
    } finally {
      setIsSaving(false);
    }
  };

  const isMealCompleted = (dayString, mealId) => {
    return mealProgress[`${dayString}-${mealId}`] || false;
  };

  const getDayProgress = (dayString, dayMeals) => {
    // Usar las comidas REALES del plan, no el default hardcodeado
    const mealIds = Object.keys(dayMeals);
    const totalMeals = mealIds.length;
    let completed = 0;

    mealIds.forEach(mealId => {
      if (isMealCompleted(dayString, mealId)) {
        completed++;
      }
    });

    return {
      completed,
      total: totalMeals,
      percentage: totalMeals > 0 ? Math.round((completed / totalMeals) * 100) : 0
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
                onClick={() => setCurrentWeek(prev => Math.max(0, prev - 1))}
                disabled={!canGoBack}
                className="border-gray-600 text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </Button>
              <div className="text-center">
                <div className="text-white font-semibold">
                  Semana {currentWeek + 1} de {maxWeeks}
                </div>
                <div className="text-gray-400 text-xs">
                  {weekDays[0]?.date.toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short'
                  })} - {weekDays[6]?.date.toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short'
                  })}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentWeek(prev => Math.min(maxWeeks - 1, prev + 1))}
                disabled={!canGoForward}
                className="border-gray-600 text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
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
          console.log(`🗓️ Comidas del día ${day.dateString} (${day.name}):`, Object.keys(dayMeals));
          const progress = getDayProgress(day.dateString, dayMeals);
          
          return (
            <Card
              key={day.dateString}
              className={`border-gray-600 cursor-pointer transition-all duration-200 ${
                !day.isWithinPlan ? 'bg-gray-900/50 opacity-50' : 'bg-gray-800/70 hover:bg-gray-700/70'
              } ${
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
                    {!day.isWithinPlan && (
                      <p className="text-xs text-gray-500 mt-1">Fuera del plan</p>
                    )}
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
      {selectedDay && (() => {
        const selectedDayData = weekDays.find(d => d.dateString === selectedDay);
        const selectedDayMeals = getMealPlanForDay(selectedDayData?.name, selectedDayData?.dayIndex);

        return (
          <Card className="bg-gray-800/70 border-gray-600">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span>
                  Detalle del {selectedDayData?.name} ({selectedDayData?.date.getDate()} de {selectedDayData?.date.toLocaleDateString('es-ES', { month: 'long' })})
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
                {Object.entries(selectedDayMeals).map(([mealId, meal]) => (
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
        );
      })()}
    </div>
  );
}