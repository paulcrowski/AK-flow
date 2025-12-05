/**
 * GoalJournalService.ts - FAZA 5: Long-term Goal Management
 * 
 * Responsibility: Persist and manage goals that span multiple sessions.
 * Goals are stored in the goal_journal table and survive agent restarts.
 * 
 * Architecture:
 * - JournalGoal = persistent goal with status tracking
 * - Sources: curiosity, empathy, survival, user, self (agent-initiated)
 * - Status: active, completed, abandoned, paused
 */

import { supabase } from './supabase';
import { generateUUID } from '../utils/uuid';

// ============================================================
// TYPES
// ============================================================

export type GoalSource = 'curiosity' | 'empathy' | 'survival' | 'user' | 'self';
export type GoalStatus = 'active' | 'completed' | 'abandoned' | 'paused';

export interface JournalGoal {
    id: string;
    agentId: string;
    description: string;
    source: GoalSource;
    priority: number;        // 0-1
    status: GoalStatus;
    progress: number;        // 0-100
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
    notes?: string;          // Agent's notes about progress
}

export interface CreateGoalParams {
    agentId: string;
    description: string;
    source: GoalSource;
    priority?: number;
}

export interface UpdateGoalParams {
    progress?: number;
    status?: GoalStatus;
    priority?: number;
    notes?: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const MAX_ACTIVE_GOALS = 5;  // Limit concurrent goals to prevent overwhelm
const DEFAULT_PRIORITY = 0.5;

// ============================================================
// MAIN SERVICE
// ============================================================

export const GoalJournalService = {
    /**
     * Create a new goal in the journal.
     */
    async createGoal(params: CreateGoalParams): Promise<JournalGoal | null> {
        try {
            // Check active goal count
            const activeCount = await this.countActiveGoals(params.agentId);
            if (activeCount >= MAX_ACTIVE_GOALS) {
                console.warn(`[GoalJournal] Max active goals (${MAX_ACTIVE_GOALS}) reached for agent`);
                return null;
            }

            const now = new Date().toISOString();
            const goal: JournalGoal = {
                id: generateUUID(),
                agentId: params.agentId,
                description: params.description,
                source: params.source,
                priority: params.priority ?? DEFAULT_PRIORITY,
                status: 'active',
                progress: 0,
                createdAt: now,
                updatedAt: now
            };

            const { error } = await supabase.from('goal_journal').insert([{
                id: goal.id,
                agent_id: goal.agentId,
                description: goal.description,
                source: goal.source,
                priority: goal.priority,
                status: goal.status,
                progress: goal.progress,
                created_at: goal.createdAt,
                updated_at: goal.updatedAt
            }]);

            if (error) {
                console.error('[GoalJournal] Create failed:', error.message);
                return null;
            }

            console.log(`[GoalJournal] Goal created: "${goal.description.slice(0, 50)}..."`);
            return goal;
        } catch (error) {
            console.error('[GoalJournal] Create error:', error);
            return null;
        }
    },

    /**
     * Get all active goals for an agent.
     */
    async getActiveGoals(agentId: string): Promise<JournalGoal[]> {
        try {
            // Try RPC first (if available)
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_active_goals', {
                p_agent_id: agentId,
                p_limit: MAX_ACTIVE_GOALS
            });

            if (!rpcError && rpcData) {
                return rpcData.map(this.mapDbToGoal);
            }

            // Fallback to direct query
            const { data, error } = await supabase
                .from('goal_journal')
                .select('*')
                .eq('agent_id', agentId)
                .eq('status', 'active')
                .order('priority', { ascending: false })
                .limit(MAX_ACTIVE_GOALS);

            if (error) {
                console.warn('[GoalJournal] Get active goals failed:', error.message);
                return [];
            }

            return (data || []).map(this.mapDbToGoal);
        } catch (error) {
            console.error('[GoalJournal] Get active goals error:', error);
            return [];
        }
    },

    /**
     * Get a specific goal by ID.
     */
    async getGoal(goalId: string): Promise<JournalGoal | null> {
        try {
            const { data, error } = await supabase
                .from('goal_journal')
                .select('*')
                .eq('id', goalId)
                .single();

            if (error || !data) {
                return null;
            }

            return this.mapDbToGoal(data);
        } catch (error) {
            console.error('[GoalJournal] Get goal error:', error);
            return null;
        }
    },

    /**
     * Update a goal's progress or status.
     */
    async updateGoal(goalId: string, updates: UpdateGoalParams): Promise<JournalGoal | null> {
        try {
            const updatePayload: any = {
                updated_at: new Date().toISOString()
            };

            if (updates.progress !== undefined) {
                updatePayload.progress = Math.min(100, Math.max(0, updates.progress));
            }
            if (updates.status !== undefined) {
                updatePayload.status = updates.status;
                if (updates.status === 'completed') {
                    updatePayload.completed_at = new Date().toISOString();
                }
            }
            if (updates.priority !== undefined) {
                updatePayload.priority = Math.min(1, Math.max(0, updates.priority));
            }
            if (updates.notes !== undefined) {
                updatePayload.notes = updates.notes;
            }

            const { data, error } = await supabase
                .from('goal_journal')
                .update(updatePayload)
                .eq('id', goalId)
                .select()
                .single();

            if (error) {
                console.error('[GoalJournal] Update failed:', error.message);
                return null;
            }

            console.log(`[GoalJournal] Goal updated: ${goalId}`);
            return this.mapDbToGoal(data);
        } catch (error) {
            console.error('[GoalJournal] Update error:', error);
            return null;
        }
    },

    /**
     * Mark a goal as completed.
     */
    async completeGoal(goalId: string, notes?: string): Promise<JournalGoal | null> {
        return this.updateGoal(goalId, {
            status: 'completed',
            progress: 100,
            notes: notes || 'Goal completed successfully.'
        });
    },

    /**
     * Abandon a goal (give up).
     */
    async abandonGoal(goalId: string, reason?: string): Promise<JournalGoal | null> {
        return this.updateGoal(goalId, {
            status: 'abandoned',
            notes: reason || 'Goal abandoned.'
        });
    },

    /**
     * Pause a goal (temporarily suspend).
     */
    async pauseGoal(goalId: string): Promise<JournalGoal | null> {
        return this.updateGoal(goalId, { status: 'paused' });
    },

    /**
     * Resume a paused goal.
     */
    async resumeGoal(goalId: string): Promise<JournalGoal | null> {
        return this.updateGoal(goalId, { status: 'active' });
    },

    /**
     * Count active goals for an agent.
     */
    async countActiveGoals(agentId: string): Promise<number> {
        try {
            const { count, error } = await supabase
                .from('goal_journal')
                .select('*', { count: 'exact', head: true })
                .eq('agent_id', agentId)
                .eq('status', 'active');

            if (error) {
                return 0;
            }

            return count || 0;
        } catch (error) {
            return 0;
        }
    },

    /**
     * Get goal history (completed and abandoned).
     */
    async getGoalHistory(agentId: string, limit: number = 10): Promise<JournalGoal[]> {
        try {
            const { data, error } = await supabase
                .from('goal_journal')
                .select('*')
                .eq('agent_id', agentId)
                .in('status', ['completed', 'abandoned'])
                .order('updated_at', { ascending: false })
                .limit(limit);

            if (error) {
                return [];
            }

            return (data || []).map(this.mapDbToGoal);
        } catch (error) {
            return [];
        }
    },

    /**
     * Get the highest priority active goal (for immediate execution).
     */
    async getTopPriorityGoal(agentId: string): Promise<JournalGoal | null> {
        const goals = await this.getActiveGoals(agentId);
        return goals.length > 0 ? goals[0] : null;
    },

    /**
     * Map database row to JournalGoal type.
     */
    mapDbToGoal(row: any): JournalGoal {
        return {
            id: row.id,
            agentId: row.agent_id,
            description: row.description,
            source: row.source as GoalSource,
            priority: row.priority,
            status: row.status as GoalStatus,
            progress: row.progress || 0,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            completedAt: row.completed_at,
            notes: row.notes
        };
    }
};

export default GoalJournalService;
