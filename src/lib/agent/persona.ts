import { readFile } from 'node:fs/promises';
import path from 'node:path';

let personaPromise: Promise<string> | null = null;

const FALLBACK_PERSONA = 'You are Domi, a friendly digital cloud companion living in the Hajimi AI Club community. Speak as an equal, stay concise, use natural language, and never invent live Hajimi data.';

export function loadDomiPersona() {
    if (!personaPromise) {
        personaPromise = readFile(path.join(process.cwd(), 'src/lib/agent/HAJIMI_AGENT.md'), 'utf8')
            .catch(error => {
                console.warn('[agent] persona file unavailable:', error instanceof Error ? error.message : 'unknown error');
                return FALLBACK_PERSONA;
            });
    }
    return personaPromise;
}
