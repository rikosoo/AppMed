const {test}=require('node:test');
const assert=require('node:assert/strict');
const {apiOrigin}=require('../apps/mobile/mobile-settings.cjs');
test('mobile server accepts only an HTTPS origin',()=>{
 assert.equal(apiOrigin('https://app.75hard.club/'),'https://app.75hard.club');
 assert.equal(apiOrigin('https://new.example:8443'),'https://new.example:8443');
 for(const url of ['http://example.com','https://user:password@example.com','https://example.com/admin','https://example.com?token=x','https://example.com#x','javascript:alert(1)','invalid'])assert.throws(()=>apiOrigin(url));
});
