'use client';

import { useState, useEffect, useRef, type ChangeEvent, type FormEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Post, User } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import PostCard from './PostCard';
import { useRouter } from 'next/navigation';
import { isStaffRole } from '@/lib/roles';
import Avatar from './Avatar';
import { FORUM_PROMOS } from '@/data/forumPromos';
import PostTextComposer from './PostTextComposer';

const TAG_OPTIONS = [
    { id: 'general', label: '💬 General' },
    { id: 'resource', label: '📚 Resource' },
    { id: 'question', label: '❓ Question' },
    { id: 'project', label: '🛠️ Project' },
    { id: 'meme', label: '😂 Meme' },
];

const CUSTOM_TAG_SUGGESTIONS = [
    { id: '升学雷达', label: '🎓 升学雷达' },
    { id: '课程补给站', label: '📚 课程补给站' },
    { id: '健身广场', label: '💪 健身广场' },
    { id: '情感树洞', label: '💗 情感树洞' },
    { id: '项目孵化器', label: '🛠️ 项目孵化器' },
];

const MAX_IMAGE_SIZE = 1 * 1024 * 1024;
const TARGET_COMPRESSED_IMAGE_SIZE = 900 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const COMPRESSIBLE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
function formatFileSize(bytes: number) {
    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function optimizedImageName(name: string) {
    const baseName = name.replace(/\.[^/.]+$/, '') || 'image';
    return `${baseName}-optimized.webp`;
}

function loadImage(file: File) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        const url = URL.createObjectURL(file);

        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Could not read image'));
        };
        image.src = url;
    });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('Could not optimize image'));
            }
        }, type, quality);
    });
}

