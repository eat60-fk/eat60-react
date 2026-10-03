import { createRoot } from 'react-dom/client';
import App from './App';
import SplashScreen from './components/SplashScreen';
import './styles.css';
createRoot(document.getElementById('root')).render(<SplashScreen><App /></SplashScreen>);
