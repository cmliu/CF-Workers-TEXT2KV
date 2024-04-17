addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*', // 替换为允许的来源，例如 'https://your-app.com'
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE', // 替换为允许的方法
    'Access-Control-Allow-Headers': 'Content-Type, Authorization' // 替换为允许的头部
  });

  return new Response(null, {
    headers,
    status: 200
  });
}