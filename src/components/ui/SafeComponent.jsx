/**
 * 🛡️ Safe Component - Wrapper para proteger componentes individuales
 * 
 * RAZONAMIENTO:
 * - Wrapper funcional fácil de usar para proteger componentes específicos
 * - Error boundaries más granulares para mejor UX
 * - Fallback personalizable según el contexto
 */

import ErrorBoundary from './ErrorBoundary';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from './alert';

/**
 * Wrapper para proteger componentes críticos con Error Boundary
 */
const SafeComponent = ({ 
  children, 
  context = 'Componente',
  fallback = null,
  showMinimalError = false 
}) => {
  // Fallback mínimo para errores en componentes pequeños
  const MinimalErrorFallback = () => (
    <Alert className="border-red-500/20 bg-red-500/10">
      <AlertTriangle className="h-4 w-4 text-red-400" />
      <AlertDescription className="text-red-400">
        Error cargando {context.toLowerCase()}
      </AlertDescription>
    </Alert>
  );

  // Si se especifica un fallback personalizado, usarlo
  if (fallback) {
    return (
      <ErrorBoundary 
        context={context}
        title={`Error en ${context}`}
        message="Este componente no se pudo cargar correctamente."
      >
        {children}
      </ErrorBoundary>
    );
  }

  // Si se pide error mínimo, usar el fallback pequeño
  if (showMinimalError) {
    return (
      <ErrorBoundary 
        context={context}
        title=""
        message=""
      >
        {children}
      </ErrorBoundary>
    );
  }

  // Error boundary completo por defecto
  return (
    <ErrorBoundary 
      context={context}
      title={`Error en ${context}`}
      message="Este componente encontró un problema. Puedes intentar recargarlo o continuar navegando."
      showStack={import.meta.env.MODE === 'development'}
    >
      {children}
    </ErrorBoundary>
  );
};

export default SafeComponent;