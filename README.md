# 国潮像素捕鱼

这是一个可在局域网内运行的 H5 捕鱼游戏。玩家用浏览器进入游戏，本机通过管理后台给玩家加游戏币。

## 快速启动

1. 安装 Node.js 18 或更高版本。
2. 双击 `run.bat`。
3. 启动窗口会输出两个地址：
   - 本机游戏：`http://localhost:3000/`
   - 本机后台：`http://localhost:3000/admin`
4. 同一局域网内的玩家访问窗口里显示的 `局域网游戏` 地址。

服务器默认监听 `0.0.0.0:3000`。如需改端口：

```powershell
$env:PORT=8080; node server/server.js
```

## 玩法调整

- 炮塔已上移到操作栏上方，不再被底部 UI 遮挡。
- 游戏开始后会自动锁定当前倍率最高的鱼。
- 点击其他鱼会切换锁定目标。
- 已去掉 `Fire` 按钮，点击水域立即开火，长按水域持续开火。
- `+` / `-` 按钮调整炮值，开火时会按当前炮值扣除玩家金币。

## 玩家买币与后台加币

玩家第一次进入游戏会生成一个玩家号，例如 `P8A31F2`。默认初始金币为 `0`，需要本机后台加币后才能开火。

后台地址只允许本机访问：

```text
http://localhost:3000/admin
```

在后台输入玩家号和加币数量，提交后玩家端会在数秒内同步余额。玩家捕获鱼后，服务端会记录中奖金币、累计购买、累计消耗和累计捕获。

如果想给新玩家默认试玩金币，可设置环境变量：

```powershell
$env:STARTING_COINS=1000; node server/server.js
```

## 文件结构

```text
index.html                 游戏入口
admin.html                 本机管理后台
src/styles/game.css        游戏样式
src/styles/admin.css       后台样式
src/js/game.js             游戏循环、输入、锁定、开火、结算
src/js/renderer.js         Canvas 绘制
src/js/api.js              玩家余额 API 客户端
src/js/config.js           鱼、炮、概率配置
src/js/utils.js            通用工具
src/js/admin.js            后台交互
server/server.js           静态资源服务器与余额接口
data/players.json          运行时自动生成的玩家余额数据
run.bat                    Windows 一键启动
```

## 局域网注意事项

- 电脑和玩家设备需要在同一个局域网。
- Windows 防火墙如果提示拦截 Node.js，需要允许专用网络访问。
- 管理后台和加币接口仅允许本机访问，不会开放给局域网玩家。
- 当前结算适合局域网小范围试玩，不建议直接暴露到公网。
