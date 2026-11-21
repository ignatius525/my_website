import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// Self-hosted pixel fonts: no third-party requests, keeps the CSP to 'self'
import '@fontsource/press-start-2p/400.css'
import '@fontsource/pixelify-sans/400.css'
import '@fontsource/pixelify-sans/500.css'
import '@fontsource/pixelify-sans/600.css'
import '@fontsource/pixelify-sans/700.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
