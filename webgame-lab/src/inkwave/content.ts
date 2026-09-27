import type { DemoKind } from "./runtime/demo";
export const chapters: Record<
  DemoKind,
  {
    title: string;
    subtitle: string;
    principle: string;
    reuse: string;
    controls: string;
  }
> = {
  "3c": {
    title: "01 / 3C & BODY",
    subtitle: "身体、输入、镜头一起顺",
    principle:
      "原版胶囊移动、跳跃缓冲、台阶补偿、程序化步态与贴地脚掌，再接速度前馈镜头、避障和落地回弹。",
    reuse:
      "第三人称探索、动作冒险、平台跳跃。替换角色模型时保留 intent → motor → pose → camera 的顺序。",
    controls: "WASD 移动 · 空格跳 · 切换原版 / GLB 角色 · 回放同一路线对比手感",
  },
  materials: {
    title: "02 / SURFACE & LIGHT",
    subtitle: "材质质感来自整条渲染链",
    principle:
      "14 层 GPU 生成纹理、反重复采样、粗糙度与法线、湿润涂层、天空环境光、HDR 泛光和保护队伍色相的调色。",
    reuse:
      "风格化城镇、玩具材质、积雪/污渍/潮湿覆盖。保留材质参数与光照预设的分离。",
    controls: "对比无 AO / 烘焙 AO / 实时 AO · 切换日照和后期 · 添加湿润涂层",
  },
  ui: {
    title: "03 / MOTION LANGUAGE",
    subtitle: "反馈、转场、结果是一套节奏",
    principle:
      "指针和键盘焦点共用反馈；入场错峰；墨水转场在遮挡中切换内容；结果用可跳过、只提交一次的时间线。",
    reuse:
      "原版菜单、设置、配装和结算。游戏数据通过接口注入；字体、材质、焦点和转场组成完整的视觉语言。",
    controls: "Tab / Enter 操作 · 悬停与点击 · 三种转场 · 播放或跳过结算",
  },
  paint: {
    title: "04 / SURFACE RULES",
    subtitle: "画上去的东西，也能成为规则",
    principle:
      "GPU 图集负责外观，CPU 网格负责归属、覆盖率与查询。外观有扩散、滴落，规则无需逐像素读取 GPU。",
    reuse:
      "毒区、冰面、清洁、耕种、领地。以可替换的 surface policy 决定速度、伤害和补给。",
    controls: "点击场景涂色 · 切换归属 · 对比领地、危险、加速与恢复地面",
  },
  combat: {
    title: "05 / FEEDBACK CHAIN",
    subtitle: "一次动作，多层反馈共同落点",
    principle:
      "真实弹道与命中发出事件，再联动墨滴、扩散、形变、镜头后坐、声音和资源提示。事件总线按世界隔离。",
    reuse:
      "近战、射击、采集、交互。玩法发事实，表现模块订阅；可以独立开关反馈。",
    controls: "播放 / 取消技能组合 · 分开开关粒子、镜头、声音 · 左键开火 · E 投掷",
  },
  ai: {
    title: "06 / INTENT & NAVIGATION",
    subtitle: "先选值得做的事，再决定怎么去",
    principle:
      "原版机器人按空地、敌色、距离、队友拥挤评分；A* 支持行走/跳跃/下落，瞄准与转向另有平滑。",
    reuse:
      "搬运、救援、巡逻。第二个策略把目标改为救援点，沿同一导航图行走，不开枪。",
    controls: "切换领地战与救援 · 显示导航采样点 · 查看实际状态与目标",
  },
  world: {
    title: "07 / DATA → WORLD",
    subtitle: "一份数据，生成多个系统",
    principle:
      "盒体和坡面同时生成可见几何、碰撞、可涂色表面与导航；道具按种子生成并合批。",
    reuse:
      "模块化关卡、街区装饰、训练场。结构与装饰分离；这里展示道具变体，不把装饰误当碰撞体。",
    controls: "重生成道具种子 · 显示碰撞结构 · 显示导航点",
  },
  audio: {
    title: "08 / SOUND SYNTHESIS",
    subtitle: "声音也可以是可调的代码",
    principle:
      "Web Audio 合成短音效、循环纹理、空间衰减和音乐分层；限声部、淡入淡出和 ducking 管理混音。",
    reuse: "低包体游戏、参数化反馈、动态配乐。每个世界独占引擎，退出即释放。",
    controls: "点击启用声音 · 试听合成音效 · 换曲 · 调整配乐强度",
  },
  diagnostics: {
    title: "09 / FRAME & LIFETIME",
    subtitle: "把手感和成本一起看见",
    principle:
      "固定步长推进模拟，限制后台补帧；显式暂停/单步；观察帧间隔中位数与 P95、绘制调用、纹理和事件计数。",
    reuse:
      "任何实时游戏的调试台。外部宿主拥有帧循环，世界拥有输入、资源和订阅并统一销毁。",
    controls: "暂停 / 单步 · 时间倍率 · 增加机器人 · 重置回合",
  },
};
