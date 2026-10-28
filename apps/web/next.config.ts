import type { NextConfig } from 'next';
const config: NextConfig = {
  devIndicators: false,
  poweredByHeader:false,
  async headers(){return [{source:'/:path*',headers:[
   {key:'X-Content-Type-Options',value:'nosniff'},
   {key:'X-Frame-Options',value:'DENY'},
   {key:'Content-Security-Policy',value:"frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"},
   {key:'Referrer-Policy',value:'no-referrer'},
   {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
  ]}];},
  allowedDevOrigins: ['127.0.0.1'],
  async rewrites() { return [{ source: '/api/:path*', destination: `${process.env.API_URL || 'http://127.0.0.1:8000'}/api/:path*` }]; },
};
export default config;
