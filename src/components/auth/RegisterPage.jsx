import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { User, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import BasicInfoStep from './steps/BasicInfoStep';
import PersonalDataStep from './steps/PersonalDataStep';
import HealthInfoStep from './steps/HealthInfoStep';
import GoalsStep from './steps/GoalsStep';
import SuccessPopup from '../ui/SuccessPopup';
import ErrorPopup from '../ui/ErrorPopup';
import { useAuth } from '../../contexts/AuthContext';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorPopup, setErrorPopup] = useState({ show: false, message: '', title: '' });
  const [formData, setFormData] = useState({
    // Información básica (simplificada)
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    
    // Datos personales
    edad: '',
    sexo: '',
    peso: '',
    altura: '',
    
    // Experiencia en entrenamiento
    nivelEntrenamiento: '',
    anosEntrenando: '',
    frecuenciaSemanal: '',
    metodologiaPreferida: '',
    nivelActividad: '',
    
    // Medidas corporales (opcional)
    cintura: '',
    pecho: '',
    brazos: '',
    muslos: '',
    cuello: '',
    antebrazos: '',
    
    // Información de salud (opcional)
    historialMedico: '',
    limitacionesFisicas: '',
    alergias: '',
    medicamentos: '',
    
    // Metas y objetivos
    objetivoPrincipal: '',
    metaPeso: '',
    metaGrasaCorporal: '',
    enfoqueEntrenamiento: '',
    horarioPreferido: '',
    comidasPorDia: '',
    suplementacion: '',
    alimentosExcluidos: ''
  });

  const steps = [
    { title: 'Básicos', component: BasicInfoStep },
    { title: 'Composición', component: PersonalDataStep },
    { title: 'Salud', component: HealthInfoStep },
    { title: 'Objetivos', component: GoalsStep }
  ];

  const handleInputChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('http://localhost:3001/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        // Mostrar error específico del backend
        setErrorPopup({
          show: true,
          title: 'Error en el registro',
          message: data.error || 'Hubo un problema al registrar tu cuenta. Por favor, intenta nuevamente.'
        });
        return;
      }

      // Registro exitoso - hacer login automático
      console.log('Usuario registrado:', data);
      if (data.token && data.user) {
        login(data.user, data.token);
        navigate('/');
      } else {
        setShowSuccessPopup(true);
      }

    } catch (error) {
      console.error('Error al registrar usuario:', error);

      // Si el backend no está disponible, simular registro exitoso
      console.log('Backend no disponible, simulando registro exitoso:', formData);
      const testUser = {
        id: 1,
        nombre: formData.nombre,
        apellido: formData.apellido,
        email: formData.email
      };
      login(testUser, 'test-token');
      navigate('/');

    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessPopup(false);
    navigate('/login');
  };

  const CurrentStepComponent = steps[currentStep].component;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-4xl"
      >
        {/* Header con pestañas */}
        <div className="mb-8">
          <div className="flex rounded-xl overflow-hidden border border-yellow-400/20">
            <button
              onClick={() => navigate('/login')}
              className="flex-1 bg-[#0d1522] text-gray-300 py-3 px-6 font-semibold hover:bg-yellow-400/10 transition-colors"
            >
              Iniciar Sesión
            </button>
            <button className="flex-1 bg-yellow-400 text-[#0b1220] py-3 px-6 font-semibold flex items-center justify-center gap-2 transition-colors">
              <User size={18} />
              Registrarse
            </button>
          </div>

          {/* Subtítulo */}
          <div className="text-center mt-4">
            <p className="text-gray-300 text-lg font-semibold">Tu entrenador personal con inteligencia artificial</p>
          </div>
        </div>

        {/* Indicador de pasos */}
        <div className="mb-8">
          <div className="flex justify-center space-x-4">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  index === currentStep
                    ? 'bg-yellow-400 text-[#0b1220]'
                    : index < currentStep
                    ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/40'
                    : 'bg-[#0d1522] text-gray-300 border border-yellow-400/20'
                }`}
              >
                {step.title}
              </div>
            ))}
          </div>
        </div>

        {/* Contenido del formulario */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="bg-[#0d1522] rounded-xl p-6 sm:p-8 border border-yellow-400/20"
        >
          <CurrentStepComponent
            formData={formData}
            onInputChange={handleInputChange}
          />

          {/* Botones de navegación */}
          <div className="flex justify-between mt-8">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="flex items-center gap-2 px-6 py-3 bg-[#0d1522] text-gray-100 rounded-lg hover:bg-yellow-400/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-yellow-400/20 font-semibold"
            >
              <ArrowLeft size={18} />
              Anterior
            </button>

            {currentStep === steps.length - 1 ? (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    Guardar Perfil
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-3 bg-yellow-400 text-[#0b1220] rounded-lg hover:bg-yellow-300 transition-colors font-semibold"
              >
                Siguiente
                <ArrowRight size={18} />
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Popup de Éxito */}
      <SuccessPopup
        show={showSuccessPopup}
        title="¡Registro Exitoso!"
        message="Se ha registrado correctamente. Ahora puedes iniciar sesión con tus credenciales."
        onClose={handleSuccessClose}
        onContinue={handleSuccessClose}
      />

      {/* Popup de Error */}
      <ErrorPopup
        show={errorPopup.show}
        title={errorPopup.title}
        message={errorPopup.message}
        onClose={() => setErrorPopup({ show: false, message: '', title: '' })}
      />
    </div>
  );
};

export default RegisterPage;
