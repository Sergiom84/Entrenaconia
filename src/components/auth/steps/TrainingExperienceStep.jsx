const TrainingExperienceStep = ({ formData, onInputChange }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onInputChange(name, value);
  };

  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-accent-400 mb-2">Experiencia en Entrenamiento</h2>
        <p className="text-gray-400">Cuéntanos sobre tu experiencia para personalizar tu plan</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nivel Actual */}
        <div>
          <label className="block text-white font-medium mb-2">Nivel Actual</label>
          <select
            name="nivelEntrenamiento"
            value={formData.nivelEntrenamiento}
            onChange={handleChange}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent-400 transition-colors"
          >
            <option value="">Seleccionar nivel</option>
            <option value="principiante">Principiante</option>
            <option value="intermedio">Intermedio</option>
            <option value="avanzado">Avanzado</option>
          </select>
        </div>

        {/* Años Entrenando */}
        <div>
          <label className="block text-white font-medium mb-2">Años Entrenando</label>
          <input
            type="number"
            name="anosEntrenando"
            value={formData.anosEntrenando}
            onChange={handleChange}
            placeholder="Ej: 3"
            min="0"
            max="50"
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-accent-400 transition-colors"
          />
        </div>

        {/* Frecuencia Semanal */}
        <div>
          <label className="block text-white font-medium mb-2">Frecuencia Semanal (días)</label>
          <input
            type="number"
            name="frecuenciaSemanal"
            value={formData.frecuenciaSemanal}
            onChange={handleChange}
            placeholder="Ej: 4"
            min="1"
            max="7"
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-accent-400 transition-colors"
          />
        </div>

        {/* Metodología Preferida */}
        <div>
          <label className="block text-white font-medium mb-2">Metodología Preferida</label>
          <select
            name="metodologiaPreferida"
            value={formData.metodologiaPreferida}
            onChange={handleChange}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent-400 transition-colors"
          >
            <option value="">Seleccionar metodología</option>
            <option value="powerlifting">Powerlifting</option>
            <option value="bodybuilding">Bodybuilding</option>
            <option value="crossfit">CrossFit</option>
            <option value="calistenia">Calistenia</option>
            <option value="entrenamiento_casa">Entrenamiento en Casa</option>
            <option value="heavy_duty">Heavy Duty</option>
            <option value="entrenamiento_funcional">Entrenamiento Funcional</option>
          </select>
        </div>

        {/* Nivel de Actividad */}
        <div className="md:col-span-2">
          <label className="block text-white font-medium mb-2">Nivel de Actividad</label>
          <select
            name="nivelActividad"
            value={formData.nivelActividad}
            onChange={handleChange}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent-400 transition-colors"
          >
            <option value="">Seleccionar</option>
            <option value="sedentario">Sedentario</option>
            <option value="ligero">Ligero</option>
            <option value="moderado">Moderado</option>
            <option value="activo">Activo</option>
            <option value="muy_activo">Muy Activo</option>
          </select>
        </div>
      </div>

      {/* Información adicional sobre niveles */}
      <div className="bg-blue-900/20 rounded-lg p-6 border border-blue-700/50">
        <h3 className="text-lg font-semibold text-blue-400 mb-4">💡 Guía de Niveles</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-300">
          <div>
            <h4 className="font-medium text-blue-300 mb-2">Principiante:</h4>
            <ul className="space-y-1 text-xs">
              <li>• 0-1 años de experiencia</li>
              <li>• Aprendiendo técnicas básicas</li>
              <li>• 2-3 días por semana</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-300 mb-2">Intermedio:</h4>
            <ul className="space-y-1 text-xs">
              <li>• 1-3 años de experiencia</li>
              <li>• Técnica establecida</li>
              <li>• 3-5 días por semana</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-300 mb-2">Avanzado:</h4>
            <ul className="space-y-1 text-xs">
              <li>• +3 años de experiencia</li>
              <li>• Técnica refinada</li>
              <li>• 4-6 días por semana</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Información sobre actividad diaria */}
      <div className="bg-green-900/20 rounded-lg p-6 border border-green-700/50">
        <h3 className="text-lg font-semibold text-green-400 mb-4">🏃‍♂️ Niveles de Actividad</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
          <div>
            <h4 className="font-medium text-green-300 mb-2">Sedentario:</h4>
            <p className="text-xs">Trabajo de oficina, poco movimiento diario</p>
          </div>
          <div>
            <h4 className="font-medium text-green-300 mb-2">Ligero:</h4>
            <p className="text-xs">Caminatas ocasionales, actividad ligera</p>
          </div>
          <div>
            <h4 className="font-medium text-green-300 mb-2">Moderado:</h4>
            <p className="text-xs">Ejercicio regular, trabajo activo</p>
          </div>
          <div>
            <h4 className="font-medium text-green-300 mb-2">Activo:</h4>
            <p className="text-xs">Ejercicio frecuente, estilo de vida activo</p>
          </div>
          <div className="md:col-span-2">
            <h4 className="font-medium text-green-300 mb-2">Muy Activo:</h4>
            <p className="text-xs">Entrenamiento intenso diario, trabajo físico</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainingExperienceStep;
