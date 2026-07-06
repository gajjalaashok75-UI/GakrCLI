import { Link, useLocation } from 'react-router-dom'
import { docsNav } from '../data/docsNav'

export default function DocsSidebar() {
  const path = useLocation().pathname

  return (
    <aside className="docs-sidebar">
      <nav aria-label="docs">
        {docsNav.map(group => (
          <div key={group.group}>
            <h4>{group.group}</h4>
            <ul>
              {group.items.map(item => (
                <li key={item.href}>
                  <Link to={item.href} aria-current={path === item.href ? 'page' : undefined}>
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}
