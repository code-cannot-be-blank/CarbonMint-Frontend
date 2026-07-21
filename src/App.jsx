import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import GlobalShortcuts from './components/GlobalShortcuts.jsx';
import ScrollToTop from './components/ScrollToTop.jsx';
import ScrollToTopButton from './components/ScrollToTopButton.jsx';
import Home from './pages/Home.jsx';
import Marketplace from './pages/Marketplace.jsx';
import BatchDetail from './pages/BatchDetail.jsx';
import MyCredits from './pages/MyCredits.jsx';
import Retirements from './pages/Retirements.jsx';
import NotFound from './pages/NotFound.jsx';
import './App.css';

/**
 * Application shell: persistent navbar/footer with routed page content.
 */
export default function App() {
  return (
    <>
      <GlobalShortcuts />
      <ScrollToTop />
      <ScrollToTopButton />
      <Navbar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/batch/:id" element={<BatchDetail />} />
          <Route path="/my-credits" element={<MyCredits />} />
          <Route path="/retirements" element={<Retirements />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
