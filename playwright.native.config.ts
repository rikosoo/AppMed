import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'native.spec.ts',use:{baseURL:'http://127.0.0.1:4173',viewport:{width:390,height:844},launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']}}});
