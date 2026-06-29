'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type TarotCard = {
    id: number;
    name: string;
    meaning: string;
    icon: string;
};

function formatOracleParagraphs(text: string, maxParagraphs = 3, softLength = 76) {
    const normalized = text
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    if (!normalized) return [];

    const explicitParagraphs = normalized
        .split(/\n{2,}/)
        .map(paragraph => paragraph.trim())
        .filter(Boolean);

    if (explicitParagraphs.length > 1) {
        return explicitParagraphs.slice(0, maxParagraphs);
    }

    const sentences = normalized
        .split(/(?<=[。！？!?])/)
        .map(sentence => sentence.trim())
        .filter(Boolean);
    const paragraphs: string[] = [];
    let current = '';

    for (const sentence of sentences) {
        if (current && `${current}${sentence}`.length > softLength) {
            paragraphs.push(current);
            current = sentence;
        } else {
            current = `${current}${sentence}`;
        }
    }

    if (current) paragraphs.push(current);
    return (paragraphs.length ? paragraphs : [normalized]).slice(0, maxParagraphs);
}

const MAJOR_ARCANA: TarotCard[] = [
    { id: 0, name: 'The Fool', meaning: 'New beginnings, innocence, spontaneity.', icon: '🤡' },
    { id: 1, name: 'The Magician', meaning: 'Manifestation, resourcefulness, power.', icon: '🪄' },
    { id: 2, name: 'The High Priestess', meaning: 'Intuition, sacred knowledge, divine feminine.', icon: '🌙' },
    { id: 3, name: 'The Empress', meaning: 'Femininity, beauty, nature, nurturing.', icon: '👑' },
    { id: 4, name: 'The Emperor', meaning: 'Authority, establishment, structure.', icon: '🏰' },
    { id: 5, name: 'The Hierophant', meaning: 'Spiritual wisdom, religious beliefs, conformity.', icon: '⛪' },
    { id: 6, name: 'The Lovers', meaning: 'Love, harmony, relationships, values alignment.', icon: '💑' },
    { id: 7, name: 'The Chariot', meaning: 'Control, willpower, success, action.', icon: '🛒' },
    { id: 8, name: 'Strength', meaning: 'Strength, courage, persuasion, influence.', icon: '🦁' },
    { id: 9, name: 'The Hermit', meaning: 'Soul-searching, introspection, being alone.', icon: '🕯️' },
    { id: 10, name: 'Wheel of Fortune', meaning: 'Good luck, karma, life cycles, destiny.', icon: '🎡' },
    { id: 11, name: 'Justice', meaning: 'Justice, fairness, truth, cause and effect.', icon: '⚖️' },
    { id: 12, name: 'The Hanged Man', meaning: 'Pause, surrender, letting go, new perspectives.', icon: '🙃' },
    { id: 13, name: 'Death', meaning: 'Endings, change, transformation, transition.', icon: '💀' },
    { id: 14, name: 'Temperance', meaning: 'Balance, moderation, patience, purpose.', icon: '🍶' },
    { id: 15, name: 'The Devil', meaning: 'Shadow self, attachment, addiction, restriction.', icon: '😈' },
    { id: 16, name: 'The Tower', meaning: 'Sudden change, upheaval, chaos, revelation.', icon: '⚡' },
    { id: 17, name: 'The Star', meaning: 'Hope, faith, purpose, renewal, spirituality.', icon: '🌟' },
    { id: 18, name: 'The Moon', meaning: 'Illusion, fear, anxiety, subconscious, intuition.', icon: '🌑' },
    { id: 19, name: 'The Sun', meaning: 'Positivity, fun, warmth, success, vitality.', icon: '☀️' },
    { id: 20, name: 'Judgement', meaning: 'Judgement, rebirth, inner calling, absolution.', icon: '🎺' },
    { id: 21, name: 'The World', meaning: 'Completion, integration, accomplishment, travel.', icon: '🌍' },
];

