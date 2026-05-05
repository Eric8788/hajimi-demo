'use client';

import { useState, useEffect } from 'react';
import { Post, User } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import PostCard from './PostCard';
import { useRouter } from 'next/navigation';

const TAG_OPTIONS = [
    { id: 'general', label: '💬 General' },
    { id: 'resource', label: '📚 Resource' },
    { id: 'question', label: '❓ Question' },
    { id: 'announcement', label: '📢 Announcement' },
    { id: 'project', label: '🛠️ Project' },
    { id: 'meme', label: '😂 Meme' },
];

export default function ForumFeed({ user, initialPosts }: { user: User | null, initialPosts: Post[] }) {
    const router = useRouter();
    const [posts, setPosts] = useState<Post[]>(initialPosts);
    const [isCreating, setIsCreating] = useState(false);
    const [sortType, setSortType] = useState<'time' | 'heat' | 'likes'>('time');
    const [filterType, setFilterType] = useState<'all' | 'saved'>('all');
    const [selectedTag, setSelectedTag] = useState<string>('all');
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newTag, setNewTag] = useState('general');
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [createError, setCreateError] = useState('');
    const [popularTags, setPopularTags] = useState<{ tag: string; count: number }[]>([]);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);

    const requireLogin = () => {
        if (!user) {
            setShowLoginPrompt(true);
            return true;
        }
        return false;
    };

    // Fetch popular tags on mount
    useEffect(() => {
        const tagCounts: Record<string, number> = {};
        initialPosts.forEach(p => {
            tagCounts[p.tag || 'general'] = (tagCounts[p.tag || 'general'] || 0) + 1;
        });
        const sorted = Object.entries(tagCounts).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
        setPopularTags(sorted.slice(0, 6));
    }, [initialPosts]);

    const fetchPosts = async (sort: string = sortType, filter: string = filterType, tag: string = selectedTag) => {
        const tagParam = tag !== 'all' ? `&tag=${tag}` : '';
        const res = await fetch(`/api/posts?sort=${sort}&filter=${filter}${tagParam}`, { cache: 'no-store' });
        const data = await res.json();
        setPosts(data);
    };

    const handleSortChange = (type: 'time' | 'heat' | 'likes') => {
        setSortType(type);
        setFilterType('all');
        fetchPosts(type, 'all', selectedTag);
    };

    const handleFilterChange = (filter: 'all' | 'saved') => {
        if (filter === 'saved' && requireLogin()) return;
        setFilterType(filter);
        fetchPosts(sortType, filter, selectedTag);
    };

    const handleTagFilter = (tag: string) => {
        setSelectedTag(tag);
        setFilterType('all');
        fetchPosts(sortType, 'all', tag);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setCreateError('');

        const formData = new FormData();
        formData.append('title', newTitle);
        formData.append('content', newContent);
        formData.append('tag', newTag);
        if (file) {
            formData.append('file', file);
            if (file.type.startsWith('image/')) formData.append('type', 'image');
            else formData.append('type', 'file');
        } else {
            formData.append('type', 'text');
        }

        try {
            const res = await fetch('/api/posts', { method: 'POST', body: formData });
            const data = await res.json().catch(() => null);

            if (!res.ok) {
                setCreateError(data?.error || 'Failed to publish post. Please try again.');
                return;
            }

            setNewTitle('');
            setNewContent('');
            setNewTag('general');
            setFile(null);
            setIsCreating(false);
            await fetchPosts();
        } finally {
            setLoading(false);
        }
    };

    const handlePostDeleted = (postId: number) => {
        setPosts(current => current.filter(p => p.id !== postId));
    };

    return (
        <div>
            {/* Login Prompt Modal */}
            <AnimatePresence>
                {showLoginPrompt && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowLoginPrompt(false)}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 1000,
                            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                background: 'rgba(255,255,255,0.95)', borderRadius: '28px',
                                padding: '40px', textAlign: 'center', maxWidth: '380px',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
                            }}
                        >
                            <div style={{ fontSize: '3rem', marginBottom: '15px' }}>🔐</div>
                            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '10px', color: '#2d3436' }}>Join the conversation!</h3>
                            <p style={{ color: '#636e72', marginBottom: '25px', lineHeight: 1.6 }}>
                                Create a free account to post, like, comment, and save your favourite discussions.
                            </p>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                <button
                                    onClick={() => setShowLoginPrompt(false)}
                                    style={{ padding: '12px 20px', borderRadius: '20px', border: '1px solid #dfe6e9', background: 'transparent', color: '#636e72', fontWeight: 600, cursor: 'pointer' }}
                                >Maybe Later</button>
                                <button
                                    onClick={() => router.push('/login')}
                                    style={{ padding: '12px 24px', borderRadius: '20px', border: 'none', background: 'linear-gradient(135deg, #a29bfe, #6c5ce7)', color: 'white', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 15px rgba(108,92,231,0.35)' }}
                                >Sign In →</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tags Bar */}
            {popularTags.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: '#636e72', fontWeight: 600 }}>🏷️</span>
                    <button
                        onClick={() => handleTagFilter('all')}
                        style={{
                            padding: '4px 12px', borderRadius: '15px', border: 'none',
                            background: selectedTag === 'all' ? '#6c5ce7' : 'rgba(255,255,255,0.6)',
                            color: selectedTag === 'all' ? 'white' : '#636e72',
                            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                        }}
                    >All</button>
                    {popularTags.map(t => (
                        <button
                            key={t.tag}
                            onClick={() => handleTagFilter(t.tag)}
                            style={{
                                padding: '4px 12px', borderRadius: '15px', border: 'none',
                                background: selectedTag === t.tag ? '#6c5ce7' : 'rgba(255,255,255,0.6)',
                                color: selectedTag === t.tag ? 'white' : '#636e72',
                                fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                            }}
                        >
                            #{t.tag} <span style={{ opacity: 0.7 }}>({t.count})</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Sort Tabs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginBottom: '20px', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.4)', padding: '5px', borderRadius: '25px' }}>
                    {[
                        { id: 'time', label: '🕒 Latest' },
                        { id: 'heat', label: '🔥 Hot' },
                        { id: 'likes', label: '❤️ Top' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => handleSortChange(tab.id as 'time' | 'heat' | 'likes')}
                            style={{
                                padding: '8px 16px',
                                background: sortType === tab.id && filterType === 'all' ? '#6c5ce7' : 'transparent',
                                color: sortType === tab.id && filterType === 'all' ? 'white' : '#636e72',
                                border: 'none', borderRadius: '20px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                            }}
                        >{tab.label}</button>
                    ))}
                </div>
                <div style={{ width: '1px', height: '30px', background: 'rgba(0,0,0,0.1)' }}></div>
                <button
                    onClick={() => handleFilterChange(filterType === 'saved' ? 'all' : 'saved')}
                    style={{
                        padding: '8px 16px',
                        background: filterType === 'saved' ? '#fdcb6e' : 'rgba(255,255,255,0.4)',
                        color: filterType === 'saved' ? 'white' : '#636e72',
                        border: 'none', borderRadius: '20px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                    }}
                >{filterType === 'saved' ? '★ Saved' : '☆ Saved'}</button>
            </div>

            {/* Create Trigger */}
            {!isCreating && (
                <div
                    onClick={() => { if (!requireLogin()) setIsCreating(true); }}
                    className="glass-card"
                    style={{ marginBottom: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', border: '2px dashed rgba(162, 155, 254, 0.5)', background: 'rgba(255,255,255,0.3)' }}
                >
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fab1a0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', border: '2px solid white' }}>
                        {user?.avatar || '✍️'}
                    </div>
                    <div style={{ flex: 1, padding: '12px 20px', borderRadius: '20px', background: 'rgba(255,255,255,0.6)', color: '#636e72', fontWeight: 500 }}>
                        {user ? `Share your thoughts, ${user.username}...` : 'Sign in to share your thoughts...'}
                    </div>
                    <div style={{ width: '40px', height: '40px', background: '#a29bfe', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.2rem' }}>✒️</div>
                </div>
            )}

            {/* Create Form (only shown when logged in and isCreating) */}
            <AnimatePresence>
                {isCreating && user && (
                    <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} onSubmit={handleCreate} className="glass-panel" style={{ padding: '25px', marginBottom: '30px', background: 'rgba(255,255,255,0.8)' }}>
                        <h3 style={{ marginBottom: '20px' }}>✨ Create a New Post</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input placeholder="Title..." value={newTitle} onChange={e => setNewTitle(e.target.value)} required className="glass-input" style={{ fontWeight: 'bold', fontSize: '1.1rem' }} />
                            {/* Tag Selector */}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.9rem', color: '#636e72' }}>Tag:</span>
                                {TAG_OPTIONS.map(t => (
                                    <button key={t.id} type="button" onClick={() => setNewTag(t.id)} style={{ padding: '5px 12px', borderRadius: '15px', border: 'none', background: newTag === t.id ? '#6c5ce7' : 'rgba(0,0,0,0.05)', color: newTag === t.id ? 'white' : '#636e72', fontSize: '0.85rem', cursor: 'pointer' }}>{t.label}</button>
                                ))}
                            </div>
                            <textarea placeholder="What's on your mind?" value={newContent} onChange={e => setNewContent(e.target.value)} required rows={5} className="glass-input" style={{ resize: 'vertical' }} />
                            <div style={{ background: 'rgba(0,0,0,0.03)', padding: '15px', borderRadius: '12px', border: '1px dashed rgba(0,0,0,0.1)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: loading ? 'default' : 'pointer', color: '#636e72' }}>📎 {file ? file.name : 'Attach Image/File'}<input type="file" onChange={e => setFile(e.target.files?.[0] || null)} disabled={loading} style={{ display: 'none' }} /></label>
                            </div>
                            {createError && (
                                <div style={{ color: '#d63031', background: 'rgba(255, 118, 117, 0.15)', borderRadius: '12px', padding: '10px 12px', fontSize: '0.9rem', fontWeight: 600 }}>
                                    {createError}
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <button type="button" onClick={() => setIsCreating(false)} className="btn" style={{ background: 'transparent', border: '1px solid #b2bec3' }}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Posting...' : '🚀 Publish'}</button>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>

            {/* Feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                {posts.map(post => (
                    <PostCard key={post.id} post={post} currentUser={user} onDeleted={handlePostDeleted} onGuestAction={() => setShowLoginPrompt(true)} />
                ))}
            </div>
        </div>
    );
}
