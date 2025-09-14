import jwt from 'jsonwebtoken';

const JWT_SECRET = 'entrenaconjwtsecret2024supersecure';

// Crear un token JWT válido para pruebas - usando usuario real de la BD
const testUser = {
  id: 14,  // Usuario "Test" que existe en la BD
  userId: 14,
  email: 'test@test.com'
};

const token = jwt.sign(testUser, JWT_SECRET, { expiresIn: '1h' });

console.log('🔑 Token generado:', token.substring(0, 50) + '...');

// Probar el endpoint
async function testEndpoint() {
  try {
    console.log('\n📡 Probando endpoint /api/calistenia-specialist/generate-plan...');
    console.log('🔧 Usando usuario ID: 14 (test@test.com)');

    const response = await fetch('http://localhost:3004/api/calistenia-specialist/generate-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        userProfile: { id: 14 },  // ID del usuario real
        selectedLevel: 'basico',
        goals: 'Mejorar mi condición física general',
        exercisePreferences: []
      })
    });

    console.log('📊 Status:', response.status);

    const data = await response.text();
    console.log('\n📝 Respuesta:');

    try {
      const jsonData = JSON.parse(data);
      console.log(JSON.stringify(jsonData, null, 2));

      if (jsonData.error) {
        console.log('\n⚠️ Error detectado:', jsonData.error);
        if (jsonData.message) {
          console.log('📌 Mensaje:', jsonData.message);
        }
        if (jsonData.details) {
          console.log('📋 Detalles:', jsonData.details);
        }
      }
    } catch {
      console.log(data);
    }

    if (response.status === 500) {
      console.log('\n❌ ERROR 500 DETECTADO - El backend está devolviendo un error interno');
    }

  } catch (error) {
    console.error('❌ Error en la petición:', error);
  }
}

testEndpoint();