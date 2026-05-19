'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type TarotCard = {
    id: number;
    name: string;
    meaning: string;
    icon: string;
};

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

    const getFallbackReading = (drawn: TarotCard[]) => (
        `过去的 ${drawn[0].name} 提醒你保留 ${drawn[0].meaning.toLowerCase()} 的能量；现在的 ${drawn[1].name} 适合把注意力放回当下行动；未来的 ${drawn[2].name} 指向新的创作和成长线索。`
    );

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

            if (!res.ok || typeof data?.reading !== 'string' || !data.reading.trim()) {
                throw new Error(data?.error || 'Oracle AI did not return a reading');
            }

            setReading(data.reading.trim());
        } catch (error) {
            console.warn('[tarot] falling back to local reading', error);
            setReading(getFallbackReading(drawn));
        } finally {
            setIsReading(false);
        }
    };

    const drawCards = () => {
        if (isShuffling || isReading) return;
        setIsShuffling(true);
        setCards([null, null, null]);
        setFlipped([false, false, false]);
        setReading('');

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

    const positions = ['Past', 'Present', 'Future'];

    return (
        <div style={{ textAlign: 'center', padding: '20px' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '10px', background: 'linear-gradient(to right, #a29bfe, #6c5ce7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                🔮 Cyber Tarot Trinity
            </h2>
            <p style={{ marginBottom: '40px', opacity: 0.7 }}>Reveal your timeline: Past, Present, and Future.</p>

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
                        style={{ maxWidth: '700px', margin: '0 auto 30px', padding: '20px', background: 'rgba(162, 155, 254, 0.1)', borderRadius: '15px', border: '1px solid rgba(162, 155, 254, 0.3)' }}
                    >
                        <h4 style={{ marginBottom: '10px', color: '#6c5ce7' }}>✨ Oracle&apos;s Insight</h4>
                        <p style={{ lineHeight: '1.6', fontSize: '1.05rem' }}>
                            {isReading ? 'AI Oracle 正在解读这组三张牌...' : reading}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                onClick={drawCards}
                disabled={isShuffling || isReading}
                className="btn btn-primary"
                style={{ minWidth: '180px', padding: '12px 24px', fontSize: '1.1rem' }}
            >
                {isShuffling ? 'Consulting the Void...' : isReading ? 'AI is reading...' : 'Reveal My Destiny'}
            </button>
        </div>
    );
}
