# NeuroBat Lab Website — Maintenance Playbook

Static site for michaelyartsev.com. No build step: plain HTML/CSS/JS, deployed via GitHub Pages on every push to `main`. Brand: "Neuroscience of Natural Intelligence" · tagline "Nature ran the experiments. We study the neural solutions."

## Local preview

```bash
ruby serve.rb
```
Serves at http://localhost:8317 (html no-cache, assets cached; the asset caching is REQUIRED for video range-streaming). If the port is stuck: `lsof -ti :8317 | xargs kill`.

## Publishing a change

```bash
git add -A && git commit -m "describe the change" && git push
```
GitHub Pages redeploys automatically in about a minute. To undo the last change: `git revert HEAD && git push`.

## House style (non-negotiable)

- NO em dashes (—) anywhere. Use commas, colons, periods, or middots (·). En dashes only for year ranges (2019–21).
- Headings are sentence case with a period ("Tools that follow the behavior.").
- Citations: `Author et al., Full Journal Name, Year →` with comma before year, full journal names, `.tl-cite` class (add `.block` for stacked rows).
- Palette: navy #080b14 bg, ivory #EDE9DF, gold #C9A227 / bright #E8C34A. Dimension colors: spatial sky blue #8FB4E8 (landscape terrain bakes deep blue #5B8AD6), social green #7FD49A, communication violet #B49AE0, motor ember #E07B4A. Gold #E8C34A is reserved for founding/brand accents.
- Fonts: Fraunces (display), Inter (body), JetBrains Mono (labels). Body has `font-optical-sizing: none` on purpose.
- Never present the research as separate pillars: one behavior, many dimensions.

## Cache stamping (do this after EVERY css/js edit)

All CSS/JS URLs carry `?v=<unix-timestamp>`. After editing main.css or any js, re-stamp every html file:

```python
import re, time, glob
V = str(int(time.time()))
for f in glob.glob('*.html'):
    h = open(f).read()
    h = re.sub(r'(assets/(?:css|js)/[a-z]+\.(?:css|js))\?v=\d+', r'\1?v=' + V, h)
    open(f, 'w').write(h)
```

For images/videos: the URL must change when the file changes (rename the file, or bump its `?v=` where one exists; main.js contains a stamped video URL too).

## Media gotchas (hard-won)

- Videos MUST be faststart (moov atom at file start) and video-only (no audio track, even silent). AVFoundation exports need `shouldOptimizeForNetworkUse = true`. Verify: byte-scan for `moov` near offset 32 and absence of `mp4a`/`soun`. A silent audio track or tail-moov breaks Chromium playback entirely.
- Verify with real playback (headless Chromium sampling `video.currentTime` twice), not with curl range requests, which can pass while playback fails.
- Photos: optimize to ≤2000px longest side, JPEG quality ~80, into `assets/img/`. Keep multi-MB originals OUT of the repo (move to the parent folder).
- If a video "stops working" in one browser while file/server/headless checks all pass: the viewer's long-running browser has a wedged media process; a FULL quit and relaunch fixes it. The auto-video JS surfaces native controls after repeated refused plays, so this failure mode shows a play button, not a frozen image.
- Photo credits: bat photography © Kim Taylor / Warren Photographic (footer credit). Do not add third-party photos without confirmed rights.

## Common recipes

**Add a news item** (news.html): reverse-chronological. Insert at top of the year block:
```html
<div class="tl-item" data-reveal>
  <p class="d">Month D, YYYY</p>
  <h3>Headline (optionally an <a> to a paper/announcement)</h3>
  <p>New people: ... Welcome, X! / Recognition: ... / Publication: ...</p>
</div>
```

**Add a publication** (publications.html): insert a `pub-row` in the right year section (create the year `<h2 class="pub-year">` if new). Include a one-sentence hover excerpt grounded in the paper's abstract:
```html
<article class="pub-row" data-reveal>
  <span class="pub-journal j-nature">Journal</span>
  <div>
    <p class="t"><a href="URL" target="_blank" rel="noopener">Title</a></p>
    <p class="a">Authors, <strong>Michael M. Yartsev</strong></p>
    <p class="pub-sub">One-sentence excerpt of what the paper shows.</p>
  </div>
</article>
```
Journal pill classes: j-nature, j-science, j-cell, j-other.

**Add a person** (people.html + person-<slug>.html): copy an existing `person` card and person page as template. Portrait to `assets/img/<name>.jpg` (square-ish, ~800px). Team order: Yuka first among staff.

**Move someone to alumni** (people.html): alumni entries are unlinked, format `Name · Role: YYYY–YYYY` (en dash).

**Home Roost** (album-home-roost.html) is the evergreen everyday-lab-life album: photos dropped into `../album-originals/Everyday_Lab_Life/` get APPENDED with the next numbers (subtitle reads 'N photos · a tiny fraction of the everyday life we share in the lab') (NEVER renumber existing photos once pushed; bump counts in the album page and lab-life tile).

**Add a Lab Life album**: originals go to `../album-originals/<year>-<event>/` (NEVER into the repo); optimize web copies into `assets/img/albums/<slug>/`, copy an album-*.html as template, add a tile in lab-life.html with photo count, and add a news item.

**Winding-road timelines** (research.html): TWO of them, 05 The Questions and 06 The Toolkit, sharing identical road geometry and node slots. Nodes + detail cards share sequential `data-i` within each `.ttl` container; main.js scopes all interaction per container (do not query `.ttl-node` globally). Each has a parallel `.ttl-mobile` list to keep in sync. The 2015 founding milestone is a `ttl-fnode` button (gold diamond, no behavioral color, no citation) present on both.

## Structure notes

- 28+ pages, shared nav/footer markup duplicated per page (edit all pages when changing nav/footer; footer logos row includes Berkeley Neuroscience SVG wordmark).
- Homepage simulation: assets/js/dims.js (canvas). Timeline interaction + video handling: assets/js/main.js.
- Anchors use `scroll-margin-top`. Reveal animations honor prefers-reduced-motion (that media query also forces visibility, useful for headless screenshots).
- Validate HTML after batch edits (python HTMLParser balance check) and always `assert old in s` before python string replacements.

## Deployment

- GitHub Pages from `main` branch root. Custom domain via `CNAME` file (added at DNS cutover).
- Old WordPress URL redirects live as meta-refresh stub pages (added at cutover).
- The old WordPress site remains on Pantheon as rollback until the new site is stable, then cancel Pantheon.
