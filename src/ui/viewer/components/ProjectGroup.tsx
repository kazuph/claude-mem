import React, { useState } from 'react';
import { ProjectGroup as ProjectGroupType } from '../utils/projectGrouping';
import { ObservationCard } from './ObservationCard';
import { SummaryCard } from './SummaryCard';
import { PromptCard } from './PromptCard';
import { formatDate } from '../utils/formatters';

interface ProjectGroupProps {
  group: ProjectGroupType;
}

export function ProjectGroupComponent({ group }: ProjectGroupProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const latestDate = formatDate(group.latestActivity);
  const itemCount = group.items.length;

  // Get the latest prompt for sticky display (if project has active session)
  const latestPrompt = group.hasActiveSession && group.prompts.length > 0
    ? group.prompts.reduce((latest, p) => p.created_at_epoch > latest.created_at_epoch ? p : latest)
    : null;

  return (
    <div className={`project-group ${group.hasActiveSession ? 'project-active' : 'project-inactive'}`}>
      {/* Project Header */}
      <div className="project-header">
        <div className="project-header-content">
          <div className="project-header-top">
            <div className="project-header-left">
              {group.hasActiveSession && (
                <span className="project-status active">Active</span>
              )}
              <span className="project-name">{group.project}</span>
            </div>
            <div className="project-header-right">
              <span className="project-count">{itemCount}</span>
              <button
                className="project-collapse-btn"
                onClick={() => setIsCollapsed(!isCollapsed)}
                aria-label={isCollapsed ? 'Expand project' : 'Collapse project'}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
                >
                  <path fillRule="evenodd" d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Sticky Prompt Display - always visible when project has active session */}
          {latestPrompt && (
            <div className="project-sticky-prompt">
              <div className="sticky-prompt-label">Current Request</div>
              <div className="sticky-prompt-text">{latestPrompt.prompt_text}</div>
            </div>
          )}
        </div>
      </div>

      {/* Items Content */}
      {!isCollapsed && (
        <div className="project-items-container">
          {group.items.map((item) => {
            const key = `${item.itemType}-${item.id}`;
            return (
              <div key={key} className="project-item">
                {item.itemType === 'observation' && (
                  <ObservationCard observation={item} />
                )}
                {item.itemType === 'summary' && (
                  <SummaryCard summary={item} />
                )}
                {item.itemType === 'prompt' && (
                  <PromptCard prompt={item} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Collapsed Summary */}
      {isCollapsed && (
        <div className="project-collapsed-summary">
          <div className="collapsed-info">
            <span className="collapsed-date">{latestDate}</span>
            <span className="collapsed-stats">
              {group.prompts.length} prompts · {group.observations.length} observations · {group.summaries.length} summaries
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
