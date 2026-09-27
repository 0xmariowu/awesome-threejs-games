import type { Backend } from './renderer'

export type { Backend }

export interface CatalogEntry {
  id: string
  collection?: 'inkwave'
  category: string
  name: string
  desc: string
  backend: Backend
  webglVerified?: boolean
  source: string
  picks: string[]
  note?: string
}

export const CATEGORY_ORDER = ['角色', '镜头', '动画', '画面', '天空', '植被', '世界', '水', '特效', 'NPC', '物理', '基础']

// One row per scene file in src/scenes; `id` is the file basename.
export const catalog: CatalogEntry[] = [
  { id: 'inkwave-3c', collection: 'inkwave', category: '角色', name: '3C 与程序化身体', desc: '完整输入、移动、动作和镜头链路，原版与直接跟随对比。', backend: 'webgl', source: '0xmariowu/inkwave 11ce485 (MIT) + portable lab adapters', picks: [] },
  { id: 'inkwave-materials', collection: 'inkwave', category: '画面', name: '材质与光照链路', desc: '生成纹理、湿润涂层、日照、HDR 泛光与调色。', backend: 'webgl', source: '0xmariowu/inkwave 11ce485 (MIT) + portable lab adapters', picks: [] },
  { id: 'inkwave-ui', collection: 'inkwave', category: '动画', name: 'UI 动态语言', desc: '焦点反馈、错峰入场、墨水转场、可跳过结算。', backend: 'webgl', source: '0xmariowu/inkwave 11ce485 (MIT) + portable lab adapters', picks: [] },
  { id: 'inkwave-paint', collection: 'inkwave', category: '世界', name: '表面涂色与玩法规则', desc: 'GPU 外观 + CPU 归属，迁移成毒区或加速地面。', backend: 'webgl', source: '0xmariowu/inkwave 11ce485 (MIT) + portable lab adapters', picks: [] },
  { id: 'inkwave-combat', collection: 'inkwave', category: '特效', name: '战斗反馈链', desc: '弹道、命中、粒子、镜头、声音和事件解耦。', backend: 'webgl', source: '0xmariowu/inkwave 11ce485 (MIT) + portable lab adapters', picks: [] },
  { id: 'inkwave-ai', collection: 'inkwave', category: 'NPC', name: '目标评分与导航', desc: '原版领地机器人与救援策略，共用导航与移动。', backend: 'webgl', source: '0xmariowu/inkwave 11ce485 (MIT) + portable lab adapters', picks: [] },
  { id: 'inkwave-world', collection: 'inkwave', category: '世界', name: '数据驱动关卡与道具', desc: '几何、碰撞、表面、导航同源；种子道具合批。', backend: 'webgl', source: '0xmariowu/inkwave 11ce485 (MIT) + portable lab adapters', picks: [] },
  { id: 'inkwave-audio', collection: 'inkwave', category: '基础', name: '程序化声音与配乐', desc: '合成音效、空间音频、分层音乐和声部管理。', backend: 'webgl', source: '0xmariowu/inkwave 11ce485 (MIT) + portable lab adapters', picks: [] },
  { id: 'inkwave-diagnostics', collection: 'inkwave', category: '基础', name: '帧循环与生命周期', desc: '固定步长、暂停单步、负载调节与资源释放。', backend: 'webgl', source: '0xmariowu/inkwave 11ce485 (MIT) + portable lab adapters', picks: [] },
  {
    id: 'feel-cam',
    category: '角色',
    name: '物理角色 + 镜头切换',
    desc: '狐狸在斜坡、台阶、箱子间跑跳；按 C 在跟随镜头和自由镜头之间切换。',
    backend: 'webgpu',
    source: 'pmndrs/ecctrl + Rapier + camera-controls',
    picks: ['A1', 'B1'],
  },
  {
    id: 'feel',
    category: '角色',
    name: '物理角色（固定跟随）',
    desc: '只有跟随镜头的狐狸手感场景，调角色参数用。',
    backend: 'webgpu',
    source: 'pmndrs/ecctrl + Rapier',
    picks: [],
  },
  {
    id: 'drive',
    category: '角色',
    name: '开车（ecctrl 车辆模式）',
    desc: '同一个角色库里自带的开车：车轮、悬挂、抓地力都有，WASD 驾驶。',
    backend: 'webgpu',
    source: 'pmndrs/ecctrl 2.0.2 vehicle',
    picks: ['A2'],
  },
  {
    id: 'drone',
    category: '角色',
    name: '开无人机（ecctrl 螺旋桨）',
    desc: '推力飞行的无人机，会自己保持平衡；空格上升，WASD 前后左右。',
    backend: 'webgpu',
    source: 'pmndrs/ecctrl 2.0.2 ThrustPropeller',
    picks: ['A3'],
  },
  {
    id: 'planet',
    category: '角色',
    name: '星球表面 / 墙面行走（ecctrl 自定义重力）',
    desc: '狐狸能绕着小星球走一圈，还能走上墙面，重力方向实时变化。',
    backend: 'webgpu',
    source: 'pmndrs/ecctrl 2.0.2 custom gravity',
    picks: ['A4'],
  },
  {
    id: 'cloudkeep-cam',
    category: '镜头',
    name: 'cloudkeep 追随镜头',
    desc: '你自己游戏里的平滑追随镜头：拖动旋转不会跳，按 C 回正，跟得柔。',
    backend: 'webgpu',
    source: '0xmariowu/cloudkeep src/flight-camera.ts（移植）',
    picks: ['B3'],
  },
  {
    id: 'tank-cam',
    webglVerified: true,
    category: '镜头',
    name: '坦克游戏式镜头',
    desc: '撞墙自动拉近、上坡自动抬高视角、滚轮分档缩放，镜头手感参考坦克游戏。',
    backend: 'webgpu',
    source: 'Kevin-Liu-01/Claude-of-Tanks cameraRig.ts（MIT 引擎代码，移植）',
    picks: ['B6'],
  },
  {
    id: 'retarget',
    webglVerified: true,
    category: '动画',
    name: '动作重定向',
    desc: '把一个角色的动作套到另一个体型不同的角色身上，以后买来或生成的动作都能用。',
    backend: 'webgpu',
    source: 'three.js SkeletonUtils.retargetClip（参考官方示例 webgpu_animation_retargeting）',
    picks: ['C3'],
  },
  {
    id: 'crowd',
    category: '动画',
    name: '一大群角色同屏',
    desc: '两百只带动画的狐狸同时出现，用显卡批量画，不卡。',
    backend: 'webgpu',
    source: 'three.js 官方示例 webgpu_skinning_instancing_individual',
    picks: ['C4'],
  },
  {
    id: 'look',
    category: '画面',
    name: '画面基础',
    desc: '真实天空、太阳影子和草地材质，没有后期。',
    backend: 'webgpu',
    source: 'Poly Haven + ambientCG',
    picks: [],
  },
  {
    id: 'look-post',
    category: '画面',
    name: '画面 + 后期',
    desc: '在画面基础上加环境光遮蔽、泛光和调色。',
    backend: 'webgpu',
    source: 'three.js TSL 后期',
    picks: [],
  },
  {
    id: 'look-presets',
    category: '画面',
    name: '一键画面预设',
    desc: '原始、电影感、清爽明亮、傍晚、阴天，点名字一键切换光照和调色。',
    backend: 'webgpu',
    source: '试验台（光照 + 后期组合）',
    picks: ['D1'],
  },
  {
    id: 'lut',
    category: '画面',
    name: '电影调色（LUT）',
    desc: '一键换电影色调：暖调、冷调、青橙、漂白、黑白，可调强度。',
    backend: 'webgpu',
    source: 'three.js 官方示例 webgpu_postprocessing_3dlut（色调表用代码生成）',
    picks: ['D6'],
  },
  {
    id: 'motion-blur',
    category: '画面',
    name: '运动模糊',
    desc: '狐狸跑起来和镜头转动时带拖影，更有速度感。',
    backend: 'webgpu',
    source: 'three.js 官方示例 webgpu_postprocessing_motion_blur',
    picks: ['D7b'],
  },
  {
    id: 'ssgi',
    category: '画面',
    name: '全局光照',
    desc: '光在墙面之间反弹，红墙会把旁边染红，真实感大增。',
    backend: 'webgpu',
    source: 'three.js 官方示例 webgpu_postprocessing_ssgi',
    picks: ['D7e'],
  },
  {
    id: 'sky',
    category: '天空',
    name: '物理天空',
    desc: '真实的天空颜色和太阳，拖动时间从清晨到黄昏，光影跟着变。',
    backend: 'webgpu',
    source: 'three.js 官方示例 webgpu_sky',
    picks: ['E1'],
  },
  {
    id: 'volume-cloud',
    category: '天空',
    name: '体积云',
    desc: '有体积感的立体云，可以调浓淡和边缘。',
    backend: 'webgpu',
    source: 'three.js 官方示例 webgpu_volume_cloud',
    picks: ['E2'],
  },
  {
    id: 'fog',
    category: '天空',
    name: '高度雾',
    desc: '贴着地面的雾，越远越朦胧，高处清楚、低处浓。',
    backend: 'webgpu',
    source: 'three.js 官方示例 webgpu_fog_height',
    picks: ['E3'],
  },
  {
    id: 'rain',
    category: '天空',
    name: '下雨',
    desc: '几万颗雨滴用显卡实时计算，落地会溅起水花。',
    backend: 'webgpu',
    source: 'three.js 官方示例 webgpu_compute_particles_rain',
    picks: ['E4a'],
  },
  {
    id: 'lightning',
    category: '天空',
    name: '闪电',
    desc: '每隔几秒劈下一道闪电，地面裂开、火花四溅、画面震动；点地面也能劈。',
    backend: 'webgl',
    source: 'SahilK-027/Lightning-VFX（MIT，移植）',
    picks: ['E5'],
    note: '用老 WebGL 渲染器；要在 WebGPU 上跑需改写成 TSL',
  },
  {
    id: 'atmosphere',
    category: '天空',
    name: '大气 + 体积云（大世界用）',
    desc: '真实大气散射和立体云层，远处的山和房子会自然变蓝变朦胧，适合开放大世界。',
    backend: 'webgl',
    source: 'takram-design-engineering/three-geospatial（MIT）',
    picks: ['E6'],
    note: '用老 WebGL 渲染器；云层包目前没有 WebGPU 版；其中一张噪声贴图的许可证正式使用前要确认',
  },
  {
    id: 'trees',
    category: '植被',
    name: '程序化树（会随风摆）',
    desc: '十几种参数生成的树，风一吹树叶会摆（树枝不动），远处自动降精度。',
    backend: 'webgl',
    source: 'dgreenheck/ez-tree 1.1.0（MIT）',
    picks: ['F3'],
    note: '用老 WebGL 渲染器；风的效果要改写成 TSL 才能在 WebGPU 上跑',
  },
  {
    id: 'plants',
    category: '植被',
    name: 'WebGPU 植物生成器',
    desc: '二十种树和植物按物种规则生成，带风吹效果，已是 WebGPU。',
    backend: 'webgpu',
    source: 'SkyeShark/SeedThree（MIT，原样引入）',
    picks: ['F4'],
  },
  {
    id: 'destruct',
    category: '世界',
    name: '可破坏几何（打洞、炸坑）',
    desc: '点墙或地面就能挖洞、炸出坑，几何形状实时改变。',
    backend: 'webgpu',
    source: 'gkjohnson/three-bvh-csg 0.0.17（MIT）',
    picks: ['G5'],
  },
  {
    id: 'ocean',
    category: '水',
    name: '海面（WebGPU 海洋）',
    desc: '开阔海面，波浪起伏、反射天空和太阳。',
    backend: 'webgpu',
    source: 'three.js r186 webgpu_ocean 示例（MIT）',
    picks: ['H1a'],
  },
  {
    id: 'pool',
    category: '水',
    name: '水池（流动水面）',
    desc: '一池会流动的水，能反射和折射周围的物体。',
    backend: 'webgpu',
    source: 'three.js r186 webgpu_water 示例（MIT）',
    picks: ['H1b'],
  },
  {
    id: 'shallow',
    category: '水',
    name: '浅水（角色站在水里）',
    desc: '狐狸在浅水里走，水下的地面和腿能透出来。',
    backend: 'webgpu',
    source: 'three.js r186 webgpu_backdrop_water 示例（MIT）',
    picks: ['H1c'],
  },
  {
    id: 'quarks',
    category: '特效',
    name: '粒子特效（篝火、爆炸、魔法）',
    desc: '篝火、点地面爆炸、魔法旋涡，全部用代码搭出来的粒子。',
    backend: 'webgl',
    source: 'Alchemist0823/three.quarks 0.17.1（MIT）',
    picks: ['I1'],
    note: '这页用老 WebGL 渲染器跑；粒子库的 WebGPU 路子还没接',
  },
  {
    id: 'flames',
    category: '特效',
    name: '火焰（节点材质）',
    desc: '风格化的火焰，全部用节点材质（TSL）画出来，不用贴图序列。',
    backend: 'webgpu',
    source: 'three.js r186 webgpu_tsl_vfx_flames 示例（MIT）',
    picks: ['I2a'],
  },
  {
    id: 'volume-fire',
    category: '特效',
    name: '体积火（立体的火）',
    desc: '有体积感的火焰，从哪个角度看都是立体的。',
    backend: 'webgpu',
    source: 'three.js r186 webgpu_volume_fire 示例（MIT）',
    picks: ['I3'],
  },
  {
    id: 'cloth',
    category: '特效',
    name: '布料（旗子被风吹）',
    desc: '显卡算的布料，被风吹动、会撞到球上。',
    backend: 'webgpu',
    source: 'three.js r186 webgpu_compute_cloth 示例（MIT）',
    picks: ['I4'],
  },
  {
    id: 'birds',
    category: '特效',
    name: '鸟群（显卡算）',
    desc: '几千只鸟在地面上空成群飞，全部由显卡实时计算。',
    backend: 'webgpu',
    source: 'three.js r186 webgpu_compute_birds 示例（MIT）',
    picks: ['I5'],
  },
  {
    id: 'npc',
    category: 'NPC',
    name: 'NPC 行为（闲逛、躲避、追赶）',
    desc: '12 个小角色：绿色闲逛，蓝色躲着狐狸，红色追着狐狸。',
    backend: 'webgpu',
    source: 'Mugen87/yuka 0.7.8（MIT）',
    picks: ['J1'],
  },
  {
    id: 'navcrowd',
    category: 'NPC',
    name: '人群寻路（小镇）',
    desc: '30 个人在小镇里自己找路走，点地面他们会绕开房子和彼此走过去。',
    backend: 'webgpu',
    source: 'isaac-mason/navcat 0.4.1（MIT）',
    picks: ['J2'],
  },
  {
    id: 'ropes',
    webglVerified: true,
    category: '物理',
    name: '绳索和铰链（吊桥、铁链、吊灯）',
    desc: '用物理关节连起来的吊桥、铁链和吊灯，狐狸撞上去会晃。',
    backend: 'webgpu',
    source: '@react-three/rapier 2.2.0 joints（MIT）',
    picks: ['K1'],
  },
  {
    id: 'boot',
    category: '基础',
    name: '开机测试',
    desc: '旋转方块，用来确认渲染器能出画面。',
    backend: 'webgpu',
    source: '试验台',
    picks: [],
  },
]

/** Only include classic-WebGL scenes and individually verified alternate backends. */
export function webglCatalog(): CatalogEntry[] {
  return catalog.filter(entry => entry.backend === 'webgl' || entry.webglVerified)
}

// Known categories follow CATEGORY_ORDER; unknown ones go last, alphabetically.
export function groupCatalog(entries: CatalogEntry[] = catalog): { category: string; entries: CatalogEntry[] }[] {
  const groups = new Map<string, CatalogEntry[]>()
  for (const entry of entries) {
    const group = groups.get(entry.category)
    if (group) {
      group.push(entry)
    } else {
      groups.set(entry.category, [entry])
    }
  }

  const known = CATEGORY_ORDER.filter((category) => groups.has(category))
  const unknown = [...groups.keys()].filter((category) => !CATEGORY_ORDER.includes(category)).sort()
  return [...known, ...unknown].map((category) => ({ category, entries: groups.get(category) ?? [] }))
}
