# ClaraCore 界面方向一：文档型工作台

> 这个分支已在应用里实现首页和共同线，导航也改成了侧栏，其他页面只继承新的颜色变量。下面的截图和 HTML 是设计稿，所有主题和记录都是虚构示例。

这版优先保证阅读：表面用中性色，紫色只标记共同线、当前位置和主操作，内容来源靠形状区分。它把顶部导航改成了侧栏，也去掉了首页的四模块汇聚结构，这两点与现有产品不同。

## 已实现的界面

这些截图由真实渲染代码生成，数据是虚构的，在 Chrome 中使用桩接口运行，没有经过 Electron。

![首页（浅色）](implemented/home-light.png)

![首页（深色）](implemented/home-dark.png)

![共同线（浅色）](implemented/shared-line-light.png)

![共同线（深色）](implemented/shared-line-dark.png)

## 如何查看设计稿

1. 直接浏览下面的截图。
2. 需要点击导航时，下载这个目录并用浏览器打开 `home.html`。

HTML 是静态导出，只有导航和折叠区可以操作，筛选、开关和复制按钮不生效。

## 设计稿页面

### 共同理解（浅色）

[打开 HTML](home.html)

![共同理解（浅色）](screenshots/home.png)

### 共同理解（深色）

[打开 HTML](home-dark.html)

![共同理解（深色）](screenshots/home-dark.png)

### 共同线

[打开 HTML](shared-line.html)

![共同线](screenshots/shared-line.png)

### 记忆

[打开 HTML](memory.html)

![记忆](screenshots/memory.png)

### 知识

[打开 HTML](knowledge.html)

![知识](screenshots/knowledge.png)

### 内在活动

[打开 HTML](innerlife.html)

![内在活动](screenshots/innerlife.png)

### 日志

[打开 HTML](logs.html)

![日志](screenshots/logs.png)

### 连接智能体

[打开 HTML](agent-access.html)

![连接智能体](screenshots/agent-access.png)

### 设置

[打开 HTML](settings.html)

![设置](screenshots/settings.png)

### 视觉规范

[打开 HTML](visual-spec.html)

![视觉规范](screenshots/visual-spec.png)
