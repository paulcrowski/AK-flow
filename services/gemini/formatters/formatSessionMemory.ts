import type { UnifiedContext } from '../../../core/context';

export function formatSessionMemory(ctx: UnifiedContext): string {
  const session = ctx.sessionMemory;
  if (!session) return '- No session data available';

  const lines: string[] = [];
  if (session.sessionsToday > 0) {
    lines.push(`- Sessions today: ${session.sessionsToday}`);
    lines.push(`- Messages today: ${session.messagesToday}`);
  } else {
    lines.push('- This is the first conversation today');
  }

  if (session.sessionsThisWeek > session.sessionsToday) {
    lines.push(`- Sessions this week: ${session.sessionsThisWeek}`);
  }

  if (session.lastInteractionAt) {
    const lastTime = new Date(session.lastInteractionAt);
    const now = new Date();
    const diffMin = Math.round((now.getTime() - lastTime.getTime()) / 60000);

    if (diffMin < 60) lines.push(`- Last interaction: ${diffMin} minutes ago`);
    else if (diffMin < 1440) lines.push(`- Last interaction: ${Math.round(diffMin / 60)} hours ago`);
  }

  if (Array.isArray(session.recentTopics) && session.recentTopics.length > 0) {
    lines.push(`- Recent topics: ${session.recentTopics.slice(0, 3).join('; ')}`);
  }

  return lines.length > 0 ? lines.join('\n') : '- No prior session data';
}
