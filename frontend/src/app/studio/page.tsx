"use client";

import { useState, useRef } from "react";
import { generate, generateAuto, subscribeTaskStream, TaskResponse, resolveImageUrl } from "../../lib/api";

const MODEL_OPTIONS = [
  { id: "image_z_image_turbo", label: "⚡ Z-Image Turbo 极速绘图 (BF16)", type: "image", defaultSteps: 8, defaultCfg: 1.5 },
  { id: "photo_cinematic_retouch", label: "📸 旅行照片大片重塑 (AI 摄影大师 · 胶片光影)", type: "image", defaultSteps: 12, defaultCfg: 1.5 },
  { id: "image_z_image_pixel", label: "👾 复古像素风 Pixel Art (LoRA)", type: "image", defaultSteps: 8, defaultCfg: 2.0 },
  { id: "video_minimax_h3_t2v", label: "🎬 MiniMax H3 电影视频 (原生配音)", type: "video", defaultSteps: 20, defaultCfg: 5.0 },
  { id: "video_wan22_ti2v_5b", label: "🎥 Wan2.1 5B 电影视频 (高动态)", type: "video", defaultSteps: 20, defaultCfg: 5.0 },
];

const TRAVEL_STUDIO_CATEGORIES = [
  { id: "all", name: "✨ 全部" },
  { id: "landmark", name: "🏛️ 地标去路人" },
  { id: "sunset", name: "🌅 黄金落日" },
  { id: "transit", name: "✈️ 交通窗景" },
  { id: "food", name: "🍜 市井美食" },
  { id: "night", name: "🌃 霓虹夜景" },
  { id: "nature", name: "🏞️ 自然山海" },
  { id: "rescue", name: "🌸 废片重打光" },
  { id: "master_film", name: "🎞️ 经典胶片" },
];

