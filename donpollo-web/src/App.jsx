import { useEffect, useMemo, useState } from 'react';
import mqtt from 'mqtt';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BatteryCharging,
  Bell, CheckCircle2, ChevronDown, Cloud, Droplets, Gauge, Lightbulb,
  Radio, RefreshCw, Settings2, Thermometer, Wind, Zap, Fan, Calendar, Wheat
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';

//const MQTT_URL = 'ws://broker.hivemq.com:8000/mqtt';
const MQTT_URL = 'ws://192.168.4.4:9001/mqtt';
const MQTT_TOPIC = 'donpollo/markos_lote1/telemetria';
const MAX_HISTORY = 30;

// NUEVO: Matriz de Rangos Ideales por Semana de Vida del pollo (Ahora con alimento)
// Matriz de Rangos Ideales por Semana (AQUÍ ESTÁ LA CLAVE DEL ERROR)
const rangosSemanales = {
  1: { temperatura: [30, 32], humedad: [60, 70], amoniaco: [0, 10], calidad_aire: [400, 800], luminosidad: [20, 1000], alimento: [0.5, 5.0] },
  2: { temperatura: [28, 30], humedad: [60, 70], amoniaco: [0, 15], calidad_aire: [400, 900], luminosidad: [20, 1000], alimento: [1.0, 8.0] },
  3: { temperatura: [26, 28], humedad: [55, 65], amoniaco: [0, 20], calidad_aire: [400, 1000], luminosidad: [20, 1000], alimento: [1.5, 12.0] },
  4: { temperatura: [24, 26], humedad: [55, 65], amoniaco: [0, 25], calidad_aire: [400, 1000], luminosidad: [20, 1000], alimento: [2.0, 15.0] }
};

const metricDefinitions = [
  { key: 'temperatura', label: 'Temperatura', unit: '°C', icon: Thermometer, color: '#54e5b1', softColor: 'rgba(84,229,177,.16)', min: 15, max: 40, format: (v) => v.toFixed(1) },
  { key: 'humedad', label: 'Humedad relativa', unit: '%', icon: Droplets, color: '#4ed7ff', softColor: 'rgba(78,215,255,.16)', min: 0, max: 100, format: (v) => v.toFixed(1) },
  { key: 'calidad_aire', label: 'Calidad del aire', unit: 'ppm', icon: Wind, color: '#bd8cff', softColor: 'rgba(189,140,255,.16)', min: 0, max: 1000, format: (v) => Math.round(v).toString() },
  { key: 'amoniaco', label: 'Amoníaco', unit: 'ppm', icon: Cloud, color: '#ffcf5a', softColor: 'rgba(255,207,90,.16)', min: 0, max: 50, format: (v) => v.toFixed(1) },
  { key: 'luminosidad', label: 'Luminosidad', unit: 'lux', icon: Lightbulb, color: '#ff8f70', softColor: 'rgba(255,143,112,.16)', min: 0, max: 1000, format: (v) => Math.round(v).toString() },

{ key: 'alimento', label: 'Alimento Restante', unit: '', icon: Wheat, defaultColor: '#f59e0b', min: 0, max: 5, format: (v) => v < 1 ? (v * 1000).toFixed(0) + ' g' : v.toFixed(3) + ' kg' }
];


const initialTelemetry = { temperatura: 0, humedad: 0, calidad_aire: 0, amoniaco: 0, luminosidad: 0, alimento: 0  };

function createSample(data) {
  return { ...data, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), timestamp: Date.now() };
}

// ANIMACIÓN SVG DEL COMEDERO (Corregida la sintaxis del return)
function FeederAnimation({ value, max, isDanger }) {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));
  const renderColor = isDanger ? '#ef4444' : '#f59e0b';

  return (
    <div className="relative flex h-[142px] items-end justify-center overflow-hidden pt-4">
      <svg viewBox="0 0 100 120" className="h-full w-full max-w-[140px] drop-shadow-[0_10px_20px_rgba(245,158,11,0.15)]">
        <path d="M 30 10 L 70 10 L 70 80 L 90 100 L 90 110 L 10 110 L 10 100 L 30 80 Z" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinejoin="round" />
        <clipPath id="feeder-clip">
          <path d="M 30 10 L 70 10 L 70 80 L 90 100 L 90 110 L 10 110 L 10 100 L 30 80 Z" />
        </clipPath>
        <rect 
          x="0" 
          y={120 - (percentage / 100) * 120} 
          width="100" 
          height="120" 
          fill={renderColor} 
          clipPath="url(#feeder-clip)" 
          style={{ transition: 'y 1s cubic-bezier(0.4, 0, 0.2, 1)' }} 
        />
        <path d="M 35 15 L 45 15 L 45 75 L 35 75 Z" fill="rgba(255,255,255,0.1)" />
      </svg>
      <div className="absolute top-1/2 text-center drop-shadow-md">
        <div className={`font-display text-xl font-bold tracking-tight ${isDanger ? 'text-red-100' : 'text-white'}`}>{percentage.toFixed(0)}%</div>
      </div>
    </div>
  );
}

