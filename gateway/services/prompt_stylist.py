"""
Prompt Stylist & Cinematography Engine.
Transforms amateur natural language descriptions and travel snapshots into
professional camera-grade ComfyUI prompts and workflow parameters across the full travel lifecycle.
"""
from typing import Any, Dict, List

TRAVEL_CATEGORIES: List[Dict[str, Any]] = [
    {"id": "all", "name": "✨ 全部精修场景", "icon": "✨"},
    {"id": "landmark", "name": "🏛️ 地标去路人", "icon": "🏛️"},
    {"id": "sunset", "name": "🌅 黄金落日逆光", "icon": "🌅"},
    {"id": "transit", "name": "✈️ 交通与窗景", "icon": "✈️"},
    {"id": "food", "name": "🍜 市井与深夜食堂", "icon": "🍜"},
    {"id": "night", "name": "🌃 霓虹都市雨夜", "icon": "🌃"},
    {"id": "nature", "name": "🏞️ 自然山海旷野", "icon": "🏞️"},
    {"id": "rescue", "name": "🌸 阴天/废片重打光", "icon": "🌸"},
    {"id": "master_film", "name": "🎞️ 经典名机胶片", "icon": "🎞️"},
]

CINEMATOGRAPHY_PRESETS: Dict[str, Dict[str, Any]] = {
    # 1. 🏛️ 地标建筑与景区去路人
    "landmark_crowd_clean": {
        "category": "landmark",
        "label": "🏛️ 著名地标·包场去路人",
        "description": "智能抹除背景密集的游客与路人杂物，还原静谧宏伟的纯净地标大片",
        "camera_lens": "shot on Leica M6, 35mm Summicron-M f/1.4 ASPH lens",
        "film_stock": "Kodak Portra 400 color film stock, authentic fine grain",
        "lighting": "natural morning ambient light, soft architectural shadows, crystal clear contrast",
        "color_grade": "clean documentary tones, authentic stone textures, DaVinci Resolve color grading",
        "aesthetic": "isolated traveler standing peacefully before grand historic landmark, empty square, 8k uhd",
        "denoise": 0.60,
    },
    "landmark_epic_scale": {
        "category": "landmark",
        "label": "🏰 古典宫殿·史诗纵深感",
        "description": "超广角建筑透视，强化高耸穹顶与人物的史诗级尺度对比",
        "camera_lens": "shot on Canon EOS R5, EF 24-70mm f/2.8L II USM at 24mm ultra-wide angle",
        "film_stock": "high dynamic range raw sensor capture, extreme micro-contrast and stonework details",
        "lighting": "dramatic directional cross lighting through gothic cathedral stained glass windows, volumetric dust shafts",
        "color_grade": "National Geographic authentic architecture color science, deep rich shadows and golden highlights",
        "aesthetic": "monumental scale perspective, human subject anchored in majestic historical palace, award winning photo",
        "denoise": 0.62,
    },
    "landmark_night_lit": {
        "category": "landmark",
        "label": "🌙 地标夜色·泛光辉煌",
        "description": "古迹与建筑夜间暖光照明，冷蓝夜空与金碧辉煌的强烈对比",
        "camera_lens": "shot on Sony A7R V, FE 35mm f/1.4 GM prime lens",
        "film_stock": "clean low-noise nocturnal sensor dynamic range, crisp sharp highlight rolloff",
        "lighting": "warm architectural floodlights illuminating historic facade, deep navy twilight sky ambient contrast",
        "color_grade": "amber gold and deep indigo blue split-toning, sparkling pinpoint city lights",
        "aesthetic": "breathtaking nocturnal landmark portrait, glowing architectural details, luxury travel cover",
        "denoise": 0.62,
    },

    # 2. 🌅 黄金时刻与日落逆光
    "sunset_beach_rim": {
        "category": "sunset",
        "label": "🌅 海边日落·发丝逆光金晕",
        "description": "落日余晖洒在海面与发丝，柔和金光轮廓与波光粼粼的浪漫氛围",
        "camera_lens": "shot on Sony A7R V, FE 85mm f/1.4 GM portrait lens, wide open aperture",
        "film_stock": "medium format dynamic range, creamy circular bokeh balls",
        "lighting": "dramatic golden hour sunset backlighting, radiant warm halo rim light around hair and shoulders, golden sparkling ocean reflections",
        "color_grade": "warm amber, honey gold and soft rose sunset grading, luminous glowing skin tone",
        "aesthetic": "romantic sunset beach portrait, wind blowing hair gently, cinematic romance movie still, 8k",
        "denoise": 0.62,
    },
    "sunset_cliff_epic": {
        "category": "sunset",
        "label": "🌄 绝美断崖·落日海平线",
        "description": "站在海边悬崖俯瞰烈焰落日，风吹衣袂的壮阔电影感",
        "camera_lens": "shot on Hasselblad X2D 100C, 45mm f/4 P lens, medium format depth",
        "film_stock": "100MP medium format sensor, incredible organic landscape detail and cloud textures",
        "lighting": "blazing fiery orange sunset horizon, dramatic golden volumetric god rays piercing storm clouds",
        "color_grade": "cinematic teal and orange split-toning, deep shadow contrast, rich golden highlights",
        "aesthetic": "epic cinematic traveler portrait at the edge of the world, majestic nature scale, masterpiece",
        "denoise": 0.63,
    },
    "blue_hour_twilight": {
        "category": "sunset",
        "label": "🌆 蓝调时刻·日暮初上 (Blue Hour)",
        "description": "太阳刚落山时的冷蓝天空，与暖黄街灯交织出的极致通透清冷感",
        "camera_lens": "shot on Leica SL2, APO-Summicron-SL 50mm f/2 ASPH",
        "film_stock": "Kodak Ektar 100 ultra-fine grain film simulation, crystal clear atmosphere",
        "lighting": "magic blue hour deep indigo twilight, warm tungsten streetlamp illumination creating complementary color contrast",
        "color_grade": "pure clean skin tones with cool cyan-blue twilight ambient and warm glowing accents",
        "aesthetic": "melancholic elegant European twilight travel portrait, serene quiet city street, masterwork",
        "denoise": 0.59,
    },

    # 3. ✈️ 交通与窗景
    "transit_plane_window": {
        "category": "transit",
        "label": "✈️ 飞机舷窗·云海晨昏金光",
        "description": "阳光穿透舷窗打在侧脸，窗外是浩瀚无垠的落日云海",
        "camera_lens": "shot on Leica Q3, Summilux 28mm f/1.7 ASPH lens",
        "film_stock": "Kodak Portra 400 film grain, soft halation around sunlit airplane window",
        "lighting": "directional golden sunlight beaming through airplane passenger window, soft warm rim light on face and hands, glowing cloud sea outside",
        "color_grade": "nostalgic travel magazine color palette, warm cabin interior contrast",
        "aesthetic": "introspective journey portrait, traveling above the clouds, peaceful wanderlust feeling, 8k",
        "denoise": 0.60,
    },
    "transit_train_speed": {
        "category": "transit",
        "label": "🚄 高铁列车·风景流动光影",
        "description": "窗外风景流光飞驰，车厢内静谧反光的文艺电影质感",
        "camera_lens": "shot on Fujifilm X-T5, XF 35mm f/1.4 R lens",
        "film_stock": "Fujichrome Classic Chrome simulation, gentle highlight rolloff",
        "lighting": "natural window light casting dynamic soft shadows, blurred scenery rushing past outside",
        "color_grade": "moody muted greens and cool train interior grays, subtle film grain",
        "aesthetic": "Wong Kar-wai cinematic train journey still, poetic travel contemplation, high aesthetic",
        "denoise": 0.58,
    },
    "transit_road_trip": {
        "category": "transit",
        "label": "🚙 公路自驾·海滨敞篷兜风",
        "description": "阳光、海风、公路沿线，自由不羁的美式公路电影风",
        "camera_lens": "shot on Canon EOS R5, RF 28-70mm f/2L USM",
        "film_stock": "vintage 1970s Kodachrome 64 slide film aesthetic, vivid colors with organic warmth",
        "lighting": "bright radiant California coastal sunlight, dynamic lens flare, wind-tousled hair",
        "color_grade": "warm nostalgic saturated tones, sun-drenched coastal highway and turquoise ocean backdrop",
        "aesthetic": "authentic carefree road trip snapshot, cinematic freedom, Vogue travel editorial",
        "denoise": 0.62,
    },

    # 4. 🍜 市井与深夜食堂
    "street_food_steam": {
        "category": "food",
        "label": "🏮 夜市摊位·热气腾腾烟火气",
        "description": "路边摊袅袅升起的食物蒸汽与暖黄灯光，极具市井烟火感染力",
        "camera_lens": "shot on Sony A7R V, FE 50mm f/1.2 GM prime lens, razor-thin depth of field",
        "film_stock": "CineStill 800T tungsten film, signature red-orange halo around incandescent stall lights",
        "lighting": "warm hanging tungsten light bulb, rising steam catching golden light, cozy night market ambient",
        "color_grade": "rich appetising warm colors, glowing amber lanterns and deep street shadows",
        "aesthetic": "authentic Asian street food culture portrait, joyful eating candid, immersive atmosphere",
        "denoise": 0.60,
    },
    "cozy_cafe_afternoon": {
        "category": "food",
        "label": "☕ 街角咖啡馆·树影斑驳午后",
        "description": "法式露天咖啡馆，树影斑驳的微风阳光，慵懒松弛的度假感",
        "camera_lens": "shot on Leica M11, Summilux-M 50mm f/1.4 ASPH",
        "film_stock": "Kodak Gold 200 film aesthetic, warm golden highlights and soft natural skin tones",
        "lighting": "dappled sunlight filtering through leaves, soft bounce light from white tablecloth",
        "color_grade": "airy European lifestyle grading, muted pastels, vintage cafe elegance",
        "aesthetic": "effortless Parisian chic candid, sipping coffee peacefully, Kinfolk lifestyle aesthetic",
        "denoise": 0.58,
    },
    "izakaya_lantern": {
        "category": "food",
        "label": "🍶 居酒屋小巷·红灯笼微醺",
        "description": "深夜小巷日式居酒屋，红灯笼映照下的暖光与复古木质质感",
        "camera_lens": "shot on Fujifilm X-T5, XF 23mm f/1.4 R LM WR",
        "film_stock": "Fujifilm Pro 400H simulation, fine grain and gentle shadow transitions",
        "lighting": "glowing crimson paper lanterns casting warm red-gold light on facial contours, dark wooden textures",
        "color_grade": "moody Tokyo night alley tones, deep warm mahogany browns and vibrant red accents",
        "aesthetic": "Midnight Diner cinematic still, intimate cozy travel night, master atmospheric depth",
        "denoise": 0.60,
    },

    # 5. 🌃 霓虹都市雨夜
    "cyber_rain_reflections": {
        "category": "night",
        "label": "🌧️ 赛博雨夜·湿地霓虹倒影",
        "description": "雨后街道积水的绚丽倒影，五彩霓虹灯光晕与横向宽银幕光斑",
        "camera_lens": "shot on Sony A7R V, FE 50mm f/1.2 GM, wide open aperture",
        "film_stock": "CineStill 800T tungsten film, distinct red-orange highlight halation around lights",
        "lighting": "vibrant neon ambient reflections, wet asphalt reflections, dramatic high ISO night illumination",
        "color_grade": "cyberpunk neon teal and magenta grading, deep moody blacks with glowing accents",
        "aesthetic": "Blade Runner inspired nocturnal travel portrait, atmospheric rain mist, cinematic bokeh",
        "denoise": 0.65,
    },
    "rooftop_skyline_night": {
        "category": "night",
        "label": "🏙️ 高空天台·繁华天际线散景",
        "description": "俯瞰万家灯火的高空天台，背景如梦似幻的城市光斑大散景",
        "camera_lens": "shot on Canon EOS R5, RF 85mm f/1.2L USM DS (Defocus Smoothing)",
        "film_stock": "ultra-clean low-noise sensor, silky smooth circular bokeh rendering",
        "lighting": "soft subtle LED rim fill light on subject, brilliant city skyscrapers illuminated in background",
        "color_grade": "sophisticated modern nocturnal color science, cool architectural blues and champagne gold lights",
        "aesthetic": "high-fashion metropolitan rooftop portrait, glamorous nighttime travel luxury",
        "denoise": 0.62,
    },

    # 6. 🏞️ 自然山海旷野
    "nature_misty_forest": {
        "category": "nature",
        "label": "🌲 迷雾森林·清晨丁达尔光",
        "description": "高大古木与晨雾弥漫，光束穿透树冠倾泻而下的童话仙境感",
        "camera_lens": "shot on Hasselblad X2D 100C, 38mm f/2.5 V lens",
        "film_stock": "Fujichrome Velvia 50 slide film emulation, deep lush emerald greens and pristine whites",
        "lighting": "dramatic morning volumetric god rays piercing through dense forest canopy mist, soft radiant illumination",
        "color_grade": "fairytale forest palette, rich moss greens, soft diffused highlights",
        "aesthetic": "ethereal woodland travel portrait, mystical tranquil atmosphere, National Geographic award winner",
        "denoise": 0.60,
    },
    "nature_snow_mountain": {
        "category": "nature",
        "label": "🏔️ 巍峨雪山·日照金山史诗",
        "description": "清晨第一缕阳光点亮雪山金顶，通透纯净的高原空气感",
        "camera_lens": "shot on Nikon Z9, NIKKOR Z 70-200mm f/2.8 VR S lens at 105mm",
        "film_stock": "pure uncompressed RAW high dynamic range, pristine snow texture and mountain ridge micro-contrast",
        "lighting": "golden morning alpenglow lighting up snowy mountain summits, crisp clear high-altitude sunlight",
        "color_grade": "vibrant contrast between warm golden peaks and cool alpine glaciers, authentic travel realism",
        "aesthetic": "epic mountaineer outdoor portrait, majestic Himalayan wilderness scale, breathtaking clarity",
        "denoise": 0.60,
    },
    "nature_tropical_island": {
        "category": "nature",
        "label": "🏖️ 热带海岛·纯净玻璃海",
        "description": "阳光折射下的透亮青碧玻璃海与摇曳椰影，明媚高级度假风",
        "camera_lens": "shot on Sony A7R V, FE 24-70mm f/2.8 GM II",
        "film_stock": "vibrant travel slide film simulation, ultra-clean water caustics rendering",
        "lighting": "radiant tropical overhead sunlight creating crystal clear underwater caustic ripples, glowing sunlit skin",
        "color_grade": "Maldives turquoise cyan waters, golden sand, saturated palm greens, bright refreshing mood",
        "aesthetic": "luxury resort holiday portrait, joyful summer vacation editorial, crystal pure",
        "denoise": 0.58,
    },

    # 7. 🌸 废片拯救与光影重打
    "rescue_overcast_flat": {
        "category": "rescue",
        "label": "⛅ 阴天拯救·重构立体暖阳",
        "description": "将阴天灰暗死白的大平光彻底转变为立体生动的落日侧光与温暖层次",
        "camera_lens": "shot on Leica M6, 35mm Summicron-M f/1.4 ASPH lens",
        "film_stock": "Kodak Portra 400 film grain, organic skin tones",
        "lighting": "transforming flat overcast sky into warm directional golden side light, sculpted natural facial shadows, rich ambient fill",
        "color_grade": "eliminating flat gray cast, injecting warm amber highlights and clean shadow depth",
        "aesthetic": "vibrant lively travel photo reconstructed from overcast snapshot, radiant natural beauty",
        "denoise": 0.63,
    },
    "rescue_backlit_dark_face": {
        "category": "rescue",
        "label": "💡 逆光黑脸拯救·通透立体五官",
        "description": "拯救逆光拍照时人脸漆黑的问题，保留绝美背景同时提亮面部透光微光",
        "camera_lens": "shot on Sony A7R V, FE 50mm f/1.2 GM prime lens",
        "film_stock": "high dynamic range sensor recovery, delicate skin pore texture",
        "lighting": "perfectly balanced exposure, soft flattering beauty fill light illuminating eyes and facial contours while keeping glowing background rim light",
        "color_grade": "luminous translucent skin tones, natural catchlights in eyes, DaVinci Resolve color science",
        "aesthetic": "flawless professional portrait rescued from harsh backlight, magazine cover quality",
        "denoise": 0.60,
    },
    "rescue_harsh_flash": {
        "category": "rescue",
        "label": "✨ 手机闪光灯拯救·柔化为电影光",
        "description": "消除手机直闪的油光、红眼与惨白塑料感，柔化为摄影棚柔光箱与自然环境光",
        "camera_lens": "shot on Leica SL2, 50mm f/1.4 lens",
        "film_stock": "Kodak Tri-X / Portra analog film depth",
        "lighting": "soft diffused giant softbox illumination replacing harsh direct flash, smooth gradual shadow rolloff, eliminating harsh shine",
        "color_grade": "authentic matte film finish, rich organic textures, balanced natural exposure",
        "aesthetic": "high-end fashion editorial still, refined elegance without phone camera artifacts",
        "denoise": 0.62,
    },

    # 8. 🎞️ 经典名机胶片
    "film_leica_portra": {
        "category": "master_film",
        "label": "🎞️ Leica M6 + Kodak Portra 400 (温暖人文)",
        "description": "传奇徕卡镜头德味，柯达肖像胶片温暖细腻的肤色与微颗粒感",
        "camera_lens": "shot on Leica M6, 35mm Summicron-M f/1.4 ASPH lens",
        "film_stock": "Kodak Portra 400 color film stock, authentic fine film grain, subtle highlight halation",
        "lighting": "golden hour warm side illumination, soft natural rim lighting on subject silhouette",
        "color_grade": "warm nostalgic analog color grading, rich skin undertones, DaVinci Resolve film print emulation",
        "aesthetic": "candid travel magazine editorial, timeless cinematic atmosphere, 8k masterpiece",
        "denoise": 0.60,
    },
    "film_fuji_velvia": {
        "category": "master_film",
        "label": "📷 Fujifilm X-T5 + Velvia 50 (极致风光色彩)",
        "description": "富士传奇反转片，鲜艳饱满的蓝天绿意与高对比度空气感",
        "camera_lens": "shot on Fujifilm X-T5, Fujinon XF 23mm f/1.4 R LM WR lens",
        "film_stock": "Fujichrome Velvia 50 slide film simulation, intense deep saturation and vivid jewel tones",
        "lighting": "crystal clear outdoor daylight, sharp crisp mountain and architecture micro-contrast",
        "color_grade": "rich saturated blues and lush emerald greens, clean highlights, high visual impact",
        "aesthetic": "classic National Geographic landscape travel editorial, breathtaking crispness",
        "denoise": 0.58,
    },
    "film_cinestill_800t": {
        "category": "master_film",
        "label": "🎬 CineStill 800T (夜景电影红晕)",
        "description": "电影胶片特有的红色光晕、复古钨丝灯色调与浓郁故事感",
        "camera_lens": "shot on Sony A7R V, FE 50mm f/1.2 GM lens, wide open aperture",
        "film_stock": "CineStill 800T tungsten-balanced cinema film, iconic red-orange highlight halation around lights",
        "lighting": "ambient city night glow, neon signage and streetlights creating cinematic moody shadows",
        "color_grade": "cinematic retro teal and warm orange grade, rich inky blacks with glowing light leaks",
        "aesthetic": "vintage Hollywood 35mm movie still, moody nocturnal storytelling, 8k",
        "denoise": 0.62,
    },
}

