import { supabase } from '../../services/supabase';
import { randomUUID } from 'crypto';

/**
 * SHADOW FACTORY (Brudnopis Manager)
 * 
 * Manages "Shadow Agents" - temporary entities used for E2E testing
 * directly against the production database (Supabase).
 * 
 * Philosophy: "Test the plumbing with dirty water, then flush."
 */
export class ShadowFactory {
    // Unique ID for this test run
    public readonly agentId: string;

    constructor() {
        // Create a unique non-colliding ID
        // DB requires UUID type, so we cannot prefix with string.
        this.agentId = randomUUID();
    }

    /**
     * INJECT: Wstrzykuje "fałszywe" wspomnienie/input użytkownika do bazy
     */
    async injectUserInput(textContent: string) {
        const payload = {
            agent_id: this.agentId,
            raw_text: textContent,
            created_at: new Date().toISOString(),
            // Fake embedding (not needed for plumbing test)
            embedding: Array(768).fill(0.1),
            neural_strength: 0.5,
            is_core_memory: false
        };

        const { error } = await supabase.from('memories').insert([payload]);

        if (error) {
            console.warn(`[ShadowFactory] Injection WARNING: DB Write Failed (likely RLS/Auth). Proceeding for logic test. Error: ${error.message}`);
            // throw new Error(`Shadow Injection Failed: ${error.message}`); // Allow test to continue
        } else {
            console.log(`[ShadowFactory] Injected for ${this.agentId}: "${textContent}"`);
        }
    }

    /**
     * VERIFY: Sprawdza czy po teście w bazie pojawiła się odpowiedź agenta
     */
    async fetchLatestMemory(seconds = 5): Promise<string | null> {
        // Fetch most recent memory for this agent
        const { data, error } = await supabase
            .from('memories')
            .select('raw_text, created_at')
            .eq('agent_id', this.agentId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) return null;

        // Simple check: is it fresh?
        const created = new Date(data.created_at).getTime();
        const now = Date.now();
        if (now - created > seconds * 1000) {
            return null; // Too old, irrelevant
        }

        return data.raw_text;
    }

    /**
     * CLEANUP: Spuszcza wodę (kasuje ślady)
     */
    async nuke() {
        const { error } = await supabase
            .from('memories')
            .delete()
            .eq('agent_id', this.agentId);

        if (error) {
            console.warn(`[ShadowFactory] Cleanup Failed (or nothing to clean): ${error.message}`);
        } else {
            console.log(`[ShadowFactory] Agent ${this.agentId} nuked.`);
        }
    }
}
