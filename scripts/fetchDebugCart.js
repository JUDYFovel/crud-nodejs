const http = require('http');
const url = 'http://localhost:3000/debug/cart/public/fotow12403%40arugy.com';
http.get(url, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    try {
      const obj = JSON.parse(d);
      console.log(JSON.stringify(obj, null, 2));
    } catch (e) {
      console.log(d);
    }
  });
}).on('error', e => console.error('Request error', e));