async function compressImageForUpload(file: File) {
    const image = await loadImage(file);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;

    if (!sourceWidth || !sourceHeight) {
        throw new Error('Invalid image dimensions');
    }

    const maxSourceDimension = Math.max(sourceWidth, sourceHeight);
    const initialScale = Math.min(1, MAX_IMAGE_DIMENSION / maxSourceDimension);
    const dimensionScales = [1, 0.85, 0.7, 0.55];
    const qualities = [0.82, 0.74, 0.66, 0.58, 0.5];
    let smallestBlob: Blob | null = null;

    for (const dimensionScale of dimensionScales) {
        const scale = initialScale * dimensionScale;
        const width = Math.max(1, Math.round(sourceWidth * scale));
        const height = Math.max(1, Math.round(sourceHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Could not prepare image optimizer');
        }

        context.drawImage(image, 0, 0, width, height);

        for (const quality of qualities) {
            const blob = await canvasToBlob(canvas, 'image/webp', quality);
            if (!smallestBlob || blob.size < smallestBlob.size) {
                smallestBlob = blob;
            }

            if (blob.size <= TARGET_COMPRESSED_IMAGE_SIZE) {
                return new File([blob], optimizedImageName(file.name), { type: 'image/webp' });
            }
        }
    }

    if (!smallestBlob) {
        throw new Error('Could not optimize image');
    }

    return new File([smallestBlob], optimizedImageName(file.name), { type: 'image/webp' });
}

export default function ForumFeed({ user, initialPosts }: { user: User | null, initialPosts: Post[] }) {
    const router = useRouter();
    const composerRef = useRef<HTMLFormElement | null>(null);
    const canPostAnnouncement = isStaffRole(user?.role);
    const canCreatePost = user?.verification_status === 'verified';
    const visibleTagOptions = canPostAnnouncement
        ? [{ id: 'announcement', label: '📢 Announcement' }, ...TAG_OPTIONS, ...CUSTOM_TAG_SUGGESTIONS]
        : [...TAG_OPTIONS, ...CUSTOM_TAG_SUGGESTIONS];
    const [posts, setPosts] = useState<Post[]>(initialPosts);
    const [isCreating, setIsCreating] = useState(false);
    const [sortType, setSortType] = useState<'time' | 'heat' | 'likes'>('time');
    const [filterType, setFilterType] = useState<'all' | 'saved'>('all');
    const [selectedTag, setSelectedTag] = useState<string>('all');
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newTag, setNewTag] = useState('general');
    const [file, setFile] = useState<File | null>(null);
    const [fileStatus, setFileStatus] = useState('');
    const [isPreparingImage, setIsPreparingImage] = useState(false);
    const [loading, setLoading] = useState(false);
    const [createError, setCreateError] = useState('');
    const [popularTags, setPopularTags] = useState<{ tag: string; count: number }[]>([]);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [promoIndex, setPromoIndex] = useState(0);
    const activePromo = FORUM_PROMOS[promoIndex];
    const visiblePopularTags = popularTags.filter(({ tag }) => canPostAnnouncement || tag !== 'announcement');
    const composerTagOptions = [
        ...visibleTagOptions,
        ...visiblePopularTags.map(({ tag }) => ({ id: tag, label: `# ${tag}` })),
    ].filter((option, index, options) => options.findIndex(item => item.id === option.id) === index);

    const requireLogin = () => {
        if (!user) {
            setShowLoginPrompt(true);
            return true;
        }
        return false;
    };

    const showPreviousPromo = () => {
        setPromoIndex(current => (current - 1 + FORUM_PROMOS.length) % FORUM_PROMOS.length);
    };

    const showNextPromo = () => {
        setPromoIndex(current => (current + 1) % FORUM_PROMOS.length);
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

    useEffect(() => {
        if (!isCreating || !user) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            const hasDraft = !!(newTitle.trim() || newContent.trim() || file);

            if (!hasDraft && !loading && !isPreparingImage && composerRef.current && !composerRef.current.contains(target)) {
                setNewTitle('');
                setNewContent('');
                setNewTag('general');
                setFile(null);
                setFileStatus('');
                setCreateError('');
                setIsCreating(false);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [file, isCreating, isPreparingImage, loading, newContent, newTitle, user]);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setPromoIndex(current => (current + 1) % FORUM_PROMOS.length);
        }, 5200);

        return () => window.clearInterval(intervalId);
    }, []);

    useEffect(() => {
        if (!window.location.hash) return;

        const targetId = window.location.hash.slice(1);
        if (!targetId.startsWith('post-')) return;

        const scrollToTarget = () => {
            const target = document.getElementById(targetId);
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        const frameId = window.requestAnimationFrame(scrollToTarget);
        const timeoutId = window.setTimeout(scrollToTarget, 320);

        return () => {
            window.cancelAnimationFrame(frameId);
            window.clearTimeout(timeoutId);
        };
    }, [posts.length]);

    const fetchPosts = async (sort: string = sortType, filter: string = filterType, tag: string = selectedTag) => {
        const tagParam = tag !== 'all' ? `&tag=${encodeURIComponent(tag)}` : '';
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

    const handleTagRailDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || event.pointerType === 'touch') return;

        const scroller = event.currentTarget;
        const startX = event.clientX;
        const startScrollLeft = scroller.scrollLeft;
        let didDrag = false;

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const deltaX = moveEvent.clientX - startX;
            if (Math.abs(deltaX) < 4) return;

            didDrag = true;
            scroller.dataset.draggingFilter = 'true';
            scroller.classList.add('is-dragging');
            scroller.scrollLeft = startScrollLeft - deltaX;
        };

        const finishDrag = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointercancel', finishDrag);
            scroller.classList.remove('is-dragging');

            if (didDrag) {
                window.setTimeout(() => {
                    delete scroller.dataset.draggingFilter;
                }, 0);
            }
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', finishDrag, { once: true });
        window.addEventListener('pointercancel', finishDrag, { once: true });
    };

    const blockTagClickAfterDrag = (event: ReactMouseEvent<HTMLDivElement>) => {
        if (event.currentTarget.dataset.draggingFilter !== 'true') return;
        event.preventDefault();
        event.stopPropagation();
    };

    const resetComposer = () => {
        setNewTitle('');
        setNewContent('');
        setNewTag('general');
        setFile(null);
        setFileStatus('');
        setCreateError('');
        setIsCreating(false);
    };

    const openComposer = () => {
        if (requireLogin()) return;
        if (!canCreatePost) {
            setCreateError('完成 Hajimi 认证后可以发帖、评论、点赞和收藏；未认证账号可以浏览和体验项目。');
            return;
        }

        setCreateError('');
        setFileStatus('');
        setIsCreating(true);
    };

    const handleTagInput = (value: string) => {
        const normalized = value.replace(/^#+/, '').replace(/\s+/g, '').slice(0, 24);
        setNewTag(normalized);
    };

    const handleCreate = async (e: FormEvent) => {
        e.preventDefault();
        if (isPreparingImage) {
            setCreateError('Please wait for image optimization to finish.');
            return;
        }
        if (!newTitle.trim()) {
            setCreateError('标题必填，内容可以选填。');
            return;
        }

        setLoading(true);
        setCreateError('');

        const formData = new FormData();
        formData.append('title', newTitle);
        formData.append('content', newContent);
        formData.append('tag', newTag.trim() || 'general');
        if (file) {
            formData.append('file', file);
            formData.append('type', 'image');
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

            resetComposer();
            await fetchPosts();
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = async (selectedFile: File | null) => {
        setCreateError('');
        setFileStatus('');

        if (!selectedFile) {
            setFile(null);
            return;
        }

        if (!ALLOWED_IMAGE_TYPES.includes(selectedFile.type)) {
            setFile(null);
            setCreateError('Only JPEG, PNG, WebP, or GIF images can be uploaded.');
            return;
        }

        if (selectedFile.type === 'image/gif' && selectedFile.size > MAX_IMAGE_SIZE) {
            setFile(null);
            setCreateError('Animated GIFs must be 1 MB or smaller.');
            return;
        }

        if (selectedFile.size <= MAX_IMAGE_SIZE) {
            setFile(selectedFile);
            setFileStatus(`Ready: ${formatFileSize(selectedFile.size)}.`);
            return;
        }

        if (!COMPRESSIBLE_IMAGE_TYPES.has(selectedFile.type)) {
            setFile(null);
            setCreateError('Image must be 1 MB or smaller.');
            return;
        }

        setFile(null);
        setIsPreparingImage(true);
        setFileStatus(`Optimizing ${formatFileSize(selectedFile.size)} image...`);

        try {
            const optimizedFile = await compressImageForUpload(selectedFile);

            if (optimizedFile.size > MAX_IMAGE_SIZE) {
                setCreateError(`This image is still ${formatFileSize(optimizedFile.size)} after compression. Try a smaller image or crop it first.`);
                setFileStatus('');
                return;
            }

            setFile(optimizedFile);
            setFileStatus(`Optimized from ${formatFileSize(selectedFile.size)} to ${formatFileSize(optimizedFile.size)}.`);
        } catch {
            setFile(null);
            setFileStatus('');
            setCreateError('Could not optimize this image. Try a smaller JPEG, PNG, or WebP file.');
        } finally {
            setIsPreparingImage(false);
        }
    };

    const handleFileInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
        await handleFileChange(event.target.files?.[0] || null);
        event.target.value = '';
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
                                Create an account and complete Hajimi verification to post, like, comment, and save discussions.
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

            <div
                className={`glass-card forum-welcome-board is-${activePromo.accent}`}
                style={{ marginBottom: '20px' }}
            >
                <div className="forum-welcome-picture" aria-label="Hajimi Hallway welcome illustration">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activePromo.title}
                            className="forum-welcome-slide"
                            initial={{ opacity: 0, x: 18 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -18 }}
                            transition={{ duration: 0.35, ease: 'easeOut' }}
                        >
                            <div className="forum-picture-copy">
                                <span className="forum-picture-kicker">{activePromo.kicker}</span>
                                <strong>{activePromo.title}</strong>
                                <span>{activePromo.body}</span>
                            </div>
                            <div className="forum-picture-scene" aria-hidden="true">
                                <div className="forum-picture-pin">{activePromo.pin}</div>
                                <div className="forum-picture-note note-a">{activePromo.notes[0]}</div>
                                <div className="forum-picture-note note-b">{activePromo.notes[1]}</div>
                                <div className="forum-picture-note note-c">{activePromo.notes[2]}</div>
                                <div className="forum-picture-cat">
                                    <span className="cat-ear left" />
                                    <span className="cat-ear right" />
                                    <span className="cat-eye left" />
                                    <span className="cat-eye right" />
                                    <span className="cat-smile" />
                                </div>
                                <div className="forum-picture-orbit one" />
                                <div className="forum-picture-orbit two" />
                            </div>
                        </motion.div>
                    </AnimatePresence>
                    <div className="forum-promo-controls" aria-label="Hallway promotional slides">
                        <button
                            type="button"
                            className="forum-promo-arrow"
                            aria-label="上一条 Hallway 公告"
                            onClick={showPreviousPromo}
                        >
                            ‹
                        </button>
                        <div className="forum-promo-dots" role="tablist" aria-label="Hallway promotional dots">
                            {FORUM_PROMOS.map((promo, index) => (
                                <button
                                    key={promo.title}
                                    type="button"
                                    className={index === promoIndex ? 'is-active' : ''}
                                    aria-label={`Show ${promo.title}`}
                                    title={promo.title}
                                    aria-selected={index === promoIndex}
                                    role="tab"
                                    onMouseEnter={() => setPromoIndex(index)}
                                    onFocus={() => setPromoIndex(index)}
                                    onClick={() => setPromoIndex(index)}
                                />
                            ))}
                        </div>
                        <button
                            type="button"
                            className="forum-promo-arrow"
                            aria-label="下一条 Hallway 公告"
                            onClick={showNextPromo}
                        >
                            ›
                        </button>
                    </div>
                </div>
            </div>

            {/* Tags Bar */}
            {visiblePopularTags.length > 0 && (
                <div className="forum-tag-filter-row">
                    <span>🏷️</span>
                    <div
                        className="project-filter-panel forum-tag-rail"
                        aria-label="Forum hashtag filters"
                        onPointerDown={handleTagRailDragStart}
                        onClickCapture={blockTagClickAfterDrag}
                    >
                    <button
                        className={`forum-chip ${selectedTag === 'all' ? 'is-active' : ''}`}
                        onClick={() => handleTagFilter('all')}
                        style={{
                            padding: '4px 12px', borderRadius: '15px', border: 'none',
                            background: selectedTag === 'all' ? '#6c5ce7' : 'rgba(255,255,255,0.6)',
                            color: selectedTag === 'all' ? 'white' : '#636e72',
                            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                        }}
                    >All</button>
                    {visiblePopularTags.map(t => (
                        <button
                            key={t.tag}
                            className={`forum-chip ${selectedTag === t.tag ? 'is-active' : ''}`}
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
                </div>
            )}

            {/* Sort Tabs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginBottom: '20px', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.4)', padding: '5px', borderRadius: '25px' }}>
                    {[
                        { id: 'time', label: '🕒 Latest', title: 'Newest posts first' },
                        { id: 'heat', label: '🔥 Hot', title: 'Discussion, likes, saves, and freshness' },
                        { id: 'likes', label: '❤️ Top', title: 'Most liked posts' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            className={`forum-tab ${sortType === tab.id && filterType === 'all' ? 'is-active' : ''}`}
                            title={tab.title}
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
                    className={`forum-tab ${filterType === 'saved' ? 'is-active saved' : ''}`}
                    title="Posts you saved"
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
                <>
                    <div
                        onClick={() => openComposer()}
                        className="glass-card composer-trigger"
                        style={{ marginBottom: createError ? '10px' : '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', border: '2px dashed rgba(162, 155, 254, 0.5)', background: 'rgba(255,255,255,0.3)' }}
                    >
                        <Avatar value={user?.avatar} theme={user?.avatar_theme} fallback="✍️" size={48} style={{ fontSize: '1.5rem', border: '2px solid white' }} />
                        <div style={{ flex: 1, padding: '12px 20px', borderRadius: '20px', background: 'rgba(255,255,255,0.6)', color: '#636e72', fontWeight: 500 }}>
                            {user ? canCreatePost ? `Share your thoughts, ${user.username}...` : '完成 Hajimi 认证后可以互动和发帖' : 'Sign in to share your thoughts...'}
                        </div>
                        <div style={{ width: '40px', height: '40px', background: '#a29bfe', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.2rem' }}>{canCreatePost ? '✒️' : '✅'}</div>
                    </div>
                    {createError && (
                        <div className="forum-verification-callout" style={{ marginBottom: '30px' }}>
                            <span>{createError}</span>
                            <button type="button" onClick={() => router.push('/profile')}>去认证</button>
                        </div>
                    )}
                </>
            )}

            {/* Create Form (only shown when logged in and isCreating) */}
            <AnimatePresence>
                {isCreating && user && (
                    <motion.form ref={composerRef} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} onSubmit={handleCreate} className="glass-panel" style={{ padding: '25px', marginBottom: '30px', background: 'rgba(255,255,255,0.8)' }}>
                        <h3 style={{ marginBottom: '20px' }}>✨ Create a New Post</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input
                                placeholder="标题（必填）"
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                                className="glass-input"
                                maxLength={80}
                                required
                                style={{ fontWeight: 'bold', fontSize: '1.02rem' }}
                            />
                            <PostTextComposer value={newContent} onChange={setNewContent} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <label style={{ fontSize: '0.9rem', color: '#636e72', fontWeight: 700 }}>Hashtag（可选）</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: '#6c5ce7', fontWeight: 800, fontSize: '1.05rem' }}>#</span>
                                    <input
                                        placeholder="general"
                                        value={newTag}
                                        onChange={e => handleTagInput(e.target.value)}
                                        className="glass-input"
                                        style={{ flex: 1 }}
                                    />
                                </div>
                                <div
                                    className="project-filter-panel forum-tag-rail"
                                    aria-label="Forum composer hashtag suggestions"
                                    onPointerDown={handleTagRailDragStart}
                                    onClickCapture={blockTagClickAfterDrag}
                                >
                                    {composerTagOptions.map(t => (
                                        <button key={t.id} type="button" onClick={() => setNewTag(t.id)} style={{ padding: '5px 12px', borderRadius: '15px', border: 'none', background: newTag === t.id ? '#6c5ce7' : 'rgba(0,0,0,0.05)', color: newTag === t.id ? 'white' : '#636e72', fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>{t.label}</button>
                                    ))}
                                </div>
                                <div style={{ color: '#636e72', fontSize: '0.8rem' }}>
                                    不填默认 General；可以直接选一个常用标签。Announcements are staff-only and behave like pinned posts.
                                </div>
                            </div>
                            <div style={{ background: 'rgba(0,0,0,0.03)', padding: '15px', borderRadius: '12px', border: '1px dashed rgba(0,0,0,0.1)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: loading || isPreparingImage ? 'default' : 'pointer', color: '#636e72' }}>🖼️ {isPreparingImage ? 'Optimizing image...' : file ? file.name : 'Attach image'}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileInputChange} disabled={loading || isPreparingImage} style={{ display: 'none' }} /></label>
                                <div style={{ color: '#636e72', fontSize: '0.8rem', marginTop: '8px' }}>JPEG, PNG, WebP, or GIF · auto-compresses to max 1 MB · 5/day · 30 total</div>
                                {fileStatus && (
                                    <div style={{ color: '#00b894', fontSize: '0.8rem', marginTop: '8px', fontWeight: 700 }}>{fileStatus}</div>
                                )}
                            </div>
                            {createError && (
                                <div style={{ color: '#d63031', background: 'rgba(255, 118, 117, 0.15)', borderRadius: '12px', padding: '10px 12px', fontSize: '0.9rem', fontWeight: 600 }}>
                                    {createError}
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <button type="button" onClick={resetComposer} className="btn" style={{ background: 'transparent', border: '1px solid #b2bec3' }}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={loading || isPreparingImage}>{loading ? 'Posting...' : isPreparingImage ? 'Optimizing...' : '🚀 发布'}</button>
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
