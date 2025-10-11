import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Calculator, X, RotateCcw } from 'lucide-react'

export const BodyCompositionCalculator = ({ isOpen, onClose, onCalculate, userProfile }) => {
  const [formData, setFormData] = useState({
    sexo: userProfile?.sexo || 'masculino',
    edad: userProfile?.edad || '',
    peso: userProfile?.peso || '',
    altura: userProfile?.altura || '',
    cintura: userProfile?.cintura || '',
    cuello: userProfile?.cuello || '',
    cadera: userProfile?.cadera || ''
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
        cuello: userProfile.cuello || '',
        cadera: userProfile.cadera || ''
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
    const { sexo, edad, peso, altura, cintura, cuello, cadera } = formData
    
    console.log('🔍 DEBUG: formData recibido:', formData)
    console.log('🔍 DEBUG: Datos extraídos:', { sexo, edad, peso, altura, cintura, cuello, cadera })
    
    if (!edad || !peso || !altura || !cintura || !cuello) {
      alert('Por favor completa todos los campos')
      return
    }
    
    if (sexo === 'femenino' && !cadera) {
      alert('Para mujeres es necesario ingresar la medida de cadera')
      return
    }

    // Convertir a números para asegurar cálculos correctos
    const pesoNum = parseFloat(peso)
    const alturaNum = parseFloat(altura)
    const cinturaNum = parseFloat(cintura)  
    const cuelloNum = parseFloat(cuello)
    const caderaNum = parseFloat(cadera)
    const edadNum = parseFloat(edad)
    
    console.log('🔢 DEBUG: Valores numéricos:', {
      sexo, 
      edad: edadNum,
      peso: pesoNum, 
      altura: alturaNum, 
      cintura: cinturaNum, 
      cuello: cuelloNum, 
      cadera: caderaNum
    })

    // Calcular IMC usando valores numéricos
    const alturaM = alturaNum / 100
    const imc = (pesoNum / (alturaM * alturaM)).toFixed(1)

    // Calcular porcentaje de grasa corporal usando la fórmula del US Navy
    let bodyFat
    if (sexo === 'masculino') {
      bodyFat = 495 / (1.0324 - 0.19077 * Math.log10(cinturaNum - cuelloNum) + 0.15456 * Math.log10(alturaNum)) - 450
      console.log('🔢 DEBUG Masculino:', { cintura: cinturaNum, cuello: cuelloNum, altura: alturaNum })
    } else {
      // Fórmula oficial US Navy para mujeres (Hodgdon & Beckett, 1984)
      const suma = cinturaNum + caderaNum - cuelloNum
      bodyFat = 163.205 * Math.log10(suma) - 97.684 * Math.log10(alturaNum) - 78.387
      console.log('🔢 DEBUG Femenino:', { 
        cintura: cinturaNum, 
        cadera: caderaNum, 
        cuello: cuelloNum, 
        altura: alturaNum, 
        suma: suma,
        log10_suma: Math.log10(suma),
        log10_altura: Math.log10(alturaNum),
        bodyFat_raw: bodyFat
      })
    }

    // Aplicar solo límite inferior realista; sin límite superior para que refleje cambios grandes
    bodyFat = Math.max(sexo === 'masculino' ? 3 : 8, bodyFat)

    // Calcular masa muscular estimada usando valores numéricos
    const masaGrasa = (pesoNum * bodyFat / 100).toFixed(1)
    const masaMagra = (pesoNum - masaGrasa).toFixed(1)

    // Calcular agua corporal (estimación: 60% para hombres, 55% para mujeres)
    const aguaCorporal = sexo === 'masculino' ? 60 : 55

    // Calcular metabolismo basal usando la fórmula Harris-Benedict con valores numéricos
    let metabolismoBasal
    if (sexo === 'masculino') {
      metabolismoBasal = 88.362 + (13.397 * pesoNum) + (4.799 * alturaNum) - (5.677 * edadNum)
    } else {
      metabolismoBasal = 447.593 + (9.247 * pesoNum) + (3.098 * alturaNum) - (4.330 * edadNum)
    }

    const results = {
      imc: parseFloat(imc),
      porcentaje_grasa: parseFloat(bodyFat.toFixed(1)),
      masa_grasa: parseFloat(masaGrasa),
      masa_magra: parseFloat(masaMagra),
      agua_corporal: aguaCorporal,
      metabolismo_basal: Math.round(metabolismoBasal)
    }

    console.log('🧮 Calculadora - Resultados generados:', results)
    console.log('📊 Detalles del cálculo:')
    console.log('  - Sexo:', sexo)
    console.log('  - Peso:', peso, 'kg')
    console.log('  - Altura:', altura, 'cm') 
    console.log('  - Cintura:', cintura, 'cm')
    console.log('  - Cuello:', cuello, 'cm')
    if (sexo === 'femenino') console.log('  - Cadera:', cadera, 'cm')
    console.log('  - % Grasa calculado:', bodyFat.toFixed(1), '%')
    console.log('  - Masa grasa:', masaGrasa, 'kg')
    console.log('  - Masa magra:', masaMagra, 'kg')

    onCalculate(results)
    
    // Resetear formulario después de calcular para siguiente uso
    setFormData({
      sexo: userProfile?.sexo || 'masculino',
      edad: userProfile?.edad || '',
      peso: userProfile?.peso || '',
      altura: userProfile?.altura || '',
      cintura: userProfile?.cintura || '',
      cuello: userProfile?.cuello || '',
      cadera: userProfile?.cadera || ''
    })
    
    onClose()
  }

  const handleReset = () => {
    // Resetear a los valores originales del perfil
    setFormData({
      sexo: userProfile?.sexo || 'masculino',
      edad: userProfile?.edad || '',
      peso: userProfile?.peso || '',
      altura: userProfile?.altura || '',
      cintura: userProfile?.cintura || '',
      cuello: userProfile?.cuello || '',
      cadera: userProfile?.cadera || ''
    })
    console.log('🔄 Formulario reseteado a valores del perfil')
  }

  const handleCancel = () => {
    handleReset()
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
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="text-gray-400 hover:text-yellow-400 transition-colors"
                title="Resetear formulario"
              >
                <RotateCcw size={18} />
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
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

          {/* Mostrar campo de cadera solo para mujeres */}
          {formData.sexo === 'femenino' && (
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Cadera (cm) *</label>
                <input
                  type="number"
                  value={formData.cadera}
                  onChange={(e) => handleInputChange('cadera', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
                  placeholder="95.0"
                  min="70"
                  max="150"
                  step="0.1"
                />
                <p className="text-xs text-gray-500 mt-1">Requerido para el cálculo correcto en mujeres</p>
              </div>
            </div>
          )}

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
