import json, re, sys, html, pathlib
# Builds public/blog (posts, index, rss.xml) from content/blog/*.html.
# Each source file starts with a JSON comment: title, seo_title, description, kicker, read, order.
# Run: npm run build:blog   (then add the new URL to public/sitemap.xml and llms.txt)
src = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
DATE = "2026-10-22"; SITE = "https://mahjongers.com"
HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script defer data-website-id="dfid_NuT1rP5EwI86MnpsZ6DKM" data-domain="mahjongers.com" src="https://datafa.st/js/script.js"></script>
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <link rel="canonical" href="{url}">
  <meta name="theme-color" content="#F4F1EC">
  <meta property="og:type" content="{ogtype}">
  <meta property="og:site_name" content="Mahjongers">
  <meta property="og:title" content="{ogtitle}">
  <meta property="og:description" content="{desc}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{site}/assets/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{ogtitle}">
  <meta name="twitter:description" content="{desc}">
  <meta name="twitter:image" content="{site}/assets/og-image.jpg">
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="alternate" type="application/rss+xml" title="Mahjongers Blog" href="/blog/rss.xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/site.css?v=20261022">
  <script type="application/ld+json">
{ld}
  </script>
</head>
<body>
<div class="page">
  <div class="blob" style="top: -180px; left: -140px; width: 640px; height: 640px; background: radial-gradient(circle, rgba(238,110,60,0.45), transparent 65%); filter: blur(40px); animation: mj-blob-a 14s ease-in-out infinite;"></div>
  <div class="blob" style="top: 200px; right: -200px; width: 640px; height: 640px; background: radial-gradient(circle, rgba(52,168,110,0.4), transparent 65%); filter: blur(46px); animation: mj-blob-b 17s ease-in-out infinite;"></div>
  <header class="nav">
    <a class="logo" href="/">Mahjongers<em>.</em></a>
    <nav>
      <a class="nav-link" href="/blog">Blog</a>
      <a class="nav-link" href="/social-media">Social media</a>
      <a class="cta-gradient" href="/social-media#plans">See plans</a>
    </nav>
  </header>
"""
FOOT = """  <footer class="footer">
    <div class="logo" style="font-size: 18px;">Mahjongers<em>.</em></div>
    <div class="made">Made with love for the mahjong table · © 2026 Mahjongers</div>
    <div class="footer-links"><a href="/">Home</a><a href="/blog">Blog</a><a href="/social-media">Social media</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div>
  </footer>
</div>
</body>
</html>
"""
CTA = """      <aside class="post-cta">
        <h2>Want this done for you?</h2>
        <p>Mahjongers Social runs your Instagram, Facebook and TikTok — posts, Reels, Stories and DMs. Plans from $350/month.</p>
        <a class="cta-gradient" href="/social-media">See social media plans</a>
      </aside>
"""
ORG = {"@type": "Organization", "@id": f"{SITE}/#organization", "name": "Mahjongers", "url": f"{SITE}/", "logo": f"{SITE}/assets/favicon.svg"}
posts = []
for f in sorted(src.glob("*.html")):
    raw = f.read_text()
    meta = json.loads(re.match(r"<!--(.*?)-->", raw, re.S).group(1))
    body = raw.split("-->", 1)[1].strip()
    slug = f.stem; url = f"{SITE}/blog/{slug}"
    meta.update(slug=slug, url=url)
    words = len(re.sub(r"<[^>]+>", " ", body).split())
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "BlogPosting", "headline": meta["title"], "description": meta["description"], "url": url,
         "mainEntityOfPage": url, "image": f"{SITE}/assets/og-image.jpg", "datePublished": DATE, "dateModified": DATE,
         "wordCount": words, "author": {"@type": "Organization", "name": "Mahjongers"}, "publisher": ORG, "inLanguage": "en"},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE}/"},
            {"@type": "ListItem", "position": 2, "name": "Blog", "item": f"{SITE}/blog"},
            {"@type": "ListItem", "position": 3, "name": meta["title"], "item": url}]}]}
    page = HEAD.format(title=html.escape(meta["seo_title"]) + " — Mahjongers", desc=html.escape(meta["description"]), url=url,
                       ogtype="article", ogtitle=html.escape(meta["title"]), site=SITE, ld=json.dumps(ld, indent=2, ensure_ascii=False))
    page += f"""  <main class="section">
    <article class="prose glass">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/blog">Blog</a> › {html.escape(meta["kicker"])}</nav>
      <h1>{html.escape(meta["title"])}</h1>
      <p class="post-meta">By the Mahjongers team · <time datetime="{DATE}">22 October 2026</time> · {meta["read"]}</p>
{body}
{CTA}    </article>
  </main>
""" + FOOT
    (out / f"{slug}.html").write_text(page)
    posts.append(meta)
posts.sort(key=lambda m: m["order"])
cards = "\n".join(f"""        <a class="post-card glass" href="/blog/{m['slug']}">
          <div class="kicker">{html.escape(m['kicker'])} · {m['read']}</div>
          <h2>{html.escape(m['title'])}</h2>
          <p>{html.escape(m['description'])}</p>
          <span class="more">Read the guide →</span>
        </a>""" for m in posts)
ld = {"@context": "https://schema.org", "@type": "Blog", "name": "Mahjongers Blog", "url": f"{SITE}/blog", "publisher": ORG,
      "blogPost": [{"@type": "BlogPosting", "headline": m["title"], "url": m["url"], "datePublished": DATE} for m in posts]}
idx = HEAD.format(title="Mahjongers Blog — Marketing &amp; Business Guides for Mahjong Teachers", desc="Practical guides for mahjong teachers, hosts and shops: filling classes, social media ideas, pricing and starting a mahjong business.",
                  url=f"{SITE}/blog", ogtype="website", ogtitle="Mahjongers Blog", site=SITE, ld=json.dumps(ld, indent=2, ensure_ascii=False))
idx += f"""  <main class="section">
    <div class="section-inner">
      <div class="section-head">
        <div class="badge green">The Mahjongers Blog</div>
        <h1>Grow your mahjong table</h1>
        <p class="lede">Practical guides for mahjong teachers, hosts and shops — from filling classes to running your social media.</p>
      </div>
      <div class="post-list">
{cards}
      </div>
    </div>
  </main>
""" + FOOT
(out / "index.html").write_text(idx)
items = "\n".join(f"""    <item><title>{html.escape(m['title'])}</title><link>{m['url']}</link><guid>{m['url']}</guid><pubDate>Thu, 22 Oct 2026 00:00:00 GMT</pubDate><description>{html.escape(m['description'])}</description></item>""" for m in posts)
(out / "rss.xml").write_text(f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Mahjongers Blog</title>
    <link>{SITE}/blog</link>
    <description>Guides for mahjong teachers, hosts and shops.</description>
    <language>en</language>
{items}
  </channel>
</rss>
""")
print("\n".join(m["slug"] for m in posts))