const CINEMA_PRESETS = [
  {
    id: "landmark_crowd_clean",
    category: "landmark",
    label: "🏛️ 著名地标·包场去路人",
    prompt: "著名历史地标广场前，智能彻底消除背景全部杂乱游客与路人，纯净开阔广场，shot on Leica M6, 35mm Summicron-M f/1.4 ASPH, Kodak Portra 400, authentic fine grain, clean documentary tone, 8k uhd",
    negative: "harsh flash, flat lighting, blurry face, crowded background, tourists, bystanders, crowd, photobombers, oversaturated, plastic skin, amateur photo",
    denoise: 0.60,
  },
  {
    id: "landmark_epic_scale",
    category: "landmark",
    label: "🏰 古典宫殿·史诗纵深感",
    prompt: "古典宫殿大教堂前，shot on Canon EOS R5, EF 24-70mm f/2.8L II at 24mm ultra-wide, majestic cathedral scale contrast, volumetric light shafts through stained glass, National Geographic architecture color science",
    negative: "harsh flash, crowded tourists, plastic skin, oversaturated, blurry, amateur snapshot",
    denoise: 0.62,
  },
  {
    id: "landmark_night_lit",
    category: "landmark",
    label: "🌙 地标夜色·泛光辉煌",
    prompt: "地标古迹夜景，shot on Sony A7R V, FE 35mm f/1.4 GM, warm golden architectural floodlights against deep navy blue twilight sky, amber gold and indigo split-toning, sparkling pinpoint city bokeh",
    negative: "noisy, daylight, washed out, blurry, flat lighting",
    denoise: 0.62,
  },
  {
    id: "sunset_beach_rim",
    category: "sunset",
    label: "🌅 海边日落·发丝逆光金晕",
    prompt: "海边沙滩日落，shot on Sony A7R V, FE 85mm f/1.4 GM, radiant golden hour sunset rim light glowing through hair strands, glistening ocean waves, warm amber golden aura, creamy circular bokeh balls, 8k",
    negative: "harsh direct flash, flat lighting, dark face, blurry, plastic skin, amateur photo",
    denoise: 0.62,
  },
  {
    id: "sunset_cliff_epic",
    category: "sunset",
    label: "🌄 绝美断崖·落日海平线",
    prompt: "海边断崖海平线落日，shot on Hasselblad X2D 100C, 45mm f/4 P lens, fiery orange sunset horizon, dramatic volumetric god rays, deep cinematic teal and orange split-toning, epic traveler portrait",
    negative: "harsh flash, blurry, flat washed-out sky, plastic skin, low quality",
    denoise: 0.63,
  },
  {
    id: "blue_hour_twilight",
    category: "sunset",
    label: "🌆 蓝调时刻·日暮初上",
    prompt: "落日后蓝调时刻(Blue Hour)，shot on Leica SL2, 50mm f/2 ASPH, Kodak Ektar 100 simulation, deep indigo twilight contrasting with warm glowing streetlamp, pure clean skin tones, cinematic romance",
    negative: "noisy, overexposed, muddy blacks, blurry",
    denoise: 0.59,
  },
  {
    id: "transit_plane_window",
    category: "transit",
    label: "✈️ 飞机舷窗·云海晨昏金光",
    prompt: "飞机客舱舷窗旁，shot on Leica Q3, 28mm f/1.7, golden sunlight streaming through passenger window, warm rim light on face, glowing vast cloud sea outside, nostalgic wanderlust film mood",
    negative: "harsh flash, flat lighting, blurry, distorted window",
    denoise: 0.60,
  },
  {
    id: "transit_train_speed",
    category: "transit",
    label: "🚄 高铁列车·流动窗景光影",
    prompt: "列车窗边，shot on Fujifilm X-T5, XF 35mm f/1.4 R, Fujichrome Classic Chrome, dynamic blurred scenery rushing past outside, natural soft window light, Wong Kar-wai cinematic train journey still",
    negative: "blurry face, oversaturated, static fake background",
    denoise: 0.58,
  },
  {
    id: "transit_road_trip",
    category: "transit",
    label: "🚙 公路自驾·海滨敞篷兜风",
    prompt: "沿海公路自驾敞篷车，shot on Canon EOS R5, 28-70mm f/2L, vintage Kodachrome 64 slide film, sun-drenched coastal highway, turquoise ocean breeze, authentic road movie snapshot",
    negative: "flat lighting, dark, blurry, low resolution",
    denoise: 0.62,
  },
  {
    id: "street_food_steam",
    category: "food",
    label: "🏮 夜市摊位·热气腾腾烟火气",
    prompt: "热闹夜市路边摊，shot on Sony A7R V, 50mm f/1.2 GM, CineStill 800T tungsten film halation, rising warm food steam catching golden hanging bulb light, appetizing colors, shallow depth of field",
    negative: "cold lighting, flat flash, blurry face, messy plastic",
    denoise: 0.60,
  },
  {
    id: "cozy_cafe_afternoon",
    category: "food",
    label: "☕ 街角咖啡馆·树影斑驳午后",
    prompt: "街角露天咖啡馆，shot on Leica M11, Summilux 50mm f/1.4, dappled sunlight filtering through leaves, warm golden highlights, relaxed Parisian chic lifestyle candid portrait",
    negative: "heavy harsh shadow, blurry, oversaturated",
    denoise: 0.58,
  },
  {
    id: "izakaya_lantern",
    category: "food",
    label: "🍶 居酒屋小巷·红灯笼微醺",
    prompt: "深夜日式居酒屋小巷，shot on Fujifilm X-T5, 23mm f/1.4, glowing crimson lanterns casting warm amber-red light on facial contours, dark wood texture, Midnight Diner cinematic atmosphere",
    negative: "harsh flash, daylight, blurry, low resolution",
    denoise: 0.60,
  },
  {
    id: "cyber_rain_reflections",
    category: "night",
    label: "🌧️ 赛博雨夜·湿地霓虹倒影",
    prompt: "都市雨夜街道，shot on Sony A7R V, FE 50mm f/1.2 GM, CineStill 800T halation, wet asphalt neon reflections, atmospheric rain mist, teal and magenta grading, Blade Runner nocturnal vibe",
    negative: "daylight, muddy blacks, blurry, flat lighting, noisy",
    denoise: 0.65,
  },
  {
    id: "rooftop_skyline_night",
    category: "night",
    label: "🏙️ 高空天台·繁华天际线散景",
    prompt: "高空天台俯瞰繁华城市夜景，shot on Canon EOS R5, 85mm f/1.2L DS, city skyscrapers illuminated in background with silky circular bokeh, modern sleek fashion magazine night editorial",
    negative: "dark face, harsh direct flash, blurry background blur artifacts",
    denoise: 0.62,
  },
  {
    id: "nature_misty_forest",
    category: "nature",
    label: "🌲 迷雾森林·清晨丁达尔光",
    prompt: "清晨古树迷雾森林，shot on Hasselblad X2D 100C, 38mm f/2.5, Velvia 50 greens, dramatic volumetric god rays piercing forest canopy mist, fairytale tranquil woodland atmosphere",
    negative: "flat overcast, blurry, fake 3d, plastic leaves",
    denoise: 0.60,
  },
  {
    id: "nature_snow_mountain",
    category: "nature",
    label: "🏔️ 巍峨雪山·日照金山史诗",
    prompt: "巍峨雪山日照金山，shot on Nikon Z9, 70-200mm f/2.8 at 105mm, golden morning alpenglow lighting up alpine summit, pure high altitude thin air clarity, National Geographic RAW realism",
    negative: "overexposed snow, washed out, blurry mountain ridge",
    denoise: 0.60,
  },
  {
    id: "nature_tropical_island",
    category: "nature",
    label: "🏖️ 热带海岛·纯净玻璃海",
    prompt: "热带海岛纯净玻璃海，shot on Sony A7R V, 24-70mm f/2.8 GM II, crystal turquoise shallow lagoon with sunlight caustic ripples, swaying palm leaves, sun-kissed glowing skin",
    negative: "murky water, overcast gray sky, blurry",
    denoise: 0.58,
  },
  {
    id: "rescue_overcast_flat",
    category: "rescue",
    label: "⛅ 阴天拯救·重构立体暖阳",
    prompt: "告别阴天灰暗死白光，shot on Leica M6, 35mm f/1.4, Kodak Portra 400, transform flat overcast into warm directional golden hour side light, sculpted natural facial contours, lively vibrant colors",
    negative: "flat gray cast, dark face, washed out overcast, blurry",
    denoise: 0.63,
  },
  {
    id: "rescue_backlit_dark_face",
    category: "rescue",
    label: "💡 逆光黑脸拯救·通透立体五官",
    prompt: "拯救逆光拍照人脸漆黑，shot on Sony A7R V, 50mm f/1.2, soft flattering beauty fill light illuminating eyes and facial contours while preserving glowing sunset background rim light, luminous skin",
    negative: "pitch black face, overexposed background, washed out skin",
    denoise: 0.60,
  },
  {
    id: "rescue_harsh_flash",
    category: "rescue",
    label: "✨ 闪光灯拯救·柔化为电影光",
    prompt: "消除生硬手机直闪，shot on Leica SL2, 50mm f/1.4, giant softbox diffused ambient illumination replacing harsh phone flash, eliminating oily shine, authentic film matte texture and pores",
    negative: "harsh direct flash shine, plastic skin, red eye, washed out face",
    denoise: 0.62,
  },
  {
    id: "film_leica_portra",
    category: "master_film",
    label: "🎞️ Leica M6 + Kodak Portra 400",
    prompt: "shot on Leica M6, 35mm Summicron-M f/1.4 ASPH, Kodak Portra 400 color film, golden hour warm side lighting, soft lens flare, clean background with clutter removed, DaVinci Resolve color grading, 8k",
    negative: "harsh flash, flat lighting, blurry face, crowded background, tourists, plastic skin, amateur photo",
    denoise: 0.60,
  },
  {
    id: "film_fuji_velvia",
    category: "master_film",
    label: "📷 Fujifilm X-T5 + Velvia 50",
    prompt: "shot on Fujifilm X-T5, 23mm f/1.4, Fujichrome Velvia 50 slide simulation, intense deep saturation and jewel tones, crystal clear mountain and architectural sharpness, high visual impact",
    negative: "oversaturated cartoonish, blurry, low resolution",
    denoise: 0.58,
  },
  {
    id: "film_cinestill_800t",
    category: "master_film",
    label: "🎬 CineStill 800T (夜景电影红晕)",
    prompt: "shot on Sony A7R V, 50mm f/1.2 GM, CineStill 800T tungsten film, iconic red-orange highlight halation around lights, cinematic retro teal and warm orange grade, inky blacks, 8k",
    negative: "daylight, blurry, muddy blacks, flat lighting, noisy",
    denoise: 0.62,
  },
];

