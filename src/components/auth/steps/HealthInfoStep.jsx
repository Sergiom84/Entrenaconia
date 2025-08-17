import TagsInput from '../../ui/TagsInput'

const HealthInfoStep = ({ formData, onInputChange }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onInputChange(name, value);
  };

  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-yellow-400 mb-2">Información de Salud (Opcional)</h2>
        <p className="text-gray-400">Esta información nos ayuda a crear entrenamientos seguros y personalizados</p>
      </div>

      <div className="space-y-6">
        {/* Historial Médico */}
        <div>
          <label className="block text-white font-medium mb-2">Historial Médico</label>
          <textarea
            name="historialMedico"
            value={formData.historialMedico}
            onChange={handleChange}
            placeholder="Describe cualquier condición médica relevante..."
            rows={4}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-accent-400 transition-colors resize-none"
          />
          <p className="text-gray-500 text-sm mt-1">
            Ejemplo: Diabetes, hipertensión, problemas cardíacos, etc.
          </p>
        </div>

        {/* Limitaciones Físicas */}
        <div>
          <label className="block text-white font-medium mb-2">Limitaciones Físicas</label>
          <textarea
            name="limitacionesFisicas"
            value={formData.limitacionesFisicas}
            onChange={handleChange}
            placeholder="Lesiones, dolores, limitaciones de movimiento..."
            rows={4}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-accent-400 transition-colors resize-none"
          />
          <p className="text-gray-500 text-sm mt-1">
            Ejemplo: Dolor de espalda, lesión de rodilla, limitación en el hombro, etc.
          </p>
        </div>

        {/* Alergias */}
        <div>
          <label className="block text-white font-medium mb-2">Alergias</label>
          <TagsInput
            value={Array.isArray(formData.alergias) ? formData.alergias : (formData.alergias ? String(formData.alergias).split(',').map(s=>s.trim()).filter(Boolean) : [])}
            onChange={(arr) => onInputChange('alergias', arr)}
            placeholder="Escribe una alergia y pulsa Enter"
          />
          <p className="text-gray-500 text-sm mt-1">
            Ejemplo: Nueces, lácteos, gluten, polen, etc.
          </p>
        </div>

        {/* Medicamentos */}
        <div>
          <label className="block text-white font-medium mb-2">Medicamentos</label>
          <TagsInput
            value={Array.isArray(formData.medicamentos) ? formData.medicamentos : (formData.medicamentos ? String(formData.medicamentos).split(',').map(s=>s.trim()).filter(Boolean) : [])}
            onChange={(arr) => onInputChange('medicamentos', arr)}
            placeholder="Escribe un medicamento y pulsa Enter"
          />
          <p className="text-gray-500 text-sm mt-1">
            Ejemplo: Aspirina, vitaminas, suplementos, etc.
          </p>
        </div>
      </div>



      {/* Advertencia médica */}
      <div className="bg-yellow-900/20 rounded-lg p-6 border border-yellow-700/50">
        <h3 className="text-lg font-semibold text-yellow-400 mb-4">⚠️ Importante</h3>
        <div className="space-y-3 text-gray-300 text-sm">
          <p>
            <strong>Consulta médica:</strong> Si tienes condiciones médicas serias o dudas sobre tu capacidad 
            para hacer ejercicio, consulta con un profesional de la salud antes de comenzar cualquier programa 
            de entrenamiento.
          </p>
          <p>
            <strong>No somos médicos:</strong> Esta aplicación no reemplaza el consejo médico profesional. 
            Los entrenamientos generados son sugerencias basadas en la información que proporcionas.
          </p>
          <p>
            <strong>Escucha a tu cuerpo:</strong> Detén cualquier ejercicio si sientes dolor, mareos o 
            malestar. Tu seguridad es lo más importante.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HealthInfoStep;
