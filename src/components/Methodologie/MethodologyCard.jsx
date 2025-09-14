/**
 * MethodologyCard - Arquitectura Modular Profesional v2.0
 * Componente para mostrar tarjetas de metodologías con consistencia visual
 * Refactorizado con patrones arquitecturales y sistema de tema centralizado
 *
 * @author Claude Code - Arquitectura Modular Profesional
 * @version 2.0.0 - Professional Standards & Theme System
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';

// Configuraciones centralizadas
const METHODOLOGY_CARD_CONFIG = {
  THEME: {
    PRIMARY: 'yellow-400',
    SECONDARY: 'gray-300',
    BACKGROUND: 'black/80',
    BORDER: {
      DEFAULT: 'gray-700',
      HOVER: 'yellow-400/60',
      INACTIVE: 'gray-600'
    },
    TEXT: {
      PRIMARY: 'white',
      SECONDARY: 'gray-400',
      MUTED: 'gray-500'
    }
  },
  ANIMATION: {
    TRANSITION: 'transition-all duration-300',
    HOVER_SCALE: 'hover:scale-[1.01]'
  },
  SPACING: {
    CARD_PADDING: 'pb-3',
    CONTENT_GAP: 'space-y-3',
    BUTTON_GAP: 'gap-2 pt-2'
  }
};

// Utilidades de validación y helpers
const MethodologyCardUtils = {
  validateMethodology(methodology) {
    if (!methodology || typeof methodology !== 'object') {
      console.warn('[MethodologyCard] Invalid methodology object provided');
      return false;
    }

    const requiredFields = ['name', 'level', 'description', 'frequency', 'volume', 'intensity'];
    const missingFields = requiredFields.filter(field => !methodology[field]);

    if (missingFields.length > 0) {
      console.warn('[MethodologyCard] Missing required fields:', missingFields);
      return false;
    }

    return true;
  },

  sanitizeProps({ methodology, manualActive, onDetails, onSelect }) {
    return {
      methodology: methodology || {},
      manualActive: Boolean(manualActive),
      onDetails: typeof onDetails === 'function' ? onDetails : () => {},
      onSelect: typeof onSelect === 'function' ? onSelect : () => {}
    };
  },

  getCardStyles(manualActive) {
    const { THEME, ANIMATION } = METHODOLOGY_CARD_CONFIG;

    return `bg-${THEME.BACKGROUND} border-${THEME.BORDER.DEFAULT} ${ANIMATION.TRANSITION}
      ${manualActive
        ? `cursor-pointer hover:border-${THEME.BORDER.HOVER} ${ANIMATION.HOVER_SCALE}`
        : `hover:border-${THEME.BORDER.INACTIVE}`}`;
  },

  getButtonStyles(manualActive) {
    const { THEME } = METHODOLOGY_CARD_CONFIG;

    return {
      details: `flex-1 border-${THEME.BORDER.INACTIVE} text-${THEME.SECONDARY} hover:bg-gray-800 hover:text-${THEME.TEXT.PRIMARY}`,
      select: manualActive
        ? `flex-1 bg-${THEME.PRIMARY} text-black hover:bg-yellow-300`
        : `flex-1 bg-gray-700 text-gray-400 cursor-not-allowed`
    };
  }
};

export default function MethodologyCard(props) {
  // Validar y sanitizar props
  const { methodology, manualActive, onDetails, onSelect } = MethodologyCardUtils.sanitizeProps(props);

  // Validar estructura de metodología
  if (!MethodologyCardUtils.validateMethodology(methodology)) {
    return (
      <Card className={`bg-red-900/20 border-red-500/50`}>
        <CardContent className="p-4">
          <p className="text-red-400 text-sm">Error: Datos de metodología inválidos</p>
        </CardContent>
      </Card>
    );
  }

  const Icon = methodology.icon;
  const cardStyles = MethodologyCardUtils.getCardStyles(manualActive);
  const buttonStyles = MethodologyCardUtils.getButtonStyles(manualActive);

  // Componentes modulares internos
  const MethodologyHeader = () => (
    <CardHeader className={METHODOLOGY_CARD_CONFIG.SPACING.CARD_PADDING}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {Icon && <Icon className={`w-7 h-7 text-${METHODOLOGY_CARD_CONFIG.THEME.PRIMARY}`} />}
          <CardTitle className={`text-${METHODOLOGY_CARD_CONFIG.THEME.TEXT.PRIMARY} text-xl`}>
            {methodology.name}
          </CardTitle>
        </div>
        <span className={`text-xs px-2 py-1 border border-${METHODOLOGY_CARD_CONFIG.THEME.BORDER.INACTIVE} text-${METHODOLOGY_CARD_CONFIG.THEME.SECONDARY} rounded`}>
          {methodology.level}
        </span>
      </div>
      <CardDescription className={`text-${METHODOLOGY_CARD_CONFIG.THEME.TEXT.SECONDARY} mt-2`}>
        {methodology.description}
      </CardDescription>
    </CardHeader>
  );

  const MethodologyDetails = () => {
    const details = [
      { label: 'Frecuencia', value: methodology.frequency },
      { label: 'Volumen', value: methodology.volume },
      { label: 'Intensidad', value: methodology.intensity }
    ];

    return (
      <div className={METHODOLOGY_CARD_CONFIG.SPACING.CONTENT_GAP}>
        {details.map(({ label, value }) => (
          <div key={label} className="flex justify-between text-sm">
            <span className={`text-${METHODOLOGY_CARD_CONFIG.THEME.TEXT.MUTED}`}>{label}:</span>
            <span className={`text-${METHODOLOGY_CARD_CONFIG.THEME.TEXT.PRIMARY}`}>{value}</span>
          </div>
        ))}
      </div>
    );
  };

  const MethodologyActions = () => (
    <div className={`flex ${METHODOLOGY_CARD_CONFIG.SPACING.BUTTON_GAP}`}>
      <Button
        variant="outline"
        className={buttonStyles.details}
        onClick={(e) => {
          e.stopPropagation();
          onDetails(methodology);
        }}
        aria-label={`Ver detalles de ${methodology.name}`}
      >
        Ver Detalles
      </Button>
      <Button
        disabled={!manualActive}
        className={buttonStyles.select}
        onClick={(e) => {
          e.stopPropagation();
          if (manualActive) onSelect(methodology);
        }}
        aria-label={`Seleccionar metodología ${methodology.name}`}
      >
        Seleccionar Metodología
      </Button>
    </div>
  );

  return (
    <Card
      className={cardStyles}
      onClick={() => manualActive && onSelect(methodology)}
      role="button"
      tabIndex={manualActive ? 0 : -1}
      aria-label={`Tarjeta de metodología ${methodology.name}`}
    >
      <MethodologyHeader />
      <CardContent className={METHODOLOGY_CARD_CONFIG.SPACING.CONTENT_GAP}>
        <MethodologyDetails />
        <MethodologyActions />
      </CardContent>
    </Card>
  );
}
