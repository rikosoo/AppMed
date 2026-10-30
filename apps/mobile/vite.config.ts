import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import settings from './mobile-settings.cjs';
export default defineConfig({
 plugins:[react()],
 publicDir:path.resolve(__dirname,'../web/public'),
 resolve:{alias:{'@':path.resolve(__dirname,'../web')},dedupe:['react','react-dom']},
 define:{'__FINANCEMED_API_ORIGIN__':JSON.stringify(settings.apiOrigin(process.env.FINANCEMED_API_ORIGIN))},
 build:{outDir:'dist',emptyOutDir:true},
});
