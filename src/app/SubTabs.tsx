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
            `-mb-px flex h-10 items-center border-b-2 px-4 text-body font-medium whitespace-nowrap transition-colors duration-150 ${
              isActive
                ? 'border-accent text-primary'
                : 'border-transparent text-secondary hover:text-primary'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
