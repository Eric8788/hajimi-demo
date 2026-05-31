'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const COVER_WIDTH = 1200;
const COVER_HEIGHT = 675;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

type ProjectCoverStudioProps = {
    value: string;
    onChange: (url: string) => void;
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

export default function ProjectCoverStudio({ value, onChange }: ProjectCoverStudioProps) {
    const [sourceUrl, setSourceUrl] = useState('');
    const [metrics, setMetrics] = useState<ImageMetrics | null>(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [message, setMessage] = useState('');
    const [uploading, setUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
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
            width: `${metrics.naturalWidth * baseScale * zoom}px`,
            height: `${metrics.naturalHeight * baseScale * zoom}px`,
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
        };
    }, [metrics, offset.x, offset.y, zoom]);

    const setImageFile = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            setMessage('请选择图片文件。');
            return;
        }

        if (file.type === 'image/gif') {
            setMessage('项目封面会裁剪成静态 WebP，建议用 PNG/JPEG/WebP 截图。');
            return;
        }

        const nextUrl = URL.createObjectURL(file);
        const image = await loadImage(nextUrl);

        if (sourceUrl) URL.revokeObjectURL(sourceUrl);

        imageRef.current = image;
        setSourceUrl(nextUrl);
        setMetrics({
            width: image.width,
            height: image.height,
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
        });
        setZoom(1);
        setOffset({ x: 0, y: 0 });
        setMessage('已读取图片，可以拖动画面并缩放裁剪区域。');
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
        if (!imageRef.current || event.button !== 0) return;
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

        const nextOffset = {
            x: dragRef.current.originX + event.clientX - dragRef.current.startX,
            y: dragRef.current.originY + event.clientY - dragRef.current.startY,
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
        setMessage('');

        const blob = await exportCoverBlob();
        if (!blob) {
            setMessage('请先上传或粘贴一张图片。');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', new File([blob], `project-cover-${Date.now()}.webp`, { type: 'image/webp' }));

            const res = await fetch('/api/project-submissions/cover', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json().catch(() => null);

            if (!res.ok) {
                setMessage(data?.error || '封面上传失败，请稍后再试。');
                return;
            }

            onChange(data.url);
            setMessage('封面已上传，提交审核时会一起保存。');
        } finally {
            setUploading(false);
        }
    };

    return (
        <section className="project-cover-studio" onPaste={handlePaste}>
            <div className="project-cover-studio-head">
                <div>
                    <strong>截图 / 封面</strong>
                    <span>支持上传、直接粘贴截图，并拖动调整截取区域。</span>
                </div>
                {value && <span className="project-cover-ready">已保存 URL</span>}
            </div>

            <div
                className={`project-cover-cropper ${isDragging ? 'is-dragging' : ''} ${sourceUrl ? 'has-image' : ''}`}
                tabIndex={0}
                role="button"
                aria-label="项目封面裁剪区域，支持粘贴图片、点击上传或拖动调整画面"
                onClick={() => {
                    if (!sourceUrl) fileInputRef.current?.click();
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
            >
                {sourceUrl && cropStyle ? (
                    <img src={sourceUrl} alt="" draggable={false} style={cropStyle} />
                ) : (
                    <div className="project-cover-drop-hint">
                        <span>Paste / Upload</span>
                        <strong>把项目截图粘贴到这里</strong>
                        <small>也可以点击选择图片，之后拖动画面裁剪 16:9 封面。</small>
                    </div>
                )}
                <div className="project-cover-safe-frame" aria-hidden="true" />
            </div>

            <div className="project-cover-toolbar">
                <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>
                    选择图片
                </button>
                <label>
                    缩放
                    <input
                        type="range"
                        min={MIN_ZOOM}
                        max={MAX_ZOOM}
                        step="0.01"
                        value={zoom}
                        disabled={!sourceUrl}
                        onChange={event => handleZoomChange(Number(event.target.value))}
                    />
                </label>
                <button type="button" className="btn btn-primary" disabled={!sourceUrl || uploading} onClick={uploadCover}>
                    {uploading ? '上传中...' : '上传封面'}
                </button>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) void setImageFile(file);
                    event.currentTarget.value = '';
                }}
            />

            <label className="project-cover-url-field">
                或粘贴已有封面 URL
                <input value={value} onChange={event => onChange(event.target.value)} className="glass-input" placeholder="https://..." />
            </label>

            {message && <p className="project-cover-message">{message}</p>}
        </section>
    );
}
