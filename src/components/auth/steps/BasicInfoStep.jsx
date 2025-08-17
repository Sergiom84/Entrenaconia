import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const BasicInfoStep = ({ formData, onInputChange }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    onInputChange(name, value);
    
    // Limpiar error cuando el usuario empiece a escribir
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateEmail = (email) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-white mb-2">Información de Cuenta</h2>
        <p className="text-gray-300">Crea tu cuenta para comenzar tu entrenamiento personalizado</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nombre */}
        <div>
          <label className="block text-gray-100 font-semibold mb-2">
            Nombre <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            placeholder="Tu nombre"
            className="w-full bg-gray-700/60 border border-yellow-400/20 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-300 focus:outline-none focus:border-yellow-400 transition-colors"
            required
          />
        </div>

        {/* Apellido */}
        <div>
          <label className="block text-white font-medium mb-2">
            Apellido <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            name="apellido"
            value={formData.apellido}
            onChange={handleChange}
            placeholder="Tu apellido"
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-accent-400 transition-colors"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Email */}
        <div>
          <label className="block text-white font-medium mb-2">
            Email <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="tu@email.com"
            className={`w-full bg-gray-700/50 border ${
              errors.email ? 'border-red-500' : 'border-gray-600'
            } rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-accent-400 transition-colors`}
            required
          />
          {errors.email && (
            <p className="text-red-400 text-sm mt-1">{errors.email}</p>
          )}
        </div>

        {/* Contraseña */}
        <div>
          <label className="block text-white font-medium mb-2">
            Contraseña <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Mínimo 6 caracteres"
              className={`w-full bg-gray-700/50 border ${
                errors.password ? 'border-red-500' : 'border-gray-600'
              } rounded-lg px-4 py-3 pr-12 text-white placeholder-gray-400 focus:outline-none focus:border-accent-400 transition-colors`}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-red-400 text-sm mt-1">{errors.password}</p>
          )}
        </div>
      </div>

      {/* Datos Personales */}
      <div className="border-t border-gray-600 pt-8">
        <h3 className="text-xl font-semibold text-yellow-400 mb-6">Datos Personales</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Edad */}
          <div>
            <label className="block text-white font-medium mb-2">Edad</label>
            <input
              type="number"
              name="edad"
              value={formData.edad}
              onChange={handleChange}
              placeholder="Ej: 25"
              min="16"
              max="100"
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-accent-400 transition-colors"
            />
          </div>

          {/* Sexo */}
          <div>
            <label className="block text-white font-medium mb-2">Sexo</label>
            <select
              name="sexo"
              value={formData.sexo}
              onChange={handleChange}
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent-400 transition-colors"
            >
              <option value="">Seleccionar</option>
              <option value="masculino">Masculino</option>
              <option value="femenino">Femenino</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          {/* Peso */}
          <div>
            <label className="block text-white font-medium mb-2">Peso (kg)</label>
            <input
              type="number"
              name="peso"
              value={formData.peso}
              onChange={handleChange}
              placeholder="Ej: 70"
              min="30"
              max="300"
              step="0.1"
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-accent-400 transition-colors"
            />
          </div>

          {/* Altura */}
          <div>
            <label className="block text-white font-medium mb-2">Altura (cm)</label>
            <input
              type="number"
              name="altura"
              value={formData.altura}
              onChange={handleChange}
              placeholder="Ej: 175"
              min="100"
              max="250"
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-accent-400 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Experiencia en Entrenamiento */}
      <div className="border-t border-gray-600 pt-8">
        <h3 className="text-xl font-semibold text-yellow-400 mb-6">Experiencia en Entrenamiento</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nivel de Entrenamiento */}
          <div>
            <label className="block text-white font-medium mb-2">Nivel de Entrenamiento</label>
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
      </div>
    </div>
  );
};

export default BasicInfoStep;
