/*{
  "ISFVSN": "2",
  "DESCRIPTION": "Chase effects for the Fruit of Life LED piece (13 double-ring circles). Every pixel inside a circle gets the same colour, so any LED mapped onto a ring lights with its whole circle. Geometry matches FruitOfLifeMapping.svg (285.16 x 320 mm page): overlay the SVG over the full frame.",
  "CREDIT": "Albert / OneEightyOne",
  "CATEGORIES": [
    "Generator",
    "LED Mapping"
  ],
  "INPUTS": [
    {
      "LABEL": "Mode",
      "NAME": "mat_mode",
      "TYPE": "long",
      "VALUES": [
        0,
        1,
        2,
        3,
        4,
        5,
        6
      ],
      "LABELS": [
        "Sequential",
        "Rotate",
        "Radial",
        "Sweep",
        "Random",
        "Solo (mapping test)",
        "All On"
      ],
      "DEFAULT": 0
    },
    {
      "LABEL": "Speed (steps/s)",
      "NAME": "mat_speed",
      "TYPE": "float",
      "MIN": 0.0,
      "MAX": 8.0,
      "DEFAULT": 2.0
    },
    {
      "LABEL": "Size (steps lit)",
      "NAME": "mat_size",
      "TYPE": "float",
      "MIN": 1.0,
      "MAX": 6.0,
      "DEFAULT": 1.0
    },
    {
      "LABEL": "Trail (steps)",
      "NAME": "mat_trail",
      "TYPE": "float",
      "MIN": 0.0,
      "MAX": 12.0,
      "DEFAULT": 2.0
    },
    {
      "LABEL": "Trail Curve",
      "NAME": "mat_curve",
      "TYPE": "float",
      "MIN": 0.5,
      "MAX": 4.0,
      "DEFAULT": 2.0
    },
    {
      "LABEL": "Chasers",
      "NAME": "mat_heads",
      "TYPE": "float",
      "MIN": 1.0,
      "MAX": 4.0,
      "DEFAULT": 1.0
    },
    {
      "LABEL": "Ping-Pong",
      "NAME": "mat_pingpong",
      "TYPE": "bool",
      "DEFAULT": false
    },
    {
      "LABEL": "Reverse",
      "NAME": "mat_reverse",
      "TYPE": "bool",
      "DEFAULT": false
    },
    {
      "LABEL": "Rotate Twist",
      "NAME": "mat_twist",
      "TYPE": "float",
      "MIN": 0.0,
      "MAX": 5.0,
      "DEFAULT": 0.0
    },
    {
      "LABEL": "Rotate: Centre On",
      "NAME": "mat_hub",
      "TYPE": "bool",
      "DEFAULT": true
    },
    {
      "LABEL": "Sweep Angle",
      "NAME": "mat_angle",
      "TYPE": "float",
      "MIN": 0.0,
      "MAX": 360.0,
      "DEFAULT": 270.0
    },
    {
      "LABEL": "Random Seed",
      "NAME": "mat_seed",
      "TYPE": "float",
      "MIN": 0.0,
      "MAX": 10.0,
      "DEFAULT": 0.0
    },
    {
      "LABEL": "Solo Circle",
      "NAME": "mat_solo",
      "TYPE": "long",
      "VALUES": [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12
      ],
      "LABELS": [
        "0 Centre",
        "1 Inner top",
        "2 Inner top-right",
        "3 Inner bottom-right",
        "4 Inner bottom",
        "5 Inner bottom-left",
        "6 Inner top-left",
        "7 Outer top",
        "8 Outer top-right",
        "9 Outer bottom-right",
        "10 Outer bottom",
        "11 Outer bottom-left",
        "12 Outer top-left"
      ],
      "DEFAULT": 0
    },
    {
      "LABEL": "Color Mode",
      "NAME": "mat_color_mode",
      "TYPE": "long",
      "VALUES": [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7
      ],
      "LABELS": [
        "Solid (Color 1)",
        "Head 1 -> Tail 2",
        "Palette per step",
        "Palette per chaser",
        "Palette per circle",
        "By ring (1 centre / 2 inner / 3 outer)",
        "Rainbow per circle",
        "Rainbow per step"
      ],
      "DEFAULT": 0
    },
    {
      "LABEL": "Color 1",
      "NAME": "mat_color_1",
      "TYPE": "color",
      "DEFAULT": [
        1.0,
        1.0,
        1.0,
        1.0
      ]
    },
    {
      "LABEL": "Color 2",
      "NAME": "mat_color_2",
      "TYPE": "color",
      "DEFAULT": [
        1.0,
        0.0,
        0.2,
        1.0
      ]
    },
    {
      "LABEL": "Color 3",
      "NAME": "mat_color_3",
      "TYPE": "color",
      "DEFAULT": [
        0.0,
        0.4,
        1.0,
        1.0
      ]
    },
    {
      "LABEL": "Color 4",
      "NAME": "mat_color_4",
      "TYPE": "color",
      "DEFAULT": [
        1.0,
        0.6,
        0.0,
        1.0
      ]
    },
    {
      "LABEL": "Palette Size",
      "NAME": "mat_pal_size",
      "TYPE": "float",
      "MIN": 1.0,
      "MAX": 4.0,
      "DEFAULT": 2.0
    },
    {
      "LABEL": "Hue Offset",
      "NAME": "mat_hue_offset",
      "TYPE": "float",
      "MIN": 0.0,
      "MAX": 1.0,
      "DEFAULT": 0.0
    },
    {
      "LABEL": "Hue Step",
      "NAME": "mat_hue_step",
      "TYPE": "float",
      "MIN": 0.0,
      "MAX": 0.5,
      "DEFAULT": 0.08
    },
    {
      "LABEL": "Hue Drift",
      "NAME": "mat_hue_drift",
      "TYPE": "float",
      "MIN": -1.0,
      "MAX": 1.0,
      "DEFAULT": 0.0
    },
    {
      "LABEL": "Saturation",
      "NAME": "mat_saturation",
      "TYPE": "float",
      "MIN": 0.0,
      "MAX": 1.0,
      "DEFAULT": 1.0
    },
    {
      "LABEL": "Background",
      "NAME": "mat_bg",
      "TYPE": "color",
      "DEFAULT": [
        0.0,
        0.0,
        0.0,
        1.0
      ]
    },
    {
      "LABEL": "Master",
      "NAME": "mat_master",
      "TYPE": "float",
      "MIN": 0.0,
      "MAX": 1.0,
      "DEFAULT": 1.0
    },
    {
      "LABEL": "Fill Radius (mm)",
      "NAME": "mat_radius",
      "TYPE": "float",
      "MIN": 5.0,
      "MAX": 32.5,
      "DEFAULT": 32.0
    },
    {
      "LABEL": "Rings",
      "NAME": "mat_rings",
      "TYPE": "long",
      "VALUES": [
        0,
        1,
        2
      ],
      "LABELS": [
        "Both rings",
        "Inner ring only",
        "Outer ring only"
      ],
      "DEFAULT": 0
    },
    {
      "LABEL": "Small Circles",
      "NAME": "mat_small",
      "TYPE": "long",
      "VALUES": [
        0,
        1,
        2
      ],
      "LABELS": [
        "Follow parent",
        "Off",
        "Always on"
      ],
      "DEFAULT": 0
    },
    {
      "LABEL": "Small Circles Color",
      "NAME": "mat_small_color",
      "TYPE": "color",
      "DEFAULT": [
        1.0,
        1.0,
        1.0,
        1.0
      ]
    },
    {
      "LABEL": "Show Guides",
      "NAME": "mat_guides",
      "TYPE": "bool",
      "DEFAULT": false
    },
    {
      "LABEL": "Offset X (mm)",
      "NAME": "mat_offset_x",
      "TYPE": "float",
      "MIN": -20.0,
      "MAX": 20.0,
      "DEFAULT": 0.0
    },
    {
      "LABEL": "Offset Y (mm)",
      "NAME": "mat_offset_y",
      "TYPE": "float",
      "MIN": -20.0,
      "MAX": 20.0,
      "DEFAULT": 0.0
    },
    {
      "LABEL": "Scale",
      "NAME": "mat_scale",
      "TYPE": "float",
      "MIN": 0.8,
      "MAX": 1.2,
      "DEFAULT": 1.0
    },
    {
      "LABEL": "Keep Aspect",
      "NAME": "mat_keep_aspect",
      "TYPE": "bool",
      "DEFAULT": true
    }
  ]
}*/

