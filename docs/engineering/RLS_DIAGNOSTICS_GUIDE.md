# RLS Diagnostics Guide

## Overview

This guide explains how to use the RLS (Row-Level Security) diagnostics tools to identify and troubleshoot authorization issues in Supabase.

## The Problem

Supabase RLS can be a "silent killer" because:
- Authorization errors often return empty results instead of clear error messages
- Empty results can be mistaken for logical errors or empty datasets
- Debugging becomes time-consuming and frustrating

## Solution: RLS Diagnostics Tools

We've implemented a comprehensive diagnostics system that helps distinguish between:
- **Logical errors** (empty datasets, wrong queries)
- **Authorization issues** (RLS blocking access)

## Key Components

### 1. RLSDiagnostics Class

The main class with static methods for RLS detection and diagnosis.

#### Methods:

- `isPotentialRLSIssue(result)` - Checks if a query result might be caused by RLS
- `diagnoseQuery(queryBuilder, operationName)` - Wraps queries with RLS diagnostics
- `getCurrentUserRole()` - Gets the current user's role from JWT
- `testTableAccess(tableName)` - Tests if user can access a specific table
- `generateDiagnosticReport()` - Creates comprehensive RLS status report

### 2. Query Builder Extension

The Supabase client has been extended with a new method:

```typescript
.withRLSDiagnostics(operationName: string)
```

This method wraps any query and adds RLS diagnostics automatically.

## Usage Examples

### Basic Query with Diagnostics

```typescript
import { supabase } from './services/supabase';

// Standard query with RLS diagnostics
const result = await supabase
    .from('memories')
    .select('*')
    .eq('agent_id', currentAgentId)
    .withRLSDiagnostics('fetchMemories');

if (result.isRLSIssue) {
    console.warn('RLS Issue detected:', result.rlsMessage);
    // Show user-friendly message or trigger re-authentication
}
```

### Manual Diagnostics

```typescript
import { RLSDiagnostics } from './services/RLSDiagnostics';

// Check if a result might be an RLS issue
const hasRLSIssue = RLSDiagnostics.isPotentialRLSIssue(queryResult);

// Get current user role
const userRole = RLSDiagnostics.getCurrentUserRole();

// Test access to specific tables
const canAccessMemories = await RLSDiagnostics.testTableAccess('memories');

// Generate comprehensive diagnostic report
const report = await RLSDiagnostics.generateDiagnosticReport();
console.log('RLS Diagnostic Report:', report);
```

## Integration with Existing Code

The diagnostics have been integrated into the main memory service methods:

- `MemoryService.recallRecent()` - Now includes RLS diagnostics
- `MemoryService.semanticSearch()` - Now includes RLS diagnostics

## Best Practices

### 1. Always Use Diagnostics for Critical Queries

```typescript
// Instead of:
const { data, error } = await supabase.from('table').select('*');

// Use:
const result = await supabase.from('table').select('*').withRLSDiagnostics('myQuery');
```

### 2. Handle RLS Issues Gracefully

```typescript
if (result.isRLSIssue) {
    // Option 1: Show user-friendly message
    showNotification('You don\'t have permission to access this data');
    
    // Option 2: Trigger re-authentication
    await reauthenticateUser();
    
    // Option 3: Log for debugging
    logRLSIssue(result.rlsMessage);
}
```

### 3. Generate Diagnostic Reports

For complex issues, generate a full diagnostic report:

```typescript
const report = await RLSDiagnostics.generateDiagnosticReport();
console.log('RLS Status:', report);

// Send to error tracking service
errorTrackingService.capture('RLS Diagnostic Report', { report });
```

### 4. Test Table Access During Development

```typescript
// Test all critical tables during app initialization
const tablesToTest = ['memories', 'agents', 'interactions'];
for (const table of tablesToTest) {
    const hasAccess = await RLSDiagnostics.testTableAccess(table);
    console.log(`Access to ${table}: ${hasAccess ? '✓' : '✗'}`);
}
```

## Debugging Workflow

### Step 1: Identify the Issue

```typescript
const result = await supabase.from('memories').select('*').withRLSDiagnostics('debugQuery');

if (result.isRLSIssue) {
    console.warn('RLS Issue detected!');
}
```

### Step 2: Check User Role

```typescript
const userRole = RLSDiagnostics.getCurrentUserRole();
console.log('Current user role:', userRole);
```

### Step 3: Generate Full Report

```typescript
const report = await RLSDiagnostics.generateDiagnosticReport();
console.log('Full RLS Report:', JSON.stringify(report, null, 2));
```

### Step 4: Fix RLS Policies

Based on the report, update your Supabase RLS policies:

```sql
-- Example: Ensure authenticated users can read their own memories
CREATE POLICY "Users can access their own memories"
ON memories FOR SELECT
TO authenticated
USING (agent_id = auth.uid());
```

## Common RLS Issues and Solutions

### Issue 1: Empty Results When Data Should Exist

**Diagnosis:**
```typescript
const result = await supabase.from('memories').select('*').withRLSDiagnostics('fetchMemories');
// result.isRLSIssue === true
```

**Solution:** Check your RLS policies and ensure the user has proper permissions.

### Issue 2: Works in Development, Fails in Production

**Diagnosis:** Different user roles or authentication states.

**Solution:** Test with the same user role in both environments.

### Issue 3: Intermittent Access Issues

**Diagnosis:** Session expiration or token issues.

**Solution:** Implement session refresh or re-authentication.

## Advanced Usage

### Custom RLS Detection Logic

```typescript
// Extend the diagnostics with custom rules
class CustomRLSDiagnostics extends RLSDiagnostics {
    static isCriticalRLSIssue(result: any, context: any): boolean {
        const isRLSIssue = super.isPotentialRLSIssue(result);
        
        // Add custom logic based on your application context
        if (isRLSIssue && context.requiresAdmin) {
            const userRole = this.getCurrentUserRole();
            return userRole !== 'admin';
        }
        
        return isRLSIssue;
    }
}
```

### Integration with Error Tracking

```typescript
// Send RLS issues to your error tracking service
if (result.isRLSIssue) {
    errorTrackingService.capture('RLS Issue', {
        message: result.rlsMessage,
        userRole: RLSDiagnostics.getCurrentUserRole(),
        query: 'fetchMemories',
        timestamp: new Date().toISOString()
    });
}
```

## Troubleshooting

### "withRLSDiagnostics is not a function"

**Cause:** The Supabase client extension wasn't properly loaded.

**Solution:** Ensure you're importing from the correct module:
```typescript
import { supabase } from './services/supabase';
```

### False Positives

**Cause:** Some queries legitimately return empty results.

**Solution:** Add context-specific checks:
```typescript
const result = await supabase.from('memories').select('*').withRLSDiagnostics('fetchMemories');

if (result.isRLSIssue && shouldHaveData) {
    // Only treat as RLS issue if we expect data
    console.warn('RLS Issue:', result.rlsMessage);
}
```

## Conclusion

The RLS diagnostics tools provide a comprehensive solution for identifying and troubleshooting Supabase authorization issues. By integrating these tools into your development workflow, you can:

- Reduce debugging time
- Improve error handling
- Provide better user experiences
- Maintain more secure applications

Always use RLS diagnostics for critical queries and implement graceful fallback mechanisms when authorization issues are detected.