export function EmptyState({ icon, title, description, children }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/90 px-6 py-12 text-center">
      {icon ? <div className="text-slate-400 [&>svg]:h-12 [&>svg]:w-12">{icon}</div> : null}
      <p className="mt-3 max-w-sm font-medium text-slate-800">{title}</p>
      {description ? <p className="mt-2 max-w-sm text-sm text-slate-600">{description}</p> : null}
      {children}
    </div>
  )
}