// ---------------------------------------------------------------------------
// Geometry, taken from FruitOfLifeMapping.svg (page 285.15958 x 320.00018 mm)
// 13 circles on a 60-degree lattice, pitch 65 mm, centred on the page.
// Each circle = two concentric LED rings (r 23.55 and 29.50 mm).
// Five outer circles also carry a small ring (r 9.93 mm); the bottom one doesn't.
// ---------------------------------------------------------------------------
#define PAGE_W   285.15958
#define PAGE_H   320.00018
#define PITCH    65.0
#define R_INNER  23.55172
#define R_OUTER  29.50234
#define R_SMALL  9.92835
#define R_SPLIT  26.52703   // halfway between inner and outer ring
#define R_SMZONE 16.74      // halfway between small ring and inner ring
#define PI_3     1.04719755
#define MAX_AGE  24

float fol_hash(float n) { return fract(sin(n * 12.9898 + 78.233) * 43758.5453); }

vec3 fol_hsv(float h) {
    vec3 p = abs(fract(vec3(h) + vec3(1.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
    return clamp(p - 1.0, 0.0, 1.0);
}

// palette: Color 1..4, cycling over the first 'Palette Size' entries
vec3 fol_pal(float i) {
    float n = clamp(floor(mat_pal_size + 0.5), 1.0, 4.0);
    float m = mod(floor(i + 0.5), n);
    return m < 0.5 ? mat_color_1.rgb : (m < 1.5 ? mat_color_2.rgb : (m < 2.5 ? mat_color_3.rgb : mat_color_4.rgb));
}

vec3 fol_rainbow(float h) {
    return mix(vec3(1.0), fol_hsv(h + mat_hue_offset + TIME * mat_hue_drift), mat_saturation);
}

// level shape: 'size' steps at full, then a 'trail' step long fade
float fol_fade(float age) {
    float sz = max(mat_size, 1.0);
    if (age < sz) return 1.0;
    if (mat_trail < 0.001) return 0.0;
    return pow(clamp(1.0 - (age - sz) / mat_trail, 0.0, 1.0), mat_curve);
}

float fol_head(float s, float N) {
    if (mat_pingpong && N > 1.5) {
        float P = 2.0 * N - 2.0;
        float m = mod(s, P);
        return m < N ? m : P - m;
    }
    return mod(s, N);
}

// step-based chase. returns (level, age, step that lit it, chaser index)
vec4 fol_steps(float slot, float N, float phase, bool rnd) {
    float s0 = floor(phase);
    float f  = phase - s0;
    float heads = mat_pingpong ? 1.0 : clamp(floor(mat_heads + 0.5), 1.0, 4.0);
    float span = max(mat_size, 1.0) + mat_trail + 1.0;
    vec4 best = vec4(0.0, 0.0, s0, 0.0);
    for (int i = 0; i < MAX_AGE; i++) {
        float fi = float(i);
        if (fi > span) break;
        float s = s0 - fi;
        bool hit = false;
        float hj = 0.0;
        for (int j = 0; j < 4; j++) {
            float fj = float(j);
            if (fj < heads) {
                if (rnd) {
                    float h = floor(fol_hash(s * 4.0 + fj + mat_seed * 97.0) * N);
                    if (!hit && abs(slot - h) < 0.5) { hit = true; hj = fj; }
                } else {
                    float rel = mod(slot - fol_head(s, N), N);
                    float target = floor(fj * N / heads + 0.5);
                    if (!hit && abs(rel - target) < 0.5) { hit = true; hj = fj; }
                }
            }
        }
        if (hit) {
            float age = fi + f;
            float l = fol_fade(age);
            if (l > best.x) best = vec4(l, age, s, hj);
        }
    }
    return best;
}

// continuous linear sweep across the piece. pos = circle centre (mm, y up, from piece centre)
vec4 fol_sweep(vec2 pos, float phase) {
    float a = radians(mat_angle);
    vec2 dir = vec2(cos(a), sin(a));
    if (mat_reverse) dir = -dir;
    float proj = dot(pos, dir) / (PITCH * 0.5);   // -4 .. 4 steps
    float N = 11.0;                               // -5 .. 5 plus one empty step
    float age;
    if (mat_pingpong) {
        float m = mod(phase, 2.0 * (N - 1.0));
        float h = (m < N - 1.0 ? m : 2.0 * (N - 1.0) - m) - 5.0;
        age = abs(h - proj) * 2.0;
    } else {
        age = mod(phase, N) - 5.0 - proj;
        if (age < 0.0) age += N;
    }
    return vec4(fol_fade(age), age, floor((phase - age) / N), 0.0);
}

// mm = SVG page coordinates in millimetres (origin top-left, y down)
vec4 fruitOfLife(vec2 mm, float phase) {
    vec2 pc = vec2(PAGE_W, PAGE_H) * 0.5;
    mm = pc + (mm - pc - vec2(mat_offset_x, -mat_offset_y)) / mat_scale;

    // --- which circle is this pixel in? (polar snap to the 60-degree lattice)
    vec2 d = mm - pc;
    float ring = clamp(floor(length(d) / PITCH + 0.5), 0.0, 2.0);
    float k = mod(floor(atan(d.x, -d.y) / PI_3 + 0.5), 6.0);  // 0 = top, clockwise
    if (ring < 0.5) k = 0.0;
    vec2 c = ring * PITCH * vec2(sin(k * PI_3), -cos(k * PI_3));
    float ld = length(d - c);
    float id = ring < 0.5 ? 0.0 : (ring < 1.5 ? 1.0 + k : 7.0 + k);
    bool hasSmall = ring > 1.5 && abs(k - 3.0) > 0.5;
    bool inSmall  = hasSmall && ld < R_SMZONE;

    // --- is this pixel part of the lit area?
    bool inside = ld < mat_radius;
    if (inSmall) {
        if (mat_small == 1) inside = false;
    } else {
        if (mat_rings == 1 && ld >= R_SPLIT) inside = false;
        if (mat_rings == 2 && ld <  R_SPLIT) inside = false;
    }

    // --- chase level for this circle
    vec4 L = vec4(0.0);
    float N = 13.0;
    if (mat_mode == 0) {            // sequential 0..12
        float slot = id;
        if (mat_reverse) slot = 12.0 - slot;
        L = fol_steps(slot, 13.0, phase, false);
    } else if (mat_mode == 1) {     // rotate spokes (+ twist)
        N = 6.0;
        if (ring < 0.5) {
            L = mat_hub ? vec4(1.0, 0.0, floor(phase), 0.0) : vec4(0.0);
        } else {
            float slot = ring > 1.5 ? mod(k + floor(mat_twist + 0.5), 6.0) : k;
            if (mat_reverse) slot = mod(6.0 - slot, 6.0);
            L = fol_steps(slot, 6.0, phase, false);
        }
    } else if (mat_mode == 2) {     // radial: centre -> inner -> outer
        N = 3.0;
        float slot = mat_reverse ? 2.0 - ring : ring;
        L = fol_steps(slot, 3.0, phase, false);
    } else if (mat_mode == 3) {     // linear sweep
        N = 11.0;
        L = fol_sweep(vec2(c.x, -c.y), phase);
    } else if (mat_mode == 4) {     // random
        L = fol_steps(id, 13.0, phase, true);
    } else if (mat_mode == 5) {     // solo (mapping test)
        L = vec4(abs(id - float(mat_solo)) < 0.5 ? 1.0 : 0.0, 0.0, 0.0, 0.0);
    } else {                        // all on
        L = vec4(1.0, 0.0, 0.0, 0.0);
    }
    if (inSmall && mat_small == 2) L = vec4(1.0, 0.0, 0.0, 0.0);

    // --- colour
    vec3 col = mat_color_1.rgb;
    float span = max(mat_size, 1.0) + mat_trail;
    if      (mat_color_mode == 1) col = mix(mat_color_1.rgb, mat_color_2.rgb, clamp(L.y / span, 0.0, 1.0));
    else if (mat_color_mode == 2) col = fol_pal(L.z);                       // palette per step
    else if (mat_color_mode == 3) col = fol_pal(L.w);                       // palette per chaser
    else if (mat_color_mode == 4) col = fol_pal(id);                        // palette per circle
    else if (mat_color_mode == 5) col = ring < 0.5 ? mat_color_1.rgb : (ring < 1.5 ? mat_color_2.rgb : mat_color_3.rgb);
    else if (mat_color_mode == 6) col = fol_rainbow(id / 13.0);             // rainbow per circle
    else if (mat_color_mode == 7) col = fol_rainbow(L.z * mat_hue_step);    // rainbow per step
    if (inSmall && mat_small == 2) col = mat_small_color.rgb;

    float lvl = inside ? L.x * mat_master : 0.0;
    vec3 rgb = mix(mat_bg.rgb * mat_bg.a, col, lvl);

    // --- optional guide overlay: the SVG ring outlines, for alignment
    if (mat_guides) {
        float w = 0.6;
        float g = step(abs(ld - R_INNER), w) + step(abs(ld - R_OUTER), w);
        if (hasSmall) g += step(abs(ld - R_SMALL), w);
        g = min(g, 1.0);
        float gf = step(abs(ld - mat_radius), 0.35) * 0.5;
        rgb = mix(rgb, vec3(1.0, 0.0, 1.0), max(g, gf));
    }
    return vec4(rgb, 1.0);
}

void main() {
    vec2 uv = isf_FragNormCoord;
    vec2 S = vec2(PAGE_W, PAGE_H);
    if (mat_keep_aspect) {
        float ra = RENDERSIZE.x / RENDERSIZE.y;
        float pa = PAGE_W / PAGE_H;
        S = ra > pa ? vec2(PAGE_H * ra, PAGE_H) : vec2(PAGE_W, PAGE_W / ra);
    }
    vec2 mm = vec2(PAGE_W * 0.5 + (uv.x - 0.5) * S.x, PAGE_H * 0.5 - (uv.y - 0.5) * S.y);
    gl_FragColor = fruitOfLife(mm, TIME * mat_speed);
}
