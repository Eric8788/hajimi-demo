'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';

export interface LogoLoopItem {
  id: string;
  title: string;
  icon: string;
  eyebrow?: string;
  meta?: string;
  description?: string;
  coverSrc?: string | null;
  accentColor?: string;
  href?: string | null;
}

interface LogoLoopProps {
  items: LogoLoopItem[];
  className?: string;
  speed?: number;
  ariaLabel?: string;
  pauseOnHover?: boolean;
}

function isExternalHref(href: string) {
  return /^(https?:)?\/\//.test(href) || href.startsWith('mailto:') || href.startsWith('tel:');
}

export default function LogoLoop({
  items,
  className = '',
  speed = 44,
  ariaLabel = 'Project showcase',
  pauseOnHover = true,
}: LogoLoopProps) {
  if (!items.length) return null;

  const loopItems = [...items, ...items];

  return (
    <div
      className={`logo-loop${pauseOnHover ? ' is-paused-on-hover' : ''}${className ? ` ${className}` : ''}`}
      aria-label={ariaLabel}
      style={{ '--logo-loop-duration': `${speed}s` } as CSSProperties}
    >
      <div className="logo-loop-track">
        {loopItems.map((item, index) => {
          const duplicate = index >= items.length;
          const itemStyle = {
            '--logo-loop-accent': item.accentColor || 'rgba(108, 92, 231, 0.2)',
          } as CSSProperties;
          const content = (
            <>
              <span className="logo-loop-cover" aria-hidden="true">
                {item.coverSrc ? (
                  <img src={item.coverSrc} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span className="logo-loop-cover-fallback">
                    <span className="logo-loop-cover-icon">{item.icon}</span>
                    <span>{item.meta || item.eyebrow || 'Project'}</span>
                  </span>
                )}
              </span>
              <span className="logo-loop-body">
                <span className="logo-loop-mark" aria-hidden="true">{item.icon}</span>
                <span className="logo-loop-copy">
                  {item.eyebrow && <span className="logo-loop-eyebrow">{item.eyebrow}</span>}
                  <span className="logo-loop-title">{item.title}</span>
                  {item.description && <span className="logo-loop-description">{item.description}</span>}
                  {item.meta && <span className="logo-loop-meta">{item.meta}</span>}
                </span>
              </span>
            </>
          );

          if (!item.href) {
            return (
              <span
                key={`${item.id}-${index}`}
                className="logo-loop-item"
                style={itemStyle}
                aria-hidden={duplicate}
              >
                {content}
              </span>
            );
          }

          if (isExternalHref(item.href)) {
            return (
              <a
                key={`${item.id}-${index}`}
                className="logo-loop-item"
                style={itemStyle}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                tabIndex={duplicate ? -1 : undefined}
                aria-hidden={duplicate}
              >
                {content}
              </a>
            );
          }

          return (
            <Link
              key={`${item.id}-${index}`}
              className="logo-loop-item"
              style={itemStyle}
              href={item.href}
              tabIndex={duplicate ? -1 : undefined}
              aria-hidden={duplicate}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
