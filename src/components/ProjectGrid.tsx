'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { ALL_TAGS, type ProjectTag, type Project } from '@/data/projects';
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

const TAG_EMOJIS: Record<string, string> = {
    Game: '🎮', Tool: '🛠️', AI: '🤖', Multiplayer: '👥', 
    Simulation: '🌍', Visual: '👁️', Finance: '💰', 
    Narrative: '📖', Sailing: '⛵', Classroom: '🏫'
};

export default function ProjectGrid() {
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedTag, setSelectedTag] = useState<ProjectTag | 'all'>('all');
    const [selectedCreator, setSelectedCreator] = useState<string | 'all'>('all');
    const [sortType, setSortType] = useState<'rating' | 'name'>('rating');
    const [showLiveOnly, setShowLiveOnly] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/projects')
            .then(res => res.json())
            .then(data => {
                setProjects(data);
                setLoading(false);
            });
    }, []);

    if (loading) return <div style={{ textAlign: 'center', padding: '50px' }}>Loading functions...</div>;

    const getDisplayName = (name: string) => {
        if (!name) return 'Unknown';
        return name.toLowerCase() === 'eric' ? 'AI Club' : name;
    };

    const uniqueCreators = Array.from(new Set(projects.map(p => getDisplayName(p.author_name || p.author)))).sort();

    const filtered = projects.filter(p => {
        const tagMatch = selectedTag === 'all' || p.tags.includes(selectedTag);
        const creatorMatch = selectedCreator === 'all' || getDisplayName(p.author_name || p.author) === selectedCreator;
        const liveMatch = !showLiveOnly || p.status === 'live';
        return tagMatch && creatorMatch && liveMatch;
    }).sort((a, b) => {
        if (sortType === 'rating') {
            return (b.rating || 0) - (a.rating || 0) || a.title.localeCompare(b.title);
        } else {
            return a.title.localeCompare(b.title);
        }
    });

    const handleRatingUpdate = (projectId: string, newRating: number, newCount: number) => {
        setProjects(prev => prev.map(p => 
            p.id === projectId ? { ...p, rating: newRating, rating_count: newCount } : p
        ));
    };

    return (
        <div>
            {/* Filter Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px', background: 'rgba(255,255,255,0.4)', padding: '20px', borderRadius: '16px' }}>
                {/* Tag Filters */}
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', maxWidth: '100%' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#2d3436', width: '80px', flexShrink: 0 }}>Category</span>
                    <div className="project-filter-panel" aria-label="Project categories">
                        <button
                            onClick={() => setSelectedTag('all')}
                            className={`project-filter-chip ${selectedTag === 'all' ? 'is-active' : ''}`}
                            style={{ '--tag-color': '#6c5ce7' } as CSSProperties}
                        >All</button>
                        {ALL_TAGS.map(tag => (
                            <button
                                key={tag}
                                onClick={() => setSelectedTag(tag)}
                                className={`project-filter-chip ${selectedTag === tag ? 'is-active' : ''}`}
                                style={{ '--tag-color': TAG_COLORS[tag] } as CSSProperties}
                            >{TAG_EMOJIS[tag] ? `${TAG_EMOJIS[tag]} ${tag}` : tag}</button>
                        ))}
                    </div>
                </div>

                {/* Creator Filters */}
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', maxWidth: '100%' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#2d3436', width: '80px', flexShrink: 0 }}>Creator</span>
                    <div className="project-filter-panel" aria-label="Project creators">
                        <button
                            onClick={() => setSelectedCreator('all')}
                            className={`project-filter-chip ${selectedCreator === 'all' ? 'is-active' : ''}`}
                            style={{ '--tag-color': '#e17055' } as CSSProperties}
                        >All</button>
                        {uniqueCreators.map(creator => (
                            <button
                                key={creator}
                                onClick={() => setSelectedCreator(creator)}
                                className={`project-filter-chip ${selectedCreator === creator ? 'is-active' : ''}`}
                                style={{ '--tag-color': '#e17055' } as CSSProperties}
                            >{creator}</button>
                        ))}
                    </div>
                    
                    <div style={{ flex: 1 }} />
                    
                    {/* Sort Options */}
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.6)', borderRadius: '20px', padding: '4px', gap: '4px' }}>
                        <button
                            onClick={() => setSortType('rating')}
                            style={{ border: 'none', background: sortType === 'rating' ? '#fff' : 'transparent', borderRadius: '16px', padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600, color: sortType === 'rating' ? '#2d3436' : '#636e72', cursor: 'pointer', boxShadow: sortType === 'rating' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}
                        >
                            ⭐ Top Rated
                        </button>
                        <button
                            onClick={() => setSortType('name')}
                            style={{ border: 'none', background: sortType === 'name' ? '#fff' : 'transparent', borderRadius: '16px', padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600, color: sortType === 'name' ? '#2d3436' : '#636e72', cursor: 'pointer', boxShadow: sortType === 'name' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}
                        >
                            🔤 A-Z
                        </button>
                    </div>

                    {/* Live Toggle */}
                    <button
                        onClick={() => setShowLiveOnly(!showLiveOnly)}
                        className={`project-live-toggle ${showLiveOnly ? 'is-active' : ''}`}
                        style={{
                            background: showLiveOnly ? 'rgba(46, 213, 115, 0.25)' : 'rgba(255,255,255,0.6)',
                            color: showLiveOnly ? '#27ae60' : '#636e72',
                            margin: 0
                        }}
                    >
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2ed573', display: 'inline-block', boxShadow: showLiveOnly ? '0 0 6px #2ed573' : 'none' }} />
                        Live Only
                    </button>
                </div>
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
                            <ProjectCard project={project} onRatingUpdate={handleRatingUpdate} />
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

function ProjectCard({ project, onRatingUpdate }: { project: any, onRatingUpdate?: (projectId: string, rating: number, count: number) => void }) {
    const isLive = project.status === 'live';
    const [rating, setRating] = useState(Number(project.rating || project.likes || 0));
    const [ratingCount, setRatingCount] = useState(Number(project.rating_count || project.likes || 0));
    const [hoverScore, setHoverScore] = useState(0);
    const [selectedScore, setSelectedScore] = useState(0);
    
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');

    const handleStarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const percentage = Math.max(0, Math.min(1, x / width));
        const score = Math.ceil(percentage * 10) / 2; // 0.5 increments
        setHoverScore(score);
    };

    const fetchComments = async () => {
        const res = await fetch(`/api/projects/comments?projectId=${project.id}`);
        const data = await res.json();
        setComments(data);
        
        const myComment = data.find((c: any) => c.is_own_comment);
        if (myComment) {
            setNewComment(myComment.content);
            setSelectedScore(myComment.author_score || 0);
        }
    };

    const handleComment = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (selectedScore === 0 || !newComment.trim()) {
            return;
        }
        
        const isUpdate = !!comments.find(c => c.is_own_comment);
        const oldScore = comments.find(c => c.is_own_comment)?.author_score || 0;
        
        // Optimistic UI for rating
        let newCount = ratingCount;
        let newRating = rating;

        if (isUpdate) {
            newRating = ratingCount > 0 ? (rating * ratingCount - oldScore + selectedScore) / ratingCount : selectedScore;
        } else {
            newCount = ratingCount + 1;
            newRating = (rating * ratingCount + selectedScore) / newCount;
        }
        
        setRating(newRating);
        setRatingCount(newCount);
        if (onRatingUpdate) onRatingUpdate(project.id, newRating, newCount);
        
        fetch('/api/projects/like', {
            method: 'POST',
            body: JSON.stringify({ projectId: project.id, score: selectedScore })
        });
        
        // Submit comment
        const tempContent = newComment;
        setNewComment('');
        setSelectedScore(0);
        
        const res = await fetch('/api/projects/comments', {
            method: 'POST',
            body: JSON.stringify({ projectId: project.id, content: tempContent })
        });
        if (res.ok) {
            fetchComments();
        }
    };

    const handleDeleteComment = async (commentId: number) => {
        const deletedComment = comments.find(c => c.id === commentId);
        setComments(comments.filter(c => c.id !== commentId));
        await fetch(`/api/projects/comments?commentId=${commentId}`, { method: 'DELETE' });
        
        // Reset inputs if we deleted our own comment
        setNewComment('');
        setSelectedScore(0);

        if (deletedComment && deletedComment.author_score > 0) {
            const newCount = Math.max(0, ratingCount - 1);
            const newRating = newCount > 0 ? (rating * ratingCount - deletedComment.author_score) / newCount : 0;
            setRating(newRating);
            setRatingCount(newCount);
            if (onRatingUpdate) onRatingUpdate(project.id, newRating, newCount);
        }
    };

    return (
        <div
            className="glass-panel"
            style={{
                padding: '28px', height: '100%', display: 'flex', flexDirection: 'column',
                gap: '12px', cursor: isLive ? 'pointer' : 'default',
                transition: 'transform 0.2s, box-shadow 0.2s',
                background: project.accent_color || project.accentColor,
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
                <span style={{ fontSize: '0.8rem', color: '#636e72', fontWeight: 500 }}>
                    by {project.author_name ? (project.author_name.toLowerCase() === 'eric' ? 'AI Club' : project.author_name) : (project.author?.toLowerCase() === 'eric' ? 'AI Club' : project.author)}
                </span>
            </div>

            {/* Description */}
            <p style={{ fontSize: '0.88rem', color: '#4a4a4a', lineHeight: 1.6, flex: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{project.description}</p>

            {/* Interaction Bar */}
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', margin: '8px 0', minHeight: '24px' }}>
                <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowComments(!showComments); if (!showComments) fetchComments(); }}
                    style={{ 
                        background: 'rgba(243, 156, 18, 0.1)', border: 'none', cursor: 'pointer', 
                        display: 'flex', alignItems: 'center', gap: '8px',
                        color: '#636e72', fontSize: '0.9rem', fontWeight: 600,
                        padding: '6px 12px', borderRadius: '16px', transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(243, 156, 18, 0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(243, 156, 18, 0.1)'}
                >
                    <span style={{ color: '#f39c12', fontSize: '1.05rem', transform: 'translateY(-1px)' }}>⭐</span>
                    {rating.toFixed(1)}
                    <span style={{ marginLeft: '4px' }}>💬 {project.commentCount || comments.length || 0}</span>
                </button>
            </div>

            {/* Comments & Review Section */}
            <AnimatePresence>
                {showComments && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden', fontSize: '0.85rem' }}
                        onClick={e => { e.preventDefault(); e.stopPropagation(); }}
                    >
                        <div style={{ padding: '10px 0', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                            {comments.map(c => (
                                <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                                    <div style={{ flex: 1 }}>
                                        <span style={{ fontWeight: 700 }}>
                                            {c.author_name} 
                                            {c.author_score > 0 && <span style={{ color: '#f39c12', fontSize: '0.8rem', marginLeft: '4px' }}>⭐ {c.author_score}</span>}
                                            : 
                                        </span>
                                        <span style={{ marginLeft: '4px' }}>{c.content}</span>
                                    </div>
                                    {c.is_own_comment && (
                                        <button 
                                            onClick={() => handleDeleteComment(c.id)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#b2bec3', padding: '0 4px' }}
                                            title="Delete comment"
                                        >🗑️</button>
                                    )}
                                </div>
                            ))}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', background: 'rgba(255,255,255,0.4)', padding: '12px', borderRadius: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontWeight: 600, color: '#2d3436' }}>Your Rating:</span>
                                    <div 
                                        onMouseMove={handleStarMouseMove}
                                        onMouseLeave={() => setHoverScore(0)}
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedScore(hoverScore); }}
                                        style={{ position: 'relative', cursor: 'pointer', fontSize: '1.2rem', display: 'inline-block', lineHeight: 1, letterSpacing: '2px', paddingBottom: '2px' }}
                                        title={hoverScore > 0 ? `Rate ${hoverScore} stars` : "Select a rating"}
                                    >
                                        <div style={{ color: '#dfe6e9' }}>★★★★★</div>
                                        <div style={{ 
                                            color: '#f39c12', position: 'absolute', top: 0, left: 0, 
                                            overflow: 'hidden', width: `${((hoverScore > 0 ? hoverScore : selectedScore) / 5) * 100}%`,
                                            whiteSpace: 'nowrap'
                                        }}>
                                            ★★★★★
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '0.85rem', color: '#f39c12', fontWeight: 700 }}>
                                        {hoverScore > 0 ? hoverScore : selectedScore > 0 ? selectedScore : ''}
                                    </span>
                                </div>
                                <form onSubmit={handleComment} style={{ display: 'flex', gap: '6px' }}>
                                    <input 
                                        value={newComment}
                                        onChange={e => setNewComment(e.target.value)}
                                        placeholder={selectedScore > 0 ? "Leave a comment for your rating..." : "Add a comment..."}
                                        style={{ flex: 1, padding: '6px 12px', borderRadius: '8px', border: '1px solid #dfe6e9', fontSize: '0.8rem', outline: 'none' }}
                                        onClick={e => { e.preventDefault(); e.stopPropagation(); }}
                                    />
                                    <button 
                                        type="submit" 
                                        className="btn btn-primary" 
                                        style={{ padding: '6px 14px', height: 'auto', fontSize: '0.8rem', opacity: (selectedScore === 0 || !newComment.trim()) ? 0.5 : 1, cursor: (selectedScore === 0 || !newComment.trim()) ? 'not-allowed' : 'pointer' }} 
                                        onClick={e => e.stopPropagation()}
                                        disabled={selectedScore === 0 || !newComment.trim()}
                                    >Post</button>
                                </form>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tags */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {project.tags.map((tag: string) => (
                    <span key={tag} style={{
                        padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                        background: `${TAG_COLORS[tag] || '#dfe6e9'}33`, color: TAG_COLORS[tag] || '#636e72'
                    }}>{TAG_EMOJIS[tag] ? `${TAG_EMOJIS[tag]} ${tag}` : tag}</span>
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
                {isLive && project.url ? (
                    <a href={project.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6c5ce7', textDecoration: 'none', background: 'rgba(108, 92, 231, 0.1)', padding: '6px 14px', borderRadius: '16px', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(108, 92, 231, 0.2)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(108, 92, 231, 0.1)'}>Open →</a>
                ) : isLive && (
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