const ZINE_STYLES = [
  {
    id: "gc-minimal-zine-poster",
    label: "📰 极简纸刊海报",
    model: "image_z_image_turbo",
    needsImage: false,
    prompt: "a poetic everyday scene, minimal zine poster, sparse vertical paper composition, large negative space, one small editorial focal element, experimental typography, single clear color accent, aged paper texture, print scan reproduction, poetic restrained mood, high aesthetic",
    negative: "commercial advertisement, full bleed busy layout, chaotic composition, generic collage template, oversaturated colors, glossy magazine cover, watermark, signature",
  },
  {
    id: "pixel-style-poster",
    label: "🔳 像素点阵海报",
    model: "image_z_image_turbo",
    needsImage: false,
    prompt: "a graceful flower, fine bitmap editorial poster, vertical 3:4 canvas, large dot-matrix halftone subject, monochrome or two-color ink, soft tonal transition through pixel density, warm off-white paper with subtle fibers, low-resolution print texture, restrained microtype caption, Japanese editorial feeling",
    negative: "chunky pixel art, retro game 8-bit, flat solid color without tonal transition, neon contrast, cartoon sticker, chaotic layout, cinematic realism, watermark",
  },
  {
    id: "photo-abstract-editorial",
    label: "🎨 克制美学·几何编辑",
    model: "photo_cinematic_retouch",
    needsImage: true,
    prompt: "the uploaded photograph, editorial photo abstraction, upper half original photograph preserved, lower half distilled into minimal geometric shapes with small English title, restrained aesthetic, clean negative space, muted palette, brand visual identity, flat printmaking language",
    negative: "rewrite the photograph, redraw the photo content, heavy ornament, loud gradient, collage clutter, UI overlay, watermark, oversaturated",
  },
  {
    id: "photo-relic-editorial",
    label: "🖼️ 纸上留影·版画印记",
    model: "photo_cinematic_retouch",
    needsImage: true,
    prompt: "the uploaded photograph, photo relic editorial, upper half preserved photograph, lower half light-ink printmaking etching of the scene, architecture skyline water motif, warm paper panel, flat ink blocks, negative-space cuts, sparse lines, one small warm accent, small English title",
    negative: "rewrite the photograph, beautify the photo, fake vintage texture, heavy watercolor, decorative geometry unrelated to photo, stickers, UI overlay, watermark",
  },
  {
    id: "travel-photo-abstraction",
    label: "🗺️ 旅行照片抽象",
    model: "photo_cinematic_retouch",
    needsImage: true,
    prompt: "the uploaded travel photograph, travel photo abstraction, upper photograph preserved untouched, lower panel abstract reconstruction of source relationships, minimal marks and fields, clean uniform ivory background, poetic negative space, quiet editorial composition, no text",
    negative: "style transfer, recognizable scene illustration, simplified tracing, posterization, object redraw, gradient background, uneven background, text, watermark, caption",
  },
  {
    id: "gathered-scenes-zine",
    label: "🧩 拾景纸刊·撕纸拼贴",
    model: "photo_cinematic_retouch",
    needsImage: true,
    prompt: "the uploaded photograph, gathered scenes zine collage, real photo as visual anchor, abstract shapes and single high-chroma color extending to paper, hand-torn paper fiber edges, visible print imperfection, restrained composition, paper zine texture",
    negative: "commercial poster, glossy finish, clean digital vector, chaotic collage clutter, oversaturated, fake vintage texture, UI overlay, watermark",
  },
];

