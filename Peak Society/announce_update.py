import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Add viewAnnouncementModal below viewPostModal
announcement_modal = """
  <!-- View Announcement Modal -->
  <div class="modal-backdrop" id="viewAnnouncementModal" role="dialog" aria-modal="true" aria-label="View announcement" hidden>
    <div class="modal modal-wide">
      <button class="modal-close" id="viewAnnouncementClose" aria-label="Close">&times;</button>
      <div class="modal-body" id="viewAnnouncementBody">
        <!-- populated by JS -->
      </div>
    </div>
  </div>
"""

html = html.replace(
    '  <!-- Report Post Modal -->',
    announcement_modal + '\n  <!-- Report Post Modal -->'
)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# 2. Add showAllAnnouncements state and render updates
render_func_find = "const renderAnnouncements = () => {"
render_func_replace = """let showAllAnnouncements = false;
const stripRichHTML = (html) => {
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};

const renderAnnouncements = () => {"""

js = js.replace(render_func_find, render_func_replace)

old_render_logic = """  if (!announcements.length) {
    list.innerHTML = '<p style="color:var(--mid);text-align:center;padding:3rem 0;">No announcements yet. Check back soon!</p>';
    return;
  }
  list.innerHTML = announcements.slice().reverse().map(a => {
    const author = users.find(u => u.username === a.authorId);
    const date = new Date(a.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const userRole = author && author.role === 'owner' ? 'Owner' : 'Staff';
    return `
      <div class="announcement-card reveal">
        <div class="announcement-tag">ANNOUNCEMENT</div>
        <div class="announcement-title">${sanitize(a.subject)}</div>
        <div class="announcement-body">${sanitizeHTML(a.body)}</div>
        <div class="announcement-meta">
          <span class="announcement-author-badge">${userRole}</span>
          <span>${date}</span>
        </div>
      </div>
    `;
  }).join('');
  list.querySelectorAll('.announcement-card').forEach(el => revealObserver.observe(el));"""

new_render_logic = """  if (!announcements.length) {
    list.innerHTML = '<p style="color:var(--mid);text-align:center;padding:3rem 0;">No announcements yet. Check back soon!</p>';
    return;
  }

  const reversed = announcements.slice().reverse();
  const visible = showAllAnnouncements ? reversed : reversed.slice(0, 3);
  
  let htmlOutput = visible.map(a => {
    const author = users.find(u => u.username === a.authorId);
    const date = new Date(a.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const userRole = author && author.role === 'owner' ? 'Owner' : 'Staff';
    
    const plainText = stripRichHTML(a.body);
    const isTruncated = plainText.length > 200;
    const previewBody = isTruncated ? plainText.slice(0, 200) + '...' : plainText;

    return `
      <div class="announcement-card reveal" style="cursor: pointer;" onclick="openViewAnnouncement('${sanitize(a.id)}')">
        <div class="announcement-tag">ANNOUNCEMENT</div>
        <div class="announcement-title">${sanitize(a.subject)}</div>
        <div class="announcement-body default-text-preview" style="color:var(--mid); font-size:1rem; margin-bottom:1rem; line-height:1.6;">${sanitize(previewBody)}</div>
        <div class="announcement-meta">
          <span class="announcement-author-badge">${userRole}</span>
          <span>${date}</span>
        </div>
      </div>
    `;
  }).join('');

  if (!showAllAnnouncements && reversed.length > 3) {
    htmlOutput += `
      <div style="text-align:center; padding: 1rem 0;">
        <button class="btn-secondary" onclick="showAllAnnouncements = true; renderAnnouncements();">View More Announcements</button>
      </div>
    `;
  }

  list.innerHTML = htmlOutput;
  list.querySelectorAll('.announcement-card').forEach(el => revealObserver.observe(el));"""

js = js.replace(old_render_logic, new_render_logic)

# 3. Add openViewAnnouncement function and close mapping
modal_helpers = "setupModalClose('viewPostModal', 'viewPostClose');"
modal_helpers_new = "setupModalClose('viewPostModal', 'viewPostClose');\nsetupModalClose('viewAnnouncementModal', 'viewAnnouncementClose');"
js = js.replace(modal_helpers, modal_helpers_new)

view_post_fn = "const openViewPost = (postId) => {"
view_announce_fn = """window.openViewAnnouncement = (id) => {
  const announcements = Store.get('announcements');
  const a = announcements.find(x => x.id === id);
  if (!a) return;
  const users = Store.get('users');
  const author = users.find(u => u.username === a.authorId);
  const date = new Date(a.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const userRole = author && author.role === 'owner' ? 'Owner' : 'Staff';

  document.getElementById('viewAnnouncementBody').innerHTML = `
    <div class="announcement-tag" style="margin-bottom:1rem;">ANNOUNCEMENT</div>
    <h2 style="font-size:1.6rem;margin-bottom:1rem;color:var(--white);">${sanitize(a.subject)}</h2>
    <div class="post-header" style="margin-bottom:1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem;">
      <span class="announcement-author-badge" style="margin-right:0.5rem;font-size:0.9rem;">${userRole}</span>
      <span class="post-date" style="font-size:0.95rem;">${date}</span>
    </div>
    <div style="color:var(--off-white);line-height:1.7;font-size:1.05rem;" class="rich-content-render">${sanitizeHTML(a.body)}</div>
  `;
  openModal('viewAnnouncementModal');
};

const openViewPost = (postId) => {"""

js = js.replace(view_post_fn, view_announce_fn)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(js)
    
print("Successfully added truncated announcements.")
