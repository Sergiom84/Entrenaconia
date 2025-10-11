import { useState, useEffect, useMemo } from 'react';
import useVirtualizedList, { VirtualizedListSearch, VirtualizedListLoader } from '../../hooks/useVirtualizedList.jsx';
import { ArrowLeft, Heart, ThumbsDown, Zap, Clock, TrendingUp, RotateCcw, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';

const HomeTrainingPreferencesHistory = ({ onBack }) => {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('favorites'); // favorites, rejected, challenging, analytics
  const [isReactivating, setIsReactivating] = useState({});

  useEffect(() => {
    loadPreferencesData();
  }, []);

  const loadPreferencesData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/home-training/preferences-history', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setPreferences(data.preferences);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReactivateExercise = async (rejectionId, exerciseName) => {
    try {
      setIsReactivating(prev => ({ ...prev, [rejectionId]: true }));
      
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/home-training/rejections/${rejectionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        // Recargar datos
        await loadPreferencesData();
        alert(`✅ "${exerciseName}" ya no será rechazado`);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Error reactivating exercise:', error);
      alert('Error al reactivar el ejercicio. Por favor, inténtalo de nuevo.');
    } finally {
      setIsReactivating(prev => ({ ...prev, [rejectionId]: false }));
    }
  };

  const tabs = [
    { id: 'favorites', label: 'Favoritos', icon: Heart, color: 'text-red-400' },
    { id: 'rejected', label: 'Rechazados', icon: ThumbsDown, color: 'text-gray-400' },
    { id: 'challenging', label: 'Desafiantes', icon: Zap, color: 'text-yellow-400' },
    { id: 'analytics', label: 'Estadísticas', icon: TrendingUp, color: 'text-blue-400' }
  ];

  const getCategoryIcon = (category) => {
    const icons = {
      'too_hard': AlertTriangle,
      'dont_like': ThumbsDown,
      'injury': Heart,
      'equipment': Zap,
      'other': Clock
    };
    return icons[category] || Clock;
  };

  const getCategoryColor = (category) => {
    const colors = {
      'too_hard': 'text-red-400 bg-red-400/10 border-red-400/30',
      'dont_like': 'text-gray-400 bg-gray-400/10 border-gray-400/30',
      'injury': 'text-orange-400 bg-orange-400/10 border-orange-400/30',
      'equipment': 'text-blue-400 bg-blue-400/10 border-blue-400/30',
      'other': 'text-purple-400 bg-purple-400/10 border-purple-400/30'
    };
    return colors[category] || 'text-gray-400 bg-gray-400/10 border-gray-400/30';
  };

  const getCategoryLabel = (category) => {
    const labels = {
      'too_hard': 'Muy difícil',
      'dont_like': 'No me gusta',
      'injury': 'Lesión/Limitación',
      'equipment': 'Sin equipamiento',
      'other': 'Otro motivo'
    };
    return labels[category] || 'Otro';
  };

  if (loading) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando preferencias...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center mb-8">
          <button
            onClick={onBack}
            className="flex items-center text-gray-300 hover:text-white transition-colors duration-200 mr-6"
          >
            <ArrowLeft size={24} className="mr-2" />
            Volver al entrenamiento
          </button>
        </div>

        {/* Título */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 text-yellow-400">
            Historial de Preferencias
          </h1>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto">
            Revisa tus ejercicios favoritos, rechazados y estadísticas de entrenamiento
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-gray-800/50 rounded-xl p-2 flex gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-4 py-2 rounded-lg transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-yellow-400 text-black'
                      : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  <Icon size={18} className="mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto">
          {/* Tab: Favoritos */}
          {activeTab === 'favorites' && (
            <div>
              <div className="text-center mb-8">
                <Heart size={48} className="text-red-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Ejercicios Favoritos</h2>
                <p className="text-gray-400">Ejercicios que has completado y calificado como "me encanta"</p>
              </div>

              {preferences?.favorites?.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {preferences.favorites.map((exercise, index) => (
                    <div key={index} className="bg-gray-800/50 border border-red-400/30 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <Heart size={24} className="text-red-400" />
                        <span className="text-sm text-gray-400">
                          {exercise.times_completed} veces completado
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">{exercise.exercise_name}</h3>
                      <div className="flex items-center justify-between text-sm text-gray-400">
                        <span>Última vez: {new Date(exercise.last_completed).toLocaleDateString()}</span>
                        <span className="bg-red-400/20 text-red-400 px-2 py-1 rounded">
                          ❤️ Favorito
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Heart size={64} className="text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-400 mb-2">No hay ejercicios favoritos aún</h3>
                  <p className="text-gray-500">Completa ejercicios y califícalos como "me encanta" para verlos aquí</p>
                </div>
              )}
            </div>
          )}

          {/* Tab: Rechazados */}
          {activeTab === 'rejected' && (
            <div>
              <div className="text-center mb-8">
                <ThumbsDown size={48} className="text-gray-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Ejercicios Rechazados</h2>
                <p className="text-gray-400">Ejercicios que has marcado para evitar. Puedes reactivarlos cuando quieras.</p>
              </div>

              {preferences?.rejected?.length > 0 ? (
                <div className="space-y-4">
                  {preferences.rejected.map((rejection) => {
                    const Icon = getCategoryIcon(rejection.rejection_category);
                    const colorClass = getCategoryColor(rejection.rejection_category);
                    const categoryLabel = getCategoryLabel(rejection.rejection_category);
                    const isExpiring = rejection.days_until_expires !== null;
                    const isReactivatingThis = isReactivating[rejection.id];

                    return (
                      <div key={rejection.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center mb-3">
                              <Icon size={20} className={`mr-3 ${colorClass.split(' ')[0]}`} />
                              <h3 className="text-lg font-semibold text-white">{rejection.exercise_name}</h3>
                              <div className={`ml-3 px-3 py-1 rounded-lg border text-sm ${colorClass}`}>
                                {categoryLabel}
                              </div>
                            </div>

                            {rejection.rejection_reason && (
                              <p className="text-gray-400 mb-3 italic">"{rejection.rejection_reason}"</p>
                            )}

                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span>Rechazado: {new Date(rejection.rejected_at).toLocaleDateString()}</span>
                              {isExpiring ? (
                                <span className="text-yellow-400">
                                  <Clock size={16} className="inline mr-1" />
                                  Expira en {rejection.days_until_expires} días
                                </span>
                              ) : (
                                <span className="text-red-400">Permanente</span>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => handleReactivateExercise(rejection.id, rejection.exercise_name)}
                            disabled={isReactivatingThis}
                            className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors ml-4"
                          >
                            {isReactivatingThis ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                                Reactivando...
                              </>
                            ) : (
                              <>
                                <RotateCcw size={16} className="mr-2" />
                                Reactivar
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle size={64} className="text-green-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-green-400 mb-2">¡Perfecto!</h3>
                  <p className="text-gray-500">No has rechazado ningún ejercicio. Todos están disponibles para tus entrenamientos.</p>
                </div>
              )}
            </div>
          )}

          {/* Tab: Desafiantes */}
          {activeTab === 'challenging' && (
            <div>
              <div className="text-center mb-8">
                <Zap size={48} className="text-yellow-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Ejercicios Desafiantes</h2>
                <p className="text-gray-400">Ejercicios que has completado pero calificado como "difícil"</p>
              </div>

              {preferences?.challenging?.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {preferences.challenging.map((exercise, index) => (
                    <div key={index} className="bg-gray-800/50 border border-yellow-400/30 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <Zap size={24} className="text-yellow-400" />
                        <span className="text-sm text-gray-400">
                          {exercise.times_completed} veces completado
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">{exercise.exercise_name}</h3>
                      <div className="flex items-center justify-between text-sm text-gray-400">
                        <span>Última vez: {new Date(exercise.last_completed).toLocaleDateString()}</span>
                        <span className="bg-yellow-400/20 text-yellow-400 px-2 py-1 rounded">
                          💪 Difícil
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Zap size={64} className="text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-400 mb-2">No hay ejercicios desafiantes registrados</h3>
                  <p className="text-gray-500">Completa ejercicios y califícalos como "difícil" para verlos aquí</p>
                </div>
              )}
            </div>
          )}

          {/* Tab: Estadísticas */}
          {activeTab === 'analytics' && (
            <div>
              <div className="text-center mb-8">
                <TrendingUp size={48} className="text-blue-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Estadísticas de Preferencias</h2>
                <p className="text-gray-400">Análisis de tus patrones de entrenamiento y preferencias</p>
              </div>

              {preferences && (
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Total Ejercicios Completados */}
                  <div className="bg-gray-800/50 border border-green-400/30 rounded-xl p-6 text-center">
                    <CheckCircle size={32} className="text-green-400 mx-auto mb-3" />
                    <div className="text-3xl font-bold text-white mb-1">
                      {preferences.analytics?.total_completed || 0}
                    </div>
                    <div className="text-sm text-gray-400">Ejercicios completados</div>
                  </div>

                  {/* Favoritos */}
                  <div className="bg-gray-800/50 border border-red-400/30 rounded-xl p-6 text-center">
                    <Heart size={32} className="text-red-400 mx-auto mb-3" />
                    <div className="text-3xl font-bold text-white mb-1">
                      {preferences.favorites?.length || 0}
                    </div>
                    <div className="text-sm text-gray-400">Ejercicios favoritos</div>
                  </div>

                  {/* Rechazados */}
                  <div className="bg-gray-800/50 border border-gray-400/30 rounded-xl p-6 text-center">
                    <ThumbsDown size={32} className="text-gray-400 mx-auto mb-3" />
                    <div className="text-3xl font-bold text-white mb-1">
                      {preferences.rejected?.length || 0}
                    </div>
                    <div className="text-sm text-gray-400">Ejercicios rechazados</div>
                  </div>

                  {/* Desafiantes */}
                  <div className="bg-gray-800/50 border border-yellow-400/30 rounded-xl p-6 text-center">
                    <Zap size={32} className="text-yellow-400 mx-auto mb-3" />
                    <div className="text-3xl font-bold text-white mb-1">
                      {preferences.challenging?.length || 0}
                    </div>
                    <div className="text-sm text-gray-400">Ejercicios desafiantes</div>
                  </div>
                </div>
              )}

              {/* Motivational Messages */}
              {preferences && (
                <div className="mt-8 bg-gradient-to-r from-yellow-400/10 to-blue-400/10 border border-yellow-400/30 rounded-xl p-6">
                  <h3 className="text-xl font-semibold text-white mb-4">💡 Sugerencias Personalizadas</h3>
                  <div className="space-y-3">
                    {preferences.favorites?.length > 0 && (
                      <p className="text-yellow-200">
                        🔥 ¡Tienes {preferences.favorites.length} ejercicios favoritos! ¿Te gustaría incluir más de ellos en tu próximo entrenamiento?
                      </p>
                    )}
                    {preferences.challenging?.length > 2 && (
                      <p className="text-blue-200">
                        💪 Has superado {preferences.challenging.length} ejercicios desafiantes. ¡Eres más fuerte de lo que crees!
                      </p>
                    )}
                    {preferences.rejected?.some(r => r.rejection_category === 'too_hard') && (
                      <p className="text-orange-200">
                        🎯 Algunos ejercicios te parecieron muy difíciles. ¿Quieres probar versiones más fáciles para progresar gradualmente?
                      </p>
                    )}
                    {(!preferences.rejected?.length || preferences.rejected.length === 0) && (
                      <p className="text-green-200">
                        ✨ ¡Excelente! No has rechazado ningún ejercicio. Tu actitud positiva es admirable.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomeTrainingPreferencesHistory;