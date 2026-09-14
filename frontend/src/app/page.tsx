"use client";

import { useState, useEffect, useRef } from "react";
import {
  sendAgentChat,
  subscribeTaskStream,
  TaskResponse,
  Storyboard,
  renderShot,
  resolveImageUrl,
} from "../lib/api";

interface ChatMessage {
  id: string;
  sender: "user" | "agent";
  text: string;
  kind?: "image" | "video" | "storyboard" | "text";
  taskId?: string;
  task?: TaskResponse;
  storyboard?: Storyboard;
  refImage?: string;
  createdAt: string;
}

const TRAVEL_FALLBACK_CATEGORIES = [
  { id: "all", name: "✨ 全部精修场景", icon: "✨" },
  { id: "landmark", name: "🏛️ 地标去路人", icon: "🏛️" },
  { id: "sunset", name: "🌅 黄金落日逆光", icon: "🌅" },
  { id: "transit", name: "✈️ 交通与窗景", icon: "✈️" },
  { id: "food", name: "🍜 市井与深夜食堂", icon: "🍜" },
  { id: "night", name: "🌃 霓虹都市雨夜", icon: "🌃" },
  { id: "nature", name: "🏞️ 自然山海旷野", icon: "🏞️" },
  { id: "rescue", name: "🌸 阴天/废片重打光", icon: "🌸" },
  { id: "master_film", name: "🎞️ 经典名机胶片", icon: "🎞️" },
];

const TRAVEL_FALLBACK_SCENARIOS = [
  { id: "landmark_crowd_clean", category: "landmark", label: "🏛️ 著名地标·包场去路人", description: "智能抹除背景游客与路人，还原纯净宏伟的地标大片", prompt: "著名历史地标广场前，智能彻底消除背景全部杂乱游客与路人，纯净开阔广场，徕卡35mm胶片质感，真实自然光影" },
  { id: "landmark_epic_scale", category: "landmark", label: "🏰 古典宫殿·史诗纵深感", description: "超广角透视，强化高耸穹顶与人物的史诗级尺度对比", prompt: "古典宫殿大教堂前，24mm超广角宏大透视，大尺度建筑光影纵深，丁达尔光束穿透窗棂，国家地理杂志史诗感" },
  { id: "landmark_night_lit", category: "landmark", label: "🌙 地标夜色·泛光辉煌", description: "古迹夜间暖光照明，冷蓝夜空与金碧辉煌对比", prompt: "地标古迹夜景，暖金泛光照明与深蓝暮色天空强烈对比，索尼35mm大光圈夜景高动态，清晰通透" },
  
  { id: "sunset_beach_rim", category: "sunset", label: "🌅 海边日落·发丝逆光金晕", description: "落日余晖洒在海面与发丝，柔和金光轮廓与波光粼粼", prompt: "海边沙滩日落，发丝透亮金色轮廓逆光，波光粼粼海面，85mm大光圈奶油般柔和虚化，电影级浪漫" },
  { id: "sunset_cliff_epic", category: "sunset", label: "🌄 绝美断崖·落日海平线", description: "站在海边悬崖俯瞰烈焰落日，风吹衣袂的壮阔电影感", prompt: "海边悬崖峭壁，落日余晖染红天际线，海风吹拂衣角，哈苏中画幅极高动态范围与层次" },
  { id: "blue_hour_twilight", category: "sunset", label: "🌆 蓝调时刻·日暮初上 (Blue Hour)", description: "太阳刚落山时的冷蓝天空与暖黄街灯交织", prompt: "日落后的蓝调时刻(Blue Hour)，深邃冷蓝天空与街角暖黄路灯冷暖对比，通透肤色，欧洲小镇电影感" },
  
  { id: "transit_plane_window", category: "transit", label: "✈️ 飞机舷窗·云海晨昏金光", description: "阳光穿透舷窗打在侧脸，窗外是浩瀚无垠的落日云海", prompt: "飞机客舱舷窗旁，夕阳穿透机窗在侧脸投下温暖轮廓光，窗外浩瀚云海金光万道，28mm广角文艺旅途感" },
  { id: "transit_train_speed", category: "transit", label: "🚄 高铁列车·流动窗景光影", description: "窗外风景流光飞驰，车厢内静谧反光的文艺电影质感", prompt: "列车窗边，窗外风景高速流动模糊，车内柔和自然窗光，富士Classic Chrome胶片色调，王家卫电影感" },
  { id: "transit_road_trip", category: "transit", label: "🚙 公路自驾·海滨敞篷兜风", description: "阳光、海风、公路沿线，自由不羁的美式公路电影风", prompt: "海滨沿海公路自驾，海风吹拂，加州明媚阳光与镜头光晕，美式复古公路电影大片" },
  
  { id: "street_food_steam", category: "food", label: "🏮 夜市摊位·热气腾腾烟火气", description: "路边摊袅袅升起的食物蒸汽与暖黄灯光", prompt: "热闹夜市路边摊，热腾腾的食物蒸汽升腾，暖黄吊灯照亮食客笑容，50mm f/1.2大光圈深夜食堂感" },
  { id: "cozy_cafe_afternoon", category: "food", label: "☕ 街角咖啡馆·树影斑驳午后", description: "法式露天咖啡馆，树影斑驳的微风阳光，慵懒度假感", prompt: "街角露天咖啡馆，午后树影斑驳洒落在木桌与咖啡杯上，轻松惬意的法式慵懒度假大片，徕卡柔和散景" },
  { id: "izakaya_lantern", category: "food", label: "🍶 居酒屋小巷·红灯笼微醺", description: "深夜小巷日式居酒屋，红灯笼映照下的暖光与复古木质质感", prompt: "深夜日式居酒屋小巷，暖红灯笼光晕照亮侧脸轮廓，深色木质质感，CineStill 800T电影感红晕" },
  
  { id: "cyber_rain_reflections", category: "night", label: "🌧️ 赛博雨夜·湿地霓虹倒影", description: "雨后街道积水的绚丽倒影，五彩霓虹灯光晕与横向光斑", prompt: "都市雨夜街道，地面水坑倒映五彩斑斓霓虹招牌，空气雨雾弥漫，索尼50mm大光圈赛博朋克电影感" },
  { id: "rooftop_skyline_night", category: "night", label: "🏙️ 高空天台·繁华天际线散景", description: "俯瞰万家灯火的高空天台，背景如梦似幻的城市光斑大散景", prompt: "高空天台俯瞰繁华城市夜景，背后万家灯火璀璨大光斑散景，现代高级时装杂志夜景大片" },
  
  { id: "nature_misty_forest", category: "nature", label: "🌲 迷雾森林·清晨丁达尔光", description: "古木与晨雾弥漫，光束穿透树冠倾泻而下的童话仙境感", prompt: "清晨迷雾古树森林，神圣丁达尔体积光穿透树冠倾泻而下，青苔绿意盎然，国家地理唯美自然大片" },
  { id: "nature_snow_mountain", category: "nature", label: "🏔️ 巍峨雪山·日照金山史诗", description: "清晨第一缕阳光点亮雪山金顶，通透纯净的高原空气感", prompt: "巍峨雪山日照金山，清晨金光点亮雪白峰顶，极高透明度高原空气感，户外探险家史诗封面" },
  { id: "nature_tropical_island", category: "nature", label: "🏖️ 热带海岛·纯净玻璃海", description: "阳光折射下的透亮青碧玻璃海与摇曳椰影，明媚度假风", prompt: "热带海岛透亮青碧玻璃海，阳光在浅海沙底折射出水波光纹，椰影婆娑，纯净高级度假大片" },
  
  { id: "rescue_overcast_flat", category: "rescue", label: "⛅ 阴天拯救·重构立体暖阳", description: "将阴天灰暗死白的大平光转变为立体生动的落日侧光", prompt: "告别阴天灰暗大平光，注入立体温暖的落日侧逆光与发丝微光，面部明暗立体雕刻，色彩明媚鲜活" },
  { id: "rescue_backlit_dark_face", category: "rescue", label: "💡 逆光黑脸拯救·通透立体五官", description: "拯救逆光拍照人脸漆黑，保留绝美背景同时提亮面部透光微光", prompt: "拯救逆光人脸暗沉，在保留背景绝美夕阳的同时，赋予面部通透自然的眼神光与微光立体补光" },
  { id: "rescue_harsh_flash", category: "rescue", label: "✨ 闪光灯拯救·柔化为电影光", description: "消除手机直闪油光与塑料感，柔化为摄影棚柔光箱与环境光", prompt: "消除生硬直接的手机闪光灯油光，柔化为摄影师高级柔光箱漫反射光，皮肤细腻透亮，高级胶片质感" },
  
  { id: "film_leica_portra", category: "master_film", label: "🎞️ Leica M6 + Kodak Portra 400", description: "传奇徕卡镜头德味，柯达肖像胶片温暖细腻的肤色与微颗粒感", prompt: "Leica M6 搭配 35mm f/1.4 镜头拍摄，Kodak Portra 400 经典胶片色调，温暖胶片颗粒与柔和高光光晕" },
  { id: "film_fuji_velvia", category: "master_film", label: "📷 Fujifilm X-T5 + Velvia 50", description: "富士传奇反转片，鲜艳饱满的蓝天绿意与高对比度空气感", prompt: "Fujifilm X-T5 搭配 Velvia 50 反转片模拟，饱满翠绿与湛蓝天空，极致通透的空气感与锐利细节" },
  { id: "film_cinestill_800t", category: "master_film", label: "🎬 CineStill 800T (夜景电影红晕)", description: "电影胶片特有的红色光晕、复古钨丝灯色调与浓郁故事感", prompt: "CineStill 800T 钨丝灯电影胶片，高光点光源标志性红色光晕，浓郁墨绿与暖橙复古电影色调" },
];

const VIDEO_CAMERA_MOTIONS = [
  { id: "dolly_in", label: "🎥 推进 Dolly In", prompt: "镜头平稳向前缓慢推进，聚焦主体微表情与细节，光影自然流转" },
  { id: "dolly_out", label: "🎬 后拉 Dolly Out", prompt: "镜头平缓向后拉远，逐渐展现宏大壮观的环境全景与空间纵深" },
  { id: "orbit_360", label: "🔄 360°环绕 Orbit", prompt: "镜头围绕主体进行360度顺滑环绕运镜，光影在人物轮廓上立体流动" },
  { id: "crane_up", label: "⬆️ 升降摇臂 Crane Up", prompt: "镜头从低角度平稳上升至高空俯瞰视角，纵览辽阔壮美全景" },
  { id: "fpv_drone", label: "🦅 穿越机飞掠 FPV", prompt: "穿越机极速贴地低空飞行，随后穿过缝隙冲向高空，极具视觉冲击力" },
  { id: "hitchcock_zoom", label: "🔀 眩晕变焦 Vertigo", prompt: "背景剧烈压缩形变，主体大小保持不变的经典希区柯克眩晕变焦" },
];

const STORYBOARD_PRESETS = [
  { label: "🎒 旅行纪录片 VLOG (3镜)", prompt: "从机场启程舷窗、到异国街头漫步、再到海边绝美落日的3镜头旅行纪录短片" },
  { label: "🎬 悬疑探案微电影 (3镜)", prompt: "深夜雨巷探员追查神秘线索、逼仄巷道回眸、发现线索的3镜头电影分镜" },
  { label: "🚀 科幻史诗太空漫游 (4镜)", prompt: "宇航员走出舱门、眺望星云、探索未知发光行星遗迹的4镜头科幻大片" },
  { label: "🌆 都市夜景浪漫情缘 (3镜)", prompt: "繁华都市霓虹天台相遇、微风吹拂发丝、相视微笑的3镜头浪漫分镜" },
  { label: "💄 国际商业时装大片 (3镜)", prompt: "高端时尚模特在米兰大教堂前优雅走秀、特写凝视、华丽转身的3镜头广告分镜" },
];

const IMAGE_STYLE_PRESETS = [
  { label: "⚡ 极速摄影大片", prompt: "8k电影级摄影大片，大师级布光，细腻微观质感，真实生动" },
  { label: "🌸 新海诚风动漫", prompt: "新海诚唯美动画风格，蓝天白云与飞舞花瓣，清澈逆光与光斑" },
  { label: "👾 16位复古像素", prompt: "16-bit 复古像素艺术，经典街机游戏怀旧配色，清晰像素网格" },
  { label: "🌆 赛博朋克雨夜", prompt: "赛博朋克未来雨夜都市，霓虹倒影，全息广告与悬浮飞车" },
  { label: "🎨 3D皮克斯动画", prompt: "皮克斯3D动画风格，次表面散射材质，温润细腻光泽，可爱灵动" },
  { label: "🖌️ 概念艺术油画", prompt: "史诗级概念艺术油画，厚涂笔触，戏剧性明暗大对比，大师杰作" },
];

const AUTO_INSPIRATIONS = [
  { label: "📸 旅行照片重构为胶片大片", prompt: "把这张随手拍照片重塑为徕卡35mm胶片电影大片，注入落日温暖侧逆光，把背景路人清理干净，增强人像面部质感" },
  { label: "🎬 电影镜头：惊涛灯塔", prompt: "俯瞰视角，惊涛骇浪拍打着黑色悬崖上的白色灯塔，暴风雨天气，镜头缓慢向前推进" },
  { label: "🌸 樱花小径唯美插画", prompt: "日式小镇春天，微风吹拂樱花花瓣飘落，湛蓝天空与白云，新海诚唯美光影" },
  { label: "🎒 3镜头旅行VLOG分镜", prompt: "从机场起飞、到古城漫步、再到海边落日的3镜头旅行纪录短片分镜" },
];

export default function AgentCopilotPage() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"retouch" | "video" | "storyboard" | "image" | "auto">("retouch");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [preview, setPreview] = useState(false);
  const [refImage, setRefImage] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Retouch Mode specific states
  const [selectedTravelCat, setSelectedTravelCat] = useState("all");
  const [removePassersby, setRemovePassersby] = useState(true);
  const [addGoldenLight, setAddGoldenLight] = useState(true);
  const [shallowBokeh, setShallowBokeh] = useState(true);
  const [sculptFace, setSculptFace] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "agent",
      text: "👋 你好！我是你的 ComfyUI 智能创作导演与 AI 旅拍摄影大师。\n直接告诉我你的创意构想或上传一张旅行照片（例如「帮我把这张照片改成大片并去除路人...」或「做一段运镜视频...」），我会自动编排最专业的工作流为您制作！",
      kind: "text",
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRefImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async (customText?: string, customMode?: "auto" | "image" | "video" | "storyboard" | "retouch") => {
    let textToSend = customText || input;
    if (!textToSend.trim() || loading) return;

    // In retouch mode, seamlessly append active retouch toggles if not already present
    if (mode === "retouch" && !customText) {
      const enhancers = [];
      if (removePassersby && !textToSend.includes("路人")) enhancers.push("清除背景杂乱路人与游客");
      if (addGoldenLight && !textToSend.includes("黄金") && !textToSend.includes("逆光")) enhancers.push("注入温暖黄金时刻侧逆光");
      if (shallowBokeh && !textToSend.includes("虚化") && !textToSend.includes("景深")) enhancers.push("35mm大光圈浅景深柔和虚化");
      if (sculptFace && !textToSend.includes("面部") && !textToSend.includes("修脸")) enhancers.push("面部微光立体化与自然质感");
      if (enhancers.length > 0) {
        textToSend = `${textToSend}，[精修要求: ${enhancers.join("，")}]`;
      }
    }

    const currentMode = customMode || mode;
    const userMsgId = `user_${Date.now()}`;
    const agentMsgId = `agent_${Date.now()}`;

    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: "user",
      text: textToSend,
      refImage: refImage || undefined,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await sendAgentChat({
        message: textToSend,
        ref_image: refImage || undefined,
        mode: currentMode,
        aspect_ratio: aspectRatio,
        preview,
      });

      const agentMsg: ChatMessage = {
        id: agentMsgId,
        sender: "agent",
        text: res.reply,
        kind: res.kind || "text",
        taskId: res.task_id,
        storyboard: res.storyboard,
        createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, agentMsg]);

      // If task was submitted, subscribe to live stream
      if (res.task_id) {
        subscribeTaskStream(res.task_id, (updatedTask) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === agentMsgId ? { ...msg, task: updatedTask } : msg
            )
          );
        });
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: "agent",
          text: `⚠️ 执行失败: ${err.message || "未知错误"}`,
          kind: "text",
          createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAnimateImage = (imgSrc: string) => {
    setRefImage(imgSrc);
    setMode("video");
    setInput("以这张图为首帧，让镜头缓慢推进，展现自然细腻的动态与光影变化");
  };

  const handleRenderStoryboardShot = async (sbId: string, shotId: string) => {
    try {
      await renderShot(sbId, shotId, preview);
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.storyboard && msg.storyboard.id === sbId) {
            const updatedShots = msg.storyboard.shots.map((s) =>
              s.id === shotId ? { ...s, status: "rendering" as const, progress: 10 } : s
            );
            return { ...msg, storyboard: { ...msg.storyboard, shots: updatedShots } };
          }
          return msg;
        })
      );
    } catch (e: any) {
      alert(`渲染镜头失败: ${e.message}`);
    }
  };

  const filteredScenarios = selectedTravelCat === "all"
    ? TRAVEL_FALLBACK_SCENARIOS
    : TRAVEL_FALLBACK_SCENARIOS.filter((s) => s.category === selectedTravelCat);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header Info Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              🤖 AI 智能创作助理 & 旅拍摄影大师
            </h1>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Full Journey Workstation
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            全旅途场景精修 · MiniMax H3 / Wan2.1 电影运镜 · 导演多镜头分镜 · Turbo 极速生图
          </p>
        </div>

        {/* Global Quick Options */}
        <div className="flex items-center gap-2">
          {/* Aspect Ratio */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60">
            {(["16:9", "9:16", "1:1"] as const).map((ratio) => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  aspectRatio === ratio
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>

          {/* Fast Preview Toggle */}
          <label className="flex items-center gap-1.5 text-xs text-slate-600 font-medium cursor-pointer px-2.5 py-1.5 rounded-xl bg-slate-100/70 border border-slate-200/60 hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={preview}
              onChange={(e) => setPreview(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
            />
            <span>快速预览</span>
          </label>
        </div>
      </div>

      {/* Main Grid: Chat Stream on Left & Canvas Feed on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Chat Conversation Stream (col-span-5) */}
        <div className="lg:col-span-5 flex flex-col h-[780px] bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          
          {/* Main Mode Isolated Navigation Header */}
          <div className="p-2.5 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between gap-1 overflow-x-auto custom-scrollbar">
            {[
              { id: "retouch", label: "📸 摄影大师", desc: "旅拍全场景" },
              { id: "video", label: "🎬 运镜视频", desc: "原生立体声" },
              { id: "storyboard", label: "📖 导演分镜", desc: "多镜编排" },
              { id: "image", label: "🖼️ 极速生图", desc: "Turbo引擎" },
              { id: "auto", label: "✨ 智能识别", desc: "意图路由" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex flex-col items-center leading-tight ${
                  mode === m.id
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <span>{m.label}</span>
                <span className="text-[9px] opacity-70 font-normal">{m.desc}</span>
              </button>
            ))}
          </div>

          {/* Conversation Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[10px] font-bold text-slate-400">
                    {msg.sender === "user" ? "你" : "✦ ComfyDesk Agent"}
                  </span>
                  <span className="text-[10px] text-slate-300">{msg.createdAt}</span>
                </div>

                <div
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed max-w-[90%] ${
                    msg.sender === "user"
                      ? "bg-slate-900 text-white rounded-tr-xs"
                      : "bg-slate-50 border border-slate-200/80 text-slate-800 rounded-tl-xs shadow-2xs"
                  }`}
                >
                  {/* If user attached image */}
                  {msg.refImage && (
                    <div className="mb-2 rounded-xl overflow-hidden border border-white/20">
                      <img src={msg.refImage} alt="Reference" className="max-h-32 object-cover w-full" />
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-start gap-2">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-xs text-xs text-indigo-600 font-medium flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></div>
                  <span>Agent 正在规划工作流与调度 GPU...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Contextual Sub-Feature / Inspiration Toolbar (Mode-Isolated) */}
          {mode === "retouch" && (
            <div className="bg-amber-50/50 border-t border-amber-200/60 p-2.5 space-y-2">
              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
                {TRAVEL_FALLBACK_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedTravelCat(cat.id)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                      selectedTravelCat === cat.id
                        ? "bg-amber-600 text-white shadow-2xs"
                        : "bg-white text-slate-700 hover:bg-amber-100/70 border border-amber-200/70"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Sub-scenarios horizontal scroll */}
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
                {filteredScenarios.map((sc) => (
                  <button
                    key={sc.id}
                    title={sc.description}
                    onClick={() => setInput(sc.prompt)}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white hover:bg-amber-100 border border-amber-200/80 text-amber-950 whitespace-nowrap transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
                  >
                    <span>{sc.label}</span>
                  </button>
                ))}
              </div>

              {/* Retouch 4 Instant Enhancement Switches */}
              <div className="pt-1.5 border-t border-amber-200/40 flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="font-bold text-amber-900 mr-0.5">精修增强:</span>
                {[
                  { label: "👥 清除路人", state: removePassersby, setter: setRemovePassersby },
                  { label: "🌅 注入黄金光", state: addGoldenLight, setter: setAddGoldenLight },
                  { label: "📷 35mm大光圈虚化", state: shallowBokeh, setter: setShallowBokeh },
                  { label: "🌸 面部微光立体化", state: sculptFace, setter: setSculptFace },
                ].map((sw, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => sw.setter(!sw.state)}
                    className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer border ${
                      sw.state
                        ? "bg-amber-600 text-white border-amber-700"
                        : "bg-white text-slate-500 border-amber-200 hover:bg-amber-50"
                    }`}
                  >
                    {sw.state ? `✓ ${sw.label}` : `+ ${sw.label}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "video" && (
            <div className="bg-violet-50/50 border-t border-violet-200/60 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-violet-900">
                <span>🎬 选择专业电影运镜编排:</span>
                <span className="text-[10px] text-violet-600 font-normal">MiniMax H3 / Wan2.1 引擎</span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
                {VIDEO_CAMERA_MOTIONS.map((cm) => (
                  <button
                    key={cm.id}
                    onClick={() => setInput(cm.prompt)}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white hover:bg-violet-100 border border-violet-200 text-violet-950 whitespace-nowrap transition-colors cursor-pointer shadow-2xs"
                  >
                    {cm.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "storyboard" && (
            <div className="bg-sky-50/50 border-t border-sky-200/60 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-sky-900">
                <span>📖 导演多镜头分镜蓝图:</span>
                <span className="text-[10px] text-sky-600 font-normal">时序叙事与镜头拆解</span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
                {STORYBOARD_PRESETS.map((sb, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(sb.prompt)}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white hover:bg-sky-100 border border-sky-200 text-sky-950 whitespace-nowrap transition-colors cursor-pointer shadow-2xs"
                  >
                    {sb.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "image" && (
            <div className="bg-emerald-50/50 border-t border-emerald-200/60 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-emerald-900">
                <span>🖼️ 极速图像风格流派:</span>
                <span className="text-[10px] text-emerald-600 font-normal">Z-Image Turbo BF16</span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
                {IMAGE_STYLE_PRESETS.map((st, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(st.prompt)}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white hover:bg-emerald-100 border border-emerald-200 text-emerald-950 whitespace-nowrap transition-colors cursor-pointer shadow-2xs"
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "auto" && (
            <div className="bg-slate-50 border-t border-slate-100 p-2 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
              <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap pl-1.5">灵感:</span>
              {AUTO_INSPIRATIONS.map((insp, i) => (
                <button
                  key={i}
                  onClick={() => setInput(insp.prompt)}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white hover:bg-slate-100 border border-slate-200/70 text-slate-600 whitespace-nowrap transition-colors cursor-pointer"
                >
                  {insp.label}
                </button>
              ))}
            </div>
          )}

          {/* Input Box & Attachment */}
          <div className="p-3 bg-white border-t border-slate-200/80 space-y-2">
            {refImage && (
              <div className="flex items-center justify-between p-2 rounded-xl bg-indigo-50 border border-indigo-100">
                <div className="flex items-center gap-2">
                  <img src={refImage} alt="Ref" className="w-9 h-9 rounded-lg object-cover border border-indigo-200" />
                  <div>
                    <span className="text-[11px] font-bold text-indigo-900 block">
                      📷 已附加旅行参考图
                    </span>
                    <span className="text-[10px] text-indigo-600">
                      {mode === "retouch" ? "已就绪 · 点击上方场景或输入要求重塑为摄影大片" : "支持图生视频运镜锚定或摄影重构"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setRefImage("")}
                  className="text-xs text-indigo-400 hover:text-indigo-700 font-bold px-1.5 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="上传参考图 / 旅行随手拍原片"
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer text-sm"
              >
                🖼️
              </button>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder={
                  mode === "retouch"
                    ? "输入旅拍精修要求（如：在圣托里尼落日海边、把路人去掉、光线变高级）..."
                    : mode === "video"
                    ? "输入视频画面与运镜描述（如：惊涛拍打悬崖灯塔，镜头缓慢向前推进）..."
                    : mode === "storyboard"
                    ? "输入剧本或故事梗概，AI将自动为您构思多镜头电影分镜..."
                    : "描述你想要的画面细节与光影..."
                }
                className="flex-1 bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none transition-all"
              />

              <button
                type="button"
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
                  loading || !input.trim()
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-slate-900 hover:bg-black text-white cursor-pointer active:scale-95 shadow-xs"
                }`}
              >
                {loading ? "处理中..." : mode === "retouch" ? "重塑大片 ✦" : "发送 ✦"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Visual Canvas & Storyboard Gallery (col-span-7) */}
        <div className="lg:col-span-7 flex flex-col h-[740px] bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900">创作画布与作品流</span>
              <span className="text-[10px] text-slate-400 font-mono">Live Stream</span>
            </div>
          </div>

          {/* Main Visual Stream */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-slate-50/40">
            {messages.filter((m) => m.task || m.storyboard).length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 py-12">
                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center text-xl text-slate-400 mb-3 shadow-2xs">
                  ✦
                </div>
                <p className="text-sm font-semibold text-slate-600">等待生成任务</p>
                <p className="text-xs text-slate-400 max-w-sm text-center mt-1">
                  在左侧对话框输入您的创作意图，生成的图像、5秒视频及多镜头分镜将实时在此呈现。
                </p>
              </div>
            ) : (
              messages
                .filter((m) => m.task || m.storyboard)
                .map((msg) => {
                  const task = msg.task;
                  const sb = msg.storyboard;

                  // Render Single Generation Task (Image or Video)
                  if (task) {
                    const isRunning = task.status === "running" || task.status === "pending";
                    const isDone = task.status === "done";
                    const images = task.images || [];

                    return (
                      <div
                        key={msg.id}
                        className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 overflow-hidden transition-all"
                      >
                        {/* Task Card Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                isDone
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : task.status === "failed"
                                  ? "bg-red-50 text-red-700 border border-red-200"
                                  : "bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse"
                              }`}
                            >
                              {isDone ? "✓ 渲染完成" : task.status === "failed" ? "✕ 失败" : `渲染中 ${task.progress}%`}
                            </span>
                            <span className="text-xs text-slate-600 font-medium truncate max-w-xs">{msg.text}</span>
                          </div>

                          {images.length > 0 && (
                            <a
                              href={resolveImageUrl(images[0])}
                              download
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 transition-colors"
                            >
                              ⬇ 下载原片
                            </a>
                          )}
                        </div>

                        {/* Progress Bar */}
                        {isRunning && (
                          <div className="w-full bg-slate-100 rounded-full h-1.5 mb-3 overflow-hidden">
                            <div
                              className="bg-slate-900 h-full rounded-full transition-all duration-300"
                              style={{ width: `${task.progress}%` }}
                            ></div>
                          </div>
                        )}

                        {/* Media Display */}
                        {images.length > 0 ? (
                          <div className="space-y-3">
                            {images.map((src, i) => {
                              const fullUrl = resolveImageUrl(src);
                              const isVideo = /\.(mp4|webm)$/i.test(src);
                              return (
                                <div key={i} className="group relative rounded-xl overflow-hidden border border-slate-200 bg-black">
                                  {isVideo ? (
                                    <video src={fullUrl} controls playsInline autoPlay muted loop className="w-full max-h-[420px] object-contain mx-auto block" />
                                  ) : (
                                    <img src={fullUrl} alt="Output" className="w-full max-h-[420px] object-contain mx-auto block" />
                                  )}

                                  {/* Action overlay for images -> make into video */}
                                  {!isVideo && (
                                    <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                      <span className="text-[11px] text-slate-500">Z-Image Turbo 8K</span>
                                      <button
                                        onClick={() => handleAnimateImage(fullUrl)}
                                        className="text-xs font-semibold text-white bg-slate-900 hover:bg-black px-3 py-1 rounded-lg shadow-xs cursor-pointer active:scale-95 transition-all"
                                      >
                                        🎬 转换为5秒运镜视频 ✦
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : isRunning ? (
                          <div className="h-64 rounded-xl bg-slate-50/50 border border-dashed border-slate-200 flex flex-col items-center justify-center gap-3">
                            <div className="w-7 h-7 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
                            <p className="text-xs font-semibold text-slate-600">ComfyUI 引擎正在生成中 ({task.progress}%)...</p>
                          </div>
                        ) : null}

                        {task.error && (
                          <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
                            <strong>渲染错误:</strong> {task.error}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Render Multi-shot Storyboard Plan
                  if (sb) {
                    return (
                      <div key={msg.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-bold text-slate-900">🎬 导演分镜计划: {sb.title}</span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                {sb.shots.length} 个镜头 · {sb.aspect_ratio}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{sb.synopsis}</p>
                          </div>
                        </div>

                        {/* Shot Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {sb.shots.map((shot) => (
                            <div
                              key={shot.id}
                              className="rounded-xl border border-slate-200 p-3 bg-slate-50/50 flex flex-col justify-between gap-2"
                            >
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-bold text-slate-900">
                                    镜头 #{shot.shot_number}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                                    {shot.camera_movement}
                                  </span>
                                </div>
                                <span className="text-[11px] font-semibold text-slate-700 block">{shot.shot_type}</span>
                                <p className="text-[11px] text-slate-500 mt-1 leading-snug">{shot.scene_description}</p>
                              </div>

                              {shot.video_url ? (
                                <video src={resolveImageUrl(shot.video_url)} controls playsInline loop className="w-full rounded-lg bg-black mt-2" />
                              ) : (
                                <button
                                  onClick={() => handleRenderStoryboardShot(sb.id, shot.id)}
                                  disabled={shot.status === "rendering"}
                                  className="w-full py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-black text-white cursor-pointer transition-all shadow-2xs"
                                >
                                  {shot.status === "rendering" ? "渲染中..." : "渲染此镜头 🎬"}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return null;
                })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
