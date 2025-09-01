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
  const [, setError] = useState(null); // Keep setError for logging purposes

  useEffect(() => {
    const loadProgressData = async () => {
      if (!methodologyPlanId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const data = await getProgressData({ methodology_plan_id: methodologyPlanId });
        setProgressData(data);
        console.log('📊 Datos de progreso cargados:', data);
      } catch (err) {
        console.error('Error cargando datos de progreso:', err);
        setError(err.message);
        // Fallback a datos vacíos si no se pueden cargar los reales
        setProgressData({
          totalWeeks: plan?.semanas?.length || 0,
          currentWeek: 1,
          totalSessions: plan?.semanas?.reduce((acc, semana) => acc + (semana.sesiones?.length || 0), 0) || 0,
          completedSessions: 0,
          totalExercises: plan?.semanas?.reduce((acc, semana) => 
            acc + semana.sesiones?.reduce((sessAcc, sesion) => 
              sessAcc + (sesion.ejercicios?.length || 0), 0) || 0, 0) || 0,
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
    if (!progressData) return 0;
    return Math.round((progressData.completedSessions / progressData.totalSessions) * 100);
  };

  const calculateWeekProgress = (weekData) => {
    if (!weekData.sessions) return 0;
    return Math.round((weekData.completed / weekData.sessions) * 100);
  };

  const formatTime = (seconds) => {
    if (!seconds) return '0h 0min';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}min`;
  };

  if (!plan) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="w-16 h-16 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-400 text-lg">No hay datos de progreso disponibles</p>
      </div>
    );
  }

  if (loading || !progressData) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-gray-900/50 border-gray-700 p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-1/4 mb-4"></div>
              <div className="h-2 bg-gray-700 rounded w-full"></div>
            </div>
          </Card>
        ))}
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
            <div className="text-2xl font-bold text-white">{progressData.currentWeek}</div>
            <div className="text-sm text-gray-400">Semana Actual</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{progressData.completedSessions}</div>
            <div className="text-sm text-gray-400">Sesiones Completadas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{progressData.completedExercises}</div>
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
                    {week.completed}/{week.sessions} sesiones
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
                <span>{week.exercisesCompleted}/{week.exercises} ejercicios</span>
                {week.seriesCompleted > 0 && (
                  <span className="text-blue-400">
                    {week.seriesCompleted} series completadas
                  </span>
                )}
                {week.completed === week.sessions && week.completed > 0 && (
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
              <span className="text-white font-semibold">{formatTime(progressData.totalTimeSpentSeconds)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Promedio por sesión:</span>
              <span className="text-white font-semibold">
                {progressData.completedSessions > 0 
                  ? formatTime(Math.round(progressData.totalTimeSpentSeconds / progressData.completedSessions))
                  : '0h 0min'
                }
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Sesiones completadas:</span>
              <span className="text-white font-semibold">{progressData.completedSessions}/{progressData.totalSessions}</span>
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
            <div className={`flex items-center space-x-3 p-2 bg-black/40 rounded-lg ${progressData.completedSessions > 0 ? '' : 'opacity-50'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${progressData.completedSessions > 0 ? 'bg-green-600' : 'bg-gray-600'}`}>
                <Target className={`w-4 h-4 ${progressData.completedSessions > 0 ? 'text-white' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className={`text-sm font-medium ${progressData.completedSessions > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                  Primera Sesión {progressData.completedSessions > 0 ? '✓' : ''}
                </p>
                <p className="text-xs text-gray-500">Completa tu primer entrenamiento</p>
              </div>
            </div>
            
            <div className={`flex items-center space-x-3 p-2 bg-black/40 rounded-lg ${progressData.weeklyProgress?.some(w => w.completed === w.sessions && w.sessions > 0) ? '' : 'opacity-50'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${progressData.weeklyProgress?.some(w => w.completed === w.sessions && w.sessions > 0) ? 'bg-green-600' : 'bg-gray-600'}`}>
                <Activity className={`w-4 h-4 ${progressData.weeklyProgress?.some(w => w.completed === w.sessions && w.sessions > 0) ? 'text-white' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className={`text-sm font-medium ${progressData.weeklyProgress?.some(w => w.completed === w.sessions && w.sessions > 0) ? 'text-green-400' : 'text-gray-400'}`}>
                  Semana Completa {progressData.weeklyProgress?.some(w => w.completed === w.sessions && w.sessions > 0) ? '✓' : ''}
                </p>
                <p className="text-xs text-gray-500">Completa una semana de entrenamientos</p>
              </div>
            </div>
            
            <div className={`flex items-center space-x-3 p-2 bg-black/40 rounded-lg ${progressData.completedSessions >= 7 ? '' : 'opacity-50'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${progressData.completedSessions >= 7 ? 'bg-green-600' : 'bg-gray-600'}`}>
                <TrendingUp className={`w-4 h-4 ${progressData.completedSessions >= 7 ? 'text-white' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className={`text-sm font-medium ${progressData.completedSessions >= 7 ? 'text-green-400' : 'text-gray-400'}`}>
                  Constancia {progressData.completedSessions >= 7 ? '✓' : ''}
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
                      Semana {activity.weekNumber} - {activity.dayName}
                    </p>
                    <p className="text-xs text-gray-400">
                      {activity.exercisesCount} ejercicios • {activity.totalSeries} series
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{activity.formattedDate}</p>
                  <p className="text-xs text-blue-400">{formatTime(activity.durationSeconds)}</p>
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