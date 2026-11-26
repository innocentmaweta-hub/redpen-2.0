import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

type Tool = 'pen' | 'eraser' | 'tick' | 'cross' | 'text' | 'line' | 'rectangle' | 'marks';
type Mark = { id: string; page: number; x: number; y: number; score: number };
type MarkMeta = { enabled: boolean; maximum: string };
type Props = { file: File | null; annotations: Record<string, string>; onChange: (value: Record<string, string>) => void };
type Point = { x: number; y: number };

const readMarks = (value: Record<string, string>): Mark[] => {
  try { const parsed = JSON.parse(value.__marks__ || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
};
const readMeta = (value: Record<string, string>): MarkMeta => {
  try { const parsed = JSON.parse(value.__marking_meta__ || '{}'); return { enabled: Boolean(parsed.enabled), maximum: String(parsed.maximum ?? '') }; } catch { return { enabled: false, maximum: '' }; }
};

export default function ManualPaperCanvas({ file, annotations, onChange }: Props) {
  const paperRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#dc4545');
  const [size, setSize] = useState(3);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const drawing = useRef(false);
  const start = useRef<Point | null>(null);
  const pdfRef = useRef<any>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const annotationsRef = useRef(annotations);
  const snapshotRef = useRef<string | null>(null);
  const marks = readMarks(annotations);
  const markMeta = readMeta(annotations);
  const awardedTotal = marks.reduce((sum, mark) => sum + (Number(mark.score) || 0), 0);

  useEffect(() => { annotationsRef.current = annotations; }, [annotations]);

  const updateMarks = (nextMarks: Mark[], nextMeta = markMeta) => {
    onChange({ ...annotations, __marks__: JSON.stringify(nextMarks), __marking_meta__: JSON.stringify(nextMeta) });
  };
  const updateMeta = (nextMeta: MarkMeta) => {
    onChange({ ...annotations, __marks__: JSON.stringify(marks), __marking_meta__: JSON.stringify(nextMeta) });
  };
  const saveScoreAt = (point: Point) => {
    const raw = window.prompt('Enter marks awarded at this position');
    if (raw === null || !raw.trim()) return;
    const score = Number(raw);
    const maximum = Number(markMeta.maximum);
    if (!Number.isFinite(score) || score < 0) { window.alert('Enter a valid score of zero or more.'); return; }
    if (markMeta.maximum.trim() && score > maximum) { window.alert('This score cannot exceed the total possible marks for the paper.'); return; }
    const next = [...marks, { id: crypto.randomUUID(), page, x: point.x / (inkRef.current?.width || 1), y: point.y / (inkRef.current?.height || 1), score }];
    updateMarks(next);
  };
  const editScore = (mark: Mark) => {
    const raw = window.prompt('Edit marks awarded', String(mark.score));
    if (raw === null || !raw.trim()) return;
    const score = Number(raw);
    const maximum = Number(markMeta.maximum);
    if (!Number.isFinite(score) || score < 0) { window.alert('Enter a valid score of zero or more.'); return; }
    if (markMeta.maximum.trim() && score > maximum) { window.alert('This score cannot exceed the total possible marks for the paper.'); return; }
    updateMarks(marks.map(item => item.id === mark.id ? { ...item, score } : item));
  };

  const saveSnapshot = useCallback(() => {
    const canvas = inkRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    snapshotRef.current = url;
    setUndoStack(stack => [...stack.slice(-39), url]);
    setRedoStack([]);
  }, []);

  const persistCurrentPage = useCallback(() => {
    const canvas = inkRef.current;
    if (!canvas) return;
    const next = { ...annotationsRef.current, [String(page)]: canvas.toDataURL('image/png') };
    annotationsRef.current = next;
    onChange(next);
  }, [onChange, page]);

  const renderPage = useCallback(async (pageNumber: number) => {
    const base = paperRef.current;
    const ink = inkRef.current;
    if (!base || !ink) return;
    setBusy(true);
    try {
      const context = base.getContext('2d');
      if (!context) return;
      if (pdfRef.current) {
        const pdfPage = await pdfRef.current.getPage(pageNumber);
        const viewport = pdfPage.getViewport({ scale: 1.35 * zoom });
        base.width = viewport.width; base.height = viewport.height;
        ink.width = viewport.width; ink.height = viewport.height;
        await pdfPage.render({ canvas: base, canvasContext: context, viewport }).promise;
      } else if (imageRef.current) {
        const image = imageRef.current;
        const scale = Math.min(1.6, 1100 / image.naturalWidth) * zoom;
        base.width = Math.round(image.naturalWidth * scale); base.height = Math.round(image.naturalHeight * scale);
        ink.width = base.width; ink.height = base.height;
        context.clearRect(0, 0, base.width, base.height);
        context.drawImage(image, 0, 0, base.width, base.height);
      }
      context.imageSmoothingEnabled = true;
      const saved = annotationsRef.current[String(pageNumber)];
      const inkContext = ink.getContext('2d');
      inkContext?.clearRect(0, 0, ink.width, ink.height);
      if (saved) {
        const savedImage = new Image();
        savedImage.onload = () => inkContext?.drawImage(savedImage, 0, 0, ink.width, ink.height);
        savedImage.src = saved;
      }
      setUndoStack([]); setRedoStack([]);
    } catch (error) { console.error('Could not render paper page:', error); }
    finally { setBusy(false); }
  }, [zoom]);

  useEffect(() => {
    let cancelled = false;
    pdfRef.current = null; imageRef.current = null;
    setPage(1); setPageCount(1);
    if (!file) return;
    let imageUrl = '';
    (async () => {
      try {
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
          if (cancelled) return;
          pdfRef.current = document; setPageCount(document.numPages);
        } else if (file.type.startsWith('image/')) {
          const image = new Image();
          image.onload = () => { if (!cancelled) { imageRef.current = image; void renderPage(1); } };
          imageUrl = URL.createObjectURL(file); image.src = imageUrl;
        }
      } catch (error) { console.error('Could not load paper into marking canvas:', error); }
    })();
    return () => { cancelled = true; if (imageUrl) URL.revokeObjectURL(imageUrl); };
  }, [file]);

  useEffect(() => { if (file && (pdfRef.current || imageRef.current)) void renderPage(page); }, [file, page, zoom, pageCount]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (event.currentTarget.width / rect.width), y: (event.clientY - rect.top) * (event.currentTarget.height / rect.height) };
  };
  const pointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!inkRef.current) return;
    const point = pointFromEvent(event);
    if (tool === 'marks') { saveScoreAt(point); return; }
    event.currentTarget.setPointerCapture(event.pointerId);
    saveSnapshot(); start.current = point;
    if (tool === 'text') {
      const value = window.prompt('Enter annotation text');
      if (value) {
        const ctx = inkRef.current.getContext('2d');
        if (ctx) { ctx.fillStyle = color; ctx.font = `bold ${Math.max(14, size * 6)}px Arial`; ctx.fillText(value, point.x, point.y); }
        persistCurrentPage();
      }
      return;
    }
    drawing.current = true;
    const ctx = inkRef.current.getContext('2d');
    if (!ctx) return;
    if (tool === 'tick' || tool === 'cross') {
      ctx.strokeStyle = tool === 'tick' ? '#159b68' : '#dc4545';
      ctx.lineWidth = Math.max(3, size * 1.5); ctx.lineCap = 'round'; ctx.beginPath();
      if (tool === 'tick') { ctx.moveTo(point.x - 12, point.y); ctx.lineTo(point.x - 2, point.y + 12); ctx.lineTo(point.x + 18, point.y - 14); }
      else { ctx.moveTo(point.x - 11, point.y - 11); ctx.lineTo(point.x + 11, point.y + 11); ctx.moveTo(point.x + 11, point.y - 11); ctx.lineTo(point.x - 11, point.y + 11); }
      ctx.stroke(); drawing.current = false; persistCurrentPage(); return;
    }
    ctx.beginPath(); ctx.moveTo(point.x, point.y);
  };
  const pointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !inkRef.current) return;
    const point = pointFromEvent(event);
    const ctx = inkRef.current.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = tool === 'eraser' ? size * 8 : size;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (tool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
    else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = color; }
    if (tool === 'line' || tool === 'rectangle') {
      const saved = snapshotRef.current;
      if (saved) { const image = new Image(); image.onload = () => { const canvas = inkRef.current; if (!canvas) return; ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0); ctx.beginPath(); if (tool === 'line') { ctx.moveTo(start.current!.x, start.current!.y); ctx.lineTo(point.x, point.y); } else ctx.rect(start.current!.x, start.current!.y, point.x - start.current!.x, point.y - start.current!.y); ctx.stroke(); }; image.src = saved; }
    } else { ctx.lineTo(point.x, point.y); ctx.stroke(); }
  };
  const pointerUp = () => { if (!drawing.current) return; drawing.current = false; if (inkRef.current) inkRef.current.getContext('2d')!.globalCompositeOperation = 'source-over'; persistCurrentPage(); };
  const undo = () => {
    if (!inkRef.current || !undoStack.length) return;
    const current = inkRef.current.toDataURL('image/png'), previous = undoStack[undoStack.length - 1];
    setRedoStack(stack => [...stack, current]); setUndoStack(stack => stack.slice(0, -1));
    const image = new Image(); image.onload = () => { const ctx = inkRef.current?.getContext('2d'); ctx?.clearRect(0, 0, inkRef.current!.width, inkRef.current!.height); ctx?.drawImage(image, 0, 0); persistCurrentPage(); }; image.src = previous;
  };
  const redo = () => {
    if (!inkRef.current || !redoStack.length) return;
    const current = inkRef.current.toDataURL('image/png'), next = redoStack[redoStack.length - 1];
    setUndoStack(stack => [...stack, current]); setRedoStack(stack => stack.slice(0, -1));
    const image = new Image(); image.onload = () => { const ctx = inkRef.current?.getContext('2d'); ctx?.clearRect(0, 0, inkRef.current!.width, inkRef.current!.height); ctx?.drawImage(image, 0, 0); persistCurrentPage(); }; image.src = next;
  };
  const clear = () => { saveSnapshot(); const canvas = inkRef.current; canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height); persistCurrentPage(); };

  if (!file) return <div className="manual-canvas-empty">Upload a paper to annotate it while marking.</div>;
  return <section className="manual-canvas">
    <div className="manual-canvas-toolbar">
      <div className="canvas-toolbar-section">
        <strong className="canvas-toolbar-label">ANNOTATION TOOLS</strong>
        <div className="manual-tools">
          {(['pen','eraser','tick','cross','text','line','rectangle'] as Tool[]).map(item => <button type="button" key={item} title={item==='tick'?'Green tick':item==='cross'?'Red cross':item==='rectangle'?'Draw rectangle':item==='line'?'Draw line':item==='text'?'Add text':item==='pen'?'Freehand pen':'Erase ink'} aria-pressed={tool===item} className={tool===item?'active':''} onClick={()=>setTool(item)}>{item==='tick'?'✓':item==='cross'?'✕':item==='rectangle'?'Rectangle':item==='line'?'Line':item==='text'?'Text':item==='eraser'?'Eraser':'Pen'}</button>)}
          <button type="button" aria-pressed={tool==='marks'} className={tool==='marks'?'active':''} onClick={()=>{const next={...markMeta,enabled:!markMeta.enabled};updateMeta(next);setTool(next.enabled?'marks':'pen');}} title="Click the paper to place awarded scores">Marks mode</button>
        </div>
      </div>
      {markMeta.enabled && <div className="canvas-toolbar-section canvas-marks-panel">
        <strong className="canvas-toolbar-label">PAPER MARKS</strong>
        <label className="canvas-maximum-field">Maximum possible marks
          <input aria-label="Maximum possible marks for this paper" type="number" min="0" step="any" value={markMeta.maximum} onChange={e=>updateMeta({...markMeta,maximum:e.target.value})} placeholder="Enter total"/>
        </label>
        <span className="canvas-awarded-total">Awarded <b>{Number(awardedTotal.toFixed(2))}</b></span>
      </div>}
      <div className="canvas-toolbar-section canvas-adjustments">
        <strong className="canvas-toolbar-label">APPEARANCE</strong>
        <label className="canvas-color">Ink colour <input aria-label="Ink colour" type="color" value={color} onChange={e=>setColor(e.target.value)}/></label>
        <label className="canvas-size">Brush size <input aria-label="Brush size" type="range" min="1" max="10" value={size} onChange={e=>setSize(Number(e.target.value))}/></label>
      </div>
      <div className="canvas-toolbar-section canvas-history">
        <strong className="canvas-toolbar-label">EDIT</strong>
        <button type="button" onClick={undo} disabled={!undoStack.length}>↶ Undo</button>
        <button type="button" onClick={redo} disabled={!redoStack.length}>↷ Redo</button>
        <button type="button" onClick={clear}>Clear all</button>
      </div>
      <div className="canvas-toolbar-section canvas-navigation">
        <strong className="canvas-toolbar-label">VIEW</strong>
        <button type="button" onClick={()=>setZoom(z=>Math.max(.65,Math.round((z-.15)*100)/100))} aria-label="Zoom out">−</button>
        <span className="canvas-zoom-value">{Math.round(zoom*100)}%</span>
        <button type="button" onClick={()=>setZoom(z=>Math.min(1.8,Math.round((z+.15)*100)/100))} aria-label="Zoom in">+</button>
        <span className="canvas-page-value">Page {page} of {pageCount}</span>
        <button type="button" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>Previous page</button>
        <button type="button" onClick={()=>setPage(p=>Math.min(pageCount,p+1))} disabled={page===pageCount}>Next page</button>
      </div>
    </div>
    <div className="manual-canvas-stage">{busy&&<span className="canvas-loading">Rendering paper…</span>}<div className="manual-canvas-sheet"><canvas ref={paperRef}/><canvas ref={inkRef} className="manual-ink-layer" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}/>{marks.filter(mark=>mark.page===page).map(mark=><button type="button" key={mark.id} className="paper-score-annotation" style={{left:(mark.x*100)+'%',top:(mark.y*100)+'%'}} onClick={()=>editScore(mark)} title="Click to edit this score">{mark.score}</button>)}</div></div>
    {markMeta.enabled && <p className="canvas-marking-hint">Marks mode is active: click beside an answer to enter its score. Click an existing score to edit it.</p>}
  </section>;
}
