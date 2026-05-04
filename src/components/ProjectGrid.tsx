'use client';

import { useState } from 'react';
import { PROJECTS, ALL_TAGS, type ProjectTag } from '@/data/projects';
import { motion, AnimatePresence } from 'framer-motion';

const TAG_COLORS: Record<string, string> = {
    Game: '#6c5ce7',
    Tool: '#00b894',
    AI: '#fd79a8',
    Multiplayer: '#e17055',
    Simulation: '#0984e3',
    Visual: '#a29bfe',
    Finance: '#00cec9',
    Narrative: '#fdcb6e',
    Sailing: '#0984e3',
    Classroom: '#b2bec3',
};

export default function ProjectGrid() {
    const [selectedTag, setSelectedTag] = useState<ProjectTag | 'all'>('all');
    const [showLiveOnly, setShowLiveOnly] = useState(false);

    const filtered = PROJECTS.filter(p => {
        const tagMatch = selectedTag === 'all' || p.tags.includes(selectedTag);
        const liveMatch = !showLiveOnly || p.status === 'live';
        return tagMatch && liveMatch;
    });

    return (
        <div>
            {/* Filter Bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '30px', alignItems: 'center' }}>
                {/* Tag Filters */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
                    <button
                        onClick={() => setSelectedTag('all')}
                        style={{
                            padding: '6px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                            background: selectedTag === 'all' ? '#6c5ce7' : 'rgba(255,255,255,0.6)',
                            color: selectedTag === 'all' ? 'white' : '#636e72',
                            fontWeight: 600, fontSize: '0.85rem', fontFamily: 'inherit', transition: 'all 0.2s'
                        }}
                    >All</button>
                    {ALL_TAGS.map(tag => (
                        <button
                            key={tag}
                            onClick={() => setSelectedTag(tag)}
                            style={{
                                padding: '6px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                                background: selectedTag === tag ? TAG_COLORS[tag] : 'rgba(255,255,255,0.6)',
                                color: selectedTag === tag ? 'white' : '#636e72',
                                fontWeight: 600, fontSize: '0.85rem', fontFamily: 'inherit', transition: 'all 0.2s'
                            }}
                        >{tag}</button>
                    ))}
                </div>

                {/* Live Toggle */}
                <button
                    onClick={() => setShowLiveOnly(!showLiveOnly)}
                    style={{
                        padding: '6px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                        background: showLiveOnly ? 'rgba(46, 213, 115, 0.25)' : 'rgba(255,255,255,0.6)',
                        color: showLiveOnly ? '#27ae60' : '#636e72',
                        fontWeight: 700, fontSize: '0.85rem', fontFamily: 'inherit', transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2ed573', display: 'inline-block', boxShadow: showLiveOnly ? '0 0 6px #2ed573' : 'none' }} />
                    Live Only
                </button>
            </div>

            {/* Project Grid */}
            <motion.div
                layout
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}
            >
                <AnimatePresence>
                    {filtered.map(project => (
                        <motion.div
                            key={project.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                        >
                            {project.url ? (
                                <a href={project.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
                                    <ProjectCard project={project} />
                                </a>
                            ) : (
                                <ProjectCard project={project} />
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </motion.div>

            {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px', color: '#b2bec3' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🔍</div>
                    <p>No projects match this filter yet.</p>
                </div>
            )}
        </div>
    );
}

function ProjectCard({ project }: { project: import('@/data/projects').Project }) {
    const isLive = project.status === 'live';

    return (
        <div
            className="glass-panel"
            style={{
                padding: '28px', height: '100%', display: 'flex', flexDirection: 'column',
                gap: '12px', cursor: isLive ? 'pointer' : 'default',
                transition: 'transform 0.2s, box-shadow 0.2s',
                background: project.accentColor,
                opacity: isLive ? 1 : 0.75,
                position: 'relative', overflow: 'hidden'
            }}
            onMouseEnter={e => { if (isLive) { (e.currentTarget as HTMLElement).style.transform = 'translateY(-5px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 40px rgba(0,0,0,0.12)'; }}}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
        >
            {/* Emoji */}
            <div style={{ fontSize: '2.8rem', lineHeight: 1 }}>{project.emoji}</div>

            {/* Title + Author */}
            <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2d3436', marginBottom: '2px' }}>{project.title}</h3>
                <span style={{ fontSize: '0.8rem', color: '#636e72', fontWeight: 500 }}>by {project.author}</span>
            </div>

            {/* Description */}
            <p style={{ fontSize: '0.88rem', color: '#4a4a4a', lineHeight: 1.6, flex: 1 }}>{project.description}</p>

            {/* Tags */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {project.tags.map(tag => (
                    <span key={tag} style={{
                        padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                        background: `${TAG_COLORS[tag]}33`, color: TAG_COLORS[tag]
                    }}>{tag}</span>
                ))}
            </div>

            {/* Status Badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                {isLive ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: '#27ae60' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2ed573', display: 'inline-block', boxShadow: '0 0 6px #2ed573' }} />
                        Live
                    </div>
                ) : (
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#b2bec3' }}>🔧 Coming Soon</div>
                )}
                {isLive && (
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#636e72' }}>Open →</div>
                )}
            </div>

            {/* Decoration emoji in background */}
            <div style={{ position: 'absolute', right: '-10px', bottom: '-15px', fontSize: '5rem', opacity: 0.07, pointerEvents: 'none' }}>
                {project.emoji}
            </div>
        </div>
    );
}
