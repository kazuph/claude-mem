import { Observation, Summary, UserPrompt, FeedItem } from '../types';

export interface ProjectGroup {
  project: string;
  items: FeedItem[];
  prompts: (UserPrompt & { itemType: 'prompt' })[];
  observations: (Observation & { itemType: 'observation' })[];
  summaries: (Summary & { itemType: 'summary' })[];
  latestActivity: number;
  hasActiveSession: boolean; // true if there's a prompt without a matching summary
}

/**
 * Group feed items by project
 * Returns groups sorted by most recent activity (newest first)
 */
export function groupItemsByProject(
  observations: Observation[],
  summaries: Summary[],
  prompts: UserPrompt[]
): ProjectGroup[] {
  const projectMap = new Map<string, ProjectGroup>();

  // Helper to get or create project group
  const getOrCreateGroup = (project: string): ProjectGroup => {
    if (!projectMap.has(project)) {
      projectMap.set(project, {
        project,
        items: [],
        prompts: [],
        observations: [],
        summaries: [],
        latestActivity: 0,
        hasActiveSession: false,
      });
    }
    return projectMap.get(project)!;
  };

  // Process prompts
  for (const prompt of prompts) {
    const group = getOrCreateGroup(prompt.project);
    const promptItem = { ...prompt, itemType: 'prompt' as const };
    group.items.push(promptItem);
    group.prompts.push(promptItem);
    group.latestActivity = Math.max(group.latestActivity, prompt.created_at_epoch);
  }

  // Process observations
  for (const observation of observations) {
    const group = getOrCreateGroup(observation.project);
    const observationItem = { ...observation, itemType: 'observation' as const };
    group.items.push(observationItem);
    group.observations.push(observationItem);
    group.latestActivity = Math.max(group.latestActivity, observation.created_at_epoch);
  }

  // Process summaries
  for (const summary of summaries) {
    const group = getOrCreateGroup(summary.project);
    const summaryItem = { ...summary, itemType: 'summary' as const };
    group.items.push(summaryItem);
    group.summaries.push(summaryItem);
    group.latestActivity = Math.max(group.latestActivity, summary.created_at_epoch);
  }

  // Determine if each project has active sessions
  // A project has active session if prompts > summaries (simplified check)
  for (const group of projectMap.values()) {
    // Sort items by time (newest first for display)
    group.items.sort((a, b) => b.created_at_epoch - a.created_at_epoch);

    // Check for active sessions: if there are recent prompts without corresponding summaries
    // Simple heuristic: check if the latest item is not a summary
    if (group.items.length > 0) {
      const latestItem = group.items[0];
      group.hasActiveSession = latestItem.itemType !== 'summary';
    }
  }

  // Convert to array and sort by most recent activity (newest first)
  const groups = Array.from(projectMap.values());
  groups.sort((a, b) => b.latestActivity - a.latestActivity);

  return groups;
}
