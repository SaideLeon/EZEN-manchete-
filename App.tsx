
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Download, Upload, Trash2, Type, Layout, Info, RefreshCw, Loader2, Smartphone, Square, Monitor, MoveVertical, Maximize, ZoomIn, Move, MousePointer2, Plus, Edit2, X, Save, Palette } from 'lucide-react';
import html2canvas from 'html2canvas';

type PostFormat = '1:1' | '9:16' | '16:9';
type DragTarget = 'background' | 'circle' | 'headline' | null;

interface NewsPost {
  brandName: string;
  headline: string;
  mainImage: string | null;
  circleImage: string | null;
  highlightColor: string;
  brandColor: string;
  format: PostFormat;
  mainImageY: number; 
  circleImageY: number; 
  circleImageScale: number; 
  circleX: number; 
  circleY: number; 
  circleSize: number; 
  headlineSize: number; 
  headlineY: number; 
}

const DB_NAME = 'EzenNewsDB';
const STORE_NAME = 'settings';
const STATE_KEY = 'currentPost';

// Simple IDB Wrapper
const idb = {
  open: () => new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }),
  get: async (key: string) => {
    const db = await idb.open();
    return new Promise((resolve) => {
      const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result);
    });
  },
  set: async (key: string, val: any) => {
    const db = await idb.open();
    return new Promise((resolve) => {
      const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(val, key);
      request.onsuccess = () => resolve(request.result);
    });
  }
};