export default function QuickStudioPage() {
  const [model, setModel] = useState(MODEL_OPTIONS[0].id);
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [refImage, setRefImage] = useState<File | null>(null);
  const [refImagePreview, setRefImagePreview] = useState<string>("");
  const [selectedStudioCategory, setSelectedStudioCategory] = useState("all");

  // Pro mode controls
  const [showPro, setShowPro] = useState(false);
  const [steps, setSteps] = useState(8);
  const [cfg, setCfg] = useState(1.5);
  const [denoise, setDenoise] = useState(0.62);
  const [seed, setSeed] = useState(-1);

  // Execution state
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleModelChange = (mId: string) => {
    setModel(mId);
    const m = MODEL_OPTIONS.find((opt) => opt.id === mId);
    if (m) {
      setSteps(m.defaultSteps);
      setCfg(m.defaultCfg);
      if (m.id === "photo_cinematic_retouch") {
        setPrompt(CINEMA_PRESETS[0].prompt);
        setNegativePrompt(CINEMA_PRESETS[0].negative);
        setDenoise(CINEMA_PRESETS[0].denoise);
      }
      if (m.type === "video" && aspectRatio === "1:1") {
        setAspectRatio("16:9");
      }
    }
  };

  const applyCinemaPreset = (preset: typeof CINEMA_PRESETS[0]) => {
    setPrompt(preset.prompt);
    setNegativePrompt(preset.negative);
    setDenoise(preset.denoise);
  };

  const applyZineStyle = (style: typeof ZINE_STYLES[0]) => {
    setModel(style.model);
    setPrompt(style.prompt);
    setNegativePrompt(style.negative);
    if (style.model === "photo_cinematic_retouch") {
      setDenoise(0.62);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRefImage(file);
    const reader = new FileReader();
    reader.onload = () => {
      setRefImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setProgress(5);
    setStatusText("正在提交任务至 ComfyUI...");
    setError(null);

    const dims = {
      "1:1": [1024, 1024],
      "16:9": model.includes("minimax") ? [1344, 768] : [1280, 704],
      "9:16": model.includes("minimax") ? [768, 1344] : [704, 1280],
      "4:3": [1024, 768],
    }[aspectRatio] || [1024, 1024];

    try {
      let taskId = "";
      if (refImage) {
        // Multipart auto generation
        const fd = new FormData();
        fd.append("prompt", prompt);
        if (negativePrompt) fd.append("negative_prompt", negativePrompt);
        fd.append("workflow", model);
        fd.append("width", String(dims[0]));
        fd.append("height", String(dims[1]));
        fd.append("denoise", String(denoise));
        fd.append("seed", String(seed));
        fd.append("image", refImage);
        const res = await generateAuto(fd);
        taskId = res.task_id;
      } else {
        const res = await generate({
          prompt,
          negative_prompt: negativePrompt,
          workflow: model,
          steps,
          cfg,
          denoise,
          width: dims[0],
          height: dims[1],
          seed,
        });
        taskId = res.task_id;
      }

      setStatusText("ComfyUI 正在运算中...");

      subscribeTaskStream(taskId, (t: TaskResponse) => {
        setProgress(t.progress);
        if (t.status === "running") {
          setStatusText(`GPU 运算渲染中 (${t.progress}%)...`);
        } else if (t.status === "done") {
          setLoading(false);
          setStatusText("✓ 渲染完成");
          setResultImages(t.images || []);
        } else if (t.status === "failed") {
          setLoading(false);
          setError(t.error || "生成失败");
        }
      });
    } catch (e: any) {
      setLoading(false);
      setError(e.message || "请求失败");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-slate-900">⚡ 快速工位 (Quick Studio)</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
            Single-Job Workbench
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          直观的图形化操作工位 · 适合精细化调参与快速出图测试
        </p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Controls Panel (col-span-5) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-5">
          
          {/* Model Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">模型引擎 / 工作流</label>
            <div className="space-y-2">
              {MODEL_OPTIONS.map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => handleModelChange(opt.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    model === opt.id
                      ? "border-slate-900 bg-slate-50 shadow-2xs"
                      : "border-slate-200/80 hover:border-slate-300 bg-white"
                  }`}
                >
                  <span className="text-xs font-bold text-slate-800">{opt.label}</span>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    opt.type === "video" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-700"
                  }`}>
                    {opt.type}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Paper Art / Zine Style Presets (always available) */}
          <div className="p-3 bg-indigo-50/60 border border-indigo-200/70 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-indigo-900 uppercase">
                📰 纸刊美学·AI 图像美化 (6 款开源风格)
              </label>
              <span className="text-[10px] text-indigo-700 font-medium">点选即注入提示词</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {ZINE_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => applyZineStyle(s)}
                  className="p-2 rounded-lg bg-white hover:bg-indigo-100/70 border border-indigo-200 text-[11px] font-semibold text-slate-800 text-left transition-colors cursor-pointer shadow-2xs"
                >
                  {s.label}
                  {s.needsImage && <span className="ml-1 text-[9px] text-indigo-500 font-bold">📷需上传原片</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Cinematography Style Presets Bar (Shown when in retouch mode) */}
          {model === "photo_cinematic_retouch" && (
            <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-amber-900 uppercase">
                  📸 旅拍全场景精修预设 (一键注入专业相机语言)
                </label>
                <span className="text-[10px] text-amber-700 font-medium">23大场景矩阵</span>
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1">
                {TRAVEL_STUDIO_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedStudioCategory(cat.id)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap transition-all cursor-pointer ${
                      selectedStudioCategory === cat.id
                        ? "bg-amber-600 text-white shadow-2xs"
                        : "bg-white text-slate-700 hover:bg-amber-100 border border-amber-200"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Sub-scenarios Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                {CINEMA_PRESETS
                  .filter((p) => selectedStudioCategory === "all" || p.category === selectedStudioCategory)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyCinemaPreset(p)}
                      className="p-2 rounded-lg bg-white hover:bg-amber-100/70 border border-amber-200 text-[11px] font-semibold text-slate-800 text-left transition-colors cursor-pointer shadow-2xs"
                    >
                      {p.label}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Prompt */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
              {model === "photo_cinematic_retouch" ? "摄影级正面提示词 (Camera & Scene Prompt)" : "正面提示词 (Prompt)"}
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="输入画面的详细描述（英文或中文均可）..."
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none transition-all leading-relaxed"
            />
          </div>

          {/* Aspect Ratio */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">画幅比例</label>
            <div className="grid grid-cols-4 gap-2">
              {["1:1", "16:9", "9:16", "4:3"].map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setAspectRatio(ratio)}
                  className={`py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    aspectRatio === ratio
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80"
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          {/* Reference Image */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
              {model === "photo_cinematic_retouch" ? "📷 上传待重塑的旅行原片 (必需)" : "参考图 / 首帧锚定 (可选)"}
            </label>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageSelect}
              className="hidden"
            />
            {refImagePreview ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-black max-h-32 flex items-center justify-center">
                <img src={refImagePreview} alt="Ref Preview" className="max-h-32 object-contain" />
                <button
                  onClick={() => {
                    setRefImage(null);
                    setRefImagePreview("");
                  }}
                  className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white text-xs font-bold hover:bg-black cursor-pointer"
                >
                  ✕ 移除
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`w-full py-3.5 rounded-xl border border-dashed text-xs font-bold transition-all cursor-pointer ${
                  model === "photo_cinematic_retouch"
                    ? "border-amber-400 bg-amber-50/40 text-amber-900 hover:bg-amber-100/50 shadow-2xs"
                    : "border-slate-300 hover:border-slate-900 text-slate-500 hover:text-slate-900 bg-slate-50/50 hover:bg-slate-100/50"
                }`}
              >
                {model === "photo_cinematic_retouch" ? "+ 点击上传旅行随手拍原片" : "+ 上传参考图或图生视频首帧"}
              </button>
            )}
          </div>

          {/* Pro Mode Collapsible */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowPro(!showPro)}
              className="flex items-center justify-between w-full text-xs font-bold text-slate-600 hover:text-slate-900 py-1 cursor-pointer"
            >
              <span>⚙️ 专家参数调节 (Pro Controls)</span>
              <span>{showPro ? "▲ 折叠" : "▼ 展开"}</span>
            </button>

            {showPro && (
              <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">负向提示词 (Negative Prompt)</label>
                  <input
                    type="text"
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="blurry, low quality, deformed..."
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Steps ({steps})</label>
                    <input
                      type="number"
                      value={steps}
                      onChange={(e) => setSteps(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">CFG ({cfg})</label>
                    <input
                      type="number"
                      step="0.5"
                      value={cfg}
                      onChange={(e) => setCfg(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      {model === "photo_cinematic_retouch" ? `重绘幅度 (${denoise})` : "Seed (-1随机)"}
                    </label>
                    {model === "photo_cinematic_retouch" ? (
                      <input
                        type="number"
                        step="0.05"
                        min="0.3"
                        max="0.9"
                        value={denoise}
                        onChange={(e) => setDenoise(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs"
                      />
                    ) : (
                      <input
                        type="number"
                        value={seed}
                        onChange={(e) => setSeed(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs"
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Submit CTA */}
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className={`w-full py-3.5 rounded-xl text-xs font-black tracking-widest uppercase transition-all ${
              loading || !prompt.trim()
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-slate-900 hover:bg-black text-white cursor-pointer active:scale-95 shadow-xs"
            }`}
          >
            {loading ? "⌛ 渲染中..." : model === "photo_cinematic_retouch" ? "📸 一键重塑为摄影大片" : "✦ 立即开始生成"}
          </button>
        </div>

        {/* Right: Live Canvas (col-span-7) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between min-h-[580px]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900">创作画布</h2>
              {loading && (
                <span className="text-xs font-semibold text-slate-700 animate-pulse">{statusText}</span>
              )}
            </div>

            {/* Progress Bar */}
            {loading && (
              <div className="w-full bg-slate-100 rounded-full h-1.5 mb-4 overflow-hidden">
                <div
                  className="bg-slate-900 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            )}

            {/* Result Display */}
            {resultImages.length > 0 ? (
              <div className="space-y-4">
                {/* Side-by-side comparison if reference image exists */}
                {refImagePreview && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>📷 摄影重塑前后对比 (Before & After)</span>
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        ✓ 质感重塑完成
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-xl overflow-hidden bg-slate-900 border border-slate-200 relative aspect-square flex items-center justify-center">
                        <img src={refImagePreview} alt="Original" className="w-full h-full object-cover" />
                        <span className="absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded bg-black/70 text-white backdrop-blur">
                          原片 (Before)
                        </span>
                      </div>
                      <div className="rounded-xl overflow-hidden bg-slate-900 border border-indigo-200 relative aspect-square flex items-center justify-center ring-2 ring-indigo-500/20">
                        <img src={resolveImageUrl(resultImages[0])} alt="Retouched" className="w-full h-full object-cover" />
                        <span className="absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-600 text-white shadow-xs">
                          大片成片 (After)
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Single Image/Video View */}
                {resultImages.map((src, i) => {
                  const fullUrl = resolveImageUrl(src);
                  const isVideo = /\.(mp4|webm)$/i.test(src);
                  return (
                    <div key={i} className="group relative rounded-xl overflow-hidden border border-slate-200 bg-black">
                      {isVideo ? (
                        <video src={fullUrl} controls playsInline autoPlay muted loop className="w-full max-h-[480px] object-contain mx-auto" />
                      ) : (
                        <img src={fullUrl} alt="Generated" className="w-full max-h-[480px] object-contain mx-auto" />
                      )}
                      <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-mono">{src}</span>
                        <a
                          href={fullUrl}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-slate-900 hover:bg-black transition-colors flex items-center gap-1"
                        >
                          <span>⬇</span>
                          <span>下载高清大片</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : !loading ? (
              <div className="h-96 rounded-xl bg-slate-50/50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 gap-2">
                <span className="text-4xl">✦</span>
                <p className="text-xs font-semibold text-slate-400">准备就绪，点击左侧开始生成</p>
              </div>
            ) : (
              <div className="h-96 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center gap-4">
                <div className="w-10 h-10 border-3 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
                <p className="text-xs font-semibold text-slate-700 animate-pulse">{statusText}</p>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3.5 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
                <strong>生成出错:</strong> {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
