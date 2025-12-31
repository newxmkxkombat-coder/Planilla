
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Camera, AlertCircle, CheckCircle2, Route, TableProperties, Search, Folder, Trash2, ChevronDown, ChevronRight, History as HistoryIcon, MapPin, X, Move, Plus } from 'lucide-react';
import { parseScheduleFromImage } from './services/geminiService';
import { AppState, SavedPlanilla } from './types';

const STORAGE_KEY = 'rutatime_pro_v7';

const normalizeTime = (time: string | null) => {
  if (!time) return null;
  const parts = time.trim().split(':');
  if (parts.length !== 2) return time;
  const h = parts[0].padStart(2, '0');
  const m = parts[1].padStart(2, '0');
  return `${h}:${m}`;
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as AppState) : {
      currentPlanilla: null,
      history: [],
      loading: false,
      error: null,
    };
  });
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());

  // Estado para la posición del recuadro arrastrable
  const [boxPos, setBoxPos] = useState({ x: 20, y: window.innerHeight - 380 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Lógica de arrastre
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!boxRef.current) return;
    const touch = e.touches[0];
    const rect = boxRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    
    let newX = touch.clientX - dragOffset.current.x;
    let newY = touch.clientY - dragOffset.current.y;

    // Límites de la pantalla
    const padding = 10;
    const boxWidth = boxRef.current?.offsetWidth || 200;
    const boxHeight = boxRef.current?.offsetHeight || 160;

    newX = Math.max(padding, Math.min(newX, window.innerWidth - boxWidth - padding));
    newY = Math.max(70, Math.min(newY, window.innerHeight - boxHeight - padding));

    setBoxPos({ x: newX, y: newY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const result = await parseScheduleFromImage(reader.result as string);
        const newP: SavedPlanilla = {
          id: Date.now().toString(),
          routeNumber: result.routeNumber || 'N/A',
          planillaNumber: result.planillaNumber || 'N/A',
          headers: result.headers,
          grid: result.grid.map(normalizeTime),
          date: new Date().toISOString(),
        };
        setState(prev => ({ 
          ...prev,
          currentPlanilla: { ...newP },
          history: [newP, ...prev.history],
          loading: false, 
          error: null 
        }));
        setShowHistory(false);
        // Resetear posición al cargar nueva
        setBoxPos({ x: (window.innerWidth / 2) - 100, y: window.innerHeight - 380 });
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  const currentP = state.currentPlanilla;
  const nowStr = `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`;

  const nextPoint = useMemo(() => {
    if (!currentP) return null;
    const points = currentP.grid
      .map((t, i) => ({ t, i }))
      .filter(p => p.t !== null && p.t > nowStr);
    return points.length > 0 ? points[0] : null;
  }, [currentP, nowStr]);

  const diffText = useMemo(() => {
    if (!nextPoint || !currentP) return null;
    const timeStr = currentP.grid[nextPoint.i];
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    const target = new Date();
    target.setHours(h, m, 0, 0);
    const diff = Math.floor((target.getTime() - currentTime.getTime()) / 1000);
    
    if (diff < 0) return "Llegada inminente";
    
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return { mins, secs };
  }, [nextPoint, currentTime, currentP]);

  const groupedHistory = useMemo(() => {
    const filtered = state.history.filter(p => 
      p.routeNumber.includes(searchTerm) || p.planillaNumber.includes(searchTerm)
    );
    const groups: Record<string, SavedPlanilla[]> = {};
    filtered.forEach(p => {
      const k = `Ruta ${p.routeNumber}`;
      if (!groups[k]) groups[k] = [];
      groups[k].push(p);
    });
    return (Object.entries(groups) as [string, SavedPlanilla[]][]);
  }, [state.history, searchTerm]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 flex flex-col font-sans selection:bg-blue-500/30 overflow-x-hidden">
      {/* HEADER FIJO SUPERIOR (REESTRUCTURADO) */}
      <header className="bg-[#0f172a]/95 backdrop-blur-xl border-b border-slate-800 px-4 py-3 sticky top-0 z-[60] flex justify-between items-center h-16 shadow-lg">
        <div className="flex items-center gap-2">
          {currentP && (
            <button 
              onClick={() => { if(confirm("¿Cerrar planilla actual?")) setState(s => ({...s, currentPlanilla: null})); }} 
              className="p-2 bg-slate-800/50 hover:bg-red-900/40 text-slate-400 hover:text-red-400 rounded-xl transition-all border border-slate-700/50"
              title="Cerrar planilla"
            >
              <X size={18} />
            </button>
          )}
          <div className="flex flex-col">
            <h1 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none mb-1">
              {currentP ? 'Ruta Activa' : 'RutaTime'}
            </h1>
            <p className="text-sm font-black text-white uppercase tracking-tight leading-none truncate max-w-[120px]">
              {currentP ? `R-${currentP.routeNumber}` : 'Pro'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Botón Nueva Planilla en Header */}
          <label className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl cursor-pointer transition-all shadow-lg shadow-blue-900/20 flex items-center gap-1.5 active:scale-95">
            <Camera size={18} />
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </label>

          {/* Reloj Digital */}
          <div className="bg-slate-800/40 px-3 py-2 rounded-xl border border-slate-700/50 hidden xs:block">
            <span className="text-blue-400 font-mono font-black text-xs tabular-nums">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Historial Toggle */}
          <button 
            onClick={() => setShowHistory(!showHistory)} 
            className={`p-2.5 rounded-xl transition-all ${showHistory ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'bg-slate-800/40 text-slate-400 border border-slate-700/50'}`}
          >
            <HistoryIcon size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full p-4 relative flex flex-col">
        {showHistory ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-right duration-300 pb-10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input 
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-4 pl-10 pr-4 font-bold text-sm text-white focus:ring-2 focus:ring-blue-600 outline-none transition-all placeholder:text-slate-600 shadow-xl"
                placeholder="Buscar por Ruta..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            {groupedHistory.length === 0 ? (
              <div className="py-20 text-center opacity-30 font-black uppercase tracking-widest text-xs">No hay registros</div>
            ) : groupedHistory.map(([route, items]) => (
              <div key={route} className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
                <button 
                  onClick={() => {
                    const n = new Set(expandedRoutes);
                    n.has(route) ? n.delete(route) : n.add(route);
                    setExpandedRoutes(n);
                  }}
                  className="w-full p-4 flex justify-between items-center hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Folder className="text-blue-500" size={18} />
                    <span className="font-black text-slate-300 uppercase text-xs tracking-widest">{route}</span>
                    <span className="bg-slate-800 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold">{items.length}</span>
                  </div>
                  {expandedRoutes.has(route) ? <ChevronDown size={18} className="text-slate-600"/> : <ChevronRight size={18} className="text-slate-600"/>}
                </button>
                {expandedRoutes.has(route) && (
                  <div className="divide-y divide-slate-800">
                    {items.map(p => (
                      <div key={p.id} className="p-4 flex justify-between items-center hover:bg-blue-600/10 cursor-pointer transition-colors group" onClick={() => { setState(s => ({...s, currentPlanilla: p})); setShowHistory(false); }}>
                        <div className="flex flex-col">
                           <span className="font-bold text-white text-sm">Planilla #{p.planillaNumber}</span>
                           <span className="text-[10px] text-slate-500 font-bold">{new Date(p.date).toLocaleDateString()}</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setState(s => ({...s, history: s.history.filter(x => x.id !== p.id)})); }} className="p-2 text-slate-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : currentP ? (
          <div className="flex flex-col pb-10">
            {/* PLANILLA DE HORARIOS CON ENCABEZADOS FIJOS (STICKY) */}
            <div className="bg-slate-900/40 rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl">
              <div className="grid grid-cols-5 bg-slate-900 sticky top-16 z-50 border-b border-slate-800 shadow-md">
                {currentP.headers.map((h, i) => (
                  <div key={i} className="p-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-tighter truncate">{h}</div>
                ))}
              </div>
              
              <div className="grid grid-cols-5 p-3 gap-1.5">
                {currentP.grid.map((time, idx) => {
                  const isNext = nextPoint?.i === idx;
                  const isPast = time && !isNext && time < nowStr;
                  return (
                    <div key={idx} className={`h-16 flex items-center justify-center rounded-2xl border font-mono font-black transition-all duration-500 ${
                      !time ? 'bg-slate-950/20 border-transparent opacity-10' :
                      isNext ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_30px_rgba(37,99,235,0.4)] scale-105 z-10 text-lg' :
                      isPast ? 'bg-[#020617] border-slate-900 text-slate-800 text-sm' : 'bg-slate-800/40 border-slate-800 text-slate-400 text-sm'
                    }`}>
                      {time}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RECUADRO DEL TIEMPO (ARRASTRABLE) */}
            <div 
              ref={boxRef}
              style={{ 
                left: `${boxPos.x}px`, 
                top: `${boxPos.y}px`,
                touchAction: 'none',
                cursor: isDragging ? 'grabbing' : 'grab'
              }}
              onMouseDown={(e) => {
                const rect = boxRef.current!.getBoundingClientRect();
                dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                setIsDragging(true);
              }}
              onMouseMove={(e) => {
                if (!isDragging) return;
                let newX = e.clientX - dragOffset.current.x;
                let newY = e.clientY - dragOffset.current.y;
                setBoxPos({ x: newX, y: newY });
              }}
              onMouseUp={() => setIsDragging(false)}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className={`fixed z-[80] w-[200px] transition-transform duration-75 select-none ${isDragging ? 'scale-105 opacity-90' : ''}`}
            >
              {nextPoint && typeof diffText === 'object' ? (
                <div className="bg-[#0f172a]/95 backdrop-blur-3xl rounded-[1.5rem] p-3 shadow-[0_30px_60px_rgba(0,0,0,0.8)] border border-slate-700/30 relative overflow-hidden flex flex-col items-center">
                  <div className="w-10 h-1 bg-slate-800 rounded-full mb-2 opacity-50"></div>
                  <div className="absolute top-0 left-0 w-full h-[3px] bg-slate-900/50">
                    <div className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-1000" style={{ width: `${((nextPoint.i + 1) / currentP.grid.length) * 100}%` }}></div>
                  </div>
                  <div className="flex items-center gap-1.5 mb-2 pointer-events-none">
                    <MapPin className="text-blue-500" size={10} />
                    <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">{currentP.headers[nextPoint.i % 5]}</span>
                  </div>
                  <div className="flex items-baseline text-white tabular-nums mb-2 pointer-events-none">
                    <span className="text-5xl font-black tracking-tight leading-none">{diffText?.mins}</span>
                    <span className="text-blue-500 font-bold text-xs ml-0.5 mr-2">m</span>
                    <span className="text-2xl font-black text-slate-500 leading-none">{diffText?.secs.toString().padStart(2, '0')}</span>
                    <span className="text-slate-700 font-bold text-[10px] ml-0.5">s</span>
                  </div>
                  <div className="bg-slate-900/60 px-3 py-1 rounded-lg border border-slate-800/80 pointer-events-none">
                    <span className="text-blue-400 font-mono font-black text-[10px] tracking-widest">{currentP.grid[nextPoint.i]}</span>
                  </div>
                </div>
              ) : nextPoint === null ? (
                <div className="bg-blue-600 p-4 rounded-[1.5rem] text-center text-white shadow-2xl">
                  <CheckCircle2 size={24} className="mx-auto mb-1" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Finalizado</span>
                </div>
              ) : (
                <div className="bg-red-600 p-4 rounded-[1.5rem] text-center text-white shadow-2xl border border-red-500">
                   <h2 className="text-[10px] font-black uppercase tracking-tighter">Llegada Ya</h2>
                   <p className="text-[8px] font-bold opacity-80 uppercase">{currentP.headers[nextPoint.i % 5]}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-[75vh] flex flex-col items-center justify-center text-center px-10">
            <div className="w-20 h-20 bg-slate-900 border border-slate-800 text-blue-500 rounded-3xl flex items-center justify-center mb-8 shadow-2xl rotate-3">
              <TableProperties size={40} />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight leading-tight">Gestión de Rutas</h2>
            <p className="text-slate-500 font-medium mt-4 text-sm leading-relaxed">Sube una foto de tu planilla usando el botón de cámara en la parte superior.</p>
            <label className="mt-12 w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-base shadow-2xl shadow-blue-900/40 hover:bg-blue-500 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-3">
              <Camera size={20} />
              TOMAR FOTO PLANILLA
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        )}
      </main>

      {state.loading && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center text-white">
          <div className="relative">
            <div className="w-16 h-16 border-[5px] border-slate-800 rounded-full"></div>
            <div className="w-16 h-16 border-[5px] border-blue-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="font-black tracking-[0.4em] text-[10px] mt-8 animate-pulse text-blue-500 text-center px-10 uppercase">Analizando horarios</p>
        </div>
      )}

      {state.error && (
        <div className="fixed bottom-10 left-4 right-4 bg-red-600 text-white p-5 rounded-3xl flex items-center gap-4 shadow-2xl border border-red-500 z-[110]">
          <AlertCircle size={20} className="shrink-0" />
          <span className="font-black text-xs">{state.error}</span>
          <button onClick={() => setState(s => ({...s, error: null}))} className="ml-auto p-1"><X size={16}/></button>
        </div>
      )}
    </div>
  );
};

export default App;
