import React, { useMemo, useRef, useEffect } from 'react';
import { Observation, Summary, UserPrompt, FeedItem } from '../types';
import { ObservationCard } from './ObservationCard';
import { SummaryCard } from './SummaryCard';
import { PromptCard } from './PromptCard';
import { ProjectGroupComponent } from './ProjectGroup';
import { ScrollToTop } from './ScrollToTop';
import { UI } from '../constants/ui';
import { groupItemsByProject } from '../utils/projectGrouping';

export type ViewMode = 'flat' | 'grouped';

interface FeedProps {
  observations: Observation[];
  summaries: Summary[];
  prompts: UserPrompt[];
  onLoadMore: () => void;
  isLoading: boolean;
  hasMore: boolean;
  viewMode?: ViewMode;
}

export function Feed({ observations, summaries, prompts, onLoadMore, isLoading, hasMore, viewMode = 'flat' }: FeedProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);

  // Keep the callback ref up to date
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasMore && !isLoading) {
          onLoadMoreRef.current?.();
        }
      },
      { threshold: UI.LOAD_MORE_THRESHOLD }
    );

    observer.observe(element);

    return () => {
      if (element) {
        observer.unobserve(element);
      }
      observer.disconnect();
    };
  }, [hasMore, isLoading]);

  // Flat view: all items sorted by time
  const items = useMemo<FeedItem[]>(() => {
    const combined = [
      ...observations.map(o => ({ ...o, itemType: 'observation' as const })),
      ...summaries.map(s => ({ ...s, itemType: 'summary' as const })),
      ...prompts.map(p => ({ ...p, itemType: 'prompt' as const }))
    ];

    return combined.sort((a, b) => b.created_at_epoch - a.created_at_epoch);
  }, [observations, summaries, prompts]);

  // Grouped view: items grouped by project
  const projectGroups = useMemo(() => {
    if (viewMode !== 'grouped') return [];
    return groupItemsByProject(observations, summaries, prompts);
  }, [observations, summaries, prompts, viewMode]);

  const hasItems = viewMode === 'grouped' ? projectGroups.length > 0 : items.length > 0;

  return (
    <div className={`feed ${viewMode === 'grouped' ? 'feed-multicolumn' : ''}`} ref={feedRef}>
      <ScrollToTop targetRef={feedRef} />
      <div className={`feed-content ${viewMode === 'grouped' ? 'feed-content-multicolumn' : ''}`}>
        {viewMode === 'grouped' ? (
          // Grouped view: render project groups in multi-column layout
          <>
            {projectGroups.map(group => (
              <div key={group.project} className="project-column">
                <ProjectGroupComponent group={group} />
              </div>
            ))}
          </>
        ) : (
          // Flat view: render individual items
          <>
            {items.map(item => {
              const key = `${item.itemType}-${item.id}`;
              if (item.itemType === 'observation') {
                return <ObservationCard key={key} observation={item} />;
              } else if (item.itemType === 'summary') {
                return <SummaryCard key={key} summary={item} />;
              } else {
                return <PromptCard key={key} prompt={item} />;
              }
            })}
          </>
        )}

        {!hasItems && !isLoading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
            {viewMode === 'grouped'
              ? 'No projects to display'
              : 'No items to display'}
          </div>
        )}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#8b949e' }}>
            <div className="spinner" style={{ display: 'inline-block', marginRight: '10px' }}></div>
            Loading more...
          </div>
        )}
        {hasMore && !isLoading && hasItems && (
          <div ref={loadMoreRef} style={{ height: '20px', margin: '10px 0' }} />
        )}
        {!hasMore && hasItems && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#8b949e', fontSize: '14px' }}>
            No more items to load
          </div>
        )}
      </div>
    </div>
  );
}
