import { Routes, Route } from 'react-router-dom'
import Landing from './components/Landing'
import ConfessionBomb from './components/ConfessionBomb'
import ImposterGame from './components/ImposterGame'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/confession" element={<ConfessionBomb />} />
      <Route path="/imposter" element={<ImposterGame />} />
    </Routes>
  )
}