const App: React.FC = () => {
  const [post, setPost] = useState<NewsPost>({
    brandName: "EZEN NEWS",
    headline: "EZEN NEWS revelado: Novo gerador de posts {revoluciona} design digital",
    mainImage: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=1080',
    circleImage: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&q=80&w=400',
    highlightColor: '#00D1FF',
    brandColor: '#FF0055',
    format: '1:1',
    mainImageY: 50,
    circleImageY: 50,
    circleImageScale: 1,
    circleX: 10,
    circleY: 10,
    circleSize: 30,
    headlineSize: 100,
    headlineY: 0,
  });

  const [isExporting, setIsExporting] = useState(false);
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const circleInputRef = useRef<HTMLInputElement>(null);

  // Load from IndexedDB
  useEffect(() => {
    idb.get(STATE_KEY).then((savedPost) => {
      if (savedPost) setPost(savedPost as NewsPost);
    });
  }, []);

  // Debounced save to IndexedDB
  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsSaving(true);
      idb.set(STATE_KEY, post).finally(() => {
        setTimeout(() => setIsSaving(false), 800);
      });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [post]);

  const handlePointerDown = (e: React.PointerEvent, target: DragTarget) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragTarget(target);
    setDragStart({ x: e.clientX, y: e.clientY });
    setIsDragging(false);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragTarget || !previewRef.current) return;

    const dx = Math.abs(e.clientX - dragStart.x);
    const dy = Math.abs(e.clientY - dragStart.y);
    if (dx > 5 || dy > 5) setIsDragging(true);

    const rect = previewRef.current.getBoundingClientRect();
    const xPct = ((rect.right - e.clientX) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    setPost(prev => {
      if (dragTarget === 'circle') {
        return { 
          ...prev, 
          circleX: Math.max(0, Math.min(100 - prev.circleSize, xPct - prev.circleSize/2)),
          circleY: Math.max(0, Math.min(100 - prev.circleSize, yPct - prev.circleSize/2))
        };
      }
      if (dragTarget === 'background') {
        return { ...prev, mainImageY: Math.max(0, Math.min(100, yPct)) };
      }
      if (dragTarget === 'headline') {
        const fromBottom = rect.bottom - e.clientY;
        const offset = fromBottom - (prev.format === '9:16' ? 180 : 100);
        return { ...prev, headlineY: offset };
      }
      return prev;
    });
  };

  const handlePointerUp = (e: React.PointerEvent, target: DragTarget) => {
    if (!isDragging && target) {
      if (target === 'background') fileInputRef.current?.click();
      if (target === 'circle') circleInputRef.current?.click();
    }
    setDragTarget(null);
    setIsDragging(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'main' | 'circle') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPost(prev => ({
          ...prev,
          [type === 'main' ? 'mainImage' : 'circleImage']: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const renderHeadline = (text: string) => {
    const parts = text.split(/(\{.*?\})/);
    return parts.map((part, index) => {
      if (part.startsWith('{') && part.endsWith('}')) {
        return <span key={index} style={{ color: post.highlightColor }}>{part.slice(1, -1)}</span>;
      }
      return part;
    });
  };

  const downloadPost = async () => {
    if (!previewRef.current || isExporting) return;
    setIsExporting(true);
    try {
      await document.fonts.ready;
      await new Promise(r => setTimeout(r, 200));
      const canvas = await html2canvas(previewRef.current, {
        useCORS: true, scale: 3, backgroundColor: '#000000', logging: false,
      });
      const link = document.createElement('a');
      link.download = `${post.brandName.toLowerCase().replace(/\s+/g, '-')}-post-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } catch (e) {
      alert("Erro ao exportar. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  };

  const getFormatClass = () => post.format === '9:16' ? 'aspect-9-16' : post.format === '16:9' ? 'aspect-16-9' : 'aspect-1-1';
  
  const getFontSize = () => {
    const base = post.format === '9:16' ? 3.5 : post.format === '16:9' ? 3.2 : 3;
    return `${(base * (post.headlineSize / 100)).toFixed(2)}rem`;
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white pb-20 selection:bg-[#FF0055] selection:text-white overflow-x-hidden">
      <header className="border-b border-white/10 p-4 sticky top-0 bg-neutral-950/80 backdrop-blur-md z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 bg-[#FF0055] rounded-md flex items-center justify-center font-black italic shadow-lg uppercase" style={{ backgroundColor: post.brandColor }}>
              {post.brandName.charAt(0)}
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-black tracking-tighter uppercase italic leading-none hidden sm:block">{post.brandName}</h1>
              <div className={`text-[8px] font-bold uppercase transition-opacity duration-500 ${isSaving ? 'opacity-100 text-indigo-400' : 'opacity-0'}`}>Sincronizado IDB</div>
            </div>
          </div>

          <div className="flex bg-neutral-900 rounded-full p-1 border border-white/10 shadow-inner overflow-x-auto max-w-full no-scrollbar">
            {[ {f:'1:1', i:<Square size={14}/>}, {f:'9:16', i:<Smartphone size={14}/>}, {f:'16:9', i:<Monitor size={14}/>} ].map(item => (
              <button 
                key={item.f}
                onClick={() => setPost({...post, format: item.f as PostFormat})}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${post.format === item.f ? 'bg-white text-black shadow-lg scale-105' : 'text-neutral-500 hover:text-white'}`}
              >
                {item.i} {item.f}
              </button>
            ))}
          </div>

          <button 
            onClick={downloadPost}
            disabled={isExporting}
            className="flex items-center gap-2 bg-white text-black px-5 py-2 rounded-full font-bold hover:bg-neutral-200 transition-all disabled:opacity-50 active:scale-95 shadow-xl shrink-0"
          >
            {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} 
            <span className="hidden md:inline">{isExporting ? 'Renderizando...' : 'Exportar'}</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 lg:p-8 grid lg:grid-cols-12 gap-8 mt-4">
        {/* Editor Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-gradient-to-br from-indigo-500/10 to-blue-500/10 border border-white/10 p-5 rounded-2xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-3 flex items-center gap-2">
              <MousePointer2 size={14} /> Design Experience 2025
            </h3>
            <ul className="space-y-2 text-[11px] text-neutral-400 font-medium">
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"/> <span className="text-white">Toque</span> nos elementos para trocar ou mover.</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"/> <span className="text-white">Personalize</span> o nome da sua marca abaixo.</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"/> <span className="text-white">Auto-Save:</span> Persistência em IndexedDB.</li>
            </ul>
          </div>

          <section className="bg-neutral-900 rounded-2xl p-6 border border-white/5 space-y-6 shadow-xl">
            {/* Brand Editing Section */}
            <div>
              <h2 className="text-xs font-black mb-4 flex items-center gap-2 text-neutral-500 uppercase tracking-widest">
                <Palette size={14} /> Branding
              </h2>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-neutral-600 uppercase">Nome da Marca / Blog</label>
                  <input
                    type="text"
                    value={post.brandName}
                    onChange={(e) => setPost({ ...post, brandName: e.target.value.toUpperCase() })}
                    className="w-full bg-neutral-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 transition-all"
                    style={{ borderColor: post.brandColor }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-neutral-600 mb-2 uppercase">Highlight Color</label>
                    <input type="color" value={post.highlightColor} onChange={(e) => setPost({ ...post, highlightColor: e.target.value })} className="w-full h-10 bg-transparent cursor-pointer rounded-lg overflow-hidden border-2 border-white/5" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-neutral-600 mb-2 uppercase">Brand Color</label>
                    <input type="color" value={post.brandColor} onChange={(e) => setPost({ ...post, brandColor: e.target.value })} className="w-full h-10 bg-transparent cursor-pointer rounded-lg overflow-hidden border-2 border-white/5" />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/5">
              <h2 className="text-xs font-black mb-4 flex items-center gap-2 text-neutral-500 uppercase tracking-widest">
                <Type size={14} /> Manchete & Estilo
              </h2>
              <textarea
                value={post.headline}
                onChange={(e) => setPost({ ...post, headline: e.target.value })}
                className="w-full h-24 bg-neutral-800 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:ring-1 text-sm mb-4 transition-all hover:bg-neutral-800/80"
                style={{ borderColor: post.brandColor }}
                placeholder="Dica: Use {chaves} para destacar"
              />
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] uppercase font-bold text-neutral-500 tracking-tighter">
                    <span>Escala da Manchete</span>
                    <span>{post.headlineSize}%</span>
                  </div>
                  <input type="range" min="40" max="160" value={post.headlineSize} onChange={(e) => setPost({...post, headlineSize: parseInt(e.target.value)})} className="w-full accent-white" />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/5">
              <h2 className="text-xs font-black mb-4 flex items-center gap-2 text-neutral-500 uppercase tracking-widest">
                <Layout size={14} /> Ajustes de Imagem
              </h2>
              
              {post.circleImage ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] uppercase font-bold text-neutral-500 tracking-tighter">
                      <span>Diâmetro do Círculo</span>
                      <span>{post.circleSize}%</span>
                    </div>
                    <input type="range" min="10" max="70" value={post.circleSize} onChange={(e) => setPost({...post, circleSize: parseInt(e.target.value)})} className="w-full accent-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-neutral-600 uppercase">Zoom Interno</label>
                      <input type="range" min="1" max="3" step="0.1" value={post.circleImageScale} onChange={(e) => setPost({...post, circleImageScale: parseFloat(e.target.value)})} className="w-full" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-neutral-600 uppercase">Eixo Y Interno</label>
                      <input type="range" min="0" max="100" value={post.circleImageY} onChange={(e) => setPost({...post, circleImageY: parseInt(e.target.value)})} className="w-full" />
                    </div>
                  </div>
                  <button onClick={() => setPost({...post, circleImage: null})} className="w-full py-2 bg-red-500/10 text-red-500 text-[10px] font-black uppercase rounded-lg border border-red-500/10 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2">
                    <Trash2 size={12}/> Remover Círculo
                  </button>
                </div>
              ) : (
                <button onClick={() => circleInputRef.current?.click()} className="w-full py-4 border-2 border-dashed border-white/10 rounded-xl text-neutral-500 hover:text-white hover:border-white/30 transition-all flex flex-col items-center gap-2">
                  <Plus size={20} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Adicionar Círculo</span>
                </button>
              )}
            </div>
          </section>
        </div>

        {/* Live Interactive Preview Area */}
        <div className="lg:col-span-8 flex flex-col items-center">
          <div className="w-full max-w-[600px] sticky top-24">
            <div 
              ref={previewRef}
              onPointerMove={handlePointerMove}
              onPointerUp={(e) => handlePointerUp(e, dragTarget)}
              className={`post-preview relative bg-black shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden transition-all duration-500 ease-in-out cursor-grab active:cursor-grabbing rounded-sm ${getFormatClass()}`}
              style={{ width: '100%' }}
              onPointerDown={(e) => handlePointerDown(e, 'background')}
            >
              {post.mainImage ? (
                <div className="relative w-full h-full group/main">
                  <img 
                    src={post.mainImage} 
                    alt="Main" 
                    className="w-full h-full object-cover select-none pointer-events-none" 
                    style={{ objectPosition: `50% ${post.mainImageY}%` }}
                    crossOrigin="anonymous" 
                  />
                  <div className="absolute inset-0 bg-white/0 group-hover/main:bg-white/5 transition-colors pointer-events-none" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/main:opacity-100 transition-opacity pointer-events-none">
                     <div className="bg-black/60 backdrop-blur-md p-3 rounded-full border border-white/20 scale-90 group-hover/main:scale-100 transition-transform">
                        <Edit2 size={24} className="text-white" />
                     </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full bg-neutral-900 flex flex-col items-center justify-center gap-4 text-neutral-500 border-4 border-dashed border-white/5">
                  <Upload size={48} className="opacity-20" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em]">Toque para carregar fundo</p>
                </div>
              )}

              {/* Degradê */}
              <div className={`absolute inset-x-0 bottom-0 pointer-events-none bg-gradient-to-t from-black via-black/90 to-transparent ${post.format === '9:16' ? 'h-[80%]' : 'h-[85%]'}`} />

              {/* Branding superior dinâmico */}
              <div className={`absolute left-10 transition-all pointer-events-none z-10 ${post.format === '9:16' ? 'top-16' : 'top-10'}`}>
                <h4 className={`font-black italic tracking-tighter uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,1)] ${post.format === '16:9' ? 'text-5xl' : 'text-4xl'}`} style={{ color: post.brandColor }}>
                  {post.brandName}
                </h4>
              </div>

              {/* Circle Interactive Element */}
              {post.circleImage && (
                <div 
                  onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, 'circle'); }}
                  onPointerUp={(e) => { e.stopPropagation(); handlePointerUp(e, 'circle'); }}
                  className="absolute rounded-full border-[6px] border-black shadow-[0_20px_40px_rgba(0,0,0,0.8)] overflow-hidden ring-4 transition-transform duration-75 aspect-square z-20 group/circle cursor-move active:scale-95"
                  style={{ 
                    right: `${post.circleX}%`,
                    top: `${post.circleY}%`,
                    width: `${post.circleSize}%`,
                    ringColor: post.highlightColor, 
                    ringOffsetColor: 'transparent',
                    touchAction: 'none'
                  } as any}
                >
                  <img 
                    src={post.circleImage} 
                    alt="Circle" 
                    className="w-full h-full object-cover pointer-events-none" 
                    style={{ 
                      objectPosition: `50% ${post.circleImageY}%`,
                      transform: `scale(${post.circleImageScale})`
                    }}
                    crossOrigin="anonymous" 
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover/circle:bg-black/20 transition-colors pointer-events-none flex items-center justify-center">
                      <Camera size={24} className="text-white opacity-0 group-hover/circle:opacity-100 transition-opacity" />
                  </div>
                </div>
              )}

              {/* Headline Interactive Block */}
              <div 
                onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, 'headline'); }}
                onPointerUp={(e) => { e.stopPropagation(); handlePointerUp(e, 'headline'); }}
                className="absolute left-12 right-12 z-30 group/text cursor-move touch-none"
                style={{ bottom: `${(post.format === '9:16' ? 140 : 80) + post.headlineY}px` }}
              >
                <div className="absolute -inset-4 bg-white/0 group-hover/text:bg-white/5 rounded-xl transition-all border border-transparent group-hover/text:border-white/10" />
                <h1 
                  className="font-[900] leading-[0.92] tracking-[-0.03em] text-white drop-shadow-[0_10px_20px_rgba(0,0,0,1)] select-none pointer-events-none relative"
                  style={{ fontSize: getFontSize() }}
                >
                  {renderHeadline(post.headline)}
                </h1>
                
                <div className="mt-8 flex items-center gap-6 pointer-events-none relative">
                  <div className="h-1.5 w-14 rounded-full shadow-lg" style={{ backgroundColor: post.brandColor }} />
                  <span className="text-[10px] uppercase tracking-[0.45em] font-black opacity-30 text-white">
                    WWW.{post.brandName.split(' ')[0].toLowerCase()}.CO/NEWS
                  </span>
                </div>
              </div>
              
              <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-15 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
            </div>

            <div className="mt-8 flex items-center justify-center gap-10">
               <div className="text-[9px] font-black uppercase tracking-[0.4em] text-neutral-600 flex items-center gap-2">
                  <Save size={10} /> Local Persistence
               </div>
               <div className="text-[9px] font-black uppercase tracking-[0.4em] text-neutral-600 flex items-center gap-2">
                  <Maximize size={10} /> {post.format} HD
               </div>
            </div>
          </div>
        </div>
      </main>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'main')} />
      <input type="file" ref={circleInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'circle')} />

      <footer className="mt-20 py-10 border-t border-white/5 text-center text-neutral-800 text-[10px] uppercase tracking-[0.5em] font-medium">
        <p>{post.brandName} • PWA HYBRID ENGINE • 2024</p>
      </footer>
    </div>
  );
};

export default App;
