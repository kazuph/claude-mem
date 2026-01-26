/**
 * Context Generator - generates context injection for SessionStart
 *
 * This module contains all the logic for building the context injection string.
 * It's used by the worker service and called via HTTP from the context-hook.
 */

import path from 'path';
import { homedir } from 'os';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { SessionStore } from './sqlite/SessionStore.js';
import {
  OBSERVATION_TYPES,
  OBSERVATION_CONCEPTS,
  TYPE_ICON_MAP,
  TYPE_WORK_EMOJI_MAP
} from '../constants/observation-metadata.js';
import { logger } from '../utils/logger.js';
import { SettingsDefaultsManager } from '../shared/SettingsDefaultsManager.js';
import {
  parseJsonArray,
  formatDateTime,
  formatTime,
  formatDate,
  formatRelativeTime,
  toRelativePath,
  extractFirstFile
} from '../shared/timeline-formatting.js';
import { getProjectName } from '../utils/project-name.js';
import { MARKETPLACE_ROOT } from '../shared/paths.js';

// Version marker path - dynamically resolved from MARKETPLACE_ROOT
const VERSION_MARKER_PATH = path.join(MARKETPLACE_ROOT, 'plugin', '.install-version');

interface ContextConfig {
  // Display counts
  totalObservationCount: number;
  fullObservationCount: number;
  sessionCount: number;
  userPromptsCount: number;
  rawToolCount: number;

  // Token display toggles
  showReadTokens: boolean;
  showWorkTokens: boolean;
  showSavingsAmount: boolean;
  showSavingsPercent: boolean;

  // Filters
  observationTypes: Set<string>;
  observationConcepts: Set<string>;

  // Display options
  fullObservationField: 'narrative' | 'facts';
  showLastSummary: boolean;
  showLastMessage: boolean;
}

/**
 * Load all context configuration settings
 * Priority: ~/.claude-mem/settings.json > env var > defaults
 */
function loadContextConfig(): ContextConfig {
  const settingsPath = path.join(homedir(), '.claude-mem', 'settings.json');
  const settings = SettingsDefaultsManager.loadFromFile(settingsPath);

  try {
    return {
      totalObservationCount: parseInt(settings.CLAUDE_MEM_CONTEXT_OBSERVATIONS, 10),
      fullObservationCount: parseInt(settings.CLAUDE_MEM_CONTEXT_FULL_COUNT, 10),
      sessionCount: parseInt(settings.CLAUDE_MEM_CONTEXT_SESSION_COUNT, 10),
      userPromptsCount: parseInt(settings.CLAUDE_MEM_CONTEXT_USER_PROMPTS_COUNT || '5', 10),
      rawToolCount: parseInt(settings.CLAUDE_MEM_CONTEXT_RAW_TOOL_COUNT || '10', 10),
      showReadTokens: settings.CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS === 'true',
      showWorkTokens: settings.CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS === 'true',
      showSavingsAmount: settings.CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT === 'true',
      showSavingsPercent: settings.CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT === 'true',
      observationTypes: new Set(
        settings.CLAUDE_MEM_CONTEXT_OBSERVATION_TYPES.split(',').map((t: string) => t.trim()).filter(Boolean)
      ),
      observationConcepts: new Set(
        settings.CLAUDE_MEM_CONTEXT_OBSERVATION_CONCEPTS.split(',').map((c: string) => c.trim()).filter(Boolean)
      ),
      fullObservationField: settings.CLAUDE_MEM_CONTEXT_FULL_FIELD as 'narrative' | 'facts',
      showLastSummary: settings.CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY === 'true',
      showLastMessage: settings.CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE === 'true',
    };
  } catch (error) {
    logger.warn('WORKER', 'Failed to load context settings, using defaults', {}, error as Error);
    // Return defaults on error
    return {
      totalObservationCount: 50,
      fullObservationCount: 5,
      sessionCount: 10,
      userPromptsCount: 5,
      rawToolCount: 10,
      showReadTokens: true,
      showWorkTokens: true,
      showSavingsAmount: true,
      showSavingsPercent: true,
      observationTypes: new Set(OBSERVATION_TYPES),
      observationConcepts: new Set(OBSERVATION_CONCEPTS),
      fullObservationField: 'narrative' as const,
      showLastSummary: true,
      showLastMessage: false,
    };
  }
}

