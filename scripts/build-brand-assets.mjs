// Deployment sizes only; the transparent source artwork remains untouched.
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const assetsRequire=createRequire(require.resolve('@capacitor/assets'));
const sharp=assetsRequire('sharp');
const source='apps/mobile/assets/logo.png';
await mkdir('apps/web/public/brand',{recursive:true});
for(const size of [32,64,192,512])await sharp(source).resize(size,size).png().toFile(`apps/web/public/brand/symbol-${size}.png`);
await sharp(source).resize(180,180).flatten({background:'#f6f7f4'}).png().toFile('apps/web/public/brand/apple-touch-icon.png');
await sharp(source).resize(320,320).extend({top:96,bottom:96,left:96,right:96,background:'#f6f7f4'}).flatten({background:'#f6f7f4'}).png().toFile('apps/web/public/brand/maskable-512.png');
await mkdir('apps/mobile/store-assets',{recursive:true});
await sharp(source).resize(512,512).flatten({background:'#f6f7f4'}).png().toFile('apps/mobile/store-assets/icon-google-play-512.png');
console.log('Web brand assets generated from the transparent symbol.');
