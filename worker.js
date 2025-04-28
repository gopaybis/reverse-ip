export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response('', {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ status: 'error', message: 'Only POST allowed' }),
        {
          headers: corsHeaders(),
          status: 405,
        }
      );
    }

    const { ips } = await request.json();

    if (!Array.isArray(ips) || ips.length === 0) {
      return new Response(
        JSON.stringify({ status: 'error', message: 'No IPs provided.' }),
        {
          headers: corsHeaders(),
          status: 400,
        }
      );
    }

    const results = {};

    for (const ip of ips) {
      if (!isValidIP(ip)) {
        results[ip] = { status: 'error', message: 'Invalid IP format.', domains: [] };
        continue;
      }

      try {
        // Debugging log: before sending request
        console.log(`Sending request to YouGetSignal for IP: ${ip}`);
        
        const response = await fetch('https://domains.yougetsignal.com/domains.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36', // Simulate real browser
            'Accept': 'application/json', // Accept JSON responses
          },
          body: `remoteAddress=${encodeURIComponent(ip)}&key=&_=` // Body POST
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        const text = await response.text();

        if (text.includes('"Fail"')) {
          results[ip] = { status: 'error', message: 'API limit reached.', domains: [] };
          continue;
        }

        const data = JSON.parse(text);
        const domains = data.domainArray ? data.domainArray.map(d => d[0]) : [];

        results[ip] = {
          status: 'success',
          message: `${domains.length} domains found`,
          domains: domains
        };

      } catch (error) {
        console.log(`Error for IP ${ip}:`, error);
        results[ip] = { status: 'error', message: error.toString(), domains: [] };
      }
    }

    return new Response(JSON.stringify(results), {
      headers: corsHeaders(),
      status: 200
    });
  }
};

function isValidIP(ip) {
  const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!pattern.test(ip)) return false;
  return ip.split('.').every(octet => Number(octet) >= 0 && Number(octet) <= 255);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
}