// Configuration constants
const CHARS_PER_TOKEN_ESTIMATE = 4;
const SUMMARY_LOOKAHEAD = 1;

export interface ContextInput {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  hook_event_name?: string;
  source?: "startup" | "resume" | "clear" | "compact";
  [key: string]: any;
}

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  red: '\x1b[31m',
};

interface Observation {
  id: number;
  sdk_session_id: string;
  type: string;
  title: string | null;
  subtitle: string | null;
  narrative: string | null;
  facts: string | null;
  concepts: string | null;
  files_read: string | null;
  files_modified: string | null;
  discovery_tokens: number | null;
  created_at: string;
  created_at_epoch: number;
}

interface SessionSummary {
  id: number;
  sdk_session_id: string;
  request: string | null;
  investigated: string | null;
  learned: string | null;
  completed: string | null;
  next_steps: string | null;
  created_at: string;
  created_at_epoch: number;
}

interface UserPrompt {
  id: number;
  claude_session_id: string;
  prompt_number: number;
  prompt_text: string;
  created_at: string;
  created_at_epoch: number;
  session_status?: string;
  completed_summary?: string;
}

// Helper: Render a summary field
function renderSummaryField(label: string, value: string | null, color: string, useColors: boolean): string[] {
  if (!value) return [];

  if (useColors) {
    return [`${color}${label}:${colors.reset} ${value}`, ''];
  }
  // Compact format for Claude: label:value
  return [`${label}:${value}`];
}

// Helper: Convert cwd path to dashed format
function cwdToDashed(cwd: string): string {
  return cwd.replace(/\//g, '-');
}

// Helper: Extract last assistant message from transcript file
function extractPriorMessages(transcriptPath: string): { userMessage: string; assistantMessage: string } {
  try {
    if (!existsSync(transcriptPath)) {
      return { userMessage: '', assistantMessage: '' };
    }

    const content = readFileSync(transcriptPath, 'utf-8').trim();
    if (!content) {
      return { userMessage: '', assistantMessage: '' };
    }

    const lines = content.split('\n').filter(line => line.trim());
    let lastAssistantMessage = '';

    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const line = lines[i];
        if (!line.includes('"type":"assistant"')) {
          continue;
        }

        const entry = JSON.parse(line);
        if (entry.type === 'assistant' && entry.message?.content && Array.isArray(entry.message.content)) {
          let text = '';
          for (const block of entry.message.content) {
            if (block.type === 'text') {
              text += block.text;
            }
          }
          text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
          if (text) {
            lastAssistantMessage = text;
            break;
          }
        }
      } catch (parseError) {
        continue;
      }
    }

    return { userMessage: '', assistantMessage: lastAssistantMessage };
  } catch (error) {
    logger.failure('WORKER', `Failed to extract prior messages from transcript`, { transcriptPath }, error as Error);
    return { userMessage: '', assistantMessage: '' };
  }
}

/**
 * Generate context for a project
 */
