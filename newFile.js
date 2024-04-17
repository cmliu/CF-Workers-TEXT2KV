import { base64Decode, configHTML, fileExists, mytoken, 下载bat, 下载sh, 空格替换加号 } from './_worker';

export default {
    async fetch(request, env) {
        // 如果环境变量中有 TOKEN，则将其赋值给 mytoken，否则保持默认值
        mytoken = env.TOKEN || mytoken;
        env.headers; {
            'Origin'; 'https://your-app.com'; // 替换为您的应用源
        }
        let KV;
        // 检查 KV (键值存储) 是否已经被设置
        if (env.KV) {
            // 将 env.KV 赋值一个名为 KV 的常量
            KV = env.KV;
        } else {
            //throw new Error('KV 命名空间未绑定');
            return new Response('KV 命名空间未绑定', {
                status: 400,
                headers: { 'content-type': 'text/plain; charset=utf-8' },
            });
        }

        // 从请求的 URL 中获取需要的参数
        const url = new URL(request.url);
        let token;
        if (url.pathname === `/${mytoken}`) {
            token = mytoken;
        } else {
            // 获取 URL 查询参数中的 'token'，如果不存在则赋值为 "null"
            token = url.searchParams.get('token') || "null";
        }

        // 检查提供的 token 是否与 mytoken 相符
        if (token === mytoken) {
            const 文件名 = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;

            if (文件名 == "config" || 文件名 == mytoken) {
                const html = configHTML(url.hostname, token);
                return new Response(html, {
                    headers: {
                        'Content-Type': 'text/html; charset=UTF-8',
                    },
                });
            } else if (文件名 == "config/update.bat") {
                return new Response(下载bat(url.hostname, token), {
                    headers: {
                        "Content-Disposition": `attachment; filename=update.bat`,
                        "content-type": "text/plain; charset=utf-8",
                    },
                });
            } else if (文件名 == "config/update.sh") {
                return new Response(下载sh(url.hostname, token), {
                    headers: {
                        "Content-Disposition": `attachment; filename=update.sh`,
                        "content-type": "text/plain; charset=utf-8",
                    },
                });
            } else {
                // 获取 URL 查询参数中的 'text' 和 'b64'，如果不存在则赋值为 "null"
                const text = url.searchParams.get('text') || "null";
                const b64 = url.searchParams.get('b64') || "null";

                // 如果 'text' 和 'b64' 都为 "null"，则从 KV 中读取并返回文件内容
                if (text === "null" && b64 === "null") {
                    const value = await KV.get(文件名);
                    return new Response(value, {
                        status: 200,
                        headers: { 'content-type': 'text/plain; charset=utf-8' },
                    });
                } else {
                    // 检查文件是否存在
                    await fileExists(KV, 文件名);

                    // 如果 'b64' 为 "null" ，则以明文方式写入文件，如果 'text' 为 "null" ，则以 base64 方式写入文件
                    if (b64 === "null") {
                        await KV.put(文件名, text);
                        return new Response(text, {
                            status: 200,
                            headers: { 'content-type': 'text/plain; charset=utf-8' },
                        });
                    } else if (text === "null") {
                        await KV.put(文件名, base64Decode(空格替换加号(b64)));
                        return new Response(base64Decode(空格替换加号(b64)), {
                            status: 200,
                            headers: { 'content-type': 'text/plain; charset=utf-8' },
                        });
                    }
                }
            }


        } else if (url.pathname == "/") { //首页改成一个nginx伪装页
            return new Response(`
			<!DOCTYPE html>
			<html>
			<head>
			<title>Welcome to nginx!</title>
			<style>
				body {
					width: 35em;
					margin: 0 auto;
					font-family: Tahoma, Verdana, Arial, sans-serif;
				}
			</style>
			</head>
			<body>
			<h1>Welcome to nginx!</h1>
			<p>If you see this page, the nginx web server is successfully installed and
			working. Further configuration is required.</p>
			
			<p>For online documentation and support please refer to
			<a href="http://nginx.org/">nginx.org</a>.<br/>
			Commercial support is available at
			<a href="http://nginx.com/">nginx.com</a>.</p>
			
			<p><em>Thank you for using nginx.</em></p>
			</body>
			</html>
			`, {
                headers: {
                    'Content-Type': 'text/html; charset=UTF-8',
                },
            });
        } else { // 如果 token 不符，返回 'token 有误'//
            return new Response('token 有误', {
                status: 400,
                headers: { 'content-type': 'text/plain; charset=utf-8' },
            });
        }
    }
};
