import type { CapacitorConfig } from '@capacitor/cli';
const config:CapacitorConfig={
 appId:'club.hard75.financemed',
 appName:'FinanceMed AI',
 webDir:'dist',
 backgroundColor:'#f6f7f4',
 server:{cleartext:false},
 android:{allowMixedContent:false,webContentsDebuggingEnabled:false},
 ios:{contentInset:'never',scrollEnabled:true},
 plugins:{CapacitorHttp:{enabled:false}},
};
export default config;
