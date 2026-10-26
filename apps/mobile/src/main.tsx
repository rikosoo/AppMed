import React from 'react';
import { createRoot } from 'react-dom/client';
import Home from '../../web/app/page';
import NativeRuntime from '../../web/components/native-runtime';
import '../../web/app/globals.css';
import '../../web/app/responsive.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><NativeRuntime/><Home/></React.StrictMode>);
