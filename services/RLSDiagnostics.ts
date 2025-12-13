import { supabase } from './supabase';

/**
 * RLS (Row-Level Security) Diagnostic Tools
 * Helps distinguish between logical errors and authorization issues
 */

export class RLSDiagnostics {
    
    /**
     * Checks if a query result is empty due to RLS restrictions
     * @param result Supabase query result
     * @returns true if empty result might be caused by RLS
     */
    static isPotentialRLSIssue(result: any): boolean {
        // Empty data with no error often indicates RLS blocking access
        return result.data === null || result.data.length === 0;
    }
    
    /**
     * Enhanced query wrapper that detects RLS issues
     * @param queryBuilder Supabase query builder
     * @param operationName Name of the operation for logging
     * @returns Original result with additional RLS diagnostics
     */
    static async diagnoseQuery(
        queryBuilder: any,
        operationName: string
    ): Promise<{ 
        data: any;
        error: any;
        isRLSIssue: boolean;
        rlsMessage: string | null;
    }> {
        const result = await queryBuilder;
        
        // Check for RLS patterns
        const isRLSIssue = this.isPotentialRLSIssue(result);
        const rlsMessage = isRLSIssue 
            ? `Potential RLS Issue in ${operationName}: Empty result may indicate authorization problem`
            : null;
        
        // Log RLS suspicions
        if (isRLSIssue) {
            console.warn(`[RLS DIAGNOSTIC] ${rlsMessage}`);
            console.info(`[RLS DIAGNOSTIC] Current user role: ${this.getCurrentUserRole()}`);
        }
        
        return {
            ...result,
            isRLSIssue,
            rlsMessage
        };
    }
    
    /**
     * Gets current user role from JWT
     * @returns Current user role or 'anonymous' if not available
     */
    static async getCurrentUserRole(): Promise<string> {
        try {
            const { data } = await supabase.auth.getSession();
            if (data?.session?.user) {
                return 'authenticated';
            }
            return 'anonymous';
        } catch (error) {
            console.error('Error getting user role:', error);
            return 'unknown';
        }
    }
    
    /**
     * Tests if user has access to a specific table
     * @param tableName Name of the table to test
     * @returns true if user can access the table
     */
    static async testTableAccess(tableName: string): Promise<boolean> {
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('id', { count: 'exact', head: true });
            
            if (error) {
                console.warn(`Access test failed for ${tableName}:`, error.message);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error(`Access test error for ${tableName}:`, error);
            return false;
        }
    }
    
    /**
     * Creates a comprehensive RLS diagnostic report
     * @returns Diagnostic report with current RLS status
     */
    static async generateDiagnosticReport(): Promise<RLSDiagnosticReport> {
        const userRole = await this.getCurrentUserRole();
        const tablesToTest = ['memories', 'agents', 'interactions']; // Add your main tables
        
        const tableAccessResults: Record<string, boolean> = {};
        for (const table of tablesToTest) {
            tableAccessResults[table] = await this.testTableAccess(table);
        }
        
        return {
            timestamp: new Date().toISOString(),
            userRole,
            tableAccess: tableAccessResults,
            recommendations: this.generateRecommendations(userRole, tableAccessResults)
        };
    }
    
    private static generateRecommendations(
        userRole: string,
        tableAccess: Record<string, boolean>
    ): string[] {
        const recommendations: string[] = [];
        
        if (userRole === 'anonymous') {
            recommendations.push('User is anonymous - consider requiring authentication');
        }
        
        const inaccessibleTables = Object.entries(tableAccess)
            .filter(([_, hasAccess]) => !hasAccess)
            .map(([table]) => table);
        
        if (inaccessibleTables.length > 0) {
            recommendations.push(
                `Tables ${inaccessibleTables.join(', ')} are inaccessible - check RLS policies`
            );
        }
        
        return recommendations;
    }
}

export interface RLSDiagnosticReport {
    timestamp: string;
    userRole: string;
    tableAccess: Record<string, boolean>;
    recommendations: string[];
}