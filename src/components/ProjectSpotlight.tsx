'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { Project } from '@/lib/db';
import { getImageDisplayUrl } from '@/lib/imageProxy';
import { recordProjectOpen } from '@/lib/hubRankings';
import './project-spotlight.css';

type FeaturedProject = Project & { coverUrl?: string | null };

export default function ProjectSpotlight({ projects, onSubmit, formOpen }: {
    projects: FeaturedProject[];
    onSubmit: () => void;
    formOpen: boolean;
}) {
    const [index, setIndex] = useState(0);
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const reducedMotion = useReducedMotion();
    const recent = [...projects]
        .filter(project => project.status === 'live' && /^https?:\/\//i.test(project.url || ''))
        .sort((a, b) => (Date.parse(String(b.created_at)) || 0) - (Date.parse(String(a.created_at)) || 0) || Number(b.id) - Number(a.id))
        .slice(0, 3);
    const slides: (FeaturedProject | null)[] = [null, ...recent];
    const active = Math.min(index, slides.length - 1);

    useEffect(() => {
        if (hovered || focused || reducedMotion || slides.length < 2) return;
        const timer = window.setInterval(() => {
            if (!document.hidden) setIndex(current => (current + 1) % slides.length);
        }, 6500);
        return () => window.clearInterval(timer);
    }, [hovered, focused, reducedMotion, slides.length]);

    return <section className="hub-notice" aria-label="项目告示牌" aria-roledescription="轮播"
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
        <div className="hub-notice-slides">
            {slides.map((project, position) => <article key={project?.id ?? 'submit'}
                className={`hub-notice-slide ${position === active ? 'is-active' : ''}`}
                aria-hidden={position !== active} inert={position !== active}>
                {project ? <>
                    <div className="hub-notice-poster">
                        {project.cover_url || project.coverUrl ? <img src={getImageDisplayUrl(project.cover_url || project.coverUrl)} alt={`${project.title} 项目截图`} /> : <span aria-hidden="true">{project.emoji || '🚀'}</span>}
                    </div>
                    <div className="hub-notice-copy"><small>最近上新</small><h2>{project.title}</h2><p>{project.description}</p></div>
                    <a className="hub-notice-action" href={project.url || undefined} target="_blank" rel="noopener noreferrer"
                        onClick={() => recordProjectOpen(project.id)} onAuxClick={event => { if (event.button === 1) recordProjectOpen(project.id); }}>打开项目 ↗</a>
                </> : <>
                    <div className="hub-notice-copy"><small>分享你的作品</small><h2>把你的项目放进 Hub</h2><p>一个名字、一张图片、一个链接、一段介绍。</p></div>
                    <button type="button" className="hub-notice-action" onClick={onSubmit}>{formOpen ? '收起申请' : '提交申请'}</button>
                </>}
            </article>)}
        </div>
        <div className="hub-notice-controls" aria-label="切换告示">
            <button type="button" aria-label="上一条告示" onClick={() => setIndex((active - 1 + slides.length) % slides.length)}>‹</button>
            {slides.map((project, position) => <button key={project?.id ?? 'submit'} type="button"
                aria-label={project ? `查看项目：${project.title}` : '查看提交申请'} aria-pressed={position === active}
                className={`hub-notice-dot ${position === active ? 'is-active' : ''}`} onClick={() => setIndex(position)} />)}
            <button type="button" aria-label="下一条告示" onClick={() => setIndex((active + 1) % slides.length)}>›</button>
        </div>
    </section>;
}
