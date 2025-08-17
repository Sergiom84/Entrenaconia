const PersonalDataStep = ({ formData, onInputChange }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onInputChange(name, value);
  };

  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-yellow-400 mb-2">Medidas Corporales (Opcional)</h2>
        <p className="text-gray-400">Estas medidas nos ayudarán a personalizar mejor tu entrenamiento</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cintura */}
        <div>
          <label className="block text-white font-medium mb-2">Cintura (cm)</label>
          <input
            type="number"
            name="cintura"
            value={formData.cintura}
            onChange={handleChange}
            placeholder="Ej: 80"
            min="50"
            max="200"
            step="0.1"
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-accent-400 transition-colors"
          />
        </div>

        {/* Pecho */}
        <div>
          <label className="block text-white font-medium mb-2">Pecho (cm)</label>
          <input
            type="number"
            name="pecho"
            value={formData.pecho}
            onChange={handleChange}
            placeholder="Ej: 95"
            min="50"
            max="200"
            step="0.1"
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-accent-400 transition-colors"
          />
        </div>

        {/* Brazos */}
        <div>
          <label className="block text-white font-medium mb-2">Brazos (cm)</label>
          <input
            type="number"
            name="brazos"
            value={formData.brazos}
            onChange={handleChange}
            placeholder="Ej: 35"
            min="20"
            max="80"
            step="0.1"
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-accent-400 transition-colors"
          />
        </div>

        {/* Muslos */}
        <div>
          <label className="block text-white font-medium mb-2">Muslos (cm)</label>
          <input
            type="number"
            name="muslos"
            value={formData.muslos}
            onChange={handleChange}
            placeholder="Ej: 55"
            min="30"
            max="100"
            step="0.1"
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-accent-400 transition-colors"
          />
        </div>

        {/* Cuello */}
        <div>
          <label className="block text-white font-medium mb-2">Cuello (cm)</label>
          <input
            type="number"
            name="cuello"
            value={formData.cuello}
            onChange={handleChange}
            placeholder="Ej: 38"
            min="25"
            max="60"
            step="0.1"
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-accent-400 transition-colors"
          />
        </div>

        {/* Antebrazos */}
        <div>
          <label className="block text-white font-medium mb-2">Antebrazos (cm)</label>
          <input
            type="number"
            name="antebrazos"
            value={formData.antebrazos}
            onChange={handleChange}
            placeholder="Ej: 28"
            min="15"
            max="50"
            step="0.1"
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-accent-400 transition-colors"
          />
        </div>
      </div>



      {/* Consejos para tomar medidas */}
      <div className="bg-blue-900/20 rounded-lg p-6 border border-blue-700/50">
        <h3 className="text-lg font-semibold text-blue-400 mb-4">💡 Consejos para tomar medidas precisas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
          <div>
            <h4 className="font-medium text-blue-300 mb-2">Cintura:</h4>
            <p>Mide en la parte más estrecha, generalmente a la altura del ombligo</p>
          </div>
          <div>
            <h4 className="font-medium text-blue-300 mb-2">Pecho:</h4>
            <p>Mide alrededor de la parte más ancha del pecho, pasando por los pezones</p>
          </div>
          <div>
            <h4 className="font-medium text-blue-300 mb-2">Brazos:</h4>
            <p>Mide la parte más ancha del bíceps con el brazo flexionado</p>
          </div>
          <div>
            <h4 className="font-medium text-blue-300 mb-2">Muslos:</h4>
            <p>Mide la parte más ancha del muslo, aproximadamente a 15cm de la rodilla</p>
          </div>
          <div>
            <h4 className="font-medium text-blue-300 mb-2">Cuello:</h4>
            <p>Mide alrededor del cuello, justo debajo de la nuez de Adán</p>
          </div>
          <div>
            <h4 className="font-medium text-blue-300 mb-2">Antebrazos:</h4>
            <p>Mide la parte más ancha del antebrazo, cerca del codo</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalDataStep;
