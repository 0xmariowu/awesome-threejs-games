import { createRoot } from 'react-dom/client'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Missing root element')
}

void import('./App').then(({ default: App }) => createRoot(root).render(<App />))