export async function generateContext(input?: ContextInput, useColors: boolean = false): Promise<string> {
  const config = loadContextConfig();
  const cwd = input?.cwd ?? process.cwd();
  const project = getProjectName(cwd);

  let db: SessionStore | null = null;
  try {
    db = new SessionStore();
  } catch (error: any) {
    if (error.code === 'ERR_DLOPEN_FAILED') {
      try {
        unlinkSync(VERSION_MARKER_PATH);
      } catch (unlinkError) {
        // Marker might not exist
      }
      console.error('Native module rebuild needed - restart Claude Code to auto-fix');
      return '';
    }
    throw error;
  }

  // Build SQL WHERE clause for observation types
  const typeArray = Array.from(config.observationTypes);
  const typePlaceholders = typeArray.map(() => '?').join(',');

  // Build SQL WHERE clause for concepts
  const conceptArray = Array.from(config.observationConcepts);
  const conceptPlaceholders = conceptArray.map(() => '?').join(',');

  // Get recent observations
  const observations = db.db.prepare(`
    SELECT
      id, sdk_session_id, type, title, subtitle, narrative,
      facts, concepts, files_read, files_modified, discovery_tokens,
      created_at, created_at_epoch
    FROM observations
    WHERE project = ?
      AND type IN (${typePlaceholders})
      AND EXISTS (
        SELECT 1 FROM json_each(concepts)
        WHERE value IN (${conceptPlaceholders})
      )
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(project, ...typeArray, ...conceptArray, config.totalObservationCount) as Observation[];

  // Get recent summaries
  const recentSummaries = db.db.prepare(`
    SELECT id, sdk_session_id, request, investigated, learned, completed, next_steps, created_at, created_at_epoch
    FROM session_summaries
    WHERE project = ?
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `).all(project, config.sessionCount + SUMMARY_LOOKAHEAD) as SessionSummary[];

  // Get recent user prompts (join with sdk_sessions to filter by project)
  const userPrompts = config.userPromptsCount > 0
    ? db.db.prepare(`
        SELECT
          up.id,
          up.claude_session_id,
          up.prompt_number,
          up.prompt_text,
          up.created_at,
          up.created_at_epoch,
          s.status as session_status,
          ss.completed as completed_summary
        FROM user_prompts up
        JOIN sdk_sessions s ON up.claude_session_id = s.claude_session_id
        LEFT JOIN session_summaries ss ON s.sdk_session_id = ss.sdk_session_id
        WHERE s.project = ?
        ORDER BY up.created_at_epoch DESC
        LIMIT ?
      `).all(project, config.userPromptsCount) as UserPrompt[]
    : [];

  // Get recent raw tool results (SDK OFF mode data)
  interface RawToolResult {
    id: number;
    session_id: string;
    tool_name: string;
    tool_input: string | null;
    tool_result: string | null;
    created_at: string;
  }

  const rawToolResults = config.rawToolCount > 0
    ? db.getRecentRawToolResults(project, config.rawToolCount)
    : [];

  // Retrieve prior session messages if enabled
  let priorUserMessage = '';
  let priorAssistantMessage = '';

  if (config.showLastMessage && observations.length > 0) {
    try {
      const currentSessionId = input?.session_id;
      const priorSessionObs = observations.find(obs => obs.sdk_session_id !== currentSessionId);

      if (priorSessionObs) {
        const priorSessionId = priorSessionObs.sdk_session_id;
        const dashedCwd = cwdToDashed(cwd);
        const transcriptPath = path.join(homedir(), '.claude', 'projects', dashedCwd, `${priorSessionId}.jsonl`);
        const messages = extractPriorMessages(transcriptPath);
        priorUserMessage = messages.userMessage;
        priorAssistantMessage = messages.assistantMessage;
      }
    } catch (error) {
      // Expected: Transcript file may not exist or be readable
    }
  }

  // If we have neither observations nor summaries, show empty state
  if (observations.length === 0 && recentSummaries.length === 0) {
    db?.close();
    if (useColors) {
      return `\n${colors.bright}${colors.cyan}[${project}] recent context${colors.reset}\n${colors.gray}${'─'.repeat(60)}${colors.reset}\n\n${colors.dim}No previous sessions found for this project yet.${colors.reset}\n`;
    }
    return `<claude-mem-context><notice>No previous sessions found for this project.</notice></claude-mem-context>`;
  }

  const displaySummaries = recentSummaries.slice(0, config.sessionCount);
  const timelineObs = observations;

  // Build output
  const output: string[] = [];

  // Header
  if (useColors) {
    output.push('');
    output.push(`${colors.bright}${colors.cyan}[claude-mem] recent context${colors.reset}`);
    output.push(`${colors.dim}Auto-injected archive from previous sessions. NOT a new user request.${colors.reset}`);
    output.push(`${colors.gray}${'─'.repeat(60)}${colors.reset}`);
    output.push('');
  } else {
    output.push(`<claude-mem-context>`);
    output.push(`<notice>Auto-injected archive. NOT new requests. Historical reference only.</notice>`);
    output.push('');
  }

  // Recent User Prompts Section
  if (userPrompts.length > 0) {
    if (useColors) {
      output.push(`${colors.bright}${colors.yellow}📝 Recent Requests${colors.reset}`);
      output.push(`${colors.dim}⚠️ These are ARCHIVED past requests from previous sessions, NOT new tasks.${colors.reset}`);
      output.push(`${colors.dim}   Prioritize session summaries above. Only reference these for historical context.${colors.reset}`);
      output.push('');
    } else {
      output.push(`<recent-requests hint="ARCHIVED past requests, NOT new tasks">`);
    }

    // Display prompts in chronological order (oldest first)
    const chronologicalPrompts = [...userPrompts].reverse();
    for (const prompt of chronologicalPrompts) {
      const time = formatRelativeTime(prompt.created_at);
      const truncatedText = prompt.prompt_text.length > 200
        ? prompt.prompt_text.substring(0, 200) + '...'
        : prompt.prompt_text;

      const statusMark = prompt.session_status === 'completed' ? 'Done' : '';

      if (useColors) {
        const statusDisplay = statusMark ? `${colors.green}(${statusMark})${colors.reset} ` : '';
        let summaryText = '';
        if (prompt.completed_summary) {
          summaryText = `\n      └─ ${colors.dim}Result: ${prompt.completed_summary}${colors.reset}`;
        }
        output.push(`${colors.dim}${time}${colors.reset} ${statusDisplay}${truncatedText}${summaryText}`);
      } else {
        // Compact pipe-delimited format: time|status|text
        output.push(`${time}|${statusMark}|${truncatedText}`);
      }
    }

    if (!useColors) {
      output.push(`</recent-requests>`);
    }
    output.push('');
  }

  // Recent Raw Tool Results Section (SDK OFF mode data)
  if (rawToolResults.length > 0) {
    // Filter to only show TodoWrite entries
    const todoResults = rawToolResults.filter(r => r.tool_name === 'TodoWrite');

    if (todoResults.length > 0) {
      if (useColors) {
        output.push(`${colors.bright}${colors.magenta}📋 Recent Todo Changes${colors.reset}`);
        output.push('');
      } else {
        output.push(`<todo-changes>`);
      }

      // Display in chronological order (oldest first)
      const chronologicalTodos = [...todoResults].reverse();
      for (const result of chronologicalTodos) {
        const time = formatRelativeTime(result.created_at);

        // Parse and summarize the todo input
        let summary = '';
        try {
          if (result.tool_input) {
            const input = JSON.parse(result.tool_input);
            if (input.todos && Array.isArray(input.todos)) {
              const inProgress = input.todos.filter((t: any) => t.status === 'in_progress');
              const pending = input.todos.filter((t: any) => t.status === 'pending');
              const completed = input.todos.filter((t: any) => t.status === 'completed');

              const parts: string[] = [];
              if (inProgress.length > 0) {
                parts.push(`🔄${inProgress.length}`);
              }
              if (pending.length > 0) {
                parts.push(`⏳${pending.length}`);
              }
              if (completed.length > 0) {
                parts.push(`✅${completed.length}`);
              }
              summary = parts.join(' ');

              // Show first in-progress or pending task as hint
              const activeTask = inProgress[0] || pending[0];
              if (activeTask && activeTask.content) {
                const truncated = activeTask.content.length > 80
                  ? activeTask.content.substring(0, 80) + '...'
                  : activeTask.content;
                summary += `|${truncated}`;
              }
            }
          }
        } catch {
          summary = 'updated';
        }

        if (!summary) {
          summary = 'updated';
        }

        if (useColors) {
          output.push(`${colors.dim}${time}${colors.reset} ${summary}`);
        } else {
          output.push(`${time}|${summary}`);
        }
      }

      if (!useColors) {
        output.push(`</todo-changes>`);
      }
      output.push('');
    }

    // Also show AskUserQuestion results if any
    const askResults = rawToolResults.filter(r => r.tool_name === 'AskUserQuestion');
    if (askResults.length > 0) {
      if (useColors) {
        output.push(`${colors.bright}${colors.blue}❓ Recent User Questions${colors.reset}`);
        output.push('');
      } else {
        output.push(`<user-questions>`);
      }

      const chronologicalAsks = [...askResults].reverse();
      for (const result of chronologicalAsks) {
        const time = formatRelativeTime(result.created_at);

        let summary = '';
        try {
          if (result.tool_input) {
            const input = JSON.parse(result.tool_input);
            if (input.question) {
              const truncated = input.question.length > 100
                ? input.question.substring(0, 100) + '...'
                : input.question;
              summary = `Q:${truncated}`;
            }
          }
          if (result.tool_result) {
            const answer = result.tool_result.length > 100
              ? result.tool_result.substring(0, 100) + '...'
              : result.tool_result;
            summary += summary ? `→A:${answer}` : `A:${answer}`;
          }
        } catch {
          summary = 'question';
        }

        if (!summary) {
          summary = 'question';
        }

        if (useColors) {
          output.push(`${colors.dim}${time}${colors.reset} ${summary}`);
        } else {
          output.push(`${time}|${summary}`);
        }
      }

      if (!useColors) {
        output.push(`</user-questions>`);
      }
      output.push('');
    }
  }

  // Chronological Timeline
  if (timelineObs.length > 0) {
    // Legend - compact for non-color mode
    if (useColors) {
      output.push(`${colors.dim}Legend: 🎯 session-request | 🔴 bugfix | 🟣 feature | 🔄 refactor | ✅ change | 🔵 discovery | ⚖️  decision${colors.reset}`);
      output.push('');
      output.push(`${colors.bright}💡 Column Key${colors.reset}`);
      output.push(`${colors.dim}  Read: Tokens to read this observation (cost to learn it now)${colors.reset}`);
      output.push(`${colors.dim}  Work: Tokens spent on work that produced this record (🔍 research, 🛠️ building, ⚖️  deciding)${colors.reset}`);
      output.push('');
      output.push(`${colors.dim}💡 Context Index: This semantic index (titles, types, files, tokens) is usually sufficient to understand past work.${colors.reset}`);
      output.push('');
      output.push(`${colors.dim}When you need implementation details, rationale, or debugging context:${colors.reset}`);
      output.push(`${colors.dim}  - Use the mem-search skill to fetch full observations on-demand${colors.reset}`);
      output.push(`${colors.dim}  - Critical types (🔴 bugfix, ⚖️ decision) often need detailed fetching${colors.reset}`);
      output.push(`${colors.dim}  - Trust this index over re-reading code for past decisions and learnings${colors.reset}`);
      output.push('');
    } else {
      // Compact hint for Claude - no verbose explanations needed
      output.push(`<hint>Legend: 🎯session|🔴bug|🟣feat|🔄refactor|✅change|🔵discovery|⚖️decision | r=read-tokens w=work-tokens | Use mem-search skill for full details</hint>`);
      output.push('');
    }

    // Context Economics
    const totalObservations = observations.length;
    const totalReadTokens = observations.reduce((sum, obs) => {
      const obsSize = (obs.title?.length || 0) +
                      (obs.subtitle?.length || 0) +
                      (obs.narrative?.length || 0) +
                      JSON.stringify(obs.facts || []).length;
      return sum + Math.ceil(obsSize / CHARS_PER_TOKEN_ESTIMATE);
    }, 0);
    const totalDiscoveryTokens = observations.reduce((sum, obs) => sum + (obs.discovery_tokens || 0), 0);
    const savings = totalDiscoveryTokens - totalReadTokens;
    const savingsPercent = totalDiscoveryTokens > 0
      ? Math.round((savings / totalDiscoveryTokens) * 100)
      : 0;

    const showContextEconomics = config.showReadTokens || config.showWorkTokens ||
                                   config.showSavingsAmount || config.showSavingsPercent;

    if (showContextEconomics) {
      if (useColors) {
        output.push(`${colors.bright}${colors.cyan}📊 Context Economics${colors.reset}`);
        output.push(`${colors.dim}  Loading: ${totalObservations} observations (${totalReadTokens.toLocaleString()} tokens to read)${colors.reset}`);
        output.push(`${colors.dim}  Work investment: ${totalDiscoveryTokens.toLocaleString()} tokens spent on research, building, and decisions${colors.reset}`);
        if (totalDiscoveryTokens > 0 && (config.showSavingsAmount || config.showSavingsPercent)) {
          let savingsLine = '  Your savings: ';
          if (config.showSavingsAmount && config.showSavingsPercent) {
            savingsLine += `${savings.toLocaleString()} tokens (${savingsPercent}% reduction from reuse)`;
          } else if (config.showSavingsAmount) {
            savingsLine += `${savings.toLocaleString()} tokens`;
          } else {
            savingsLine += `${savingsPercent}% reduction from reuse`;
          }
          output.push(`${colors.green}${savingsLine}${colors.reset}`);
        }
        output.push('');
      } else {
        // Compact economics line
        const parts: string[] = [`load:${totalObservations}obs/${totalReadTokens}t`];
        if (totalDiscoveryTokens > 0) {
          parts.push(`invested:${totalDiscoveryTokens}t`);
          if (config.showSavingsPercent) {
            parts.push(`savings:${savingsPercent}%`);
          }
        }
        output.push(`<context-economics>${parts.join('|')}</context-economics>`);
        output.push('');
      }
    }

    // Prepare summaries for timeline display
    const mostRecentSummaryId = recentSummaries[0]?.id;

    interface SummaryTimelineItem extends SessionSummary {
      displayEpoch: number;
      displayTime: string;
      shouldShowLink: boolean;
    }

    const summariesForTimeline: SummaryTimelineItem[] = displaySummaries.map((summary, i) => {
      const olderSummary = i === 0 ? null : recentSummaries[i + 1];
      return {
        ...summary,
        displayEpoch: olderSummary ? olderSummary.created_at_epoch : summary.created_at_epoch,
        displayTime: olderSummary ? olderSummary.created_at : summary.created_at,
        shouldShowLink: summary.id !== mostRecentSummaryId
      };
    });

    // Identify which observations should show full details
    const fullObservationIds = new Set(
      observations
        .slice(0, config.fullObservationCount)
        .map(obs => obs.id)
    );

    type TimelineItem =
      | { type: 'observation'; data: Observation }
      | { type: 'summary'; data: SummaryTimelineItem };

    const timeline: TimelineItem[] = [
      ...timelineObs.map(obs => ({ type: 'observation' as const, data: obs })),
      ...summariesForTimeline.map(summary => ({ type: 'summary' as const, data: summary }))
    ];

    // Sort chronologically
    timeline.sort((a, b) => {
      const aEpoch = a.type === 'observation' ? a.data.created_at_epoch : a.data.displayEpoch;
      const bEpoch = b.type === 'observation' ? b.data.created_at_epoch : b.data.displayEpoch;
      return aEpoch - bEpoch;
    });

    // Group by day
    const itemsByDay = new Map<string, TimelineItem[]>();
    for (const item of timeline) {
      const itemDate = item.type === 'observation' ? item.data.created_at : item.data.displayTime;
      const day = formatDate(itemDate);
      if (!itemsByDay.has(day)) {
        itemsByDay.set(day, []);
      }
      itemsByDay.get(day)!.push(item);
    }

    // Sort days chronologically
    const sortedDays = Array.from(itemsByDay.entries()).sort((a, b) => {
      const aDate = new Date(a[0]).getTime();
      const bDate = new Date(b[0]).getTime();
      return aDate - bDate;
    });

    // Render each day's timeline
    for (const [day, dayItems] of sortedDays) {
      if (useColors) {
        output.push(`${colors.bright}${colors.cyan}${day}${colors.reset}`);
        output.push('');
      } else {
        output.push(`<observations date="${day}">`);
      }

      let currentFile: string | null = null;
      let lastTime = '';

      for (const item of dayItems) {
        if (item.type === 'summary') {
          const summary = item.data;
          const summaryTitle = summary.request || 'Session started';
          const summaryTime = formatDateTime(summary.displayTime);

          if (useColors) {
            output.push(`🎯 ${colors.yellow}#S${summary.id}${colors.reset} ${summaryTitle} (${summaryTime})`);
          } else {
            // Compact session format: 🎯S{id}|time|title
            output.push(`🎯S${summary.id}|${summaryTime}|${summaryTitle}`);
          }
          currentFile = null;
          lastTime = '';
        } else {
          const obs = item.data;
          const file = extractFirstFile(obs.files_modified, cwd);

          // Show file header only when file changes (for color mode)
          if (useColors && file !== currentFile) {
            output.push(`${colors.dim}${file}${colors.reset}`);
            currentFile = file;
            lastTime = '';
          }

          const time = formatTime(obs.created_at);
          const title = obs.title || 'Untitled';
          const icon = TYPE_ICON_MAP[obs.type as keyof typeof TYPE_ICON_MAP] || '•';

          const obsSize = (obs.title?.length || 0) +
                          (obs.subtitle?.length || 0) +
                          (obs.narrative?.length || 0) +
                          JSON.stringify(obs.facts || []).length;
          const readTokens = Math.ceil(obsSize / CHARS_PER_TOKEN_ESTIMATE);
          const discoveryTokens = obs.discovery_tokens || 0;
          const workEmoji = TYPE_WORK_EMOJI_MAP[obs.type as keyof typeof TYPE_WORK_EMOJI_MAP] || '🔍';

          const showTime = time !== lastTime;
          const timeDisplay = showTime ? time : '';
          lastTime = time;

          const shouldShowFull = fullObservationIds.has(obs.id);

          if (shouldShowFull) {
            const detailField = config.fullObservationField === 'narrative'
              ? obs.narrative
              : (obs.facts ? parseJsonArray(obs.facts).join('\n') : null);

            if (useColors) {
              const timePart = showTime ? `${colors.dim}${time}${colors.reset}` : ' '.repeat(time.length);
              const readPart = (config.showReadTokens && readTokens > 0) ? `${colors.dim}(~${readTokens}t)${colors.reset}` : '';
              const discoveryPart = (config.showWorkTokens && discoveryTokens > 0) ? `${colors.dim}(${workEmoji} ${discoveryTokens.toLocaleString()}t)${colors.reset}` : '';

              output.push(`  ${colors.dim}#${obs.id}${colors.reset}  ${timePart}  ${icon}  ${colors.bright}${title}${colors.reset}`);
              if (detailField) {
                output.push(`    ${colors.dim}${detailField}${colors.reset}`);
              }
              if (readPart || discoveryPart) {
                output.push(`    ${readPart} ${discoveryPart}`);
              }
              output.push('');
            } else {
              // Compact full observation: #id|time|icon|title|r{tokens}|w{tokens}
              // Then detail on next line
              const tokenParts: string[] = [];
              if (config.showReadTokens) tokenParts.push(`r${readTokens}`);
              if (config.showWorkTokens && discoveryTokens > 0) tokenParts.push(`${workEmoji}${discoveryTokens}`);
              output.push(`#${obs.id}|${timeDisplay}|${icon}|${title}|${tokenParts.join('|')}`);
              if (detailField) {
                output.push(detailField);
              }
              currentFile = null;
            }
          } else {
            if (useColors) {
              const timePart = showTime ? `${colors.dim}${time}${colors.reset}` : ' '.repeat(time.length);
              const readPart = (config.showReadTokens && readTokens > 0) ? `${colors.dim}(~${readTokens}t)${colors.reset}` : '';
              const discoveryPart = (config.showWorkTokens && discoveryTokens > 0) ? `${colors.dim}(${workEmoji} ${discoveryTokens.toLocaleString()}t)${colors.reset}` : '';
              output.push(`  ${colors.dim}#${obs.id}${colors.reset}  ${timePart}  ${icon}  ${title} ${readPart} ${discoveryPart}`);
            } else {
              // Compact observation: #id|time|icon|title|r{tokens}|w{tokens}
              const tokenParts: string[] = [];
              if (config.showReadTokens) tokenParts.push(`r${readTokens}`);
              if (config.showWorkTokens && discoveryTokens > 0) tokenParts.push(`${workEmoji}${discoveryTokens}`);
              output.push(`#${obs.id}|${timeDisplay}|${icon}|${title}|${tokenParts.join('|')}`);
            }
          }
        }
      }

      // Close observations tag for non-color mode
      if (!useColors) {
        output.push(`</observations>`);
      }
      output.push('');
    }

    // Add full summary details for most recent session
    const mostRecentSummary = recentSummaries[0];
    const mostRecentObservation = observations[0];

    const shouldShowSummary = config.showLastSummary &&
      mostRecentSummary &&
      (mostRecentSummary.investigated || mostRecentSummary.learned || mostRecentSummary.completed || mostRecentSummary.next_steps) &&
      (!mostRecentObservation || mostRecentSummary.created_at_epoch > mostRecentObservation.created_at_epoch);

    if (shouldShowSummary) {
      if (useColors) {
        output.push(...renderSummaryField('Investigated', mostRecentSummary.investigated, colors.blue, useColors));
        output.push(...renderSummaryField('Learned', mostRecentSummary.learned, colors.yellow, useColors));
        output.push(...renderSummaryField('Completed', mostRecentSummary.completed, colors.green, useColors));
        output.push(...renderSummaryField('Next Steps', mostRecentSummary.next_steps, colors.magenta, useColors));
      } else {
        // Compact last-session summary
        const summaryParts: string[] = [];
        if (mostRecentSummary.investigated) summaryParts.push(`inv:${mostRecentSummary.investigated}`);
        if (mostRecentSummary.learned) summaryParts.push(`learned:${mostRecentSummary.learned}`);
        if (mostRecentSummary.completed) summaryParts.push(`done:${mostRecentSummary.completed}`);
        if (mostRecentSummary.next_steps) summaryParts.push(`next:${mostRecentSummary.next_steps}`);
        if (summaryParts.length > 0) {
          output.push(`<last-session>`);
          summaryParts.forEach(part => output.push(part));
          output.push(`</last-session>`);
        }
      }
    }

    // Previously section
    if (priorAssistantMessage) {
      if (useColors) {
        output.push('');
        output.push('---');
        output.push('');
        output.push(`${colors.bright}${colors.magenta}📋 Previously${colors.reset}`);
        output.push('');
        output.push(`${colors.dim}A: ${priorAssistantMessage}${colors.reset}`);
        output.push('');
      } else {
        output.push(`<previously>${priorAssistantMessage}</previously>`);
      }
    }

    // Footer - only for color mode (humans)
    if (useColors && showContextEconomics && totalDiscoveryTokens > 0 && savings > 0) {
      const workTokensK = Math.round(totalDiscoveryTokens / 1000);
      output.push('');
      output.push(`${colors.dim}💰 Access ${workTokensK}k tokens of past research & decisions for just ${totalReadTokens.toLocaleString()}t. Use the mem-search skill to access memories by ID instead of re-reading files.${colors.reset}`);
    }

    // Close the main context tag for non-color mode
    if (!useColors) {
      output.push(`</claude-mem-context>`);
    }
  }

  db?.close();
  return output.join('\n').trimEnd();
}
