import React from 'react';
import { createRoot } from 'react-dom/client';
import Portfolio from './Portfolio.jsx';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import './portfolio.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode><Portfolio /></React.StrictMode>,
);
