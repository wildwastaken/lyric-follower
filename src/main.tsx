import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Display from './Display'
import './styles.css'

const isDisplay = new URLSearchParams(location.search).has('display')
document.title = isDisplay ? 'Lyrics (projector)' : 'Lyric Follower'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isDisplay ? <Display /> : <App />}</React.StrictMode>,
)