// VELOCÍMETRO (Se mantiene igual a tu versión)
function SemiGauge({ value, metric, isDanger }) {
  const percentage = Math.max(0, Math.min(100, ((value - metric.min) / (metric.max - metric.min)) * 100));
  const angle = -90 + percentage * 1.8;
  const renderColor = isDanger ? '#ef4444' : metric.color || metric.defaultColor; 

  return (
    <div className="relative flex h-[142px] items-end justify-center overflow-hidden pt-4">
      <svg viewBox="0 0 220 130" className="h-full w-full max-w-[240px]">
        <path d="M 20 110 A 90 90 0 0 1 200 110" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="12" strokeLinecap="round" />
        <path d="M 20 110 A 90 90 0 0 1 200 110" fill="none" stroke={renderColor} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${percentage * 2.83} 283`} />
        <line x1="110" y1="110" x2="110" y2="42" stroke="white" strokeWidth="3" strokeLinecap="round" transform={`rotate(${angle} 110 110)`} />
        <circle cx="110" cy="110" r="7" fill={renderColor} stroke="#08111f" strokeWidth="4" />
      </svg>
      <div className="absolute bottom-1 text-center">
        <div className={`font-display text-2xl font-semibold tracking-tight ${isDanger ? 'text-red-400' : 'text-white'}`}>{percentage.toFixed(0)}%</div>
        <div className="text-[10px] uppercase tracking-[.18em] text-slate-500">del rango</div>
      </div>
    </div>
  );
}

// SENSORCARD (Corregido para mostrar la tolva de alimento cuando corresponda)
function SensorCard({ metric, value, history, rangoIdeal }) {
  const [showAltVisual, setShowAltVisual] = useState(false); // Cambiado a showAltVisual para mayor claridad
  const Icon = metric.icon;
  const trend = history.length > 1 ? value - (history[history.length - 2][metric.key] ?? value) : 0;
  const chartData = history.map((sample) => ({ time: sample.time, value: sample[metric.key] ?? 0 }));
  
  const isDanger = value < rangoIdeal[0] || value > rangoIdeal[1];
  const activeColor = isDanger ? '#ef4444' : metric.color || metric.defaultColor;
  const softColor = isDanger ? 'rgba(239, 68, 68, 0.15)' : metric.softColor || `${metric.defaultColor}20`;

  return (
    <article className={`group relative overflow-hidden rounded-2xl border bg-[#101b2d]/90 p-5 shadow-2xl transition duration-300 ${isDanger ? 'border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.15)] animate-[pulse_2s_ease-in-out_infinite]' : 'border-white/[.08] hover:-translate-y-1 hover:border-white/[.18]'}`}>
      <div className="absolute inset-x-0 top-0 h-px opacity-70" style={{ backgroundColor: activeColor }} />
      <div className={`pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl transition duration-500 ${isDanger ? 'scale-150' : 'group-hover:scale-150'}`} style={{ backgroundColor: softColor }} />
      
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10" style={{ color: activeColor, backgroundColor: softColor }}>
            <Icon size={19} strokeWidth={1.8} className={isDanger ? 'animate-bounce' : ''} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-medium uppercase tracking-[.18em] text-slate-500">Sensor</p>
              {isDanger && <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-400 border border-red-500/30 animate-pulse">ALERTA</span>}
            </div>
            <h2 className={`mt-1 text-sm font-medium ${isDanger ? 'text-red-100' : 'text-slate-200'}`}>{metric.label}</h2>
          </div>
        </div>
        <button type="button" onClick={() => setShowAltVisual(!showAltVisual)} className="rounded-lg border border-white/10 p-2 text-slate-500 transition hover:border-white/25 hover:text-white" title={showAltVisual ? 'Mostrar gráfica' : 'Mostrar visual alternativo'}>
          <Gauge size={15} />
        </button>
      </div>

      <div className="relative mt-5 flex items-end gap-2">
        <span className={`font-display text-4xl font-semibold tracking-tight ${isDanger ? 'text-red-400' : 'text-white'}`}>{metric.format(value)}</span>
        <span className={`mb-1 text-sm ${isDanger ? 'text-red-400/70' : 'text-slate-500'}`}>{metric.unit}</span>
        <span className={`mb-1 ml-auto flex items-center gap-1 text-xs font-medium ${trend >= 0 ? (isDanger ? 'text-red-300' : 'text-emerald-300') : (isDanger ? 'text-red-300' : 'text-blue-300')}`}>
          {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{Math.abs(trend).toFixed(2)}
        </span>
      </div>

      <div className="mt-4 h-[150px]">
        {/* Aquí está la corrección: si es la tarjeta de alimento, pinta la tolva. Si es otro sensor, pinta el velocímetro o la gráfica */}
        {metric.key === 'alimento' && showAltVisual ? (
           <FeederAnimation value={value} max={rangoIdeal[1]} isDanger={isDanger} />
        ) : showAltVisual ? (
           <SemiGauge value={value} metric={metric} isDanger={isDanger} /> 
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 12, right: 0, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id={`fill-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={activeColor} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={activeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,.05)" />
              <XAxis dataKey="time" hide />
              <YAxis domain={['auto', 'auto']} hide />
              <Tooltip contentStyle={{ background: '#111d31', border: isDanger ? '1px solid #ef4444' : '1px solid rgba(255,255,255,.12)', borderRadius: 10, fontSize: 11 }} labelStyle={{ color: '#8491a8' }} itemStyle={{ color: activeColor }} />
              <Area type="monotone" dataKey="value" stroke={activeColor} strokeWidth={isDanger ? 3 : 2} fill={`url(#fill-${metric.key})`} dot={false} isAnimationActive />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="relative mt-2 flex justify-between text-[10px] uppercase tracking-[.15em] text-slate-500">
        <span className={value < rangoIdeal[0] ? 'text-red-400 font-bold' : ''}>mín {rangoIdeal[0]}</span>
        <span className={value > rangoIdeal[1] ? 'text-red-400 font-bold' : ''}>máx {rangoIdeal[1]}</span>
      </div>
    </article>
  );
}

function App() {
  const [semanaActual, setSemanaActual] = useState(1); // NUEVO: Estado del selector de semanas
  const [telemetry, setTelemetry] = useState(initialTelemetry);
  const [history, setHistory] = useState([]);
  const [connection, setConnection] = useState('connecting');
  const [lastUpdate, setLastUpdate] = useState('Esperando señal');
  const [calefactorActivo, setCalefactorActivo] = useState(false);
  const [extractorActivo, setExtractorActivo] = useState(false); // NUEVO: Estado del ventilador
  const [peligroModal, setPeligroModal] = useState(false);
  const [advertenciaOptima, setAdvertenciaOptima] = useState(false);


  // NUEVA FUNCIÓN OPTIMISTA
  const ejecutarCalefaccion = (encender) => {
    setCalefactorActivo(encender); // El botón se desliza al instante (Optimistic UI)
    const client = mqtt.connect(MQTT_URL);
    client.on('connect', () => { 
      client.publish(MQTT_TOPIC.replace("telemetria", "control/calefactor"), encender ? "ON" : "OFF"); 
      client.end(); 
    });
    setAdvertenciaOptima(false); // Cierra el modal si estaba abierto
  };

  useEffect(() => {
    console.log("📡 Iniciando conexión MQTT a:", MQTT_URL);
    const client = mqtt.connect(MQTT_URL, { reconnectPeriod: 3000, connectTimeout: 5000 });

    client.on('connect', () => { 
      setConnection('connected'); 
      client.subscribe(MQTT_TOPIC); 
    });
    client.on('reconnect', () => setConnection('connecting'));
    client.on('offline', () => setConnection('offline'));
    client.on('error', () => setConnection('offline'));

    client.on('message', (topic, payload) => {
      if (topic !== MQTT_TOPIC) return;
      try {
        const parsed = JSON.parse(payload.toString());
        if (parsed.estado_calefactor !== undefined) setCalefactorActivo(parsed.estado_calefactor);
        if (parsed.estado_extractor !== undefined) setExtractorActivo(parsed.estado_extractor); // NUEVO: Captura estado del ventilador
        if (parsed.alerta_override !== undefined) setPeligroModal(parsed.alerta_override); 
        
        const next = { 
          temperatura: Number(parsed.temperatura ?? 0), 
          humedad: Number(parsed.humedad ?? 0), 
          calidad_aire: Number(parsed.calidad_aire ?? 0), 
          amoniaco: Number(parsed.amoniaco ?? 0), 
          luminosidad: Number(parsed.luminosidad ?? 0),
          alimento: Number(parsed.alimento ?? 0) 
        };
        
        setTelemetry(next); 
        setHistory((current) => [...current, createSample(next)].slice(-MAX_HISTORY)); 
        setLastUpdate(new Date().toLocaleTimeString());
      } catch (e) { 
        console.error("❌ Error leyendo JSON:", e);
      }
    });

    return () => { client.end(true); };
  }, []);

  const statusLabel = connection === 'connected' ? 'Broker conectado' : connection === 'connecting' ? 'Conectando al broker' : 'Broker desconectado';
  const average = useMemo(() => history.length ? history.reduce((sum, sample) => sum + sample.temperatura, 0) / history.length : 0, [history]);
  
  // Obtenemos los rangos de la semana seleccionada
  const rangos = rangosSemanales[semanaActual];

  return (
    <main className="min-h-screen overflow-hidden bg-[#080f1c] text-slate-100">

      {/* MODAL DE AUTODEFENSA TÉRMICA */}
      {peligroModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-300">
          <div className="relative w-full max-w-md scale-100 overflow-hidden rounded-2xl border border-rose-500/50 bg-[#0a1120] p-8 text-center shadow-[0_0_80px_rgba(244,63,94,.15)] animate-pulse">
            <div className="mx-auto mb-5 flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-rose-500/20">
              <AlertTriangle size={32} className="text-rose-500" />
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-white">¡Peligro de Hipotermia!</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">Has desactivado la calefacción manualmente mientras la temperatura está en un nivel crítico.</p>
            <div className="mt-6 rounded-xl bg-rose-500/10 p-4 border border-rose-500/20">
              <p className="text-xs font-medium uppercase tracking-widest text-rose-400">Protocolo de autodefensa activo</p>
              <p className="mt-1 text-sm text-slate-200">El sistema anulará tu orden en <span className="font-bold text-white">10 segundos</span>.</p>
            </div>
            <button 
              onClick={() => {
                const client = mqtt.connect(MQTT_URL);
                client.publish(MQTT_TOPIC.replace("telemetria", "control/calefactor"), "ON");
              }}
              className="mt-6 w-full rounded-xl bg-rose-500 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(244,63,94,.4)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Reactivar Inmediatamente
            </button>
          </div>
        </div>
      )}

      {/* NUEVO: MODAL DE ADVERTENCIA POR TEMPERATURA ÓPTIMA */}
      {advertenciaOptima && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-300">
          <div className="relative w-full max-w-md scale-100 overflow-hidden rounded-2xl border border-amber-500/50 bg-[#0a1120] p-8 text-center shadow-[0_0_80px_rgba(245,158,11,.15)]">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
              <Thermometer size={32} className="text-amber-500" />
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-white">Temperatura Óptima</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              El galpón se encuentra a <strong className="text-amber-400">{telemetry.temperatura}°C</strong>. Encender la calefacción ahora es innecesario y podría causar estrés térmico en las aves.
            </p>
            <div className="mt-6 flex gap-3">
              <button 
                onClick={() => setAdvertenciaOptima(false)}
                className="flex-1 rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button 
                onClick={() => ejecutarCalefaccion(true)}
                className="flex-1 rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(245,158,11,.4)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Forzar Encendido
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_85%_0%,rgba(35,99,116,.16),transparent_32%),radial-gradient(circle_at_0%_100%,rgba(26,64,92,.14),transparent_30%)]" />
      <div className="relative mx-auto max-w-[1600px] px-5 py-5 sm:px-8 lg:px-10">
        
        {/* HEADER MODIFICADO */}
        <header className="flex flex-col gap-6 border-b border-white/[.07] pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-300 shadow-[0_0_25px_rgba(78,215,255,.12)]">
              <Activity size={24} />
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#080f1c] bg-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <p className="font-display text-lg font-semibold tracking-tight text-white">DON POLLO</p>
                <span className="rounded bg-white/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[.18em] text-slate-400">Lote 01</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Centro de control · Edge computing local</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            
            {/* NUEVO: SELECTOR DE SEMANA DE VIDA */}
            <div className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2.5">
              <Calendar size={16} className="text-blue-400" />
              <div>
                <p className="text-[10px] uppercase tracking-[.15em] text-blue-300/70">Línea de tiempo</p>
                <select 
                  className="bg-transparent text-sm font-semibold text-white focus:outline-none cursor-pointer"
                  value={semanaActual}
                  onChange={(e) => setSemanaActual(Number(e.target.value))}
                >
                  <option value={1} className="bg-[#080f1c]">Semana 1 (Cría inicial)</option>
                  <option value={2} className="bg-[#080f1c]">Semana 2 (Desarrollo)</option>
                  <option value={3} className="bg-[#080f1c]">Semana 3 (Crecimiento)</option>
                  <option value={4} className="bg-[#080f1c]">Semana 4 (Engorde)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-white/[.08] bg-white/[.03] px-4 py-2.5">
              <span className={`h-2 w-2 rounded-full ${connection === 'connected' ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]' : connection === 'connecting' ? 'animate-pulse bg-amber-300' : 'bg-rose-400'}`} />
              <div>
                <p className="text-xs font-medium text-slate-300">{statusLabel}</p>
                <p className="text-[10px] text-slate-600">{MQTT_URL}</p>
              </div>
            </div>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <section className="py-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[.22em] text-cyan-300"><Radio size={13} /> Telemetría en vivo</div>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">Panel de monitoreo</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Lecturas ambientales de tu galpón, procesadas y visualizadas en tiempo real.</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="hidden sm:inline">Actualizado {lastUpdate}</span>
              <button type="button" className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-slate-400 transition hover:border-white/20 hover:text-white"><RefreshCw size={13} /> Sincronizar</button>
            </div>
          </div>
        </section>

        {/* TARJETAS DE SENSORES Y ACTUADORES */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {metricDefinitions.map((metric) => 
            <SensorCard 
              key={metric.key} 
              metric={metric} 
              value={telemetry[metric.key] ?? 0} 
              history={history} 
              rangoIdeal={rangos[metric.key]} // NUEVO: Pasamos el rango de la semana a la tarjeta
            />
          )}
          
          <aside className="rounded-2xl border border-white/[.08] bg-[#101b2d]/50 p-5 flex flex-col justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[.18em] text-slate-400">Panel de Acción</p>
              <h2 className="mt-1 text-base font-medium text-white">Control de Lote</h2>
              
              <div className="mt-6 flex flex-col gap-3">
                {/* BOTÓN CALEFACCIÓN */}
                <div className={`rounded-xl border p-4 flex items-center justify-between transition-colors ${calefactorActivo ? 'border-orange-500/30 bg-orange-500/10' : 'border-white/[.05] bg-black/20'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${calefactorActivo ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-500'}`}>
                      <Thermometer size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-wide">CALEFACCIÓN</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">Campanas térmicas</p>
                    </div>
                  </div>
                  <button onClick={() => {
                      // Si está apagado, el usuario quiere encenderlo, y la temperatura es mayor o igual al mínimo ideal de la semana
                      if (!calefactorActivo && telemetry.temperatura >= rangos.temperatura[0]) {
                        setAdvertenciaOptima(true); // Mostrar modal de advertencia
                      } else {
                        ejecutarCalefaccion(!calefactorActivo); // Acción normal rápida
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${calefactorActivo ? 'bg-orange-500' : 'bg-slate-600'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${calefactorActivo ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {/* NUEVO: BOTÓN EXTRACTOR */}
                <div className={`rounded-xl border p-4 flex items-center justify-between transition-colors ${extractorActivo ? 'border-cyan-500/30 bg-cyan-500/10' : 'border-white/[.05] bg-black/20'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${extractorActivo ? 'bg-cyan-500/20 text-cyan-400 animate-spin-slow' : 'bg-slate-800 text-slate-500'}`}>
                      <Fan size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-wide">EXTRACTOR</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">Ventilación de amoníaco</p>
                    </div>
                  </div>
                  <button onClick={() => {
                    setExtractorActivo(!extractorActivo); 
                    const client = mqtt.connect(MQTT_URL);
                    client.on('connect', () => { client.publish("donpollo/markos_lote1/control/extractor", !extractorActivo ? "ON" : "OFF"); client.end(); });
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${extractorActivo ? 'bg-cyan-500' : 'bg-slate-600'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${extractorActivo ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

export default App;