NEGATIVE_PROMPT_CORE = (
    "harsh direct flash, flat washed-out lighting, crowded background, blurry face, distorted eyes, "
    "bad hands, plastic artificial skin, oversaturated cartoonish colors, cgi render, 3d model, "
    "low quality phone snapshot, artifacts, watermark, signature, text, out of focus subject"
)


def list_travel_categories() -> List[Dict[str, Any]]:
    """Return all categorized tabs for UI navigation."""
    return TRAVEL_CATEGORIES


def list_travel_sub_scenarios(category_id: str = "all") -> List[Dict[str, Any]]:
    """Return sub-scenario presets filtered by travel category."""
    results = []
    for k, v in CINEMATOGRAPHY_PRESETS.items():
        if category_id in ("all", "") or v.get("category") == category_id:
            results.append({"id": k, **v})
    return results


def enhance_travel_prompt(
    user_text: str,
    style_id: str = "landmark_crowd_clean",
    remove_passersby: bool = True,
    add_golden_light: bool = False,
    shallow_bokeh: bool = True,
    sculpt_face: bool = True,
    custom_mood: str = "",
) -> Dict[str, Any]:
    """
    Synthesizes professional cinematography prompt and parameters based on amateur input.
    """
    preset = CINEMATOGRAPHY_PRESETS.get(style_id)
    if not preset:
        # Fallback to fuzzy match or default
        preset = CINEMATOGRAPHY_PRESETS.get("film_leica_portra", list(CINEMATOGRAPHY_PRESETS.values())[0])

    base_elements = []
    if user_text.strip():
        base_elements.append(user_text.strip())

    camera_block = preset["camera_lens"]
    film_block = preset["film_stock"]
    lighting_block = preset["lighting"]
    color_block = preset["color_grade"]
    aesthetic_block = preset["aesthetic"]

    # Modular enhancement switches
    passersby_clean_block = "clean background, tourists and cluttered crowd completely removed, clear unobstructed focal subject" if remove_passersby else ""
    golden_light_block = "golden hour radiant warm rim light glowing along silhouette, soft volumetric sun rays" if add_golden_light else ""
    bokeh_block = "shallow depth of field, creamy background blur, beautiful circular bokeh rendering" if shallow_bokeh else ""
    face_block = "sharp crisp focus on eyes and facial contours, refined luminous natural skin texture" if sculpt_face else ""

    prompt_parts = [
        "cinematic masterpiece travel photography",
        ", ".join(base_elements) if base_elements else "traveler enjoying picturesque scene",
        camera_block,
        film_block,
        lighting_block,
        golden_light_block,
        passersby_clean_block,
        bokeh_block,
        face_block,
        color_block,
        custom_mood.strip() if custom_mood.strip() else "",
        aesthetic_block,
        "8k uhd, photorealistic, DaVinci Resolve color grading",
    ]

    final_positive = ", ".join([p for p in prompt_parts if p])
    final_negative = NEGATIVE_PROMPT_CORE
    if remove_passersby:
        final_negative += ", people in background, tourists, bystanders, crowd, photobombers, strangers"

    summary_zh = (
        f"已应用【{preset['label']}】摄影语言精修：\n"
        f"• 场景描述：{preset.get('description', '')}\n"
        f"• 相机与镜头：{camera_block}\n"
        f"• 胶片与画质：{film_block}\n"
        f"• 光影环境：{lighting_block}\n"
        + (f"• 背景净化：已开启【清除杂乱路人与游客】\n" if remove_passersby else "")
        + (f"• 光影增强：已注入【黄金时刻侧逆光】\n" if add_golden_light else "")
        + f"• 色彩科学：{color_block}"
    )

    return {
        "style_id": style_id,
        "style_label": preset["label"],
        "category": preset.get("category", "general"),
        "positive_prompt": final_positive,
        "negative_prompt": final_negative,
        "denoise": preset["denoise"],
        "summary_zh": summary_zh,
    }
