# 欢乐捕鱼 (Fishing Joy)

[🇬🇧 English](./README.md) | [🇨🇳 中文](./README.zh.md) | [🇯🇵 日本語](./README.ja.md) | [🇪🇸 Español](./README.es.md)

这是一个基于 **PixiJS v8** 和 **Tone.js** 的独立浏览器捕鱼游戏。项目不需要构建步骤，可以作为纯静态站点在本地直接运行。

## 功能特点

- WebGL 水波扭曲效果与分层场景渲染
- 动态刷鱼与鱼群阵列逻辑
- 本地金币系统与炮台火力调节
- 合成音效与循环背景音乐
- 通过 [index.html](./index.html) 直接加载脚本

## 快速启动

### Windows 一键运行

直接双击 [run.bat](./run.bat)。

脚本会自动：

- 检查 `py` 或 `python`
- 在 `http://localhost:8080/` 启动本地静态服务器
- 用默认浏览器打开游戏

### 手动运行

```powershell
cd E:\Privy\Fish
python -m http.server 8080
```

然后打开 [http://localhost:8080](http://localhost:8080)。

## 环境要求

- 已安装 Python 3，且可通过 `py` 或 `python` 调用
- 支持 WebGL 的现代浏览器
- 能访问 CDN，因为 [index.html](./index.html) 通过外链加载 PixiJS 和 Tone.js

## 目录说明

- [index.html](./index.html)：页面入口与脚本加载顺序
- [src](./src)：游戏逻辑、渲染、音频和实体代码
- [images](./images)：贴图、鱼精灵图和 UI 资源
- [loop-01.mp3](./loop-01.mp3)：循环背景音乐

## 说明

- 请使用本地静态服务器运行，不要直接用 `file://` 打开页面。
- 金币现在完全使用本地内存状态，不再依赖外部钱包或平台接口。
