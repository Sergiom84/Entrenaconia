import React, { useState, useEffect } from 'react';
import { X, Calendar, Zap, Target, AlertCircle } from 'lucide-react';

/**
 * Modal de Confirmación de Día de Inicio
 * Aparece cuando el usuario selecciona una metodología en Jueves, Viernes, Sábado o Domingo
 */
const StartDayConfirmationModal = ({ isOpen, onClose, onConfirm, methodology }) => {
  const [selectedOption, setSelectedOption] = useState(null);
  const [currentDay, setCurrentDay] = useState('');
  const [options, setOptions] = useState([]);

  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const dayName = dayNames[dayOfWeek];
      
      setCurrentDay(dayName);
      setSelectedOption(null);
      
      // Configurar opciones según el día
      const dayOptions = getDayOptions(dayOfWeek);
      setOptions(dayOptions);
    }
  }, [isOpen]);

  const getDayOptions = (dayOfWeek) => {
    switch (dayOfWeek) {
      case 4: // Jueves
        return [
          {
            id: 'monday',
            icon: Calendar,
            title: '🗓️ Empezar el LUNES (Recomendado)',
            description: 'Comenzarás con una semana completa',
            startDate: 'next_monday',
            color: 'blue'
          },
          {
            id: 'today_2days',
            icon: Zap,
            title: '💪 Empezar HOY (Jueves + Viernes)',
            description: 'Entrenas hoy y mañana, descansas el fin de semana, continúas el lunes',
            startDate: 'today',
            sessionsFirstWeek: 2,
            color: 'green'
          },
          {
            id: 'today_3days',
            icon: Target,
            title: '⚡ Empezar HOY (Jue + Vie + Sáb)',
            description: 'Entrenas hoy, mañana y el sábado, descansas el domingo, continúas el lunes',
            startDate: 'today',
            sessionsFirstWeek: 3,
            color: 'purple'
          }
        ];

      case 5: // Viernes
        return [
          {
            id: 'monday',
            icon: Calendar,
            title: '🗓️ Empezar el LUNES (Recomendado)',
            description: 'Comenzarás con una semana completa',
            startDate: 'next_monday',
            color: 'blue'
          },
          {
            id: 'today_2days',
            icon: Zap,
            title: '💪 Empezar HOY (Viernes + Sábado)',
            description: 'Entrenas hoy y mañana, descansas el domingo, continúas el lunes',
            startDate: 'today',
            sessionsFirstWeek: 2,
            color: 'green'
          },
          {
            id: 'today_1day',
            icon: Target,
            title: '⚡ Empezar HOY (solo Viernes)',
            description: 'Entrenas solo hoy, descansas el fin de semana, continúas el lunes',
            startDate: 'today',
            sessionsFirstWeek: 1,
            color: 'purple'
          }
        ];

      case 6: // Sábado
        return [
          {
            id: 'home_training',
            icon: Zap,
            title: '💪 Entrenamiento para HOY',
            description: 'Te generamos un entrenamiento único para hoy, y el lunes empiezas el plan completo',
            startDate: 'home_training_today',
            color: 'orange'
          },
          {
            id: 'today_continue_monday',
            icon: Target,
            title: '⚡ Empezar HOY (Sábado)',
            description: 'Entrenas hoy, descansas el domingo, continúas el lunes',
            startDate: 'today',
            sessionsFirstWeek: 1,
            color: 'green'
          }
        ];

      case 0: // Domingo
        return [
          {
            id: 'home_training',
            icon: Zap,
            title: '💪 Entrenamiento para HOY',
            description: 'Te generamos un entrenamiento único para hoy, y mañana empiezas el plan completo',
            startDate: 'home_training_today',
            color: 'orange'
          },
          {
            id: 'monday',
            icon: Calendar,
            title: '🗓️ Empezar MAÑANA (Lunes)',
            description: 'Descansas hoy, mañana empiezas el plan completo',
            startDate: 'next_monday',
            color: 'blue'
          }
        ];

      default:
        return [];
    }
  };

  const handleConfirm = () => {
    if (!selectedOption) return;
    
    const option = options.find(opt => opt.id === selectedOption);
    const today = new Date();
    const effectiveStartDay = option.startDate === 'next_monday' ? 1 : today.getDay();

    onConfirm({
      startDate: option.startDate,
      sessionsFirstWeek: option.sessionsFirstWeek,
      isHomeTraining: option.startDate === 'home_training_today',
      startDayOfWeek: effectiveStartDay // 0=Dom ... 6=Sáb (solo usamos jueves para sábados)
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-7 h-7 text-blue-500" />
              Hoy es {currentDay}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              ¿Cuándo quieres comenzar tu plan de {methodology}?
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Options */}
        <div className="p-6 space-y-4">
          {options.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedOption === option.id;
            
            return (
              <button
                key={option.id}
                onClick={() => setSelectedOption(option.id)}
                className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${
                    option.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' :
                    option.color === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
                    option.color === 'purple' ? 'bg-purple-100 dark:bg-purple-900/30' :
                    'bg-orange-100 dark:bg-orange-900/30'
                  }`}>
                    <Icon className={`w-6 h-6 ${
                      option.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                      option.color === 'green' ? 'text-green-600 dark:text-green-400' :
                      option.color === 'purple' ? 'text-purple-600 dark:text-purple-400' :
                      'text-orange-600 dark:text-orange-400'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-semibold text-lg mb-1 ${
                      isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'
                    }`}>
                      {option.title}
                    </h3>
                    <p className={`text-sm ${
                      isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {option.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedOption}
            className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-colors ${
              selectedOption
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
};

export default StartDayConfirmationModal;

