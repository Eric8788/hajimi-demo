export type ProjectTag = 'Game' | 'Tool' | 'AI' | 'Multiplayer' | 'Simulation' | 'Visual' | 'Finance' | 'Narrative';

export interface Project {
    id: string;
    title: string;
    author: string;
    description: string;
    tags: ProjectTag[];
    emoji: string;
    url: string | null;        // null = not yet deployed
    accentColor: string;       // for card theming
    status: 'live' | 'coming_soon';
}

export const PROJECTS: Project[] = [
    {
        id: 'snake-io',
        title: 'Snake.io',
        author: 'AI Club',
        description: 'A real-time multiplayer Snake clone with Socket.IO, live leaderboard, and smooth movement.',
        tags: ['Game', 'Multiplayer'],
        emoji: '🐍',
        url: 'https://snake-io-n197.onrender.com/',
        accentColor: 'rgba(46, 213, 115, 0.2)',
        status: 'live',
    },
    {
        id: 'prometheus',
        title: 'PROMETHEUS',
        author: 'AI Club',
        description: 'A high-fidelity terminal-style narrative engine exploring humanity, survival, and choices.',
        tags: ['AI', 'Narrative', 'Game'],
        emoji: '🔥',
        url: 'https://prometheus-pzu9.onrender.com/',
        accentColor: 'rgba(253, 121, 168, 0.2)',
        status: 'live',
    },
    {
        id: 'quant-panel',
        title: 'Quant Panel',
        author: 'AI Club',
        description: 'A professional quantitative monitoring and alert dashboard for analyzing market trends.',
        tags: ['Tool', 'Finance'],
        emoji: '📈',
        url: 'https://www.ericproject.xyz/',
        accentColor: 'rgba(55, 66, 250, 0.2)',
        status: 'live',
    },
    {
        id: 'sailer-2d',
        title: 'Sailer 2D',
        author: 'AI Club',
        description: 'A serious 2D sailing simulator for learning wind, sail, rudder, force, and boat movement.',
        tags: ['Game', 'Simulation'],
        emoji: '⛵',
        url: null,
        accentColor: 'rgba(116, 185, 255, 0.2)',
        status: 'coming_soon',
    },
    {
        id: 'boxhead',
        title: 'Boxhead',
        author: 'Cooka',
        description: 'A 3D survival action game with local two-player controls, waves, shooting, and arena building.',
        tags: ['Game'],
        emoji: '🎮',
        url: null,
        accentColor: 'rgba(255, 118, 117, 0.2)',
        status: 'coming_soon',
    },
    {
        id: 'climb-3d',
        title: 'Climb 3D',
        author: 'Cooka',
        description: 'A 3D climbing and parkour experiment with keyboard movement, camera control, and stamina.',
        tags: ['Game'],
        emoji: '🧗',
        url: null,
        accentColor: 'rgba(253, 203, 110, 0.2)',
        status: 'coming_soon',
    },
    {
        id: 'ai-tabletop',
        title: 'AI Tabletop',
        author: 'Eric / AI Club',
        description: 'A tabletop game platform for AI party games including Undercover, Werewolf, and more.',
        tags: ['Game', 'AI'],
        emoji: '🃏',
        url: null,
        accentColor: 'rgba(162, 155, 254, 0.3)',
        status: 'coming_soon',
    },
    {
        id: 'countdown',
        title: '帆船倒计时',
        author: 'Albert',
        description: 'A sailing race start countdown tool for real training and competition scenarios.',
        tags: ['Tool', 'Simulation'],
        emoji: '⏱️',
        url: null,
        accentColor: 'rgba(85, 239, 196, 0.2)',
        status: 'coming_soon',
    },
    {
        id: 'vocabulary',
        title: '背单词',
        author: 'Peter',
        description: 'A minimal vocabulary flashcard app — a great starter for personal learning tools.',
        tags: ['Tool'],
        emoji: '📖',
        url: null,
        accentColor: 'rgba(255, 234, 167, 0.4)',
        status: 'coming_soon',
    },
    {
        id: 'lucy-grass',
        title: '草原梦境',
        author: 'Lucy / Eric',
        description: 'A small interactive visual artwork for exploring atmosphere and generative art.',
        tags: ['Visual'],
        emoji: '🌿',
        url: null,
        accentColor: 'rgba(85, 239, 196, 0.3)',
        status: 'coming_soon',
    },
];

export const ALL_TAGS: ProjectTag[] = ['Game', 'Tool', 'AI', 'Multiplayer', 'Simulation', 'Visual', 'Finance', 'Narrative'];
