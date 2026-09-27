# INKWAVE: Turf Riot — 技术白皮书与工程规范规范 (Technical Specification & Architecture)

> **版本**：v1.0.0  
> **定位**：基于 WebGL2 / Three.js 的零外部资产（Zero-Asset）、纯程序化生成的 4v4 涂地动作对战游戏  
> **适用环境**：现代现代浏览器（Chrome 90+, Edge 90+, Safari 16.4+, Firefox 115+）  
> **部署标准**：原生 ES Modules + `<script type="importmap">`，零打包混淆

> Publication note: This document contains design notes, not a verified performance or browser-compatibility guarantee. The current build is single-player with AI teammates and opponents. Fonts and baked lightmaps are bundled assets. See README.md for current setup and controls.

---

## 目录
1. [项目概述与设计哲学](#一项目概述与设计哲学)
2. [工程目录与核心模块划分](#二工程目录与核心模块划分)
3. [核心技术规范与实现原理](#三核心技术规范与实现原理)
   - 3.1 [纹理空间涂地系统规范 (Paint System)](#31-纹理空间涂地系统规范-paint-system)
   - 3.2 [程序化角色与分层动力学动画 (Procedural Character & Motion)](#32-程序化角色与分层动力学动画-procedural-character--motion)
   - 3.3 [GPU 程序化 PBR 材质生成系统 (texlib)](#33-gpu-程序化-pbr-材质生成系统-texlib)
   - 3.4 [场景构建与轻量化物理引擎 (Physics & Collision)](#34-场景构建与轻量化物理引擎-physics--collision)
   - 3.5 [空间网格导航与拟人化 Bot AI (Nav & AI)](#35-空间网格导航与拟人化-bot-ai-nav--ai)
   - 3.6 [纯 Web Audio DSP 程序化声音引擎 (Audio & Music)](#36-纯-web-audio-dsp-程序化声音引擎-audio--music)
   - 3.7 [图形渲染管线与自定义后处理 (Rendering & Post-processing)](#37-图形渲染管线与自定义后处理-rendering--post-processing)
   - 3.8 [UI 与前端工程规范 (HUD & Menus)](#38-ui-与前端工程规范-hud--menus)
4. [核心性能优化与编码规范](#四核心性能优化与编码规范)
5. [配置参数与调试接口 (Debug APIs)](#五配置参数与调试接口-debug-apis)

---

## 一、 项目概述与设计哲学

### 1.1 项目定位
**INKWAVE (Turf Riot)** 是一款在 Web 端高度复刻任天堂《Splatoon》（斯普拉遁/喷射战士）核心玩法的完整 3D 动作射击游戏。游戏支持 4v4 团队阵地涂抹赛（Turf War），玩家可操纵墨灵（Squidkid）在人类形态与乌贼形态间自由切换，利用墨汁占领场地、潜墨加速游动、潜水爬墙补给，并与具备战术智能的电脑 AI 展开对抗。

### 1.2 核心设计哲学
1. **绝对的“零外部 3D/音频资产”（Zero-Asset Proceduralism）**：
   - 传统 3D Web 游戏依赖体积庞大的 `.gltf` / `.fbx` 模型、骨骼动画切片、PBR 贴图纹理和 `.mp3` / `.wav` 音频采样。
   - INKWAVE 全站除两个英文字体（`TitanOne` 与 `Rubik`）外，**100% 的 3D 模型、骨骼绑定、着色材质、环境特效、场景道具、枪械弹道、游戏音效以及多轨 BGM 全部由数学公式与着色器在客户端运行时动态生成**。
   - 全工程代码及依赖压缩后体积极小（除去 Three.js 核心库外，游戏自身源码仅约 1.5 MB），实现首屏极速加载与极致的自包含性。
2. **纯粹的现代 Web 标准（Native Modern Web Standards）**：
   - 不依赖 Webpack / Vite / Rollup 等传统前端打包工具编译构建。
   - 原生基于浏览器 ES Modules 及 `<script type="importmap">` 规范直接执行源码，代码无混淆、无二次封装，保持清晰的原生开发态。
3. **严格的工业级性能控制（Zero-Allocation & Draw Call Budget）**：
   - 运行时每帧循环（Update / Render）坚持 **零动态内存分配（Allocation-Free）**，彻底消除 JavaScript 垃圾回收（GC Pause）导致的掉帧卡顿。
   - 全场景 150+ 道具与复杂几何体通过材质与实例批次合并（Batch Merging），严格控制 WebGL Draw Calls。

---

## 二、 工程目录与核心模块划分

```
inkwave/
├── index.html                   # 网页主入口，配置 importmap 映射 Three.js 依赖
├── start.sh                     # 自动探测空闲端口并启动本地服务器的 Shell 脚本
├── README.md                    # 本地快速上手与操作指南
├── TECHNICAL_SPEC.md            # 本技术白皮书与架构规范文档
├── styles/
│   ├── ui.css                   # 全局 UI 样式表，基于 --u 的 16:9 响应式等比缩放系统
│   └── hud.css                  # 游戏内 HUD 准星、墨量槽、击杀卡与倒计时样式
├── assets/
│   ├── fonts/                   # TitanOne-latin.woff2, Rubik-latin.woff2（全站唯一外部资产）
│   └── lightmaps/               # 烘焙的环境光遮蔽（AO）纹理图集与坐标映射 JSON
├── vendor/
│   └── three/                   # Three.js (r186) 核心 ES 模块及 JSM 后处理管线扩展
└── src/
    ├── main.js                  # 游戏启动入口、生命周期状态机与主渲染循环
    ├── config.js                # 全局物理手感常数、武器数值、队伍调色板配置
    ├── core/
    │   ├── ctx.js               # 全局单例上下文、事件总线（emit/on）与公共数学算法
    │   ├── renderer.js          # WebGL 渲染器初始化、后处理管线与自定义阴影过滤
    │   └── input.js             # 键盘/鼠标/手柄输入监听器与指针锁定（Pointer Lock）管理
    ├── game/
    │   ├── actor.js             # 角色战斗实体状态机（位移、跳跃、潜墨、生命、受击）
    │   ├── character.js         # 程序化角色动画控制器（足部步态锁、两骨 IK、弹簧动力学）
    │   ├── character-geo.js     # 纯代码建模：参数化超椭球体与车削体构造角色与骨骼蒙皮
    │   ├── character-mats.js    # 角色皮肤次表面、衣物布料、触须发丝凝胶材质 Shader
    │   ├── character-weapons.js # 纯代码建模：枪械、滚筒、狙击枪等参数化几何构造
    │   ├── weapons.js           # 武器射击弹道解算、散射角散布、后坐力与副武器抛物线
    │   ├── physics.js           # 自研几何物理引擎：OBB、坡道、胶囊体与多点地面探针
    │   ├── nav.js               # 地图空间网格自动体素化与二叉堆 A* 寻路图
    │   ├── bots.js              # 人机 AI：战术跑位、阻尼弹簧瞄准惯性、潜墨躲避与超级跳
    │   ├── cameraRig.js         # 第三人称弹簧臂追踪摄像机（防遮挡防穿墙探针）
    │   ├── match.js             # 比赛生命周期（Intro -> Countdown -> Play -> Judge）
    │   ├── minimap.js           # 实时俯瞰战局小地图与超级跳跃队友定位
    │   └── showcase.js          # 展厅模式与角色自定义展示
    ├── world/
    │   ├── level.js             # 关卡构造器：将数据盒子解析为碰撞体与可涂抹渲染面
    │   ├── maps.js              # 竞技场地几何拓扑定义（Tidewater Plaza, Kelpline Terminal）
    │   ├── paint.js             # 核心涂地系统：GPU Atlas 纹理空间着墨 + CPU 玩法网格
    │   ├── levelMaterial.js     # 场景注入 Shader：B-spline 采样生成立体厚涂墨水反光
    │   ├── texlib.js            # GPU 实时程序化生成 PBR 贴图库（MRT + PCG/FBM 噪声）
    │   ├── props.js             # 场景道具生成器：长凳、集装箱、栏杆、风扇（批次合并）
    │   ├── environment.js       # 天空穹顶、动态海面着色器、远景港口码头风光
    │   └── murals.js            # 离屏 Canvas 2D 动态生成墙面涂鸦与商业标语贴图
    ├── fx/
    │   ├── fx.js                # 粒子与特效池（飞溅墨滴、爆破气泡、水花、冲击波）
    │   ├── fxHooks.js           # 战斗事件与特效触发解耦钩子
    │   └── screenfx.js          # 屏幕级后期受击溅血、墨汁飞溅特效
    ├── audio/
    │   ├── audio.js             # Web Audio API 纯程序化音效合成（喷射、潜水、爆炸、步足）
    │   └── music.js             # Web Audio API 纯程序化 BGM 合成器（物理建模鼓机 + FM 合成）
    └── ui/
        ├── hud.js               # 战斗 HUD 界面（动态准星、墨量计、大招计量表、击杀通知）
        ├── menus.js             # 主菜单、模式选择、结算面板与设置面板逻辑
        ├── menu-art.js          # 动态 SVG 徽章、矢量艺术图形与涂鸦素材
        └── ui-util.js           # 极轻量 DOM 构造器 `h()` 与插值曲线工具
```

---

## 三、 核心技术规范与实现原理

### 3.1 纹理空间涂地系统规范 (Paint System)
墨汁涂地是整个游戏的核心玩法机制，其技术难点在于：**如何让任意 3D 几何体的表面（地面、垂直墙面、倾斜坡道）都能被子弹自然沾染，且画面表现与玩法逻辑（百分比判定、潜游条件）高度一致**。

```
                    ┌────────────────────────────────────────────────────────┐
                    │                   子弹着弹事件 (Hit Event)              │
                    └──────────────────────────┬─────────────────────────────┘
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       ▼                                               ▼
       ┌───────────────────────────────┐               ┌───────────────────────────────┐
       │     GPU 渲染管线 (Visual)     │               │     CPU 玩法逻辑 (Gameplay)   │
       ├───────────────────────────────┤               ├───────────────────────────────┤
       │ 1. 映射至 UV 图集 (Atlas RT)   │               │ 1. 对应到面的 0.25m 离散网格  │
       │ 2. 执行 `PAINT_FS` 片段着色器 │               │ 2. 执行相同的 `blobWobble()`  │
       │ 3. 评估有机边缘 `blobWobble`  │               │ 3. 更新网格所有权 (Alpha/Bravo│
       │ 4. 写入 R(队伍0)/G(队伍1)/A  │               │ 4. 瞬时查询：脚下墨水/潜游/加  │
       │ 5. 场景着色器 B-spline 滤镜   │               │ 5. 统计全场涂抹面积占比(Judge)│
       │    生成立体圆润凝胶厚度与法线 │               │                               │
       └───────────────────────────────┘               └───────────────────────────────┘
```

1. **UV 图集映射（Texture-Space Painting）**：
   - 场景中所有可涂抹的多边形面在初始化时展开并分配到一张大尺寸纹理图集渲染目标（`WebGLRenderTarget`，尺寸为 2048×2048 或 4096×4096，见 `config.js` 中的 `QUALITY` 配置）。
   - 图集通道格式为 RGBA8：
     - **R 通道**：Alpha 队伍墨水权重。
     - **G 通道**：Bravo 队伍墨水权重。
     - **B 通道**：单次撞击噪波与色调微调。
     - **A 通道**：平滑覆盖率（3 像素过渡轮廓），采用 `gl.MAX` 混合方程合并。
2. **GPU 与 CPU 对称的边缘扰动函数**：
   为了保证渲染边界与碰撞/判定网格绝对吻合，着色器与 JS 端共同计算相同的分析解形态函数：
   ```javascript
   export function blobWobble(ang, seed) {
     return 1 + 0.12 * Math.sin(3 * ang + seed * 6.2831)
              + 0.08 * Math.sin(5 * ang + seed * 17.0)
              + 0.05 * Math.sin(7 * ang + seed * 41.0)
              + 0.03 * Math.sin(11 * ang + seed * 73.0)
              + 0.018 * Math.sin(17 * ang + seed * 29.0)
              + 0.17 * Math.pow(Math.max(Math.cos(ang - seed * 37.7), 0), 28)
              + 0.12 * Math.pow(Math.max(Math.cos(ang - seed * 53.3 - 2.1), 0), 36);
   }
   ```
3. **立体凝胶材质表现（Gel Micro-surface）**：
   - 在 `levelMaterial.js` 中重写了 Three.js 的 `MeshPhysicalMaterial` 片段着色器。
   - 使用三次 B-样条（Cubic B-spline）对 Atlas 贴图进行双三次采样，消除双线性插值的生硬多边形感，重构出圆润凸起的流体高度场，并据此计算微表面法线和菲涅尔高光（Clearcoat 1.0, ClearcoatRoughness 0.08）。

---

### 3.2 程序化角色与分层动力学动画 (Procedural Character & Motion)
角色系统摒弃了所有传统的骨骼动画片段（如 Idle、Run、Jump、Shoot 等 FBX/GLTF 剪辑），采用全解算架构（`character.js`）：

1. **数学建模（`character-geo.js`）**：
   - 角色身体、五官、四肢全部由超椭球体（Superellipsoid）、放样旋转体（Lathe）和扫掠体（Sweep）生成。
   - 网格包含完整的 24 根骨骼绑定系统（`hips`, `spine`, `chest`, `neck`, `head`, `uArm`, `fArm`, `hand`, `thigh`, `shin`, `foot` 等），总面数严格压制在 40,000 三角面以内，角色主体仅 8~10 个 Draw Calls。
2. **足部锁定步态（World-locked Foot Plants）**：
   - 根据角色的世界线速度、加速度以及朝向计算步频相位。
   - 当步态处于支撑期（Stance Phase）时，脚掌世界坐标**完全锁死在着地点**，利用下肢两骨逆向运动学（Two-Bone Analytical IK）反向求解大腿和膝关节的屈伸与旋转。从根本上杜绝了 3D 动作游戏中最普遍的“滑步”缺陷。
3. **分层动力学弹簧体系（Layered Springs）**：
   - **加速度倾斜层**：起步加速向前倾、刹车后仰、转向离心侧倾，均由临界阻尼弹簧平滑驱动；
   - **躯干与视线解算**：躯干骨骼采用正向运动学（FK），头部独立于身体面向瞄准十字线；
   - **次级物理（Secondary Dynamics）**：乌贼触须头发采用 8 条 Verlet 弹簧质点链（每条 3 节），在世界空间实时计算惯性、重力与风阻摆动；后背墨水瓶液体计算晃动坡度。

---

### 3.3 GPU 程序化 PBR 材质生成系统 (texlib)
为了在无图片资产的情况下获得高品质的 PBR 质感，`texlib.js` 采用现代 GPU 预烘焙技术：

1. **多渲染目标（MRT）架构**：
   - 在启动阶段使用单一 Uber Fragment Shader 同时向包含 3 个色彩附件的 `WebGLArrayRenderTarget` 渲染：
     - **Albedo 贴图数组**：sRGB8_A8（漫反射反照率 + Alpha 遮罩）。
     - **Normal 贴图数组**：RGBA8（切线空间法线向量）。
     - **ORM 贴图数组**：RGBA8（R: 遮蔽/AO, G: 粗糙度, B: 金属度, A: 浮雕高度）。
2. **数学噪声与抗周期拉伸**：
   - 混凝土、沥青、地砖、瓦楞铁皮、木质甲板的微表面完全通过 **PCG 整数哈希、Worley 细胞噪声与 FBM 分形噪声**合成。
   - 引入 **Hex-tile 六边形随机旋转混合算法（Mikkelsen 2022）**，消除大面积无缝贴图重复带来的网格感。

---

### 3.4 场景构建与轻量化物理引擎 (Physics & Collision)
放弃笨重的物理引擎中间件，针对涂地射击玩法定制了轻量、高精度的几何物理系统（`physics.js`）：

1. **碰撞基元与分离轴算法**：
   - 场景几何以有向包围盒（OBB）和斜坡（Ramp）构成；
   - 角色碰撞体采用胶囊体（Capsule），在每个物理步长中对临近 OBB 进行快速投影碰撞解除（AABB 空间散列预筛选）。
2. **8 探针环形地面检测（Ground Probe Ring）**：
   - 为避免角色脚下边缘悬空或台阶卡死，在角色脚底半径上呈圆环状均匀投射 8 根垂直射线，精准感知悬崖边缘与斜坡法线，决定角色是平滑站立还是滑落。
3. **摄像机防穿墙探针（Camera Collision Probe）**：
   - 第三人称相机发射由 1 根中心主光线 + 6 根内环光线 + 8 根外环光线组成的视锥体探针束，当贴近墙体或障碍物时柔和推进相机焦距，杜绝穿模与视觉遮挡。
4. **铁丝网机制（Grate Physics）**：
   - 模拟原作设定：人类形态可踩在铁丝网上行动，但乌贼形态、墨水以及射击子弹会直接穿透铁丝网网孔。

---

### 3.5 空间网格导航与拟人化 Bot AI (Nav & AI)
游戏内置了高仿真度的人机对战行为树系统（`nav.js` + `bots.js`）：

1. **体素化导航图（NavGraph）**：
   - 关卡加载后，在所有可行走表面上以 1 米步长自动采样节点，建立包含行走边、跳跃上升边、下落边缘的有向图，使用二叉堆优化的 A* 算法进行毫秒级寻路。
2. **拟人化射击操控手感（Human-like Aiming）**：
   - AI 的准星瞄准不是机械的角度对准，而是通过带有角速度上限的**临界阻尼弹簧（Critically-damped Spring）**进行旋转跟踪。
   - 包含超调回正（Overshoot / Undershoot）与平滑游走的人类操作误差，射击子弹严格依据枪管实际物理朝向发射。
3. **战术态势感知**：
   - AI 会评估自身墨水余量、当前生命值与周围敌我墨水覆盖比例；
   - 处于劣势或血量危险时，AI 会主动潜入己方墨水潜行撤退、蛇皮走位规避伤害、甚至通过超级跳跃（Super Jump）飞回大本营或飞向突前队友。

---

### 3.6 纯 Web Audio DSP 程序化声音引擎 (Audio & Music)
声音系统（`audio.js` 与 `music.js`）完全基于 Web Audio API 底层节点网络，**全工程无一个音频文件**：

1. **DSP 核心构建块**：
   - 预分配无缝循环的白噪声、粉红噪声与布朗噪声缓冲区（`noiseBuffer`），在循环边界使用双重 IIR 滤波热身消除接缝爆音。
   - 自研多段式包络器（ADSR, AHR, 最小加加速度 Minimum-Jerk 曲线）。
2. **打击乐物理建模**：
   - **底鼓（Kick）**：下潜扫频正弦波 + 瞬态脉冲（Impulse）冲击。
   - **军鼓（Snare）**：带通滤波粉红噪声与腔体共振双振荡器叠加。
   - **踩镲（Hi-hat）与吊镲（Crash）**：高通滤波金属质感随机脉冲。
3. **液体与喷射音效模拟**：
   - 潜水气泡声（`bubbles`）：由几十个微小颗粒带通正弦扫频在时间轴上泊松分布卷积生成；
   - 涂地墨水飞溅声：带有随机包络的带通噪声脉冲。
4. **动态多轨 BGM 系统**：
   - BGM 包含 6 种战斗与大厅旋律，能根据战场局势（如终局最后 1 分钟、激烈交火区）动态提升节奏强度（Intensity），自动在帽子戏法（Hats only）与全管弦/电贝斯爆音之间平滑过渡。

---

### 3.7 图形渲染管线与自定义后处理 (Rendering & Post-processing)

1. **后处理管线顺序**：
   ```
   Scene 渲染 (MSAA HDR Target) 
       │
       ▼
   GTAOPass (屏幕空间地面定向环境遮蔽，高质量模式开启)
       │
       ▼
   UnrealBloomPass (针对墨汁与霓虹光源的泛光扩散)
       │
       ▼
   GradeShader (色彩分级 Shader)
       ├─ 对数空间动态对比度调整
       ├─ 冷暗部 / 暖高光色调分离 (Split-toning)
       ├─ 自然色彩饱和度增强 (Vibrance，确保强饱和墨汁不溢出饱和度)
       ├─ 动态暗角 (Vignette)
       └─ 低生命值去饱和黑白化与血色边缘脉冲
       │
       ▼
   OutputPass (ACESFilmic 色调映射与 sRGB 色彩空间输出)
   ```
2. **原生 Three.js 阴影伪影修复**：
   - Three.js 原生软阴影采用 Vogel 盘随机旋转采样，在边缘产生强烈的噪波颗粒。
   - 本项目通过 `patchShadowFilter` 函数重写了内部的 `shadowmap_pars_fragment` ShaderChunk，替换为无噪波的 **3×3 硬件双线性比较采样网格**，获得了平滑稳定的柔和阴影边缘。

---

### 3.8 UI 与前端工程规范 (HUD & Menus)

1. **分辨率等比适配规范（The `--u` Unit）**：
   - UI 布局完全基于 CSS 变量 `--u: min(1vw, 1.7778vh)`（即 16:9 标准画布的 1%）。无论屏幕是超宽带鱼屏、手机竖屏还是 4K 显示器，UI 元素均能保持像素完美的绝对等比缩放。
2. **无框架极速 DOM 构造**：
   - 未引入 React/Vue 等高开销框架，采用原生工具函数 `h(tag, props, ...children)` 操作 DOM，以极致的更新效率响应射击、命中跳字（Hit Marker）、墨量浮动等高频界面更新。

---

## 四、 核心性能优化与编码规范

INKWAVE 能够稳定运行在 60~120 FPS 的终极原因在于贯彻了严格的系统级前端编码军规：

### 4.1 帧循环内零分配准则 (Allocation-Free Frame Loop)
在 `update(dt)`、`physics.step()`、`character.update()` 等每帧被调用数百次的函数中，**严禁使用任何 `new` 操作符**：
* ❌ 严禁出现：`const dir = new THREE.Vector3().subVectors(a, b);`
* ✅ 强制模式：在模块作用域预分配全局复用变量池（Scratch Variables）：
  ```javascript
  const _v = new THREE.Vector3();
  const _v2 = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  ```
  在方法内部一律使用 `.copy()`, `.set()`, `.addScaledVector()` 进行原地算术，杜绝 V8 引擎新生代垃圾回收停顿。

### 4.2 场景道具合并批次 (Prop Merging)
场景中的 150+ 道具（路灯、长椅、集装箱、管道、水管、雪糕筒等）在关卡加载时通过 `BufferGeometryUtils.mergeGeometries` 按照材质类型烘焙合并为 **9 个静态 Mesh**，动态旋转的排风扇和警戒闪光灯则使用 **5 个 `InstancedMesh`**，将全场景静态物体的 Draw Calls 控制在个位数。

### 4.3 粒子全对象池化 (Object Pooling)
墨汁飞溅水滴、气泡、水花均在初始化时预分配定长 TypedArray 数组，着色器直接利用顶点属性在 GPU 端根据时间戳解算抛物线轨迹，无任何动态数组扩容。

---

## 五、 配置参数与调试接口 (Debug APIs)

### 5.1 URL 调试参数 (Query Parameters)
在启动本地服务后，可在 URL 后面附加调试参数进行快速测试：
* `?map=kelpline`：直接进入指定的竞技场地（支持 `tidewater`, `kelpline`, `sunset`）。
* `?skipTitle`：跳过标题画面，直接进入主模式选择菜单。
* `?autostart=90`：跳过菜单流程，以指定时长（如 90 秒）直接自动开启一局 4v4 对战。

### 5.2 开发者控制台接口 (Console API)
游戏运行时在全局暴露了 `window.__inkwave` 与 `window.__G`，可在浏览器 F12 控制台中直接调用：
* `__inkwave.debug.freeze()`：冻结物理与动画模拟（单帧审计模式）。
* `__inkwave.debug.step(16.7)`：单步执行指定毫秒数的逻辑，方便调试物理和子弹弹道。
* `__inkwave.debug.paintRandom(500)`：向场地随机倾泻 500 发墨水，压力测试涂地系统。
* `__inkwave.debug.endMatch()`：立刻将比赛时间缩短为 0.5 秒，快速触发结果胜负判定（Judge）。
* `__G.actors[0]`：获取玩家实体，直接修改 `hp`、`ink` 等属性。

---

## 六、 总结与学习路线指引

本项目不仅是一部高完成度的 Web 3D 动作游戏，更是**现代 WebGL / Three.js 全栈程序化开发的典范教科书**。建议开发者遵循以下顺序阅读核心模块：
1. 从 `src/main.js` 入手理清游戏启动与主循环脉络；
2. 研读 `src/world/paint.js` 与 `src/world/levelMaterial.js`，掌握纹理空间着墨与厚涂 Shader 技巧；
3. 研读 `src/game/character.js` 与 `src/game/character-geo.js`，学习逆向运动学（IK）、步态锁定与纯代码建模；
4. 研读 `src/audio/music.js`，了解 Web Audio DSP 纯代码音频合成。
