// 定义一个名为 mytoken 的变量，并将 'passwd' 作为默认的读写权限
let mytoken= 'passwd';

export default {
	async fetch (request, env) {
		// 如果环境变量中有 TOKEN，则将其赋值给 mytoken，否则保持默认值
		mytoken = env.TOKEN || mytoken;

		let KV;
		// 检查 KV (键值存储) 是否已经被设置
		if (env.KV) {
			// 将 env.KV 赋值一个名为 KV 的常量
			KV =  env.KV;
		} else {
			//throw new Error('KV 命名空间未绑定');
			return new Response('KV 命名空间未绑定', {
				status: 400,
				headers: { 'content-type': 'text/plain; charset=utf-8' },
			});
		}

		// 从请求的 URL 中获取需要的参数
		const url = new URL(request.url);

		// 获取 URL 查询参数中的 'token'，如果不存在则赋值为 "null"
		const token = url.searchParams.get('token') || "null";

		// 检查提供的 token 是否与 mytoken 相符
		if (token === mytoken) {
			const 文件名 = url.pathname;
			// 获取 URL 查询参数中的 'text' 和 'b64'，如果不存在则赋值为 "null"
			const text = url.searchParams.get('text') || "null";
			const b64 = url.searchParams.get('b64') || "null";

			// 如果 'text' 和 'b64' 都为 "null"，则从 KV 中读取并返回文件内容
			if (text === "null" && b64 === "null"){
				const value = await KV.get(文件名);
				return new Response(value , {
					status: 200,
					headers: { 'content-type': 'text/plain; charset=utf-8' },
				});
			} else {
				// 检查文件是否存在
				await fileExists(KV, 文件名);
				  
				// 如果 'b64' 为 "null" ，则以明文方式写入文件，如果 'text' 为 "null" ，则以 base64 方式写入文件
				if (b64 === "null" ){
					await KV.put(文件名, text);
					return new Response(text, {
						status: 200,
						headers: { 'content-type': 'text/plain; charset=utf-8' },
					});
				} else if (text === "null" ){
					await KV.put(文件名, base64Decode(b64));
					return new Response(base64Decode(b64), {
						status: 200,
						headers: { 'content-type': 'text/plain; charset=utf-8' },
					});
				}
			}
			// 如果 token 不符，返回 'token 有误'
		} else {
			return new Response('token 有误', {
				status: 400,
				headers: { 'content-type': 'text/plain; charset=utf-8' },
			});
		}
	}
};

// 定义一个名为 fileExists 的异步函数，通过查询 KV 中是否有 filename 对应的值来判断文件是否存在
async function fileExists(KV, filename) {
	const value = await KV.get(filename);
	return value !== null;
}

// 定义一个名为 base64Decode 的函数，用于将 base64 编码的字符串转换为 utf-8 编码的字符
function base64Decode(str) {
	const bytes = new Uint8Array(atob(str).split('').map(c => c.charCodeAt(0)));
	const decoder = new TextDecoder('utf-8');
	return decoder.decode(bytes);
}
