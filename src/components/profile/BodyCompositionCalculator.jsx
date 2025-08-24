import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Calculator, X } from 'lucide-react'

export const BodyCompositionCalculator = ({ isOpen, onClose, onCalculate, userProfile }) => {
  const [formData, setFormData] = useState({
    sexo: userProfile?.sexo || 'masculino',
    edad: userProfile?.edad || '',
    peso: userProfile?.peso || '',
    altura: userProfile?.altura || '',
    cintura: userProfile?.cintura || '',
    cuello: userProfile?.cuello || ''
  })

  // Actualizar formData cuando cambie userProfile
  useEffect(() => {
    if (userProfile && isOpen) {
      setFormData({
        sexo: userProfile.sexo || 'masculino',
        edad: userProfile.edad || '',
        peso: userProfile.peso || '',
        altura: userProfile.altura || '',
        cintura: userProfile.cintura || '',
        cuello: userProfile.cuello || ''
      })
    }
  }, [userProfile, isOpen])

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const calculateComposition = () => {
    const { sexo, edad, peso, altura, cintura, cuello } = formData
    
    if (!edad || !peso || !altura || !cintura || !cuello) {
      alert('Por favor completa todos los campos')
      return
    }

    // Calcular IMC
    const alturaM = altura / 100
    const imc = (peso / (alturaM * alturaM)).toFixed(1)

    // Calcular porcentaje de grasa corporal usando la fórmula del US Navy
    let bodyFat
    if (sexo === 'masculino') {
      bodyFat = 495 / (1.0324 - 0.19077 * Math.log10(cintura - cuello) + 0.15456 * Math.log10(altura)) - 450
    } else {
      // Para mujeres necesitaríamos medida de cadera, por ahora usamos una fórmula simplificada
      bodyFat = 495 / (1.29579 - 0.35004 * Math.log10(cintura + cuello - altura)) - 450
    }

    bodyFat = Math.max(0, Math.min(50, bodyFat)).toFixed(1)

    // Calcular masa muscular estimada
    const masaGrasa = (peso * bodyFat / 100).toFixed(1)
    const masaMagra = (peso - masaGrasa).toFixed(1)

    // Calcular agua corporal (estimación: 60% para hombres, 55% para mujeres)
    const aguaCorporal = sexo === 'masculino' ? 60 : 55

    // Calcular metabolismo basal usando la fórmula Harris-Benedict
    let metabolismoBasal
    if (sexo === 'masculino') {
      metabolismoBasal = 88.362 + (13.397 * peso) + (4.799 * altura) - (5.677 * edad)
    } else {
      metabolismoBasal = 447.593 + (9.247 * peso) + (3.098 * altura) - (4.330 * edad)
    }

    const results = {
      imc: parseFloat(imc),
      porcentaje_grasa: parseFloat(bodyFat),
      masa_grasa: parseFloat(masaGrasa),
      masa_magra: parseFloat(masaMagra),
      agua_corporal: aguaCorporal,
      metabolismo_basal: Math.round(metabolismoBasal)
    }

    onCalculate(results)
    onClose()
  }

  const handleCancel = () => {
    setFormData({
      sexo: 'masculino',
      edad: '',
      peso: '',
      altura: '',
      cintura: '',
      cuello: ''
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="bg-gray-900 border-yellow-400/20 w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <div className="flex items-center">
              <Calculator className="mr-2 text-yellow-400" />
              Calculadora de Composición Corporal
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </CardTitle>
          <p className="text-gray-400 text-sm">
            Ingresa tus medidas para calcular automáticamente tu composición corporal
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Sexo</label>
              <select
                value={formData.sexo}
                onChange={(e) => handleInputChange('sexo', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
              >
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
              </select>
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-1 block">Edad</label>
              <input
                type="number"
                value={formData.edad}
                onChange={(e) => handleInputChange('edad', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                placeholder="41"
                min="16"
                max="100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Peso (kg)</label>
              <input
                type="number"
                value={formData.peso}
                onChange={(e) => handleInputChange('peso', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                placeholder="76.00"
                min="40"
                max="200"
                step="0.1"
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-1 block">Altura (cm)</label>
              <input
                type="number"
                value={formData.altura}
                onChange={(e) => handleInputChange('altura', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                placeholder="183.50"
                min="140"
                max="220"
                step="0.1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Cintura (cm)</label>
              <input
                type="number"
                value={formData.cintura}
                onChange={(e) => handleInputChange('cintura', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                placeholder="90.0"
                min="50"
                max="150"
                step="0.1"
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-1 block">Cuello (cm)</label>
              <input
                type="number"
                value={formData.cuello}
                onChange={(e) => handleInputChange('cuello', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                placeholder="34.0"
                min="25"
                max="50"
                step="0.1"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleCancel}
              variant="outline"
              className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Cancelar
            </Button>
            <Button
              onClick={calculateComposition}
              className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              Calcular
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
