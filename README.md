添加KV 命名空间绑定 空间名称KV
变量TOKEN = passwd

明文写入ip.txt内容

https://worker-flat-firefly-1484.workers.dev/ip.txt?token=passwd&text=123
```
123
```

base64写入ip.txt内容

https://worker-flat-firefly-1484.workers.dev/ip.txt?token=passwd&b64=MzIx
```
321
```

读取内容

https://worker-flat-firefly-1484.workers.dev/ip.txt?token=passwd
```
123
```
