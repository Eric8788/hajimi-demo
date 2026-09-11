'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const COVER_WIDTH = 1200;
const COVER_HEIGHT = 675;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

type ProjectCoverStudioProps = {
    value: string;
    onChange: (url: string) => void;
    onPendingChange: (pending: boolean) => void;
};

type ImageMetrics = {
    width: number;
    height: number;
    naturalWidth: number;
    naturalHeight: number;
};

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function getCoverBounds(image: HTMLImageElement, zoom: number) {
    const baseScale = Math.max(COVER_WIDTH / image.naturalWidth, COVER_HEIGHT / image.naturalHeight);
    const width = image.naturalWidth * baseScale * zoom;
    const height = image.naturalHeight * baseScale * zoom;

    return { width, height };
}

function getSafeCropOffset(image: HTMLImageElement, zoom: number, offset: { x: number; y: number }) {
    const bounds = getCoverBounds(image, zoom);
    const maxX = Math.max(0, (bounds.width - COVER_WIDTH) / 2);
    const maxY = Math.max(0, (bounds.height - COVER_HEIGHT) / 2);

    return {
        x: clamp(offset.x, -maxX, maxX),
        y: clamp(offset.y, -maxY, maxY),
    };
}

async function loadImage(src: string) {
    const image = new Image();
    image.decoding = 'async';
    image.src = src;
    await image.decode();
    return image;
}