export default function TarotGame() {
    const [cards, setCards] = useState<(TarotCard | null)[]>([null, null, null]);
    const [flipped, setFlipped] = useState([false, false, false]);
    const [isShuffling, setIsShuffling] = useState(false);
    const [isReading, setIsReading] = useState(false);
    const [reading, setReading] = useState('');
    const [readingId, setReadingId] = useState<number | null>(null);
    const [remainingReadings, setRemainingReadings] = useState<number | null>(null);
    const [dailyLimit, setDailyLimit] = useState(3);
    const [limitMessage, setLimitMessage] = useState('');
    const [followUpQuestion, setFollowUpQuestion] = useState('');
    const [followUpAnswer, setFollowUpAnswer] = useState('');
    const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
    const [followUpUsed, setFollowUpUsed] = useState(false);
    const [followUpMessage, setFollowUpMessage] = useState('');

    useEffect(() => {
        let isMounted = true;

        const loadOracleQuota = async () => {
            try {
                const res = await fetch('/api/oracle');
                const data = await res.json();
                if (!isMounted || !res.ok) return;
                if (data.readonly) setLimitMessage(data.message || '参观账号可以体验项目，Cyber Oracle 暂不开放。');
                if (typeof data.remaining === 'number') setRemainingReadings(data.remaining);
                if (typeof data.limit === 'number') setDailyLimit(data.limit);
            } catch (error) {
                console.warn('[tarot] failed to load oracle quota', error);
            }
        };

        void loadOracleQuota();

        return () => {
            isMounted = false;
        };
    }, []);

    const generateAiReading = async (drawn: TarotCard[]) => {
        setIsReading(true);
        try {
            const res = await fetch('/api/oracle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cards: drawn.map((card, index) => ({
                        position: positions[index],
                        name: card.name,
                        meaning: card.meaning,
                    })),
                }),
            });
            const data = await res.json();

            if (res.status === 403 || res.status === 429) {
                const remaining = typeof data?.remaining === 'number' ? data.remaining : 0;
                const limit = typeof data?.limit === 'number' ? data.limit : dailyLimit;
                setRemainingReadings(remaining);
                setDailyLimit(limit);
                setLimitMessage(data?.error || '今日 Oracle 解读次数已用完，明天再来抽牌吧。');
                setReading('');
                return;
            }

            if (!res.ok || typeof data?.reading !== 'string' || !data.reading.trim()) {
                throw new Error(data?.error || 'Oracle AI did not return a reading');
            }

            setReading(data.reading.trim());
            setReadingId(typeof data.readingId === 'number' ? data.readingId : null);
            setFollowUpUsed(Boolean(data.followUpUsed));
            setFollowUpQuestion('');
            setFollowUpAnswer('');
            setFollowUpMessage('');
            if (typeof data.remaining === 'number') {
                setRemainingReadings(data.remaining);
            }
            if (typeof data.limit === 'number') {
                setDailyLimit(data.limit);
            }
            setLimitMessage('');
        } catch (error) {
            console.warn('[tarot] oracle reading failed', error);
            setReading('');
            setReadingId(null);
            setFollowUpUsed(false);
            setFollowUpQuestion('');
            setFollowUpAnswer('');
            setFollowUpMessage('');
            if (limitMessage === '') {
                setLimitMessage('Oracle 暂时没有成功连接，请稍后再试。');
            }
        } finally {
            setIsReading(false);
        }
    };

    const drawCards = () => {
        if (isShuffling || isReading) return;
        if (remainingReadings === 0) {
            setLimitMessage('今日 Oracle 解读次数已用完，明天再来抽牌吧。');
            return;
        }
        setIsShuffling(true);
        setCards([null, null, null]);
        setFlipped([false, false, false]);
        setReading('');
        setReadingId(null);
        setFollowUpQuestion('');
        setFollowUpAnswer('');
        setFollowUpUsed(false);
        setFollowUpMessage('');
        setLimitMessage('');

        // Draw 3 unique cards
        const drawn: TarotCard[] = [];
        const pool = [...MAJOR_ARCANA];

        for (let i = 0; i < 3; i++) {
            const idx = Math.floor(Math.random() * pool.length);
            drawn.push(pool[idx]);
            pool.splice(idx, 1);
        }

        // Sequence animation
        setTimeout(() => {
            setCards(drawn);
            setIsShuffling(false);

            // Flip 1
            setTimeout(() => setFlipped(f => [true, f[1], f[2]]), 300);
            // Flip 2
            setTimeout(() => setFlipped(f => [true, true, f[2]]), 1000);
            // Flip 3
            setTimeout(() => {
                setFlipped([true, true, true]);
                void generateAiReading(drawn);
            }, 1700);
        }, 800);
    };

    const askFollowUp = async () => {
        const question = followUpQuestion.trim();
        if (!readingId || followUpUsed || isFollowUpLoading) return;
        if (question.length < 4) {
            setFollowUpMessage('给水晶球一点更具体的线索吧。');
            return;
        }

        setIsFollowUpLoading(true);
        setFollowUpMessage('');
        try {
            const res = await fetch('/api/oracle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'followup',
                    readingId,
                    question,
                }),
            });
            const data = await res.json();

            if (res.status === 409) {
                setFollowUpUsed(true);
                setFollowUpMessage(data?.error || '这次 Reveal 的追问已经用过啦。');
                return;
            }

            if (!res.ok || typeof data?.followUpAnswer !== 'string' || !data.followUpAnswer.trim()) {
                throw new Error(data?.error || 'Oracle follow-up did not return an answer');
            }

            setFollowUpAnswer(data.followUpAnswer.trim());
            setFollowUpUsed(true);
            setFollowUpQuestion('');
        } catch (error) {
            console.warn('[tarot] oracle follow-up failed', error);
            setFollowUpMessage('水晶球刚才没有听清，稍后再试一下。');
        } finally {
            setIsFollowUpLoading(false);
        }
    };

    const positions = ['Past', 'Present', 'Future'];
    const readingParagraphs = formatOracleParagraphs(reading, 4, 88);
    const followUpParagraphs = formatOracleParagraphs(followUpAnswer, 3, 78);
    const canAskFollowUp = Boolean(reading && readingId && !followUpUsed);

    return (
        <div style={{ textAlign: 'center', padding: '20px' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '10px', background: 'linear-gradient(to right, #a29bfe, #6c5ce7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                🔮 Cyber Tarot Trinity
            </h2>
            <p style={{ marginBottom: '12px', opacity: 0.7 }}>Reveal your timeline: Past, Present, and Future.</p>
            <div style={{ marginBottom: '32px', color: '#6c5ce7', fontSize: '0.85rem', fontWeight: 800 }}>
                今日可解读 {remainingReadings === null ? dailyLimit : remainingReadings} / {dailyLimit} 次
            </div>

            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '40px' }}>
                {cards.map((card, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#636e72', textTransform: 'uppercase', letterSpacing: '1px' }}>{positions[idx]}</div>
                        <div style={{ perspective: '1000px', width: '200px', height: '300px' }}>
                            <motion.div
                                style={{
                                    width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d'
                                }}
                                animate={{ rotateY: flipped[idx] ? 180 : 0 }}
                                transition={{ duration: 0.6 }}
                            >
                                {/* Back */}
                                <div style={{
                                    position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                                    background: 'linear-gradient(135deg, #2d3436, #000000)',
                                    borderRadius: '16px', border: '2px solid #6c5ce7',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 8px 20px rgba(0,0,0,0.2)'
                                }}>
                                    <div style={{ fontSize: '3rem', opacity: 0.5 }}>👁️‍🗨️</div>
                                </div>

                                {/* Front */}
                                <div style={{
                                    position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
                                    background: 'linear-gradient(135deg, #fff, #dfe6e9)',
                                    borderRadius: '16px', border: '4px solid #a29bfe',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '15px',
                                    boxShadow: '0 8px 20px rgba(162, 155, 254, 0.3)'
                                }}>
                                    {card && (
                                        <>
                                            <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '10px', color: '#2d3436' }}>{card.name}</div>
                                            <div style={{ fontSize: '4rem', marginBottom: '15px' }}>{card.icon}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#636e72', lineHeight: '1.4' }}>{card.meaning}</div>
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    </div>
                ))}
            </div>

            <AnimatePresence>
                {(reading || isReading) && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ maxWidth: '700px', margin: '0 auto 30px', padding: '24px 28px', background: 'rgba(162, 155, 254, 0.1)', borderRadius: '15px', border: '1px solid rgba(162, 155, 254, 0.3)', textAlign: 'left' }}
                    >
                        <h4 style={{ margin: '0 0 14px', color: '#6c5ce7', textAlign: 'center' }}>✨ Oracle&apos;s Insight</h4>
                        {isReading ? (
                            <p style={{ margin: 0, lineHeight: 1.8, fontSize: '1rem', color: '#5f6472' }}>AI Oracle 正在解读这组三张牌...</p>
                        ) : (
                            <div style={{ display: 'grid', gap: '10px' }}>
                                {readingParagraphs.map((paragraph, index) => (
                                    <p key={index} style={{ margin: 0, lineHeight: 1.75, fontSize: '0.98rem', color: '#566070', overflowWrap: 'anywhere' }}>
                                        {paragraph}
                                    </p>
                                ))}
                            </div>
                        )}

                        {(canAskFollowUp || followUpAnswer || isFollowUpLoading) && (
                            <div style={{ marginTop: '20px', paddingTop: '18px', borderTop: '1px solid rgba(108, 92, 231, 0.18)' }}>
                                {followUpAnswer && (
                                    <div style={{ marginBottom: '16px', padding: '14px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.54)', border: '1px solid rgba(162,155,254,0.22)' }}>
                                        <div style={{ marginBottom: '8px', color: '#6c5ce7', fontWeight: 800, textAlign: 'center' }}>🔮 水晶球回应</div>
                                        <div style={{ display: 'grid', gap: '8px' }}>
                                            {followUpParagraphs.map((paragraph, index) => (
                                                <p key={index} style={{ margin: 0, lineHeight: 1.7, fontSize: '0.95rem', color: '#566070', overflowWrap: 'anywhere' }}>
                                                    {paragraph}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {canAskFollowUp && (
                                    <div style={{ display: 'grid', gap: '10px' }}>
                                        <textarea
                                            className="glass-input"
                                            value={followUpQuestion}
                                            onChange={event => setFollowUpQuestion(event.target.value)}
                                            placeholder="告诉水晶球一个新的现实背景..."
                                            rows={3}
                                            maxLength={420}
                                            style={{ resize: 'vertical', minHeight: '84px', lineHeight: 1.55 }}
                                            disabled={isFollowUpLoading}
                                        />
                                        <button
                                            type="button"
                                            className="btn"
                                            onClick={askFollowUp}
                                            disabled={isFollowUpLoading || followUpQuestion.trim().length < 4}
                                            style={{
                                                justifySelf: 'center',
                                                minWidth: '150px',
                                                padding: '10px 18px',
                                                color: '#6c5ce7',
                                                background: 'rgba(255,255,255,0.72)',
                                                border: '1px solid rgba(108,92,231,0.24)',
                                            }}
                                        >
                                            {isFollowUpLoading ? '水晶球凝视中...' : 'Ask Crystal Ball'}
                                        </button>
                                    </div>
                                )}

                                {followUpMessage && (
                                    <div style={{ marginTop: '10px', textAlign: 'center', color: '#6c5ce7', fontWeight: 800 }}>
                                        {followUpMessage}
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {limitMessage && (
                <div style={{ maxWidth: '700px', margin: '0 auto 20px', color: '#6c5ce7', fontWeight: 800 }}>
                    {limitMessage}
                </div>
            )}

            <button
                onClick={drawCards}
                disabled={isShuffling || isReading || remainingReadings === 0}
                className="btn btn-primary"
                style={{ minWidth: '180px', padding: '12px 24px', fontSize: '1.1rem' }}
            >
                {isShuffling ? 'Consulting the Void...' : isReading ? 'AI is reading...' : 'Reveal My Destiny'}
            </button>
        </div>
    );
}
