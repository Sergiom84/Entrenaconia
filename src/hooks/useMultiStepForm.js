import { useState, useEffect, useMemo } from 'react';

const STORAGE_KEY = 'register_form_progress';

const STEP_VALIDATION_RULES = {
  0: { // BasicInfoStep
    required: ['nombre', 'apellido', 'email', 'password'],
    validation: {
      email: {
        pattern: /\S+@\S+\.\S+/,
        message: 'Email no válido'
      },
      password: {
        minLength: 6,
        message: 'Contraseña debe tener al menos 6 caracteres'
      }
    }
  },
  1: { // PersonalDataStep
    required: ['edad', 'sexo', 'peso', 'altura'],
    validation: {
      edad: {
        min: 13,
        max: 100,
        message: 'Edad debe estar entre 13 y 100 años'
      },
      peso: {
        min: 30,
        max: 300,
        message: 'Peso debe estar entre 30 y 300 kg'
      },
      altura: {
        min: 120,
        max: 250,
        message: 'Altura debe estar entre 120 y 250 cm'
      }
    }
  },
  2: { // HealthInfoStep - Opcional
    required: [],
    validation: {}
  },
  3: { // GoalsStep
    required: ['objetivoPrincipal', 'enfoqueEntrenamiento'],
    validation: {}
  }
};

export const useMultiStepForm = (initialData = {}, steps = []) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(() => {
    // Cargar datos desde localStorage si existen
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        return { ...initialData, ...JSON.parse(savedData) };
      } catch (error) {
        console.warn('Error loading saved form data:', error);
        return initialData;
      }
    }
    return initialData;
  });
  const [stepErrors, setStepErrors] = useState({});

  // Guardar progreso en localStorage cada vez que cambian los datos
  useEffect(() => {
    if (Object.keys(formData).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    }
  }, [formData]);

  const handleInputChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Limpiar errores del campo cuando cambia
    if (stepErrors[currentStep]?.[name]) {
      setStepErrors(prev => ({
        ...prev,
        [currentStep]: {
          ...prev[currentStep],
          [name]: ''
        }
      }));
    }
  };

  const validateStep = (stepIndex = currentStep) => {
    const rules = STEP_VALIDATION_RULES[stepIndex];
    if (!rules) return { isValid: true, errors: {} };

    const errors = {};

    // Validar campos requeridos
    rules.required.forEach(field => {
      if (!formData[field] || formData[field].toString().trim() === '') {
        errors[field] = 'Este campo es requerido';
      }
    });

    // Validaciones específicas
    Object.entries(rules.validation).forEach(([field, rule]) => {
      const value = formData[field];

      if (value) {
        // Validación de patrón (email)
        if (rule.pattern && !rule.pattern.test(value)) {
          errors[field] = rule.message;
        }

        // Validación de longitud mínima
        if (rule.minLength && value.length < rule.minLength) {
          errors[field] = rule.message;
        }

        // Validación de rango numérico
        if (rule.min !== undefined || rule.max !== undefined) {
          const numValue = parseFloat(value);
          if (isNaN(numValue) ||
              (rule.min !== undefined && numValue < rule.min) ||
              (rule.max !== undefined && numValue > rule.max)) {
            errors[field] = rule.message;
          }
        }
      }
    });

    const isValid = Object.keys(errors).length === 0;

    setStepErrors(prev => ({
      ...prev,
      [stepIndex]: errors
    }));

    return { isValid, errors };
  };

  const canGoNext = useMemo(() => {
    return currentStep < steps.length - 1;
  }, [currentStep, steps.length]);

  const canGoPrevious = useMemo(() => {
    return currentStep > 0;
  }, [currentStep]);

  const handleNext = () => {
    const { isValid } = validateStep();
    if (isValid && canGoNext) {
      setCurrentStep(prev => prev + 1);
      return true;
    }
    return false;
  };

  const handlePrevious = () => {
    if (canGoPrevious) {
      setCurrentStep(prev => prev - 1);
      return true;
    }
    return false;
  };

  const goToStep = (stepIndex) => {
    if (stepIndex >= 0 && stepIndex < steps.length) {
      setCurrentStep(stepIndex);
    }
  };

  const validateAllSteps = () => {
    let allValid = true;
    const allErrors = {};

    for (let i = 0; i < steps.length; i++) {
      const { isValid, errors } = validateStep(i);
      if (!isValid) {
        allValid = false;
        allErrors[i] = errors;
      }
    }

    if (!allValid) {
      setStepErrors(allErrors);
    }

    return { isValid: allValid, errors: allErrors };
  };

  const clearFormData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setFormData(initialData);
    setStepErrors({});
    setCurrentStep(0);
  };

  const resetStep = (stepIndex = currentStep) => {
    setStepErrors(prev => ({
      ...prev,
      [stepIndex]: {}
    }));
  };

  return {
    // Estado
    currentStep,
    formData,
    stepErrors: stepErrors[currentStep] || {},
    allStepErrors: stepErrors,

    // Navegación
    canGoNext,
    canGoPrevious,
    handleNext,
    handlePrevious,
    goToStep,

    // Datos
    handleInputChange,

    // Validación
    validateStep,
    validateAllSteps,
    resetStep,

    // Utilidades
    clearFormData,

    // Información del progreso
    progress: ((currentStep + 1) / steps.length) * 100,
    isLastStep: currentStep === steps.length - 1,
    isFirstStep: currentStep === 0
  };
};