// functions/admin/api/blog/list.js
//
// Reads blog/index.html from GitHub and parses out post card metadata
// (slug, title, category, date display) so the admin can backfill the
// published posts list without reading every individual post file.
//
// GET /admin/api/blog/list

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

async function ghHeaders(env) {
  return {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'wabashsystems-list-fn',
  };
}

function b64decode(s) {
  const bin = atob(s.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// Parse post cards from blog/index.html.
// Card structure from publish.js:
//   <article class="post-card">
//     <div class="post-info">
//       <div class="post-meta">
//         <span class="post-cat">{category}</span>
//         <span>{date display}</span>
//       </div>
//       <h2 class="post-title"><a href="/blog/{slug}">{title}</a></h2>
//       ...
//     </div>
//   </article>
function parsePostCards(html) {
  const posts = [];
  // Split on article boundaries
  const articleRe = /<article class="post-card">([\s\S]*?)<\/article>/g;
  let m;
  while ((m = articleRe.exec(html)) !== null) {
    const block = m[1];

    // Slug + title from <h2 class="post-title"><a href="/blog/{slug}">{title}</a></h2>
    const titleM = block.match(/class="post-title"[^>]*>[\s\S]*?href="\/blog\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!titleM) continue;
    const slug  = titleM[1].trim();
    const title = titleM[2].replace(/<[^>]+>/g, '').trim();

    // Category from <span class="post-cat">{category}</span>
    const catM = block.match(/class="post-cat"[^>]*>([\s\S]*?)<\/span>/);
    const category = catM ? catM[1].replace(/<[^>]+>/g, '').trim() : '';

    // Date — the second <span> inside post-meta (after the category span)
    const metaM = block.match(/class="post-meta"[^>]*>([\s\S]*?)<\/div>/);
    let date = '';
    if (metaM) {
      const spans = [...metaM[1].matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)];
      if (spans.length >= 2) {
        date = spans[1][1].replace(/<[^>]+>/g, '').trim();
      }
    }

    posts.push({ slug, title, category, date });
  }
  return posts;
}

export async function onRequestGet(context) {
  const { env } = context;

  if (!env.GITHUB_TOKEN) {
    return json({ error: 'GITHUB_TOKEN env var not configured.' }, 503);
  }

  const owner  = env.GITHUB_OWNER  || 'wabashsystems';
  const repo   = env.GITHUB_REPO   || 'wabash-systems';
  const branch = env.GITHUB_BRANCH || 'main';
  const url    = `https://api.github.com/repos/${owner}/${repo}/contents/blog/index.html?ref=${encodeURIComponent(branch)}`;

  let html;
  try {
    const res = await fetch(url, { headers: await ghHeaders(env) });
    if (res.status === 404) return json({ posts: [] });
    if (!res.ok) throw new Error(`GitHub read blog/index.html: ${res.status} ${await res.text()}`);
    const j = await res.json();
    html = b64decode(j.content);
  } catch (err) {
    return json({ error: err.message }, 500);
  }

  const posts = parsePostCards(html);
  return json({ posts });
}
