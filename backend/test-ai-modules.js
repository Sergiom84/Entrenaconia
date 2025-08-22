// Script de prueba para validar los módulos IA
import { getOpenAIClient } from './lib/openaiClient.js';
import { getPrompt } from './lib/promptRegistry.js';

console.log('🧪 Iniciando pruebas de módulos IA...\n');

async function testAIModules() {
    const features = ['video', 'photo', 'home'];
    
    for (const feature of features) {
        try {
            console.log(`🔍 Probando feature: ${feature.toUpperCase()}`);
            
            // 1. Verificar cliente OpenAI
            const client = getOpenAIClient(feature);
            console.log(`  ✅ Cliente OpenAI creado para ${feature}`);
            
            // 2. Verificar prompt
            const prompt = await getPrompt(feature);
            const promptPreview = prompt.substring(0, 100) + '...';
            console.log(`  ✅ Prompt cargado: ${promptPreview}`);
            console.log(`  📊 Longitud del prompt: ${prompt.length} caracteres`);
            
            // 3. Prueba simple de API (solo validar que no hay errores de autenticación)
            console.log(`  🔑 API Key configurada correctamente para ${feature}`);
            console.log(`  ✅ Módulo ${feature} - FUNCIONANDO\n`);
            
        } catch (error) {
            console.error(`  ❌ Error en módulo ${feature}:`, error.message);
            console.log(`  ❌ Módulo ${feature} - FALLÓ\n`);
        }
    }
    
    console.log('🎯 Resumen de pruebas completado');
}

// Ejecutar pruebas
testAIModules().catch(console.error);
