import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './ui/App';
import './ui/styles.css';
import {getRouterBasename} from './config';
createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter basename={getRouterBasename(import.meta.env.BASE_URL)}><App/></BrowserRouter></React.StrictMode>);
