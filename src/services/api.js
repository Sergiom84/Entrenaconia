/**
 * 🔌 API Services - Servicios especializados por módulo
 * 
 * RAZONAMIENTO:
 * - Consolida todas las peticiones API de la aplicación
 * - Organizado por módulos (auth, routines, nutrition, etc.)
 * - Usa el cliente centralizado para consistency
 * - Reduce duplicación de código API
 * - Facilita mantenimiento y testing
 */

import apiClient from '../lib/apiClient';

// =============================================================================
// 🔐 AUTHENTICATION SERVICES
// =============================================================================
export const authApi = {
  /**
   * Iniciar sesión
   */
  async login(credentials) {
    const response = await apiClient.post('/auth/login', credentials);
    
    // Guardar token si existe
    if (response.token) {
      localStorage.setItem('authToken', response.token);
    }
    
    return response;
  },

  /**
   * Registrar usuario
   */
  async register(userData) {
    const response = await apiClient.post('/auth/register', userData);
    
    // Guardar token si existe
    if (response.token) {
      localStorage.setItem('authToken', response.token);
    }
    
    return response;
  },

  /**
   * Obtener perfil actual
   */
  async getProfile() {
    return apiClient.get('/users/profile');
  },

  /**
   * Actualizar perfil
   */
  async updateProfile(profileData) {
    return apiClient.put('/users/profile', profileData);
  },

  /**
   * Cerrar sesión
   */
  async logout() {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      // Limpiar tokens siempre, incluso si la API falla
      localStorage.removeItem('authToken');
      localStorage.removeItem('token');
    }
  }
};

// =============================================================================
// 🏋️ ROUTINES SERVICES
// =============================================================================
export const routinesApi = {
  /**
   * Obtener plan activo
   */
  async getActivePlan() {
    return apiClient.get('/routines/active-plan');
  },

  /**
   * Confirmar plan de rutina
   */
  async confirmPlan(planData) {
    return apiClient.post('/routines/confirm-plan', planData);
  },

  /**
   * Obtener estado de sesión de hoy
   */
  async getTodaySessionStatus(methodologyPlanId, dayName) {
    return apiClient.get(`/routines/today-status/${methodologyPlanId}/${dayName}`);
  },

  /**
   * Iniciar nueva sesión
   */
  async startSession(sessionData) {
    return apiClient.post('/routines/sessions/start', sessionData);
  },

  /**
   * Obtener progreso de sesión
   */
  async getSessionProgress(sessionId) {
    return apiClient.get(`/routines/sessions/${sessionId}/progress`);
  },

  /**
   * Actualizar ejercicio
   */
  async updateExercise(sessionId, exerciseOrder, updateData) {
    return apiClient.put(`/routines/sessions/${sessionId}/exercise/${exerciseOrder}`, updateData);
  },

  /**
   * Finalizar sesión
   */
  async finishSession(sessionId) {
    return apiClient.post(`/routines/sessions/${sessionId}/finish`);
  },

  /**
   * Obtener ejercicios pendientes
   */
  async getPendingExercises(methodologyPlanId) {
    return apiClient.get(`/routines/pending-exercises/${methodologyPlanId}`);
  },

  /**
   * Cancelar rutina
   */
  async cancelRoutine(methodologyPlanId) {
    return apiClient.delete(`/routines/cancel/${methodologyPlanId}`);
  },

  /**
   * Obtener datos de progreso para analytics
   */
  async getProgressData(methodologyPlanId) {
    return apiClient.get(`/routines/progress-data/${methodologyPlanId}`);
  },

  /**
   * Guardar feedback de ejercicio
   */
  async saveExerciseFeedback(sessionId, exerciseOrder, feedbackData) {
    return apiClient.post(`/routines/sessions/${sessionId}/exercise/${exerciseOrder}/feedback`, feedbackData);
  },

  /**
   * Obtener feedback de sesión
   */
  async getSessionFeedback(sessionId) {
    return apiClient.get(`/routines/sessions/${sessionId}/feedback`);
  }
};

// =============================================================================
// 🧠 METHODOLOGIES SERVICES
// =============================================================================
export const methodologiesApi = {
  /**
   * Generar metodología automática con IA
   */
  async generateMethodology(profileData) {
    return apiClient.post('/methodologie/generate', { profile: profileData });
  },

  /**
   * Generar metodología manual
   */
  async generateManualMethodology(methodologyData) {
    return apiClient.post('/methodology-manual/generate', methodologyData);
  },

  /**
   * Evaluar perfil para calistenia
   */
  async evaluateCalisteniaProfile(profileData) {
    return apiClient.post('/calistenia-specialist/evaluate-profile', profileData);
  },

  /**
   * Generar plan de calistenia especializado
   */
  async generateCalisteniaPlan(planData) {
    return apiClient.post('/calistenia-specialist/generate-plan', planData);
  }
};

