import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import MenuPage from './pages/MenuPage'
import CartBar from './components/CartBar'

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/:subdomain/menu" element={<MenuPage />} />
      </Routes>
      <CartBar />
    </>
  )
}
