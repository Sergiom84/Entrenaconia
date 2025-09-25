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
  CheckCircle,
  Database,
  History,
  AlertTriangle
} from 'lucide-react';
import { getHistoricalData } from '../api';
import { useTrace } from '@/contexts/TraceContext.jsx';


export default function HistoricalTab({ methodologyPlanId }) {
  const { track } = useTrace();

  useEffect(() => {
    track('VIEW', { name: 'HistoricalTab' }, { component: 'HistoricalTab' });
  }, []);

  const [historicalData, setHistoricalData] = useState({
    totalRoutinesCompleted: 0,
    totalSessionsEver: 0,
    totalExercisesEver: 0,
    totalSeriesEver: 0,
    routineHistory: [],
    monthlyStats: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadHistoricalData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getHistoricalData({
          methodologyPlanId: methodologyPlanId || null
        });

        // Validar estructura de datos
        const validatedData = validateHistoricalData(data);
        setHistoricalData(validatedData);
        track('DATA_LOAD', { ok: true, routines: validatedData.totalRoutinesCompleted, sessions: validatedData.totalSessionsEver }, { component: 'HistoricalTab' });
      } catch (err) {
        setError(err.message);
        track('DATA_LOAD', { ok: false, error: err.message }, { component: 'HistoricalTab' });
        // En caso de error, usar datos vacíos validados
        setHistoricalData({
          totalRoutinesCompleted: 0,
          totalSessionsEver: 0,
          totalExercisesEver: 0,
          totalSeriesEver: 0,
          totalTimeSpentEver: 0,
          firstWorkoutDate: null,
          lastWorkoutDate: null,
          routineHistory: [],
          monthlyStats: []
        });
      } finally {
        setLoading(false);
      }
    };


    loadHistoricalData();
  }, [methodologyPlanId]);

  // Función de validación de datos
  const validateHistoricalData = (data) => {
    if (!data || typeof data !== 'object') {
      throw new Error('Datos históricos inválidos');
    }

    return {
      totalRoutinesCompleted: Math.max(0, parseInt(data.totalRoutinesCompleted) || 0),
      totalSessionsEver: Math.max(0, parseInt(data.totalSessionsEver) || 0),
      totalExercisesEver: Math.max(0, parseInt(data.totalExercisesEver) || 0),
      totalSeriesEver: Math.max(0, parseInt(data.totalSeriesEver) || 0),
      totalTimeSpentEver: Math.max(0, parseInt(data.totalTimeSpentEver) || 0),
      firstWorkoutDate: data.firstWorkoutDate,
      lastWorkoutDate: data.lastWorkoutDate,
      routineHistory: Array.isArray(data.routineHistory) ? data.routineHistory : [],
      monthlyStats: Array.isArray(data.monthlyStats) ? data.monthlyStats : []
    };
  };

  const formatTime = (seconds) => {
    if (!seconds || seconds < 0) return '0h 0min';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}min`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Componente de Error
  const ErrorDisplay = ({ error }) => (
    <Card className="bg-red-900/20 border-red-600/30 p-6">
      <div className="flex items-center space-x-3 text-red-400">
        <AlertTriangle className="w-5 h-5" />
        <div>
          <h3 className="font-semibold">Error cargando datos históricos</h3>
          <p className="text-sm text-red-300 mt-1">{error}</p>
        </div>
      </div>
    </Card>
  );

  if (loading) {
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

  // Verificar si hay datos históricos
  const hasData = historicalData && (
    historicalData.totalRoutinesCompleted > 0 ||
    historicalData.totalSessionsEver > 0 ||
    historicalData.routineHistory.length > 0
  );

  if (error && !hasData) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <div className="space-y-6">
      {/* Mostrar error si existe pero hay datos de fallback */}
      {error && historicalData && (
        <ErrorDisplay error={error} />
      )}

      {/* Resumen histórico total */}
      <Card className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border-purple-600/30 p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center">
              <History className="w-6 h-6 mr-2 text-purple-400" />
              Histórico Total
            </h2>
            <Badge variant="secondary" className="bg-purple-400/20 text-purple-300">
              Todas las rutinas completadas
            </Badge>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-purple-400">
              {historicalData.totalRoutinesCompleted}
            </div>
            <div className="text-sm text-gray-400">Rutinas Completadas</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{historicalData.totalSessionsEver}</div>
            <div className="text-sm text-gray-400">Sesiones Totales</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{historicalData.totalExercisesEver}</div>
            <div className="text-sm text-gray-400">Ejercicios Totales</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{historicalData.totalSeriesEver}</div>
            <div className="text-sm text-gray-400">Series Totales</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">{formatTime(historicalData.totalTimeSpentEver)}</div>
            <div className="text-sm text-gray-400">Tiempo Total</div>
          </div>
        </div>
      </Card>

      {/* Rutinas completadas */}
      <Card className="bg-gray-900/50 border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Database className="w-5 h-5 mr-2 text-yellow-400" />
          Rutinas
        </h3>

        <div className="space-y-4">
          {historicalData.routineHistory.length > 0 ? historicalData.routineHistory.map((routine) => (
            <div key={routine.id} className="border border-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-3">
                  <Badge variant="outline" className="border-purple-400/50 text-purple-400">
                    {routine.methodologyType}
                  </Badge>
                  <span className="text-sm text-gray-400">
                    {routine.status === 'cancelled' ? (
                      <>Cancelada{routine.completedAt ? ` el ${formatDate(routine.completedAt)}` : ''}</>
                    ) : (
                      <>Completada el {formatDate(routine.completedAt)}</>
                    )}
                  </span>
                </div>
                {routine.status === 'cancelled' ? (
                  <div className="text-sm font-medium text-red-400 flex items-center">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Cancelada
                  </div>
                ) : (
                  <div className="text-sm font-medium text-green-400 flex items-center">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Completada
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-blue-400 font-semibold">{routine.sessions}</div>
                  <div className="text-gray-500">Sesiones</div>
                </div>
                <div className="text-center">
                  <div className="text-green-400 font-semibold">{routine.exercises}</div>
                  <div className="text-gray-500">Ejercicios</div>
                </div>
                <div className="text-center">
                  <div className="text-yellow-400 font-semibold">{routine.series}</div>
                  <div className="text-gray-500">Series</div>
                </div>
                <div className="text-center">
                  <div className="text-red-400 font-semibold">{formatTime(routine.timeSpent)}</div>
                  <div className="text-gray-500">Tiempo</div>
                </div>
              </div>
            </div>
          )) : (
            <div className="text-center py-8 text-gray-400">
              <Database className="w-12 h-12 mx-auto mb-3 text-gray-500" />
              <p>No hay rutinas completadas aún</p>
              <p className="text-sm">Las rutinas aparecerán aquí al ser completadas</p>
            </div>
          )}
        </div>
      </Card>

      {/* Estadísticas mensuales */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Progreso mensual */}
        <Card className="bg-gray-900/50 border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-yellow-400" />
            Progreso Mensual
          </h3>

          <div className="space-y-4">
            {historicalData.monthlyStats.length > 0 ? historicalData.monthlyStats.map((month, index) => (
              <div key={index} className="border-b border-gray-700 pb-3 last:border-b-0">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white font-medium">{month.month}</span>
                  <span className="text-sm text-gray-400">{month.sessions} sesiones</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="text-green-400">{month.exercises} ejercicios</div>
                  <div className="text-yellow-400">{month.series} series</div>
                </div>
              </div>
            )) : (
              <div className="text-center py-4 text-gray-400">
                <p className="text-sm">No hay datos mensuales disponibles</p>
              </div>
            )}
          </div>
        </Card>

        {/* Logros históricos */}
        <Card className="bg-gray-900/50 border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Award className="w-5 h-5 mr-2 text-yellow-400" />
            Logros Históricos
          </h3>

          <div className="space-y-3">
            <div className={`flex items-center space-x-3 p-2 bg-black/40 rounded-lg ${historicalData.totalRoutinesCompleted > 0 ? '' : 'opacity-50'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${historicalData.totalRoutinesCompleted > 0 ? 'bg-purple-600' : 'bg-gray-600'}`}>
                <Target className={`w-4 h-4 ${historicalData.totalRoutinesCompleted > 0 ? 'text-white' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className={`text-sm font-medium ${historicalData.totalRoutinesCompleted > 0 ? 'text-purple-400' : 'text-gray-400'}`}>
                  Primera Rutina {historicalData.totalRoutinesCompleted > 0 ? '✓' : ''}
                </p>
                <p className="text-xs text-gray-500">Completa tu primera rutina completa</p>
              </div>
            </div>

            <div className={`flex items-center space-x-3 p-2 bg-black/40 rounded-lg ${historicalData.totalSessionsEver >= 10 ? '' : 'opacity-50'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${historicalData.totalSessionsEver >= 10 ? 'bg-purple-600' : 'bg-gray-600'}`}>
                <Activity className={`w-4 h-4 ${historicalData.totalSessionsEver >= 10 ? 'text-white' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className={`text-sm font-medium ${historicalData.totalSessionsEver >= 10 ? 'text-purple-400' : 'text-gray-400'}`}>
                  Atleta Dedicado {historicalData.totalSessionsEver >= 10 ? '✓' : ''}
                </p>
                <p className="text-xs text-gray-500">Completa 10 sesiones de entrenamiento</p>
              </div>
            </div>

            <div className={`flex items-center space-x-3 p-2 bg-black/40 rounded-lg ${historicalData.totalRoutinesCompleted >= 3 ? '' : 'opacity-50'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${historicalData.totalRoutinesCompleted >= 3 ? 'bg-purple-600' : 'bg-gray-600'}`}>
                <TrendingUp className={`w-4 h-4 ${historicalData.totalRoutinesCompleted >= 3 ? 'text-white' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className={`text-sm font-medium ${historicalData.totalRoutinesCompleted >= 3 ? 'text-purple-400' : 'text-gray-400'}`}>
                  Maestro del Fitness {historicalData.totalRoutinesCompleted >= 3 ? '✓' : ''}
                </p>
                <p className="text-xs text-gray-500">Completa 3 rutinas diferentes</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}