const https = require('https');

const options = {
  hostname: 'www.nseindia.com',
  path: '/api/NextApi/apiClient/GetQuoteApi?functionName=getOptionChainData&symbol=NIFTY&params=expiryDate=09-Jun-2026',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'application/json'
  }
};

https.get(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      console.log('Keys:', Object.keys(data));
      if (Array.isArray(data)) {
        console.log('Is Array');
      }
    } catch(e) {
      console.log('Parse error', e.message);
      console.log('Body length:', body.length);
    }
  });
}).on('error', console.error);
