import { Axiom } from '@axiomhq/js'

const axiom = new Axiom({
  token: import.meta.env.VITE_AXIOM_TOKEN,
})

function log(level, message, data = {}) {
  axiom.ingest('standup-logger', [
    {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...data,
    },
  ])
}

export const logger = {
  info: (message, data) => log('info', message, data),
  warn: (message, data) => log('warn', message, data),
  error: (message, data) => log('error', message, data),
}
