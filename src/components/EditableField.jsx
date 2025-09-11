import React from 'react'

export const EditableField = ({
  label,
  field,
  value,
  displayValue,
  type = 'text',
  suffix = '',
  editing,
  editedData,
  onInputChange,
  options = null,
  isList = false,
  displayObjects = null
}) => {
  const currentValue = editing ? (editedData[field] || (isList ? [] : '')) : value

  if (editing) {
    if (isList) {
      // Campo para listas
      return (
        <div className="h-full flex flex-col">
          <label className="text-gray-400 mb-2 font-medium">{label}</label>
          <div className="space-y-2 flex-grow">
            {currentValue.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newList = [...currentValue]
                    newList[index] = e.target.value
                    onInputChange(field, newList)
                  }}
                  className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/20 transition-all"
                  placeholder={`${label} ${index + 1}`}
                />
                <button
                  onClick={() => {
                    const newList = currentValue.filter((_, i) => i !== index)
                    onInputChange(field, newList)
                  }}
                  className="text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg px-2 py-1 transition-all"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const newList = [...currentValue, '']
                onInputChange(field, newList)
              }}
              className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 text-sm font-medium border border-yellow-400/20 rounded-lg px-3 py-1.5 transition-all"
            >
              + Agregar {label.toLowerCase()}
            </button>
          </div>
        </div>
      )
    } else if (options) {
      // Campo select
      return (
        <div>
          <label className="text-gray-400">{label}</label>
          <select
            value={currentValue}
            onChange={(e) => onInputChange(field, e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
          >
            <option value="">Seleccionar...</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )
    } else {
      // Campo input
      return (
        <div>
          <label className="text-gray-400">{label}</label>
          <input
            type={type}
            value={currentValue}
            onChange={(e) => onInputChange(field, e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
            placeholder={`Ingresa ${label.toLowerCase()}`}
          />
        </div>
      )
    }
  } else {
    // Modo visualización
    if (isList && Array.isArray(value)) {
      return (
        <div className="h-full flex flex-col">
          <label className="text-gray-400 mb-2 font-medium">{label}</label>
          <div className="space-y-1 flex-grow">
            {value.length > 0 ? (
              value.map((item, index) => (
                <div key={index} className="text-white text-sm bg-gray-700/50 border border-gray-600/50 rounded-lg px-3 py-1.5 backdrop-blur-sm">
                  {displayObjects ? displayObjects[index]?.name || item : item}
                </div>
              ))
            ) : (
              <p className="text-gray-500 italic text-sm bg-gray-800/30 rounded-lg px-3 py-2 border border-dashed border-gray-600/30">
                Ninguno especificado
              </p>
            )}
          </div>
        </div>
      )
    } else {
      return (
        <div>
          <label className="text-gray-400">{label}</label>
          <p className="text-white font-semibold">
            {displayValue || (value ? `${value}${suffix}` : 'No especificado')}
          </p>
        </div>
      )
    }
  }
}
