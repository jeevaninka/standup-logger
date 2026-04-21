import { useEffect } from 'react'

const DEFAULT_TITLE = 'Standup Logger'

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title
    return () => {
      document.title = DEFAULT_TITLE
    }
  }, [title])
}
