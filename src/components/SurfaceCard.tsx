import type { ReactNode } from 'react'

export const SurfaceCard = ({
  title,
  eyebrow,
  actions,
  children,
}: {
  title?: string
  eyebrow?: string
  actions?: ReactNode
  children: ReactNode
}) => (
  <section className="surface-card">
    {(title || eyebrow || actions) && (
      <header className="surface-card__header">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          {title ? <h3>{title}</h3> : null}
        </div>
        {actions}
      </header>
    )}
    {children}
  </section>
)
