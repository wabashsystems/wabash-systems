// functions/admin/api/blog/delete.js
//
// Deletes a published blog post from GitHub:
//   1. Removes blog/{slug}.html
//   2. Strips the post card from blog/index.html
//   3. Removes the URL entry from sitemap.xml
//
// POST /admin/api/blog/delete
// Body: { slug: "my-post-slug" }

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// ── GitHub helpers (mirrors publish.js) ──────────────────────────────────

async function ghHeaders(env) {
  return {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'wabashsystems-delete-fn',
    'Content-Type': 'application/json',
  };
}

function ghContentsUrl(env, path) {
  const owner = env.GITHUB_OWNER || 'wabashsystems';
  const repo  = env.GITHUB_REPO  || 'wabash-systems';
  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(path)}`;
}

function b64decode(s) {
  const bin = atob(s.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function b64encode(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function ghReadFile(env, path) {
  const branch = env.GITHUB_BRANCH || 'main';
  const res = await fetch(`${ghContentsUrl(env, path)}?ref=${encodeURIComponent(branch)}`, {
    headers: await ghHeaders(env),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub read ${path}: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return { sha: j.sha, content: b64decode(j.content) };
}

async function ghDeleteFile(env, path, sha, message) {
  const branch = env.GITHUB_BRANCH || 'main';
  const res = await fetch(ghContentsUrl(env, path), {
    method: 'DELETE',
    headers: await ghHeaders(env),
    body: JSON.stringify({ message, sha, branch }),
  });
  if (!res.ok) throw new Error(`GitHub delete ${path}: ${res.status} ${await res.text()}`);
}

async function ghWriteFile(env, path, content, message, sha) {
  const branch = env.GITHUB_BRANCH || 'main';
  const res = await fetch(ghContentsUrl(env, path), {
    method: 'PUT',
    headers: await ghHeaders(env),
    body: JSON.stringify({ message, content: b64encode(content), branch, sha }),
  });
  if (!res.ok) throw new Error(`GitHub write ${path}: ${res.status} ${await res.text()}`);
}

// ── Index / sitemap cleanup ───────────────────────────────────────────────

function removeCardFromIndex(html, slug) {
  // Cards injected by publish.js look like:
  //   <article class="post-card">...<a href="/blog/{slug}">...</article>
  // Strip the whole <article> block that contains a link to this slug.
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `\\s*<article class="post-card">[^]*?href="/blog/${escaped}"[^]*?</article>`,
    'g'
  );
  return html.replace(re, '');
}

function removeFromSitemap(xml, slug) {
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `\\s*<url>\\s*<loc>https://www\\.wabashsystems\\.com/blog/${escaped}</loc>[^]*?</url>`,
    'g'
  );
  return xml.replace(re, '');
}

// ── Handler ───────────────────────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.GITHUB_TOKEN) {
    return json({ error: 'GITHUB_TOKEN env var not configured.' }, 503);
  }

  let payload;
  try { payload = await request.json(); }
  catch { return json({ error: 'Invalid JSON body.' }, 400); }

  const { slug } = payload || {};

  if (!slug || !SLUG_RE.test(slug)) {
    return json({ error: 'Invalid or missing slug.' }, 400);
  }

  try {
    // 1. Delete the post file (required — fail if missing)
    const postFile = await ghReadFile(env, `blog/${slug}.html`);
    if (!postFile) {
      return json({ error: `Post not found: blog/${slug}.html` }, 404);
    }
    await ghDeleteFile(env, `blog/${slug}.html`, postFile.sha, `blog: delete ${slug}`);

    // 2. Remove card from blog/index.html (best-effort)
    const index = await ghReadFile(env, 'blog/index.html');
    if (index) {
      const newIndex = removeCardFromIndex(index.content, slug);
      if (newIndex !== index.content) {
        await ghWriteFile(env, 'blog/index.html', newIndex, `blog: remove index card for ${slug}`, index.sha);
      }
    }

    // 3. Remove from sitemap.xml (best-effort)
    const sitemap = await ghReadFile(env, 'sitemap.xml');
    if (sitemap) {
      const newSitemap = removeFromSitemap(sitemap.content, slug);
      if (newSitemap !== sitemap.content) {
        await ghWriteFile(env, 'sitemap.xml', newSitemap, `sitemap: remove ${slug}`, sitemap.sha);
      }
    }
  } catch (err) {
    return json({ error: `GitHub operation failed: ${err.message}` }, 500);
  }

  return json({ ok: true, slug });
}
