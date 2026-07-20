import { Compass } from 'lucide-react'
import { Outlet, Link } from 'react-router'
import { Button } from '../components/ui/Button.tsx'
import { EmptyState } from '../components/ui/EmptyState.tsx'

/** Section wrapper: the routed pane only (§2). The sidebar is the sole
 *  navigation system — there is no horizontal sub-tab row. The page title lives
 *  in the page-control bar. */
export function SectionPage() {
  return <Outlet />
}

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      message="This route doesn't exist — every section lives in the sidebar."
      action={
        <Link to="/overview">
          <Button variant="secondary">Go to Overview</Button>
        </Link>
      }
    />
  )
}
