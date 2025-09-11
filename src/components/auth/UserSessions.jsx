import React, { useState, useEffect } from 'react';
import { Monitor, Smartphone, Globe, LogOut, Shield, Clock, MapPin } from 'lucide-react';

const UserSessions = () => {
  const [activeSessions, setActiveSessions] = useState([]);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [sessionStats, setSessionStats] = useState(null);
  const [activeTab, setActiveTab] = useState('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

  // Obtener token del localStorage
  const getAuthToken = () => {
    return localStorage.getItem('token');
  };

  // Headers para requests autenticadas
  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${getAuthToken()}`,
    'Content-Type': 'application/json'
  });

  // Cargar datos de sesiones
  useEffect(() => {
    loadSessionData();
  }, [activeTab]);

  const loadSessionData = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();

      // Cargar datos según la pestaña activa
      if (activeTab === 'active') {
        const response = await fetch(`${API_BASE}/auth/sessions`, { headers });
        if (response.ok) {
          const data = await response.json();
          setActiveSessions(data.activeSessions || []);
        }
      } else if (activeTab === 'history') {
        const response = await fetch(`${API_BASE}/auth/sessions/history?limit=20`, { headers });
        if (response.ok) {
          const data = await response.json();
          setSessionHistory(data.sessions || []);
        }
      } else if (activeTab === 'stats') {
        const response = await fetch(`${API_BASE}/auth/sessions/stats`, { headers });
        if (response.ok) {
          const data = await response.json();
          setSessionStats(data.stats);
        }
      }

    } catch (err) {
      setError('Error cargando datos de sesiones: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Cerrar todas las sesiones
  const logoutAllSessions = async () => {
    if (!confirm('¿Estás seguro de que quieres cerrar todas las sesiones activas? Esto te desconectará de todos los dispositivos.')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/sessions/logout-all`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason: 'user_requested' })
      });

      if (response.ok) {
        const data = await response.json();
        alert(`${data.closedSessions} sesiones cerradas. Serás redirigido al login.`);
        
        // Limpiar localStorage y redirigir
        localStorage.removeItem('token');
        window.location.href = '/login';
      } else {
        throw new Error('Error cerrando sesiones');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Formatear duración
  const formatDuration = (duration) => {
    if (!duration) return 'Activa';
    
    const match = duration.match(/(\d+):(\d+):(\d+)/);
    if (match) {
      const hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes}m`;
    }
    return duration;
  };

  // Obtener icono de dispositivo
  const getDeviceIcon = (deviceInfo) => {
    try {
      const info = typeof deviceInfo === 'string' ? JSON.parse(deviceInfo) : deviceInfo;
      const platform = info?.userAgent?.platform?.toLowerCase() || '';
      const mobile = info?.userAgent?.mobile;

      if (mobile || platform.includes('android') || platform.includes('ios')) {
        return <Smartphone className="h-4 w-4" />;
      }
      return <Monitor className="h-4 w-4" />;
    } catch {
      return <Monitor className="h-4 w-4" />;
    }
  };

  // Obtener información de dispositivo legible
  const getDeviceInfo = (deviceInfo) => {
    try {
      const info = typeof deviceInfo === 'string' ? JSON.parse(deviceInfo) : deviceInfo;
      const ua = info?.userAgent || {};
      
      const platform = ua.platform || 'Unknown';
      const browser = ua.browser || 'Unknown';
      const version = ua.version || '';

      return `${platform} - ${browser}${version ? ` ${version}` : ''}`;
    } catch {
      return 'Información no disponible';
    }
  };

  // Obtener estado de logout
  const getLogoutTypeLabel = (logoutType) => {
    const types = {
      'manual': 'Manual',
      'timeout': 'Timeout',
      'forced': 'Forzado',
      'system': 'Sistema'
    };
    return types[logoutType] || 'Desconocido';
  };

  // Renderizar pestañas
  const renderTabs = () => (
    <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-6">
      {[
        { key: 'active', label: 'Sesiones Activas', count: activeSessions.length },
        { key: 'history', label: 'Historial', count: sessionHistory.length },
        { key: 'stats', label: 'Estadísticas' }
      ].map(tab => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === tab.key
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-2 bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );

  // Renderizar sesiones activas
  const renderActiveSessions = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Sesiones Activas</h3>
        {activeSessions.length > 1 && (
          <button
            onClick={logoutAllSessions}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar Todas
          </button>
        )}
      </div>

      {activeSessions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No hay sesiones activas</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {activeSessions.map((session, index) => (
            <div key={session.sessionId || index} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    {getDeviceIcon(session.deviceInfo)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {getDeviceInfo(session.deviceInfo)}
                    </p>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                      <div className="flex items-center">
                        <Globe className="h-3 w-3 mr-1" />
                        {session.ipAddress}
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        Desde: {new Date(session.loginTime).toLocaleString()}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Última actividad: {new Date(session.lastActivity).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5"></div>
                    Activa
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    Duración: {formatDuration(session.sessionAge)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Renderizar historial
  const renderHistory = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Historial de Sesiones</h3>
      
      {sessionHistory.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No hay historial disponible</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessionHistory.map((session, index) => (
            <div key={session.session_id || index} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-gray-50 rounded-lg">
                    {getDeviceIcon(session.user_agent_info)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center text-gray-600">
                        <Globe className="h-3 w-3 mr-1" />
                        {session.ip_address}
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(session.login_time).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {session.login_time && `Login: ${new Date(session.login_time).toLocaleTimeString()}`}
                      {session.logout_time && ` - Logout: ${new Date(session.logout_time).toLocaleTimeString()}`}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    session.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {session.is_active ? 'Activa' : getLogoutTypeLabel(session.logout_type)}
                  </span>
                  {session.duration_seconds && (
                    <p className="text-xs text-gray-500 mt-1">
                      {Math.round(session.duration_seconds / 60)} minutos
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Renderizar estadísticas
  const renderStats = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Estadísticas de Sesiones</h3>
      
      {!sessionStats ? (
        <div className="text-center py-8 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Cargando estadísticas...</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="text-sm font-medium text-gray-900 mb-4">Resumen General</h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total de sesiones:</span>
                <span className="font-medium">{sessionStats.total_sessions || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sesiones activas:</span>
                <span className="font-medium text-green-600">{sessionStats.active_sessions || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">IPs únicas:</span>
                <span className="font-medium">{sessionStats.unique_ips || 0}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="text-sm font-medium text-gray-900 mb-4">Actividad</h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Último login:</span>
                <span className="font-medium">
                  {sessionStats.last_login ? new Date(sessionStats.last_login).toLocaleString() : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Duración promedio:</span>
                <span className="font-medium">
                  {sessionStats.avg_session_duration ? formatDuration(sessionStats.avg_session_duration) : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Dispositivo preferido:</span>
                <span className="font-medium">{sessionStats.most_used_device || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <Shield className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Gestión de Sesiones</h2>
        <p className="text-gray-600">Administra tus sesiones activas y revisa tu historial de acceso</p>
      </div>

      {renderTabs()}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      ) : (
        <div>
          {activeTab === 'active' && renderActiveSessions()}
          {activeTab === 'history' && renderHistory()}
          {activeTab === 'stats' && renderStats()}
        </div>
      )}
    </div>
  );
};

export default UserSessions;