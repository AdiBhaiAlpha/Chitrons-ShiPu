import { CookieLoader } from './src/adapters/messenger/CookieLoader.js';

const dummyCookie = `[
    {
      "domain": ".facebook.com",
      "expirationDate": 1810324134.982044,
      "hostOnly": false,
      "httpOnly": true,
      "name": "c_user",
      "path": "/",
      "sameSite": "no_restriction",
      "secure": true,
      "session": false,
      "storeId": null,
      "value": "1000123456789"
    },
    {
      "domain": ".facebook.com",
      "expirationDate": 1810324134.982044,
      "hostOnly": false,
      "httpOnly": true,
      "name": "xs",
      "path": "/",
      "sameSite": "no_restriction",
      "secure": true,
      "session": false,
      "storeId": null,
      "value": "dummy_xs_value"
    }
]`;

console.log('Validating Cookie Array format:');
const val = CookieLoader.validateCookieJson(dummyCookie);
console.log('Result:', val.valid ? 'SUCCESS' : 'FAILED', val.error || '');