export default function ProjectCoverStudio({ value, onChange, onPendingChange }: ProjectCoverStudioProps) {
    const [sourceUrl, setSourceUrl] = useState('');
    const [metrics, setMetrics] = useState<ImageMetrics | null>(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [message, setMessage] = useState('');
    const [uploading, setUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [reading, setReading] = useState(false);
    const [dropActive, setDropActive] = useState(false);
    const fileReadId = useRef(0);

    useEffect(() => {
        onPendingChange(Boolean(sourceUrl) || uploading || reading);
    }, [sourceUrl, uploading, reading, onPendingChange]);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

    useEffect(() => {
        return () => {
            if (sourceUrl) URL.revokeObjectURL(sourceUrl);
        };
    }, [sourceUrl]);

    const cropStyle = useMemo(() => {
        if (!metrics) return undefined;
        const baseScale = Math.max(COVER_WIDTH / metrics.naturalWidth, COVER_HEIGHT / metrics.naturalHeight);
        return {
            width: `${metrics.naturalWidth * baseScale * zoom / COVER_WIDTH * 100}%`,
            height: `${metrics.naturalHeight * baseScale * zoom / COVER_HEIGHT * 100}%`,
            left: `${50 + offset.x / COVER_WIDTH * 100}%`,
            top: `${50 + offset.y / COVER_HEIGHT * 100}%`,
            transform: 'translate(-50%, -50%)',
        };
    }, [metrics, offset.x, offset.y, zoom]);

    const setImageFile = async (file: File) => {
        if (uploading || reading) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
            setMessage('请选择 PNG、JPEG 或 WebP 图片。');
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            setMessage('原图不能超过 20 MB，请换一张较小的截图。');
            return;
        }
        const readId = ++fileReadId.current;
        const nextUrl = URL.createObjectURL(file);
        setReading(true);
        try {
            const image = await loadImage(nextUrl);
            if (readId !== fileReadId.current) { URL.revokeObjectURL(nextUrl); return; }
            imageRef.current = image;
            setSourceUrl(nextUrl);
            setMetrics({ width: image.width, height: image.height, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight });
            setZoom(1);
            setOffset({ x: 0, y: 0 });
            setMessage('拖动或用方向键调整画面，满意后点击「使用这张封面」。');
        } catch {
            URL.revokeObjectURL(nextUrl);
            setMessage('无法读取这张图片，请换一张 PNG、JPEG 或 WebP 截图。');
        } finally {
            setReading(false);
        }
    };

    const handlePaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest('input, textarea')) return;

        const imageFile = Array.from(event.clipboardData.files).find(file => file.type.startsWith('image/'));
        if (!imageFile) {
            setMessage('剪贴板里没有图片，可以先复制截图再粘贴。');
            return;
        }

        event.preventDefault();
        await setImageFile(imageFile);
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!sourceUrl || !imageRef.current || uploading || event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            originX: offset.x,
            originY: offset.y,
        };
        setIsDragging(true);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current || !imageRef.current) return;

        const scale = COVER_WIDTH / event.currentTarget.getBoundingClientRect().width;
        const nextOffset = {
            x: dragRef.current.originX + (event.clientX - dragRef.current.startX) * scale,
            y: dragRef.current.originY + (event.clientY - dragRef.current.startY) * scale,
        };
        setOffset(getSafeCropOffset(imageRef.current, zoom, nextOffset));
    };

    const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) return;
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        setIsDragging(false);
    };

    const handleZoomChange = (nextZoom: number) => {
        const cleanZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
        setZoom(cleanZoom);
        if (imageRef.current) {
            setOffset(current => getSafeCropOffset(imageRef.current!, cleanZoom, current));
        }
    };

    const exportCoverBlob = async () => {
        if (!imageRef.current) return null;

        const image = imageRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = COVER_WIDTH;
        canvas.height = COVER_HEIGHT;
        const context = canvas.getContext('2d');
        if (!context) return null;

        const bounds = getCoverBounds(image, zoom);
        const drawX = (COVER_WIDTH - bounds.width) / 2 + offset.x;
        const drawY = (COVER_HEIGHT - bounds.height) / 2 + offset.y;

        context.fillStyle = '#eef2ff';
        context.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);
        context.drawImage(image, drawX, drawY, bounds.width, bounds.height);

        return new Promise<Blob | null>(resolve => {
            canvas.toBlob(resolve, 'image/webp', 0.86);
        });
    };

    const uploadCover = async () => {
        if (uploading || reading) return;
        setMessage('');
        setUploading(true);
        try {
            const blob = await exportCoverBlob();
            if (!blob) throw new Error('请先选择一张图片。');
            if (blob.size > 1024 * 1024) throw new Error('裁剪后的封面仍超过 1 MB，请换一张细节较少的图片。');
            const formData = new FormData();
            formData.append('file', new File([blob], `project-cover-${Date.now()}.webp`, { type: 'image/webp' }));
            const res = await fetch('/api/project-submissions/cover', { method: 'POST', body: formData });
            const data = await res.json().catch(() => null);
            if (!res.ok || typeof data?.url !== 'string') throw new Error(data?.error || '封面上传失败，请稍后重试。');
            onChange(data.url);
            setSourceUrl('');
            setMetrics(null);
            imageRef.current = null;
            setMessage('封面已准备好，会随项目一起提交审核。');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : '网络连接失败，请重试上传。');
        } finally {
            setUploading(false);
        }
    };

    return (
        <section className="project-cover-studio" onPaste={handlePaste}>
            {value && !sourceUrl && <span className="project-cover-ready">✓ 封面已就绪</span>}
            <div
                className={`project-cover-cropper ${isDragging ? 'is-dragging' : ''} ${sourceUrl ? 'has-image' : ''} ${dropActive ? 'is-drop-active' : ''}`}
                tabIndex={uploading || reading ? -1 : 0}
                role="button"
                aria-disabled={uploading || reading}
                aria-label={sourceUrl ? '封面裁剪区域，拖动或用方向键调整画面' : '选择项目图片，也可粘贴截图或拖入图片'}
                onClick={() => { if (!sourceUrl && !uploading && !reading) fileInputRef.current?.click(); }}
                onKeyDown={event => {
                    if (uploading || reading) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        fileInputRef.current?.click();
                    }
                    if (sourceUrl && imageRef.current && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
                        event.preventDefault();
                        const step = event.shiftKey ? 40 : 10;
                        setOffset(current => getSafeCropOffset(imageRef.current!, zoom, {
                            x: current.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
                            y: current.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
                        }));
                    }
                }}
                onDragOver={event => { event.preventDefault(); setDropActive(true); }}
                onDragLeave={() => setDropActive(false)}
                onDrop={event => { event.preventDefault(); setDropActive(false); const file = event.dataTransfer.files[0]; if (file) void setImageFile(file); }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
            >
                {sourceUrl && cropStyle ? (
                    <img src={sourceUrl} alt="待裁剪的项目图片" draggable={false} style={cropStyle} />
                ) : value ? (
                    <img className="project-cover-saved-image" src={value} alt="已选项目封面" />
                ) : (
                    <div className="project-cover-drop-hint">

                        <strong>{reading ? '正在读取图片…' : '点击上传或拖入图片'}</strong>
                        <small>支持粘贴 · PNG / JPEG / WebP · 最大 20 MB</small>
                    </div>
                )}
                {sourceUrl && <div className="project-cover-safe-frame" aria-hidden="true" />}
            </div>
            {(sourceUrl || value) && <div className="project-cover-toolbar">
                <button type="button" className="btn" disabled={uploading || reading} onClick={() => fileInputRef.current?.click()}>{value || sourceUrl ? '更换图片' : '选择图片'}</button>
                {sourceUrl && <>
                    <label>缩放<input type="range" min={MIN_ZOOM} max={MAX_ZOOM} step="0.01" value={zoom} disabled={uploading} onChange={event => handleZoomChange(Number(event.target.value))} /></label>
                    <button type="button" className="btn btn-primary" disabled={uploading} onClick={uploadCover}>{uploading ? '上传中…' : '使用这张封面'}</button>
                    <button type="button" className="btn" disabled={uploading} onClick={() => { setSourceUrl(''); setMetrics(null); imageRef.current = null; setMessage(''); }}>取消更换</button>
                </>}
                {!sourceUrl && value && <button type="button" className="btn" disabled={reading} onClick={() => { onChange(''); setMessage(''); }}>移除</button>}
            </div>}
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={uploading || reading} onChange={event => {
                const file = event.target.files?.[0];
                if (file) void setImageFile(file);
                event.currentTarget.value = '';
            }} />
            {message && <p className="project-cover-message" role="status">{message}</p>}
        </section>
    );
}
