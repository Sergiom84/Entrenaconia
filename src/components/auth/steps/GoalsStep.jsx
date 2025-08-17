import TagsInput from '../../ui/TagsInput'

const GoalsStep = ({ formData, onInputChange }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onInputChange(name, value);
  };

  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-yellow-400 mb-2">Metas y Objetivos</h2>
        <p className="text-gray-400">Define tus objetivos para crear un plan personalizado</p>
      </div>

      {/* Metas y Objetivos */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Objetivo Principal */}
          <div>
            <label className="block text-white font-medium mb-2">Objetivo Principal</label>
            <select
              name="objetivoPrincipal"
              value={formData.objetivoPrincipal}
              onChange={handleChange}
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent-400 transition-colors"
            >
              <option value="">Seleccionar objetivo</option>
              <option value="perder_peso">Perder peso</option>
              <option value="ganar_musculo">Ganar músculo</option>
              <option value="tonificar">Tonificar</option>
              <option value="mejorar_resistencia">Mejorar resistencia</option>
              <option value="fuerza">Aumentar fuerza</option>
              <option value="mantener_forma">Mantener forma física</option>
              <option value="rehabilitacion">Rehabilitación</option>
            </select>
          </div>

          {/* Meta de Peso */}
          <div>
            <label className="block text-white font-medium mb-2">Meta de Peso (kg)</label>
            <input
              type="number"
              name="metaPeso"
              value={formData.metaPeso}
              onChange={handleChange}
              placeholder="Ej: 65"
              min="30"
              max="300"
              step="0.1"
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-accent-400 transition-colors"
            />
          </div>

          {/* Meta de % Grasa Corporal */}
          <div>
            <label className="block text-white font-medium mb-2">Meta de % Grasa Corporal</label>
            <input
              type="number"
              name="metaGrasaCorporal"
              value={formData.metaGrasaCorporal}
              onChange={handleChange}
              placeholder="Ej: 15"
              min="5"
              max="50"
              step="0.1"
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-accent-400 transition-colors"
            />
          </div>

          {/* Enfoque de Entrenamiento */}
          <div>
            <label className="block text-white font-medium mb-2">Enfoque de Entrenamiento</label>
            <select
              name="enfoqueEntrenamiento"
              value={formData.enfoqueEntrenamiento}
              onChange={handleChange}
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent-400 transition-colors"
            >
              <option value="">Seleccionar enfoque</option>
              <option value="fuerza">Fuerza</option>
              <option value="hipertrofia">Hipertrofia</option>
              <option value="resistencia">Resistencia</option>
              <option value="funcional">Funcional</option>
              <option value="hiit">HIIT</option>
              <option value="mixto">Mixto</option>
            </select>
          </div>
        </div>
      </div>

      {/* Preferencias de Nutrición y Horarios */}
      <div className="border-t border-gray-600 pt-8">
        <h3 className="text-xl font-semibold text-yellow-400 mb-6">Preferencias de Nutrición y Horarios</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Horario Preferido */}
          <div>
            <label className="block text-white font-medium mb-2">Horario Preferido</label>
            <select
              name="horarioPreferido"
              value={formData.horarioPreferido}
              onChange={handleChange}
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent-400 transition-colors"
            >
              <option value="">Seleccionar horario</option>
              <option value="manana">Mañana (6:00 - 10:00)</option>
              <option value="mediodia">Mediodía (10:00 - 14:00)</option>
              <option value="tarde">Tarde (14:00 - 18:00)</option>
              <option value="noche">Noche (18:00 - 22:00)</option>
              <option value="flexible">Flexible</option>
            </select>
          </div>

          {/* Comidas por Día */}
          <div>
            <label className="block text-white font-medium mb-2">Comidas por Día</label>
            <input
              type="number"
              name="comidasPorDia"
              value={formData.comidasPorDia}
              onChange={handleChange}
              placeholder="Ej: 4"
              min="2"
              max="8"
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-accent-400 transition-colors"
            />
          </div>
        </div>

        <div className="space-y-6 mt-6">
          {/* Suplementación */}
          <div>
            <label className="block text-white font-medium mb-2">Suplementación</label>
            <TagsInput
              value={Array.isArray(formData.suplementacion) ? formData.suplementacion : (formData.suplementacion ? String(formData.suplementacion).split(',').map(s=>s.trim()).filter(Boolean) : [])}
              onChange={(arr) => onInputChange('suplementacion', arr)}
              placeholder="Escribe un suplemento y pulsa Enter"
            />
          </div>

          {/* Alimentos Excluidos */}
          <div>
            <label className="block text-white font-medium mb-2">Alimentos Excluidos</label>
            <TagsInput
              value={Array.isArray(formData.alimentosExcluidos) ? formData.alimentosExcluidos : (formData.alimentosExcluidos ? String(formData.alimentosExcluidos).split(',').map(s=>s.trim()).filter(Boolean) : [])}
              onChange={(arr) => onInputChange('alimentosExcluidos', arr)}
              placeholder="Escribe un alimento y pulsa Enter"
            />
          </div>
        </div>
      </div>

      {/* Resumen motivacional */}
      <div className="bg-gradient-to-r from-accent-900/20 to-accent-800/20 rounded-lg p-6 border border-accent-700/50">
        <h3 className="text-lg font-semibold text-yellow-400 mb-4">🎯 ¡Estás a punto de comenzar!</h3>
        <div className="space-y-3 text-gray-300">
          <p>
            Con la información que has proporcionado, nuestra IA creará un plan de entrenamiento 
            completamente personalizado para ti.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-accent-400 rounded-full"></div>
              <span className="text-sm">Rutinas adaptadas a tu nivel</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-accent-400 rounded-full"></div>
              <span className="text-sm">Progreso automático</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-accent-400 rounded-full"></div>
              <span className="text-sm">Seguimiento detallado</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-accent-400 rounded-full"></div>
              <span className="text-sm">Ajustes inteligentes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Términos y condiciones */}
      <div className="bg-gray-700/30 rounded-lg p-6 border border-gray-600">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="terms"
            className="mt-1 w-4 h-4 text-accent-400 bg-gray-700 border-gray-600 rounded focus:ring-accent-400 focus:ring-2"
          />
          <label htmlFor="terms" className="text-sm text-gray-300">
            Acepto los{' '}
            <a href="#" className="text-accent-400 hover:text-accent-300 underline">
              términos y condiciones
            </a>{' '}
            y la{' '}
            <a href="#" className="text-accent-400 hover:text-accent-300 underline">
              política de privacidad
            </a>
            . Entiendo que esta aplicación no reemplaza el consejo médico profesional.
          </label>
        </div>
      </div>
    </div>
  );
};

export default GoalsStep;
