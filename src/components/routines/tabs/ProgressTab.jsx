import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Progress } from '@/components/ui/progress.jsx';
import { 
  BarChart3, 
  TrendingUp, 
  Calendar,
  Clock,
  Target,
  Award,
  Activity,
  CheckCircle
} from 'lucide-react';
import { getProgressData } from '../api';

export default function ProgressTab({ plan, methodologyPlanId }) {
  const [progressData, setProgressData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadProgressData = async () => {
      if (!methodologyPlanId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const data = await getProgressData({ methodology_plan_id: methodologyPlanId });
        // Validar estructura de datos recibidos
        if (!data || typeof data !== 'object') {
          throw new Error('Datos de progreso inválidos');
        }
        setProgressData(data);
      } catch (err) {
        console.error('Error cargando datos de progreso:', err);
        setError(err.message);
        // Establecer datos de progreso vacíos basados en estructura esperada
        setProgressData({
          totalWeeks: 0,
          currentWeek: 1,
          totalSessions: 0,
          completedSessions: 0,
          totalExercises: 0,
          completedExercises: 0,
          totalSeriesCompleted: 0,
          totalTimeSpentSeconds: 0,
          weeklyProgress: [],
          recentActivity: []
        });
      } finally {
        setLoading(false);
      }
    };

    loadProgressData();
  }, [methodologyPlanId, plan]);

  const calculateOverallProgress = () => {
    if (!progressData || !progressData.totalSessions || progressData.totalSessions === 0) return 0;
    const completed = progressData.completedSessions || 0;
    const total = progressData.totalSessions || 0;
    return Math.round((completed / total) * 100);
  };

  const calculateWeekProgress = (weekData) => {
    if (!weekData || !weekData.sessions || weekData.sessions === 0) return 0;
    const completed = weekData.completed || 0;
    const total = weekData.sessions || 0;
    return Math.round((completed / total) * 100);
  };

  const formatTime = (seconds) => {
    if (!seconds || seconds === 0) return '0h 0min';
    const totalSeconds = Math.max(0, parseInt(seconds) || 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}min`;
  };

  // Mostrar error si existe
  if (error && !loading && !progressData) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <p className="text-red-400 text-lg mb-2">Error cargando datos de progreso</p>
        <p className="text-gray-400 text-sm">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            // Recargar datos
            const loadProgressData = async () => {
              try {
                const data = await getProgressData({ methodology_plan_id: methodologyPlanId });
                if (!data || typeof data !== 'object') {
                  throw new Error('Datos de progreso inválidos');
                }
                setProgressData(data);
              } catch (err) {
                setError(err.message);
                setProgressData({
                  totalWeeks: 0,
                  currentWeek: 1,
                  totalSessions: 0,
                  completedSessions: 0,
                  totalExercises: 0,
                  completedExercises: 0,
                  totalSeriesCompleted: 0,
                  totalTimeSpentSeconds: 0,
                  weeklyProgress: [],
                  recentActivity: []
                });
              } finally {
                setLoading(false);
              }
            };
            if (methodologyPlanId) loadProgressData();
          }}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!plan && !loading && !error) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="w-16 h-16 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-400 text-lg">No hay datos de progreso disponibles</p>
        <p className="text-gray-500 text-sm mt-2">Selecciona una rutina para ver tu progreso</p>
      </div>
    );
  }

  if (loading || (!progressData && !error)) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-blue-600/30 p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
            <div className="h-3 bg-gray-700 rounded w-full mb-4"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="text-center">
                  <div className="h-8 bg-gray-700 rounded w-12 mx-auto mb-2"></div>
                  <div className="h-3 bg-gray-700 rounded w-20 mx-auto"></div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="bg-gray-900/50 border-gray-700 p-6">
          <div className="animate-pulse">
            <div className="h-5 bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="border border-gray-700 rounded-lg p-4">
                  <div className="h-4 bg-gray-700 rounded w-1/6 mb-2"></div>
                  <div className="h-2 bg-gray-700 rounded w-full"></div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <Card key={i} className="bg-gray-900/50 border-gray-700 p-6">
              <div className="animate-pulse">
                <div className="h-5 bg-gray-700 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-3 bg-gray-700 rounded w-full"></div>
                  <div className="h-3 bg-gray-700 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-700 rounded w-5/6"></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen general */}
      <Card className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-blue-600/30 p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Progreso General</h2>
            <Badge variant="secondary" className="bg-yellow-400/20 text-yellow-300">
              {plan.selected_style}
            </Badge>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-400">
              {calculateOverallProgress()}%
            </div>
            <div className="text-sm text-gray-400">Completado</div>
          </div>
        </div>

        <Progress 
          value={calculateOverallProgress()} 
          className="h-3 mb-4"
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{progressData.currentWeek || 1}</div>
            <div className="text-sm text-gray-400">Semana Actual</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{progressData.completedSessions || 0}</div>
            <div className="text-sm text-gray-400">Sesiones Completadas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{progressData.completedExercises || 0}</div>
            <div className="text-sm text-gray-400">Ejercicios Completados</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">{progressData.totalSeriesCompleted || 0}</div>
            <div className="text-sm text-gray-400">Series Totales</div>
          </div>
        </div>
      </Card>

      {/* Progreso por semanas */}
      <Card className="bg-gray-900/50 border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Calendar className="w-5 h-5 mr-2 text-yellow-400" />
          Progreso por Semanas
        </h3>

        <div className="space-y-4">
          {progressData.weeklyProgress?.length > 0 ? progressData.weeklyProgress.map((week) => (
            <div key={week.week} className="border border-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center space-x-3">
                  <Badge variant="outline" className="border-yellow-400/50 text-yellow-400">
                    Semana {week.week}
                  </Badge>
                  <span className="text-sm text-gray-400">
                    {week.completed || 0}/{week.sessions || 0} sesiones
                  </span>
                </div>
                <div className="text-sm font-medium text-white">
                  {calculateWeekProgress(week)}%
                </div>
              </div>

              <Progress 
                value={calculateWeekProgress(week)} 
                className="h-2 mb-2"
              />

              <div className="flex justify-between text-xs text-gray-400">
                <span>{week.exercisesCompleted || 0}/{week.exercises || 0} ejercicios</span>
                {(week.seriesCompleted || 0) > 0 && (
                  <span className="text-blue-400">
                    {week.seriesCompleted || 0} series completadas
                  </span>
                )}
                {(week.completed || 0) === (week.sessions || 0) && (week.completed || 0) > 0 && (
                  <span className="text-green-400 flex items-center">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Completada
                  </span>
                )}
              </div>
            </div>
          )) : (
            <div className="text-center py-8 text-gray-400">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-500" />
              <p>No hay progreso por semanas aún</p>
              <p className="text-sm">Completa entrenamientos para ver tu progreso semanal</p>
            </div>
          )}
        </div>
      </Card>

      {/* Estadísticas adicionales */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Tiempo total */}
        <Card className="bg-gray-900/50 border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-yellow-400" />
            Tiempo de Entrenamiento
          </h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Total entrenado:</span>
              <span className="text-white font-semibold">{formatTime(progressData.totalTimeSpentSeconds || 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Promedio por sesión:</span>
              <span className="text-white font-semibold">
                {(progressData.completedSessions || 0) > 0
                  ? formatTime(Math.round((progressData.totalTimeSpentSeconds || 0) / progressData.completedSessions))
                  : '0h 0min'
                }
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Sesiones completadas:</span>
              <span className="text-white font-semibold">{progressData.completedSessions || 0}/{progressData.totalSessions || 0}</span>
            </div>
          </div>
        </Card>

        {/* Logros */}
        <Card className="bg-gray-900/50 border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Award className="w-5 h-5 mr-2 text-yellow-400" />
            Logros
          </h3>
          
          <div className="space-y-3">
            <div className={`flex items-center space-x-3 p-2 bg-black/40 rounded-lg ${(progressData.completedSessions || 0) > 0 ? '' : 'opacity-50'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${(progressData.completedSessions || 0) > 0 ? 'bg-green-600' : 'bg-gray-600'}`}>
                <Target className={`w-4 h-4 ${(progressData.completedSessions || 0) > 0 ? 'text-white' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className={`text-sm font-medium ${(progressData.completedSessions || 0) > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                  Primera Sesión {(progressData.completedSessions || 0) > 0 ? '✓' : ''}
                </p>
                <p className="text-xs text-gray-500">Completa tu primer entrenamiento</p>
              </div>
            </div>

            <div className={`flex items-center space-x-3 p-2 bg-black/40 rounded-lg ${progressData.weeklyProgress?.some(w => (w.completed || 0) === (w.sessions || 0) && (w.sessions || 0) > 0) ? '' : 'opacity-50'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${progressData.weeklyProgress?.some(w => (w.completed || 0) === (w.sessions || 0) && (w.sessions || 0) > 0) ? 'bg-green-600' : 'bg-gray-600'}`}>
                <Activity className={`w-4 h-4 ${progressData.weeklyProgress?.some(w => (w.completed || 0) === (w.sessions || 0) && (w.sessions || 0) > 0) ? 'text-white' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className={`text-sm font-medium ${progressData.weeklyProgress?.some(w => (w.completed || 0) === (w.sessions || 0) && (w.sessions || 0) > 0) ? 'text-green-400' : 'text-gray-400'}`}>
                  Semana Completa {progressData.weeklyProgress?.some(w => (w.completed || 0) === (w.sessions || 0) && (w.sessions || 0) > 0) ? '✓' : ''}
                </p>
                <p className="text-xs text-gray-500">Completa una semana de entrenamientos</p>
              </div>
            </div>

            <div className={`flex items-center space-x-3 p-2 bg-black/40 rounded-lg ${(progressData.completedSessions || 0) >= 7 ? '' : 'opacity-50'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${(progressData.completedSessions || 0) >= 7 ? 'bg-green-600' : 'bg-gray-600'}`}>
                <TrendingUp className={`w-4 h-4 ${(progressData.completedSessions || 0) >= 7 ? 'text-white' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className={`text-sm font-medium ${(progressData.completedSessions || 0) >= 7 ? 'text-green-400' : 'text-gray-400'}`}>
                  Constancia {(progressData.completedSessions || 0) >= 7 ? '✓' : ''}
                </p>
                <p className="text-xs text-gray-500">Completa 7 sesiones de entrenamiento</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Actividad reciente */}
      <Card className="bg-gray-900/50 border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-yellow-400" />
          Actividad Reciente
        </h3>
        
        {progressData.recentActivity?.length > 0 ? (
          <div className="space-y-3">
            {progressData.recentActivity.map((activity, index) => (
              <div key={activity.sessionId || index} className="flex items-center justify-between p-3 bg-black/40 rounded-lg border border-gray-700">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      Semana {activity.weekNumber || 'N/A'} - {activity.dayName || 'Sin día'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {activity.exercisesCount || 0} ejercicios • {activity.totalSeries || 0} series
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{activity.formattedDate || 'Fecha no disponible'}</p>
                  <p className="text-xs text-blue-400">{formatTime(activity.durationSeconds || 0)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-500" />
            <p>No hay actividad reciente</p>
            <p className="text-sm">Completa tu primer entrenamiento para ver tu progreso aquí</p>
          </div>
        )}
      </Card>
    </div>
  );
}