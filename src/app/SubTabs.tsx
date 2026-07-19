import { NavLink } from 'react-router'
import type { SubTab } from './nav.ts'

/**
 * Horizontal sub-tab row across the top of a section's content area (§5) —
 * active tab gets the Penn Crimson underline (§12.2 brand rules).
 */
export function SubTabs({ tabs, ariaLabel }: { tabs: SubTab[]; ariaLabel: string }) {
  return (
    <nav aria-label={ariaLabel} className="flex gap-1 overflow-x-auto border-b border-subtle">
      {tabs.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          end={tab.end}
          className={({ isActive }) =>
            `section-label -mb-px flex h-12 items-center border-b-[3px] px-4 text-body whitespace-nowrap transition-colors duration-150 ${
              isActive
                ? 'border-accent text-primary'
                : 'border-transparent text-muted hover:text-secondary'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
