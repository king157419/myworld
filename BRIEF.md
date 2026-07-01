# Engineering Brief — Image→3D, Music, Stair Collision & Camera Focus

> Produced by a research workflow (4 agents, web-verified) on 2026-06-30 to drive this round of fixes.
> Stored for the record; see DECISIONS.md for what we actually adopted.

## 1. Image→3D pipeline (honest verdict)

The offline-at-runtime rule does **not** forbid a hosted authoring API — you generate a GLB at dev
time, commit it, ship it as a static file (same exception as the CC0 audio). The real filter is the
**output licence**, not the API call.

- **Hosted, no local GPU:** Meshy / Tripo free image-to-3D → download GLB. Output is **CC BY 4.0**
  (attribution required, made public). Lowest friction, best textures.
- **Pure-offline fallback:** **TripoSR** local — **MIT** (redistributable, no attribution), has a
  **CPU mode** (slow, minutes), ~6–8 GB VRAM on GPU. Draft quality, no PBR; fine for stylised props.
- **If ≥16 GB NVIDIA VRAM:** Microsoft **TRELLIS** or **Stable Fast 3D** locally (clean licences).
- **Every** AI mesh needs Blender cleanup (decimate, fix scale/origin, simplify materials) before
  it's R3F-ready — this *is* the "modify-don't-copy" step.

**Why "just call a free API" never panned out:** the clean-licensed *local* models need a GPU we
can't assume; the no-GPU *hosted* tools attach CC-BY attribution and make outputs public; a couple
(Hunyuan3D, FLUX.1-dev, Zero123) carry licence landmines. None of it is one-line.

Key URLs: Meshy https://www.meshy.ai/pricing · TripoSR https://github.com/VAST-AI-Research/TripoSR ·
TRELLIS https://github.com/microsoft/TRELLIS · Stable Fast 3D https://github.com/Stability-AI/stable-fast-3d

## 2. Public-domain music to bundle (verified direct URLs)

All `.ogg` (native browser decode). Wikimedia rate-limits batch downloads (429) — UA + spacing.

| # | Piece | Performer | Licence | Direct URL |
|---|---|---|---|---|
| 1 | Chopin Nocturne Op.9 No.1 | Vadim Chaimovich | **CC0** | upload.wikimedia.org/wikipedia/commons/b/bf/Chopin%2C_Nocturne_No._1_in_B_Flat_Minor%2C_Op._9.ogg |
| 2 | Chopin Nocturne Op.9 No.2 | Peter Johnston | **CC0** | (already have Levy/Musopen take) |
| 3 | Chopin Nocturne C# minor Op.posth | Aaron Dunn | **CC0** | upload.wikimedia.org/wikipedia/commons/1/12/Chopin%2C_Nocturne_in_C-sharp_minor%2C_Op._Posth.ogg |
| 4 | Satie Gymnopédie No.1 | Robin Alciatore | **PD** | upload.wikimedia.org/wikipedia/commons/9/90/Erik_Satie_-_gymnopedies_-_la_1_ere._lent_et_douloureux.ogg |
| 5 | Lake-shore water ambience | Dsw4 | **PD** | (already have water-ambient.ogg) |

Rejected: Clair de Lune .opus (unknown recording provenance), Sounding_waves.ogg (CC-BY-SA + synth).

## 3. Stair collision + camera-focus recipes

### Stairs (root cause + fix)
Both bugs come from a per-frame support-height query that is **unbounded vertically** and **falls
back to the water circle** when you leave the union. Fix:
- **Invisible linear ramp over visible steps.** `t = clamp((z-z0)/(z1-z0),0,1); y = t*H`. Monotonic
  in z → no multi-step teleport, ever. Collision = the ramp; visible steps are decoration on it.
- **Nearest-region clamp** (never radial-project to the court when you step off the deck edge).
- **Damp only vertical** eye height: `y = damp(y, target, 12, dt)`; XZ stays exact.
- Substep horizontal motion to ≤ tread depth to kill fast-move tunnelling.

### Camera focus (frame the object)
1. World bounds: `Box3().setFromObject(obj).getBoundingSphere()` → center, radius.
2. **Fit distance:** `d = radius / sin(fov_v/2) * fill` (use **sin**, not tan). Clamp to hFov for
   portrait: `hFov = 2*atan(tan(vFov/2)*aspect)`, take `max(dV,dH)`. fill 1.2–1.4.
3. Pose: `pos = center + dir.normalize()*d`, always `lookAt(center)`. dir = current view dir
   (least disorienting) or a fixed hero angle.
4. Tween in AND out: damp position and the look-point (damp the look-point too or the gaze snaps).

## Honest blockers
- GPU wall for clean-licence local image→3D; only TripoSR/SD-1.5 CPU actually run no-GPU (slow).
- Free-tier mesh licence (CC-BY, made public) is the catch, not the API.
- AI meshes always need Blender cleanup.
