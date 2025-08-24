# 🔄 Flujo de Datos Completo

## 📊 Diagrama de Flujo de Datos

```
┌─────────────────┐
│    Usuario      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  React Frontend │
│   (Cliente)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Express Server │
│    (Backend)    │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│Supabase│ │OpenAI  │
│   DB   │ │  API   │
└────────┘ └────────┘
```

## 🔗 Flujo Detallado: Usuario → IA → Respuesta

### 1. Inicio de Sesión y Carga de Perfil

```javascript
// Frontend: App.tsx
const initializeUser = async () => {
  // 1. Verificar sesión existente
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    // 2. Cargar perfil del usuario
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    // 3. Almacenar en estado global
    setUserProfile(profile);
    
    // 4. Cargar datos adicionales
    await Promise.all([
      loadTrainingHistory(session.user.id),
      loadNutritionData(session.user.id),
      loadActiveTrainingPlan(session.user.id)
    ]);
  }
};
```

### 2. Solicitud de Plan de Entrenamiento

```javascript
// Frontend: EntrenamientoCasa.tsx
const requestTrainingPlan = async () => {
  // 1. Recopilar contexto del usuario
  const userContext = {
    profile: userProfile,
    availableTime: selectedTime,
    equipment: selectedEquipment,
    preferences: userPreferences,
    recentWorkouts: recentWorkouts
  };
  
  // 2. Enviar al backend
  const response = await fetch('/api/generate-training-plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(userContext)
  });
  
  const plan = await response.json();
  
  // 3. Guardar plan en base de datos
  await savePlanToDatabase(plan);
  
  // 4. Actualizar UI
  setCurrentPlan(plan);
};
```

### 3. Procesamiento en Backend

```javascript
// Backend: server/index.js
app.post('/api/generate-training-plan', authenticateUser, async (req, res) => {
  const { profile, availableTime, equipment, preferences, recentWorkouts } = req.body;
  
  // 1. Validar datos de entrada
  if (!validateUserData(req.body)) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  
  // 2. Obtener historial completo del usuario
  const { data: fullHistory } = await supabase
    .from('training_history')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(30);
  
  // 3. Analizar progreso y patrones
  const progressAnalysis = analyzeUserProgress(fullHistory);
  
  // 4. Construir prompt para OpenAI
  const systemPrompt = `
    Eres un entrenador personal experto. Crea un plan de entrenamiento considerando:
    
    PERFIL DEL USUARIO:
    - Edad: ${profile.edad} años
    - Peso: ${profile.peso} kg
    - Altura: ${profile.altura} cm
    - Nivel: ${profile.experiencia}
    - Objetivo: ${profile.objetivo}
    
    DISPONIBILIDAD:
    - Tiempo por sesión: ${availableTime} minutos
    - Equipamiento: ${equipment.join(', ') || 'Sin equipamiento'}
    
    HISTORIAL RECIENTE:
    ${recentWorkouts.map(w => `- ${w.date}: ${w.type} (${w.duration} min)`).join('\n')}
    
    ANÁLISIS DE PROGRESO:
    - Tendencia de peso: ${progressAnalysis.weightTrend}
    - Consistencia: ${progressAnalysis.consistency}%
    - Áreas fuertes: ${progressAnalysis.strengths.join(', ')}
    - Áreas a mejorar: ${progressAnalysis.weaknesses.join(', ')}
    
    Genera un plan de entrenamiento detallado para los próximos 7 días.
  `;
  
  // 5. Llamada a OpenAI
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Genera el plan de entrenamiento" }
    ],
    temperature: 0.7,
    max_tokens: 2000
  });
  
  // 6. Parsear respuesta de IA
  const aiResponse = completion.choices[0].message.content;
  const structuredPlan = parseAIPlan(aiResponse);
  
  // 7. Guardar plan en base de datos
  const { data: savedPlan, error } = await supabase
    .from('training_plans')
    .insert({
      user_id: req.user.id,
      plan_data: structuredPlan,
      created_at: new Date(),
      active: true
    });
  
  // 8. Enviar respuesta al frontend
  res.json({
    success: true,
    plan: structuredPlan,
    planId: savedPlan.id
  });
});
```

### 4. Chat con IA en Tiempo Real

```javascript
// Frontend: AIChat.tsx
const AIChatComponent = () => {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  
  const sendMessage = async (message) => {
    // 1. Añadir mensaje del usuario a la UI
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setIsTyping(true);
    
    // 2. Preparar contexto
    const context = {
      message,
      conversationHistory: messages.slice(-10), // Últimos 10 mensajes
      userProfile: userProfile,
      currentPlan: activePlan,
      recentActivity: {
        lastWorkout: lastWorkout,
        nutritionToday: todayNutrition
      }
    };
    
    // 3. Enviar al backend
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(context)
    });
    
    const { reply } = await response.json();
    
    // 4. Actualizar UI con respuesta
    setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    setIsTyping(false);
    
    // 5. Guardar conversación
    await saveConversation(messages);
  };
  
  return (
    <div className="chat-container">
      <MessageList messages={messages} isTyping={isTyping} />
      <MessageInput onSend={sendMessage} />
    </div>
  );
};
```

### 5. Sincronización de Datos

```javascript
// Servicio de sincronización
class DataSyncService {
  constructor(supabase, userId) {
    this.supabase = supabase;
    this.userId = userId;
    this.syncInterval = null;
  }
  
  // Sincronización automática cada 5 minutos
  startAutoSync() {
    this.syncInterval = setInterval(() => {
      this.syncAllData();
    