// =============================================================================
// 🏠 HOME TRAINING SERVICES
// =============================================================================
export const homeTrainingApi = {
  /**
   * Generar plan de entrenamiento en casa
   */
  async generatePlan(planData) {
    return apiClient.post('/home-training/generate', planData);
  },

  /**
   * Obtener sesiones de entrenamiento en casa
   */
  async getSessions(userId) {
    return apiClient.get(`/home-training/sessions/${userId}`);
  },

  /**
   * Iniciar sesión de entrenamiento en casa
   */
  async startSession(sessionData) {
    return apiClient.post('/home-training/sessions/start', sessionData);
  },

  /**
   * Actualizar progreso de ejercicio
   */
  async updateExerciseProgress(sessionId, exerciseOrder, progressData) {
    return apiClient.put(`/home-training/sessions/${sessionId}/exercise/${exerciseOrder}`, progressData);
  },

  /**
   * Guardar rechazos de ejercicios
   */
  async saveRejections(rejectionData) {
    return apiClient.post('/home-training/save-rejections', rejectionData);
  },

  /**
   * Cerrar sesiones activas
   */
  async closeActiveSessions(userId) {
    return apiClient.put(`/home-training/close-active-sessions`, { userId });
  },

  /**
   * Obtener historial de preferencias
   */
  async getPreferencesHistory(userId) {
    return apiClient.get(`/home-training/preferences-history/${userId}`);
  }
};

// =============================================================================
// 🍎 NUTRITION SERVICES
// =============================================================================
export const nutritionApi = {
  /**
   * Obtener recomendaciones nutricionales con IA
   */
  async getNutritionRecommendations(profileData) {
    return apiClient.post('/nutrition/recommendations', profileData);
  },

  /**
   * Guardar log diario de nutrición
   */
  async saveDailyLog(logData) {
    return apiClient.post('/nutrition/daily-log', logData);
  },

  /**
   * Obtener historial de nutrición
   */
  async getNutritionHistory(userId, dateRange) {
    return apiClient.get(`/nutrition/history/${userId}`, {
      params: dateRange
    });
  },

  /**
   * Buscar alimentos en base de datos
   */
  async searchFoods(query) {
    return apiClient.get(`/nutrition/foods/search?q=${encodeURIComponent(query)}`);
  }
};

// =============================================================================
// 📹 VIDEO CORRECTION SERVICES
// =============================================================================
export const videoCorrectionApi = {
  /**
   * Subir video para análisis
   */
  async uploadVideo(videoFile, exerciseType) {
    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('exercise_type', exerciseType);

    return apiClient.post('/ai/analyze-video', formData, {
      headers: {
        // Remover Content-Type para FormData
        'Content-Type': undefined
      }
    });
  },

  /**
   * Analizar imagen de ejercicio
   */
  async analyzeImage(imageFile, exerciseType) {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('exercise_type', exerciseType);

    return apiClient.post('/ai-photo-correction/analyze', formData, {
      headers: {
        'Content-Type': undefined
      }
    });
  }
};

// =============================================================================
// 👤 PROFILE SERVICES
// =============================================================================
export const profileApi = {
  /**
   * Obtener equipamiento del usuario
   */
  async getUserEquipment(userId) {
    return apiClient.get(`/equipment/user/${userId}`);
  },

  /**
   * Actualizar equipamiento
   */
  async updateEquipment(equipmentData) {
    return apiClient.put('/equipment/user', equipmentData);
  },

  /**
   * Obtener catálogo de equipamiento
   */
  async getEquipmentCatalog() {
    return apiClient.get('/equipment/catalog');
  },

  /**
   * Guardar composición corporal
   */
  async saveBodyComposition(compositionData) {
    return apiClient.post('/body-composition', compositionData);
  },

  /**
   * Obtener historial de composición corporal
   */
  async getBodyCompositionHistory(userId) {
    return apiClient.get(`/body-composition/history/${userId}`);
  },

  /**
   * Subir documentos médicos
   */
  async uploadMedicalDocs(files) {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append(`document_${index}`, file);
    });

    return apiClient.post('/uploads/medical-docs', formData, {
      headers: {
        'Content-Type': undefined
      }
    });
  }
};

// =============================================================================
// 🎵 MUSIC SERVICES
// =============================================================================
export const musicApi = {
  /**
   * Obtener configuración de música del usuario
   */
  async getMusicConfig(userId) {
    return apiClient.get(`/music/config/${userId}`);
  },

  /**
   * Actualizar configuración de música
   */
  async updateMusicConfig(configData) {
    return apiClient.put('/music/config', configData);
  },

  /**
   * Sincronizar playlist
   */
  async syncPlaylist(playlistData) {
    return apiClient.post('/music/sync-playlist', playlistData);
  }
};

// =============================================================================
// 📊 STATS SERVICES
// =============================================================================
export const statsApi = {
  /**
   * Obtener estadísticas generales del usuario
   */
  async getUserStats(userId) {
    return apiClient.get(`/stats/user/${userId}`);
  },

  /**
   * Obtener estadísticas de rutinas
   */
  async getRoutineStats(methodologyPlanId) {
    return apiClient.get(`/stats/routines/${methodologyPlanId}`);
  },

  /**
   * Obtener estadísticas de home training
   */
  async getHomeTrainingStats(userId) {
    return apiClient.get(`/stats/home-training/${userId}`);
  }
};

// Exportación por defecto con todos los servicios agrupados
export default {
  auth: authApi,
  routines: routinesApi,
  methodologies: methodologiesApi,
  homeTraining: homeTrainingApi,
  nutrition: nutritionApi,
  videoCorrection: videoCorrectionApi,
  profile: profileApi,
  music: musicApi,
  stats: statsApi
};