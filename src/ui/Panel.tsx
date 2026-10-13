import { m } from 'motion/react';
import type { ReactNode } from 'react';
import { useId } from 'react';

interface PanelProps {
  index: string;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  flush?: boolean;
  /** Stagger position for the entrance. */
  order?: number;
  children: ReactNode;
}

export function Panel({ index, title, meta, actions, className = '', flush, order = 0, children }: PanelProps) {
  const titleId = useId();
  return (
    <m.section
      className={`panel ${className}`}
      aria-labelledby={titleId}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay: Math.min(order, 8) * 0.045, ease: [0.2, 0.7, 0.1, 1] }}
    >
      <header className="panel__head">
        <span className="panel__index" aria-hidden="true">
          {index}
        </span>
        <h2 className="panel__title" id={titleId}>
          {title}
        </h2>
        {meta != null && <span className="panel__meta">{meta}</span>}
        {actions && <div className="panel__actions">{actions}</div>}
      </header>
      <div className={`panel__body ${flush ? 'panel__body--flush' : ''}`}>{children}</div>
    </m.section>
  );
}
