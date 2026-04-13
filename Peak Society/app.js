/* ═══════════════════════════════════════════════
   PEAK SOCIETY — APP.JS
   Front-end logic: auth, forum, admin, channels
═══════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────
   SECURITY HELPERS
───────────────────────────────────────────── */
const sanitize = (str) => {
  const div = document.createElement('div');
  div.textContent = String(str).slice(0, 2000);
  return div.innerHTML;
};

const sanitizeHTML = (html) => {
  const allowedTags = ['b', 'strong', 'i', 'em', 'u', 'br', 'ul', 'ol', 'li', 'p', 'span'];
  const allowedAttrs = ['style'];
  const template = document.createElement('template');
  template.innerHTML = html;
  const clean = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (!allowedTags.includes(node.tagName.toLowerCase())) {
        node.replaceWith(document.createTextNode(node.textContent));
        return;
      }
      [...node.attributes].forEach(attr => {
        if (!allowedAttrs.includes(attr.name)) node.removeAttribute(attr.name);
      });
    }
    [...node.childNodes].forEach(clean);
  };
  [...template.content.childNodes].forEach(clean);
  const div = document.createElement('div');
  div.appendChild(template.content);
  return div.innerHTML;
};

const hashPassword = async (password) => {
  const enc = new TextEncoder().encode(password + 'ps_salt_2025');
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const csrfToken = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36);

// Initialize Supabase
const SUPABASE_URL = "https://mbulkzroidrpszxvknua.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_VIACP_4OHYSLMz32zmrWZQ_bBWHefKu";

let sbClient = null;
try {
  // Ensure the browser loaded window.supabase before app.js
  if (window.supabase) {
    sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase initialized successfully.");
  } else {
    console.error("Supabase SDK not found on window object. Is it loaded in index.html?");
  }
} catch (error) {
  console.error("Failed to initialize Supabase:", error);
}

/* ─────────────────────────────────────────────
   STATE — Supabase-backed store
───────────────────────────────────────────── */
const Store = (() => {
  const defaults = {
    users: [
      { id: 'u1', username: 'Owner', passwordHash: '98c0d4c37f52edefdd5c1764401cfd27b26f6bc6a788f04d63f05ccf4a7a15fe', role: 'owner', joined: '2024-01-01' },
      { id: 'u2', username: 'AdminUser', passwordHash: '86c1e9538c0dbc985825fe35b8e41ff64a363e1d310f57a0ea91e4101bce977e', role: 'admin', joined: '2024-03-15' },
      { id: 'u3', username: 'StaffMike', passwordHash: '0ef8d9349851ef8d44d31fecaf16cdd893d397afd29e9725084dfd6eea830af6', role: 'staff', joined: '2024-05-20' },
      { id: 'u4', username: 'CreatorJane', passwordHash: 'cfb6c3e06ba2b44251343efa1b5d4d683a850adbf77f2e588893a5fdba26581a', role: 'member', joined: '2024-07-01' },
    ],
    posts: [
      { id: 'p1', userId: 'u4', category: 'wins', title: 'Hit 10k subscribers in 60 days!', body: 'Started with zero knowledge, followed the niche tips from the resources channel, posted daily Shorts. The community kept me accountable. 10k is just the start!', likes: 42, comments: 8, date: '2025-06-10T10:00:00Z', likedBy: [] },
      { id: 'p2', userId: 'u3', category: 'questions', title: 'Best niche for 2025 Q3 — thoughts?', body: 'Looking for low-competition niches that still have high CPM. Motivation, finance, and productivity feel saturated. Any hidden gems?', likes: 18, comments: 15, date: '2025-06-12T14:30:00Z', likedBy: [] },
      { id: 'p3', userId: 'u4', category: 'tutorial-requests', title: 'Tutorial request: CapCut batch editing workflow', body: "Could you make a tutorial on how to use CapCut templates for batch-producing 10 Shorts at once? I've seen it mentioned in the tips channel but couldn't find a detailed guide.", likes: 29, comments: 5, date: '2025-06-14T08:15:00Z', likedBy: [] },
      { id: 'p4', userId: 'u3', category: 'wins', title: 'First monetization — $342 in month one!', body: 'Shorts play bonus just hit. Started the channel 8 weeks ago. This community showed me how to set up the system. Grateful!', likes: 67, comments: 22, date: '2025-06-15T16:45:00Z', likedBy: [] },
    ],
    comments: [],
    announcements: [
      { id: 'a1', authorId: 'u1', subject: 'Welcome to Peak Society v2.0', body: '<p>We have officially launched our <strong>new community website</strong>! Browse channels, share wins, and connect with fellow creators.</p><p>The Discord remains our home base — <a href="https://discord.gg/peaksociety" target="_blank">join if you haven\'t already</a>.</p>', date: '2025-06-01T09:00:00Z' },
      { id: 'a2', authorId: 'u2', subject: 'New YTA Learning resources added', body: '<p>We\'ve added <strong>15 new niche research guides</strong> to the #resources channel. Topics include:</p><ul><li>High-CPM finance niches</li><li>Evergreen motivation content</li><li>AI voiceover tools comparison</li></ul><p>Check the Discord and let us know your feedback!</p>', date: '2025-06-08T11:00:00Z' },
    ],
    auditLog: [
      { id: 'log1', action: 'User registered', performedBy: 'system', target: 'CreatorJane', date: '2025-06-01T08:00:00Z' },
      { id: 'log2', action: 'Announcement posted', performedBy: 'Owner', target: 'Welcome to Peak Society v2.0', date: '2025-06-01T09:00:00Z' },
      { id: 'log3', action: 'Announcement posted', performedBy: 'AdminUser', target: 'New YTA Learning resources added', date: '2025-06-08T11:00:00Z' },
    ],
    reports: [],
    notifications: [],
    session: null,
    adminSession: null,
  };

  const get = (key) => {
    try {
      const raw = localStorage.getItem('ps_' + key);
      return raw ? JSON.parse(raw) : defaults[key];
    } catch { return defaults[key]; }
  };

  const _localSet = (key, val) => {
    try { localStorage.setItem('ps_' + key, JSON.stringify(val)); } catch { }
  };

  const set = async (key, val) => {
    _localSet(key, val);
    // Push changes to Supabase async
    if (sbClient && key !== 'session' && key !== 'adminSession') {
      try {
        if (key === 'users') {
          // Explicit requirement: Users table logic
          for (const u of val) { 
            await sbClient.from('users').upsert({ 
              username: u.username, 
              role: u.role, 
              joined: u.joined,
              profilePicture: u.profilePicture || null,
              displayName: u.displayName || null,
              bio: u.bio || null,
              youtube: u.youtube || null,
              discord: u.discord || null,
              passwordHash: u.passwordHash || null,
              lastUsernameChange: u.lastUsernameChange || null
            }); 
          }
        } else if (key === 'reports') {
          // Explicit requirement: Report Logs logic 
          for (const r of val) { await sbClient.from('reports').upsert(r); }
        } else if (key === 'posts') {
          for (const p of val) { await sbClient.from('posts').upsert({ id: p.id, userId: p.userId, category: p.category, title: p.title, content: p.body, image: p.image, likes: p.likes, commentsCount: p.comments, likedBy: p.likedBy || [], created_at: p.date }); }
        } else if (key === 'comments') {
          for (const c of val) { await sbClient.from('comments').upsert(c); }
        } else if (key === 'announcements') {
          for (const a of val) { await sbClient.from('announcements').upsert(a); }
        } else {
          // Keep generic store logic for the rest as decided
          await sbClient.from('store').upsert({ id: key, data: JSON.stringify(val) });
        }
      } catch (err) {
        console.error("Supabase Save Error:", err);
      }
    }
  };

  // Init defaults if not set locally
  Object.keys(defaults).forEach(k => {
    if (localStorage.getItem('ps_' + k) === null) _localSet(k, defaults[k]);
  });

  // Real-time Supabase Synchronization
  if (sbClient) {
    // 1. Fetch initial explicit tables
    sbClient.from('users').select('*').then(({ data, error }) => {
       if (!error && data && data.length > 0) {
           _localSet('users', data);
           window.dispatchEvent(new CustomEvent('ps_db_updated', { detail: 'users' }));
       } else if (!error && data && data.length === 0) {
           defaults.users.forEach(u => sbClient.from('users').upsert(u).catch(e => {}));
       }
    });

    sbClient.from('reports').select('*').then(({ data, error }) => {
       if (!error && data) {
           _localSet('reports', data);
           window.dispatchEvent(new CustomEvent('ps_db_updated', { detail: 'reports' }));
       }
    });

    ['posts', 'comments', 'announcements', 'likes'].forEach(cat => {
        sbClient.from(cat).select('*').then(({ data, error }) => {
            if (error) { console.error(`Fetch error for ${cat}:`, error); return; }
            if (data) { 
                if (cat === 'comments') console.log('COMMENTS FETCHED:', data);
                if (cat === 'posts') data = data.map(p => ({...p, body: p.content || p.body, comments: p.commentsCount ?? p.comments, date: p.created_at || p.date, likedBy: p.likedBy || [] }));
                if (cat === 'announcements') data = data.map(a => ({...a, subject: a.title || a.subject, body: a.content || a.body, authorId: a.author || a.authorId, date: a.created_at || a.date}));
                if (cat === 'comments')      data = data.map(c => ({...c, postId: c.postId, userId: c.userId, body: c.content || c.body, date: c.created_at || c.date}));
                if (cat === 'likes')         data = data.map(l => ({...l, postId: l.postId || l.postid, userId: l.userId || l.userid}));
                _localSet(cat, data); 
                window.dispatchEvent(new CustomEvent('ps_db_updated', { detail: cat }));
            }
        });
    });

    // Fetch initial store subsets (legacy non-relational values)
    ['auditLog', 'notifications'].forEach(k => {
       sbClient.from('store').select('*').eq('id', k).maybeSingle().then(({ data, error }) => {
           if (!error && data && data.data) {
              try { _localSet(k, JSON.parse(data.data)); } catch(e) {}
              window.dispatchEvent(new CustomEvent('ps_db_updated', { detail: k }));
           } else if (!data) {
              sbClient.from('store').upsert({ id: k, data: JSON.stringify(get(k)) }).catch(e => {});
           }
       });
    });

    // 2. Realtime Subscriptions
    sbClient.channel('public:users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, payload => {
          sbClient.from('users').select('*').then(({ data }) => {
              if (data) Object.assign(localStorage, { ['ps_users']: JSON.stringify(data) });
              window.dispatchEvent(new CustomEvent('ps_db_updated', { detail: 'users' }));
          });
      }).subscribe();
      
    sbClient.channel('public:reports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, payload => {
          sbClient.from('reports').select('*').then(({ data }) => {
              if (data) _localSet('reports', data);
              window.dispatchEvent(new CustomEvent('ps_db_updated', { detail: 'reports' }));
          });
      }).subscribe();

    sbClient.channel('public:dynamic')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, payload => {
          sbClient.from('posts').select('*').then(({ data }) => {
              if (data) _localSet('posts', data.map(p => ({...p, body: p.content || p.body, comments: p.commentsCount ?? p.comments, date: p.created_at || p.date, likedBy: p.likedBy || [] }))); window.dispatchEvent(new CustomEvent('ps_db_updated', { detail: 'posts' }));
          });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, payload => {
          sbClient.from('comments').select('*').then(({ data }) => {
              if (data) {
                  data = data.map(c => ({...c, postId: c.postId, userId: c.userId, body: c.content || c.body, date: c.created_at || c.date}));
                  _localSet('comments', data); window.dispatchEvent(new CustomEvent('ps_db_updated', { detail: 'comments' }));
              }
          });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, payload => {
          sbClient.from('likes').select('*').then(({ data }) => {
              if (data) {
                  data = data.map(l => ({...l, postId: l.postId || l.postid, userId: l.userId || l.userid}));
                  _localSet('likes', data); window.dispatchEvent(new CustomEvent('ps_db_updated', { detail: 'likes' }));
              }
          });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, payload => {
          sbClient.from('announcements').select('*').then(({ data }) => {
              if (data) {
                  data = data.map(a => ({...a, subject: a.title || a.subject, body: a.content || a.body, authorId: a.author || a.authorId, date: a.created_at || a.date}));
                  _localSet('announcements', data); window.dispatchEvent(new CustomEvent('ps_db_updated', { detail: 'announcements' }));
              }
          });
      }).subscribe();

    sbClient.channel('public:store')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store' }, payload => {
         const row = payload.new;
         if (row && row.id) {
             try {
                _localSet(row.id, JSON.parse(row.data));
                window.dispatchEvent(new CustomEvent('ps_db_updated', { detail: row.id }));
             } catch(e) {}
         }
      }).subscribe();
  }

  // Migration: Reset users if they have the old unsalted hash for Owner
  const currentUsers = get('users');
  if (currentUsers && currentUsers.some(u => u.username === 'Owner' && u.passwordHash === '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8')) {
    set('users', defaults.users);
  }

  // Restore ghost sessions safely
  const s = get('session');
  if (s) {
    const uList = get('users') || [];
    if (!uList.find(u => u.id === s.userId)) {
      uList.push({ id: s.userId, username: s.username, role: s.role, passwordHash: 'ghost', joined: new Date().toISOString().split('T')[0] });
      set('users', uList);
    }
  }

  return { get, set };
})();

/* ─────────────────────────────────────────────
   NOTIFICATIONS ENGINE
───────────────────────────────────────────── */
const navBell = document.getElementById('navBell');
const notificationDropdown = document.getElementById('notificationDropdown');
const notificationWrapper = document.getElementById('notificationWrapper');
const notificationBadge = document.getElementById('notificationBadge');
const notificationList = document.getElementById('notificationList');
const markAllReadBtn = document.getElementById('markAllReadBtn');

let audioCtx = null;
const playNotificationSound = () => {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    // Create a crisp "ding" synth bell
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1400, audioCtx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
  } catch (e) { console.warn('Audio play failed:', e); }
};

const dispatchNotification = (targetUserId, type, title, body, actionData = null) => {
  let notifs = Store.get('notifications') || [];
  const newNotif = {
    id: 'n' + Date.now() + Math.floor(Math.random() * 1000),
    userId: targetUserId,
    type,
    title,
    body,
    actionData,
    read: false,
    date: new Date().toISOString()
  };
  notifs.push(newNotif);

  // Clean up notifications older than 7 days
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  notifs = notifs.filter(n => new Date(n.date).getTime() > oneWeekAgo);

  Store.set('notifications', notifs);

  const currentSession = Store.get('session');
  if (currentSession && (targetUserId === 'all' || targetUserId === currentSession.userId)) {
    playNotificationSound();
    renderNotifications();
  }
};

const renderNotifications = () => {
  if (!notificationWrapper) return;
  const session = Store.get('session');
  if (!session) {
    notificationWrapper.style.display = 'none';
    return;
  }
  notificationWrapper.style.display = 'block';

  let allNotifs = Store.get('notifications') || [];

  // Clean up notifications older than 7 days for all users
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const validNotifs = allNotifs.filter(n => new Date(n.date).getTime() > oneWeekAgo);
  if (validNotifs.length !== allNotifs.length) {
    Store.set('notifications', validNotifs);
    allNotifs = validNotifs;
  }

  const myNotifs = allNotifs.filter(n => n.userId === 'all' || n.userId === session.userId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const unreadCount = myNotifs.filter(n => !n.read).length;

  if (unreadCount > 0) {
    notificationBadge.removeAttribute('hidden');
    notificationBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
  } else {
    notificationBadge.setAttribute('hidden', '');
  }

  if (myNotifs.length === 0) {
    notificationList.innerHTML = '<div class="notif-empty">No notifications yet.</div>';
    return;
  }

  notificationList.innerHTML = myNotifs.slice(0, 20).map(n => {
    const actionAttr = n.actionData ? ` data-action='${sanitize(JSON.stringify(n.actionData))}'` : '';
    return `
      <div class="notification-item ${n.read ? '' : 'unread'}" data-nid="${sanitize(n.id)}"${actionAttr} style="cursor: pointer;">
         <div class="notif-icon">${n.type === 'announcement' ? '📢' : n.type === 'violation' ? '⚠️' : n.type === 'like' ? '❤️' : '💬'}</div>
         <div class="notif-content">
            <div class="notif-title">${sanitize(n.title)}</div>
            <div class="notif-body">${sanitize(n.body)}</div>
            <div class="notif-date">${new Date(n.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
         </div>
      </div>
      `;
  }).join('');

  notificationList.querySelectorAll('.notification-item').forEach(item => {
    item.addEventListener('click', () => {
      const nid = item.dataset.nid;
      const actionStr = item.dataset.action;

      const notifs = Store.get('notifications') || [];
      const notif = notifs.find(n => n.id === nid);

      let needsRender = false;
      if (notif && !notif.read) {
        notif.read = true;
        Store.set('notifications', notifs);
        needsRender = true;
      }

      notificationDropdown.setAttribute('hidden', '');
      navBell.classList.remove('active');

      if (actionStr) {
        try {
          const action = JSON.parse(actionStr.replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
          if (action.hash) {
            window.location.hash = action.hash;
          } else if (action.postId) {
            const allPosts = Store.get('posts') || [];
            if (allPosts.some(p => p.id === action.postId)) {
              openViewPost(action.postId);
            } else {
              customConfirm("This post was removed or is no longer available.", "Post Not Found");
            }
          }
        } catch (e) { }
      }

      if (needsRender) renderNotifications();
    });
  });
};

if (navBell) {
  navBell.addEventListener('click', () => {
    const hidden = notificationDropdown.hasAttribute('hidden');
    if (hidden) {
      notificationDropdown.removeAttribute('hidden');
      navBell.classList.add('active');
      // Optional: mark all as read when opened? We have a button for that.
    } else {
      notificationDropdown.setAttribute('hidden', '');
      navBell.classList.remove('active');
    }
  });
}

if (markAllReadBtn) {
  markAllReadBtn.addEventListener('click', () => {
    const session = Store.get('session');
    if (!session) return;
    const notifs = Store.get('notifications') || [];
    let changed = false;
    notifs.forEach(n => {
      if ((n.userId === 'all' || n.userId === session.userId) && !n.read) {
        n.read = true;
        changed = true;
      }
    });
    if (changed) {
      Store.set('notifications', notifs);
      renderNotifications();
    }
  });
}

// Click outside to close nav menus including bell
document.addEventListener('click', e => {
  if (notificationWrapper && !notificationWrapper.contains(e.target)) {
    notificationDropdown?.setAttribute('hidden', '');
    navBell?.classList.remove('active');
  }
});

/* ─────────────────────────────────────────────
   CURSOR
───────────────────────────────────────────── */
const cursor = document.getElementById('cursor');
const cursorDot = document.getElementById('cursorDot');
let cursorX = 0, cursorY = 0;
let cursorTargetX = 0, cursorTargetY = 0;

document.addEventListener('mousemove', e => {
  cursorTargetX = e.clientX;
  cursorTargetY = e.clientY;
  cursorDot.style.left = e.clientX + 'px';
  cursorDot.style.top = e.clientY + 'px';
});

(function animateCursor() {
  cursorX += (cursorTargetX - cursorX) * 0.12;
  cursorY += (cursorTargetY - cursorY) * 0.12;
  cursor.style.left = cursorX + 'px';
  cursor.style.top = cursorY + 'px';
  requestAnimationFrame(animateCursor);
})();

document.querySelectorAll('a, button, [data-channel], .channel-item, .forum-post, .forum-tab').forEach(el => {
  el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hovering'));
  el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hovering'));
});

/* ─────────────────────────────────────────────
   NAVBAR
───────────────────────────────────────────── */
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 40);
});

const hamburger = document.getElementById('navHamburger');
const mobileMenu = document.getElementById('navMobile');
const toggleMenu = () => {
  const open = mobileMenu.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', open);
  mobileMenu.setAttribute('aria-hidden', !open);
};
hamburger.addEventListener('click', toggleMenu);

// Close menu when a link is clicked
mobileMenu.querySelectorAll('a, button').forEach(el => {
  el.addEventListener('click', () => {
    if (mobileMenu.classList.contains('open')) toggleMenu();
  });
});

/* ─────────────────────────────────────────────
   COUNTER ANIMATION
───────────────────────────────────────────── */
const animateCounter = (el, target) => {
  let current = 0;
  const step = target / 60;
  const tick = () => {
    current = Math.min(current + step, target);
    el.textContent = Math.floor(current).toLocaleString();
    if (current < target) requestAnimationFrame(tick);
  };
  tick();
};

const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const target = parseInt(e.target.dataset.target);
      animateCounter(e.target, target);
      statsObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.stat-number[data-target]').forEach(el => statsObserver.observe(el));

/* ─────────────────────────────────────────────
   SCROLL REVEAL
───────────────────────────────────────────── */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      e.target.style.transitionDelay = (i * 0.05) + 's';
      e.target.classList.add('visible');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.feature-card, .announcement-card, .forum-post, .yt-card, .about-text, .creator-info').forEach(el => {
  el.classList.add('reveal');
  revealObserver.observe(el);
});

/* ─────────────────────────────────────────────
   3D HERO ROTATION
───────────────────────────────────────────── */
const heroPlayButton = document.getElementById('heroPlayButton');
const heroScene = document.querySelector('.hero-3d-scene');
if (heroPlayButton && heroScene) {
  let targetRotX = 15;
  let targetRotY = -25;
  let currentRotX = 15;
  let currentRotY = -25;
  let isDragging = false;
  let prevMouseX = 0;
  let prevMouseY = 0;
  let autoSpin = 0;

  const animate3D = () => {
    if (!isDragging) {
      autoSpin += 0.4;
      currentRotX += (targetRotX - currentRotX) * 0.1;
      currentRotY += ((targetRotY + autoSpin) - currentRotY) * 0.1;
    } else {
      currentRotX += (targetRotX - currentRotX) * 0.2;
      currentRotY += (targetRotY - currentRotY) * 0.2;
    }

    heroPlayButton.style.transform = `rotateX(${currentRotX}deg) rotateY(${currentRotY}deg)`;
    requestAnimationFrame(animate3D);
  };
  animate3D();

  heroScene.addEventListener('mousedown', (e) => {
    isDragging = true;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;
    targetRotY = currentRotY;
    targetRotX = currentRotX;
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      targetRotX = 15;
      targetRotY = -25;
      autoSpin = currentRotY - targetRotY;
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - prevMouseX;
    const deltaY = e.clientY - prevMouseY;
    targetRotY += deltaX * 0.6;
    targetRotX -= deltaY * 0.6;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;

    if (targetRotX > 60) targetRotX = 60;
    if (targetRotX < -60) targetRotX = -60;
  });
}

/* ─────────────────────────────────────────────
   CHANNELS PREVIEW
───────────────────────────────────────────── */
const channelData = {
  rules: {
    messages: [
      { author: '⚡ Owner', role: 'Owner', avatar: '⚡', text: '📋 Welcome to Peak Society! Please read all rules before participating. Failure to comply = ban.' },
      { author: '⚡ Owner', role: 'Owner', avatar: '⚡', text: '1. No spam or self-promotion outside designated channels.\n2. Be respectful — we\'re all here to grow.\n3. Share only verified information in #resources.' },
      { author: '🤖 Bot', role: 'BOT', avatar: '🤖', text: 'React with ✅ to gain access to the full server.' },
    ]
  },
  welcome: {
    messages: [
      { author: 'nar', role: 'Admin', avatar: '🛠️', text: 'Welcome to Peak Society everyone! This is where your journey begins.' },
      { author: 'Jane', role: 'Member', avatar: '👋', text: 'Just joined! Excited to start my first automation channel with you all. Day 1 begins now.' },
      { author: 'YTA_Dev', role: 'Member', avatar: '👋', text: 'Hey everyone! Been lurking YouTube Shorts for a while, finally decided to take the leap. Happy to be here!' },
    ]
  },
  announcements: {
    messages: [
      { author: '⚡ Owner', role: 'Owner', avatar: '⚡', text: '📢 NEW: Free 120+ Sound Effects have been added to #resources. Go check them out and let us know what you find!' },
      { author: '⚡ Owner', role: 'Owner', avatar: '⚡', text: '🎉 We hit 1500 members! Massive thank you to everyone who\'s been spreading the word. You are Peak Society.' },
    ]
  },
  verses: {
    messages: [
      { author: 'Gelo', role: 'Owner', avatar: '👑', text: '📖Zechariah 4:10: "Do not despise these small beginnings, for the Lord rejoices to see the work begin..."' },
      { author: 'nar', role: 'Admin', avatar: '🛠️', text: 'Trust in God Alone💯' },
    ]
  },
  uploads: {
    messages: [
      { author: 'Gelo', role: 'Owner', avatar: '👑', text: '📹 Just uploaded my Day 13 on TikTok! Seeing slow but steady growth. The system works if you work the system.' },
      { author: 'Gelo', role: 'Owner', avatar: '👑', text: 'I uploaded my first YT long form video. Go check it out and dont forget to Subscribe!' },
    ]
  },
  general: {
    messages: [
      { author: 'FIRE | Ian', role: 'Peak', avatar: '⚡', text: 'I got 12 million views in my new upload guys' },
      { author: 'Phinx', role: 'Peak', avatar: '⚡', text: 'I got 13 million views in my new channel' },
      { author: 'Boss Chamz', role: 'Admin', avatar: '🛠️', text: 'Watch the #niches channel — dropping a breakdown post on this today. Stay tuned.' },
    ]
  },
  questions: {
    messages: [
      { author: 'JABEE', role: 'Member', avatar: '👋', text: 'How do I find trending audio for Shorts without TikTok? Any tools?' },
      { author: 'satorouya', role: 'Admin', avatar: '🛠️', text: 'Check out YT Studio\'s trending sounds tab. Also CapCut has a trending audio section updated daily.' },
      { author: 'yatot', role: 'Member', avatar: '👋', text: 'dobolyu chat' },
    ]
  },
  wins: {
    messages: [
      { author: 'Stigbidi', role: 'Member', avatar: '👋', text: '🏆 WOW. Just hit 1 million views! Started 2 weeks ago. Followed the how-to-start guide step by step. THANK YOU all!' },
      { author: 'Korei', role: 'Member', avatar: '👋', text: '🎉 First monetization check: $342! Month 1 of Shorts play bonus. The system is real.' },
      { author: 'satorouya', role: 'Admin', avatar: '🛠️', text: 'LETS GO! These wins never get old. Keep posting them — they fuel the whole community.' },
    ]
  },
  resources: {
    messages: [
      { author: 'Gelo', role: 'Owner', avatar: '👑', text: '📚 PINNED: Complete YTA Starter Pack — Niche database, script templates, thumbnail guides, and posting schedule. Link in the message below.' },
      { author: 'StaffMike', role: 'Staff', avatar: '👋', text: '🆕 Added: AI Voiceover Tool Comparison 2026. Covers ElevenLabs and Fish.Audio side by side.' },
    ]
  },
  niches: {
    messages: [
      { author: 'Gelo', role: 'Owner', avatar: '👑', text: '🎯 NICHE ALERT: "Ranking Niche are getting 500K+ views consistently.' },
      { author: 'satorouya', role: 'Staff', avatar: '👋', text: 'Roblox Niche is also goldmine right now.' },
    ]
  },
  tips: {
    messages: [
      { author: 'Gelo', role: 'Owner', avatar: '👑', text: '💡 TIP: Hook in the first 1.5 seconds. If you don\'t grab them, they scroll. Use a visual + text hook together.' },
      { author: 'Gelo', role: 'Owner', avatar: '👑', text: '💡 Post between 12am-3am, that is the peak time in US.' },
    ]
  },
};

const previewName = document.getElementById('previewName');
const previewMessages = document.getElementById('previewMessages');

const renderChannelPreview = (channel) => {
  previewName.textContent = channel;
  const data = channelData[channel] || { messages: [{ author: 'Gelo', role: 'Owner', avatar: '👑', text: 'Join Discord to see this channel!' }] };
  previewMessages.innerHTML = data.messages.map(m => `
    <div class="preview-msg">
      <div class="msg-avatar">${sanitize(m.avatar)}</div>
      <div class="msg-content">
        <span class="msg-author">${sanitize(m.author)}</span>
        <span class="msg-role">${sanitize(m.role)}</span>
        <div class="msg-text">${sanitize(m.text).replace(/\n/g, '<br>')}</div>
      </div>
    </div>
  `).join('');
};

document.querySelectorAll('.channel-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.channel-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    renderChannelPreview(item.dataset.channel);
  });
});

renderChannelPreview('rules');

/* ─────────────────────────────────────────────
   YOUTUBE CREATOR SECTION
───────────────────────────────────────────── */
const ytVideos = [
  { id: '647p_dYV1VY', title: 'Export in Capcut With Pro Features 2026 (No Pro Required)', views: '143 views', date: '1 day ago' },
  { id: '647p_dYV1VY', title: 'Export in Capcut With Pro Features 2026 (No Pro Required)', views: '143 views', date: '1 day ago' },
  { id: '647p_dYV1VY', title: 'Export in Capcut With Pro Features 2026 (No Pro Required)', views: '143 views', date: '1 day ago' },
  { id: '647p_dYV1VY', title: 'Export in Capcut With Pro Features 2026 (No Pro Required)', views: '143 views', date: '1 day ago' },
];

const creatorVideos = document.getElementById('creatorVideos');
creatorVideos.innerHTML = ytVideos.map(v => `
  <a href="https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}" target="_blank" rel="noopener noreferrer" class="yt-card reveal">
    <div class="yt-thumb">
      <img src="https://img.youtube.com/vi/${encodeURIComponent(v.id)}/mqdefault.jpg" alt="${sanitize(v.title)}" loading="lazy" />
      <div class="yt-play-btn" aria-hidden="true">
        <div class="yt-play-icon">▶</div>
      </div>
    </div>
    <div class="yt-card-info">
      <div class="yt-card-title">${sanitize(v.title)}</div>
      <div class="yt-card-meta">${sanitize(v.views)} · ${sanitize(v.date)}</div>
    </div>
  </a>
`).join('');

ytVideos.forEach((_, i) => {
  const el = creatorVideos.children[i];
  if (el) { el.classList.add('reveal'); revealObserver.observe(el); }
});

/* ─────────────────────────────────────────────
   ANNOUNCEMENTS RENDER
───────────────────────────────────────────── */
let showAllAnnouncements = false;
const stripRichHTML = (html) => {
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};

const renderAnnouncements = () => {
  const list = document.getElementById('announcementsList');
  const announcements = Store.get('announcements');
  const users = Store.get('users');
  if (!announcements.length) {
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
  list.querySelectorAll('.announcement-card').forEach(el => revealObserver.observe(el));
};

renderAnnouncements();

/* ─────────────────────────────────────────────
   FORUM RENDER
───────────────────────────────────────────── */
let currentTab = 'all';

const categoryLabels = { wins: '🥇 Win', questions: '❓ Question', 'tutorial-requests': '🎬 Tutorial Request' };

const renderForum = () => {
  const container = document.getElementById('forumPosts');
  if (!container) return;
  const session = Store.get('session');

  if (!session) {
    container.classList.remove('forum-posts');
    container.innerHTML = `
      <div class="sign-in-wall">
        <h3>Join the conversation</h3>
        <p>Sign in to post wins, ask questions, and request tutorials.</p>
        <button class="btn-primary" id="forumSignInBtn">Sign In to Post</button>
      </div>
    `;
    document.getElementById('forumSignInBtn')?.addEventListener('click', () => openAuthModal());
  } else {
    container.classList.add('forum-posts');
    container.innerHTML = renderPostCards();
  }

  container.querySelectorAll('.forum-post').forEach(card => {
    card.addEventListener('click', () => openViewPost(card.dataset.postId));
    revealObserver.observe(card);
  });
};

const renderPostCards = () => {
  const posts = Store.get('posts');
  const users = Store.get('users');
  const filtered = currentTab === 'all' ? posts : posts.filter(p => p.category === currentTab);

  if (!filtered.length) return '<p style="color:var(--mid);text-align:center;padding:3rem 0;">No posts in this category yet. Be the first!</p>';

  return filtered.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5).map(p => {
    let author = users.find(u => u.username === p.userId);
    if (!author && p.authorName) author = { username: p.authorName, role: p.authorRole || 'member' };
    const date = new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const commentCount = (Store.get('comments') || []).filter(c => c.postId === p.id).length;
    const likeCount = (Store.get('likes') || []).filter(l => l.postId === p.id).length;
    return `
      <div class="forum-post reveal" data-post-id="${sanitize(p.id)}" role="article" tabindex="0">
        <div class="post-header" style="cursor: pointer; z-index: 2; position: relative;" onclick="event.stopPropagation(); if(typeof openPublicProfile === 'function') openPublicProfile('${sanitize(p.userId)}');" title="View Profile">
          ${author && author.profilePicture ? `<div class="post-avatar" style="background-image:url('${author.profilePicture}'); background-size: cover; border-radius: 50%;"></div>` : `<div class="post-avatar" style="font-size: 1.2rem;">&#128100;</div>`}
          <span class="post-author">${sanitize(author ? (author.displayName || author.username) : 'Unknown')}</span>
          ${author ? `<span class="post-role-badge">${sanitize(author.role)}</span>` : ''}
          <span class="post-date">${date}</span>
        </div>
        <div class="post-category-tag">${categoryLabels[p.category] || p.category}</div>
        <div class="post-title">${sanitize(p.title)}</div>
        <div class="post-excerpt">${sanitize(p.body.slice(0, 180))}${p.body.length > 180 ? '…' : ''}</div>
        ${p.image ? `
        <div class="post-image-container">
          <div class="post-image-wrapper">
            <img src="${p.image}" alt="Attached image" class="post-image-img" loading="lazy" />
          </div>
        </div>` : ''}
        <div class="post-footer">
          <span class="post-action">❤️ ${sanitize(String(likeCount))}</span>
          <span class="post-action">💬 ${sanitize(String(commentCount))}</span>
        </div>
      </div>
    `;
  }).join('');
};

document.querySelectorAll('.forum-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.forum-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    currentTab = tab.dataset.tab;
    renderForum();
  });
});

renderForum();

/* ─────────────────────────────────────────────
   MODAL HELPERS
───────────────────────────────────────────── */
const openModal = (id) => {
  const modal = document.getElementById(id);
  modal.removeAttribute('hidden');
  modal.querySelector('[role="dialog"]')?.focus?.();
  document.body.style.overflow = 'hidden';
};

const closeModal = (id) => {
  document.getElementById(id).setAttribute('hidden', '');
  document.body.style.overflow = '';
};

const setupModalClose = (backdropId, closeBtnId) => {
  const backdrop = document.getElementById(backdropId);
  document.getElementById(closeBtnId).addEventListener('click', () => closeModal(backdropId));
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(backdropId); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !backdrop.hasAttribute('hidden')) closeModal(backdropId); });
};

setupModalClose('authModal', 'authModalClose');
setupModalClose('postModal', 'postModalClose');
setupModalClose('adminModal', 'adminModalClose');
setupModalClose('adminAuthModal', 'adminAuthClose');
setupModalClose('composerModal', 'composerClose');
setupModalClose('viewPostModal', 'viewPostClose');
setupModalClose('viewAnnouncementModal', 'viewAnnouncementClose');
setupModalClose('profileModal', 'profileModalClose');
setupModalClose('publicProfileModal', 'publicProfileClose');

window.openPublicProfile = (userId) => {
  const users = Store.get('users');
  const targetUser = users.find(u => u.id === userId);
  if (!targetUser) return;

  const displayName = targetUser.displayName || targetUser.username;
  document.getElementById('publicUsername').textContent = displayName;

  const roleClasses = {
    'owner': 'role-owner',
    'admin': 'role-admin',
    'staff': 'role-staff',
    'member': 'role-member'
  };

  document.getElementById('publicRoleBadge').innerHTML = `<span class="role-badge ${roleClasses[targetUser.role] || 'role-member'}">${sanitize(targetUser.role)}</span>`;

  document.getElementById('publicBio').textContent = targetUser.bio || "This user hasn't added a bio yet.";

  const socialsDiv = document.getElementById('publicSocials');
  let socialsHtml = '';
  if (targetUser.youtubeLink) {
    socialsHtml += `<a href="${sanitize(targetUser.youtubeLink)}" target="_blank" class="btn-youtube btn-sm" style="text-decoration:none;">YouTube</a>`;
  }
  if (targetUser.discordHandle) {
    socialsHtml += `<div class="btn-discord btn-sm">Discord: ${sanitize(targetUser.discordHandle)}</div>`;
  }
  socialsDiv.innerHTML = socialsHtml;

  const avatarBox = document.getElementById('publicAvatarBox');
  if (targetUser.profilePicture) {
    avatarBox.style.backgroundImage = `url('${targetUser.profilePicture}')`;
    avatarBox.innerHTML = '';
  } else {
    avatarBox.style.backgroundImage = 'none';
    avatarBox.innerHTML = `&#128100;`;
  }

  const allPosts = Store.get('posts') || [];
  const userPosts = allPosts.filter(p => p.userId === userId).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  const actList = document.getElementById('publicActivityList');
  if (userPosts.length === 0) {
    actList.innerHTML = '<p style="color:var(--mid);text-align:center;font-size:0.85rem;">No recent activity.</p>';
  } else {
    actList.innerHTML = userPosts.map(p => {
      const commentCount = (Store.get('comments') || []).filter(c => c.postId === p.id).length;
      const likeCount = (Store.get('likes') || []).filter(l => l.postId === p.id).length;
      return `
      <div class="activity-item" style="cursor: pointer;" onclick="closeModal('publicProfileModal'); openViewPost('${sanitize(p.id)}');">
        <div class="activity-title">${sanitize(p.title)}</div>
        <div class="activity-meta">
          <span>❤️ ${likeCount}</span>
          <span>💬 ${commentCount}</span>
          <span>${new Date(p.date).toLocaleDateString()}</span>
        </div>
      </div>
    `}).join('');
  }

  openModal('publicProfileModal');
};

/* ─────────────────────────────────────────────
   AUTH MODAL
───────────────────────────────────────────── */
const openAuthModal = (startInRegister = false) => {
  // Reset modal state
  isRegisterMode = startInRegister;
  applyAuthMode();
  document.getElementById('authUsername').value = '';
  document.getElementById('authPassword').value = '';
  document.getElementById('authError').setAttribute('hidden', '');
  openModal('authModal');
};

// Nav sign-in / sign-out toggle
document.getElementById('navSignIn').addEventListener('click', async () => {
  if (Store.get('session')) {
    if (await customConfirm('Are you sure you want to sign out?', 'Sign Out')) {
      signOut();
    }
  } else {
    openAuthModal();
  }
});
document.getElementById('navSignInMobile')?.addEventListener('click', async () => {
  if (Store.get('session')) {
    if (await customConfirm('Are you sure you want to sign out?', 'Sign Out')) {
      signOut();
    }
  } else {
    openAuthModal();
  }
});

document.getElementById('newPostBtn')?.addEventListener('click', () => {
  if (!Store.get('session')) { openAuthModal(); return; }
  openModal('postModal');
});

const signOut = () => {
  const s = Store.get('session');
  if (s) addAuditLog('User signed out', s.username, s.username);
  Store.set('session', null);
  updateNavForSession();
  renderForum();
};

let isRegisterMode = false;

const applyAuthMode = () => {
  document.getElementById('authRegisterToggle').textContent = isRegisterMode
    ? 'Already have an account? Sign in'
    : "Don't have an account? Sign up";
  document.querySelector('#authModal h2').textContent = isRegisterMode ? 'Create Account' : 'Welcome back';
  document.getElementById('authSubmit').textContent = isRegisterMode ? 'Create Account' : 'Sign In';
  document.querySelector('#authModal .modal-sub').textContent = isRegisterMode
    ? 'Choose a username and password'
    : 'Sign in to post in the community';
};

document.getElementById('authRegisterToggle').addEventListener('click', () => {
  isRegisterMode = !isRegisterMode;
  applyAuthMode();
  document.getElementById('authError').setAttribute('hidden', '');
});

// Rate limiting state
let authAttempts = 0;
let authLockUntil = 0;

document.getElementById('authSubmit').addEventListener('click', async () => {
  const errEl = document.getElementById('authError');
  errEl.setAttribute('hidden', '');

  // Rate limit check
  if (Date.now() < authLockUntil) {
    const secs = Math.ceil((authLockUntil - Date.now()) / 1000);
    errEl.textContent = `Too many attempts. Please wait ${secs} seconds.`;
    errEl.removeAttribute('hidden');
    return;
  }

  const username = document.getElementById('authUsername').value.trim();
  const password = document.getElementById('authPassword').value;

  // Validation
  if (!username || !password) {
    errEl.textContent = 'Please fill in both username and password.';
    errEl.removeAttribute('hidden');
    return;
  }
  if (username.length < 3 || username.length > 32) {
    errEl.textContent = 'Username must be between 3 and 32 characters.';
    errEl.removeAttribute('hidden');
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errEl.textContent = 'Username may only contain letters, numbers, and underscores.';
    errEl.removeAttribute('hidden');
    return;
  }
  if (password.length < 6) {
    errEl.textContent = 'Password must be at least 6 characters.';
    errEl.removeAttribute('hidden');
    return;
  }

  const hash = await hashPassword(password);
  const users = Store.get('users');

  if (isRegisterMode) {
    // Check username is not already taken (case-insensitive)
    const taken = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (taken) {
      errEl.textContent = 'That username is already taken. Please choose a different one.';
      errEl.removeAttribute('hidden');
      return;
    }

    const joinedStr = new Date().toISOString().split('T')[0];

    if (sbClient) {
      const { error } = await sbClient.from('users').insert([{ 
        username: username, 
        role: 'member', 
        joined: joinedStr,
        passwordHash: hash
      }]);

      if (error) {
        console.error("Supabase Sign Up Error:", error);
        errEl.textContent = "Database Error: " + error.message;
        errEl.removeAttribute('hidden');
        return; // Stop here if DB fails
      }
    } else {
        errEl.textContent = "Supabase connection is offline. Cannot register.";
        errEl.removeAttribute('hidden');
        return;
    }

    // Since it successfully inserted into Supabase, update the local cache only for the current session.
    // We do NOT need to push to store anymore, but we must update local state so they can use the app right now.
    const newUser = {
      id: username, // using username as unique identifier since ID column doesn't exist
      username,
      passwordHash: hash,
      role: 'member',
      joined: joinedStr,
    };
    users.push(newUser);
    Store.set('users', users);
    Store.set('session', { userId: newUser.id, username: newUser.username, role: newUser.role });
    addAuditLog('User registered', 'system', username);

  } else {
    // Sign in
    const user = users.find(
      u => u.username.toLowerCase() === username.toLowerCase() && (u.passwordHash === hash || !u.passwordHash)
    );

    if (!user) {
      // Increment rate limit counter on failed login
      authAttempts++;
      if (authAttempts >= 5) {
        authLockUntil = Date.now() + 30000;
        authAttempts = 0;
        errEl.textContent = 'Too many failed attempts. Please wait 30 seconds.';
      } else {
        errEl.textContent = `Incorrect username or password. (${5 - authAttempts} attempt${5 - authAttempts !== 1 ? 's' : ''} remaining)`;
      }
      errEl.removeAttribute('hidden');
      return;
    }

    // Reset rate limit on success
    authAttempts = 0;
    Store.set('session', { userId: user.id, username: user.username, role: user.role });
    addAuditLog('User signed in', user.username, user.username);
  }

  // Clear fields and close
  document.getElementById('authUsername').value = '';
  document.getElementById('authPassword').value = '';
  closeModal('authModal');
  updateNavForSession();
  renderForum();
});

// Allow Enter key to submit auth form
['authUsername', 'authPassword'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('authSubmit').click();
  });
});

const updateNavForSession = () => {
  const session = Store.get('session');
  const btn = document.getElementById('navSignIn');
  const mobileBtn = document.getElementById('navSignInMobile');
  const profileWidget = document.getElementById('navProfileWidget');

  if (session) {
    if (btn) btn.style.display = 'none';
    if (mobileBtn) mobileBtn.textContent = `Sign Out (${sanitize(session.username)})`;
    if (profileWidget) {
      profileWidget.style.display = 'flex';
      const users = Store.get('users') || [];
      const me = users.find(u => u.username === session.username);
      const avatarBlock = document.getElementById('navProfileAvatar');
      if (me) {
        if (me.profilePicture) {
          avatarBlock.style.backgroundImage = `url('${me.profilePicture}')`;
          avatarBlock.innerHTML = '';
        } else {
          avatarBlock.style.backgroundImage = 'none';
          avatarBlock.innerHTML = '&#128100;';
        }
      }
    }
  } else {
    if (btn) { btn.style.display = 'inline-block'; btn.textContent = 'Sign In'; }
    if (mobileBtn) mobileBtn.textContent = 'Sign In';
    if (profileWidget) profileWidget.style.display = 'none';
  }

  const adminAnncBtn = document.getElementById('adminAnnouncementsBtn');
  const adminFooterBtn = document.getElementById('footerAdminBtn');
  // Admin portal visilibity check
  if (session && ['owner', 'admin', 'staff'].includes(session.role)) {
    if (adminAnncBtn) adminAnncBtn.style.display = 'inline-block';
    if (adminFooterBtn) adminFooterBtn.style.display = 'inline-block';
  } else {
    if (adminAnncBtn) adminAnncBtn.style.display = 'none';
    if (adminFooterBtn) adminFooterBtn.style.display = 'none';
  }

  if (typeof renderNotifications === 'function') renderNotifications();
};

updateNavForSession();

/* ─────────────────────────────────────────────
   NEW POST
───────────────────────────────────────────── */
document.getElementById('postSubmit').addEventListener('click', async () => {
  const session = Store.get('session');
  if (!session) { closeModal('postModal'); openAuthModal(); return; }

  const title = document.getElementById('postTitle').value.trim();
  const body = document.getElementById('postBody').value.trim();
  const category = document.getElementById('postCategory').value;
  const imageInput = document.getElementById('postImageBtn');
  const errEl = document.getElementById('postError');
  errEl.setAttribute('hidden', '');

  if (!title || !body) { errEl.textContent = 'Please fill in all fields.'; errEl.removeAttribute('hidden'); return; }
  if (title.length < 5) { errEl.textContent = 'Title must be at least 5 characters.'; errEl.removeAttribute('hidden'); return; }

  let imageBase64 = null;
  if (imageInput && imageInput.files && imageInput.files[0]) {
    const file = imageInput.files[0];
    if (file.size > 2 * 1024 * 1024) {
      errEl.textContent = 'Image must be less than 2MB.';
      errEl.removeAttribute('hidden');
      return;
    }
    const btn = document.getElementById('postSubmit');
    btn.textContent = 'Uploading...';
    btn.disabled = true;
    const compressImageBeforeBase64 = (f, maxWidth, maxHeight, quality) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(f);
        reader.onload = event => {
          const img = new Image();
          img.src = event.target.result;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width, height = img.height;
            if (width > height) { if (width > maxWidth) { height = Math.round(height *= maxWidth / width); width = maxWidth; } } 
            else { if (height > maxHeight) { width = Math.round(width *= maxHeight / height); height = maxHeight; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          };
        };
      });
    };
    imageBase64 = await compressImageBeforeBase64(file, 800, 800, 0.6);
    btn.textContent = 'Publish Post';
    btn.disabled = false;
  }

  const newPost = { id: 'p' + Date.now(), userId: session.username, category, title, body, image: imageBase64, likes: 0, comments: 0, likedBy: [], date: new Date().toISOString() };
  const newPostDB = { id: newPost.id, userId: newPost.userId, category: newPost.category, title: newPost.title, content: newPost.body, image: newPost.image, likes: 0, commentsCount: 0, likedBy: [], created_at: newPost.date };
  
  if (sbClient) {
      const { error } = await sbClient.from('posts').insert([newPostDB]);
      if (error) {
          errEl.textContent = 'Database Error: ' + error.message;
          errEl.removeAttribute('hidden');
          return;
      }
      // Optimistic UI Update so we don't have to wait for websocket bounce back
      const posts = Store.get('posts');
      posts.push(newPost);
      Store.set('posts', posts);
  } else {
      const posts = Store.get('posts');
      posts.push(newPost);
      Store.set('posts', posts);
  }
  addAuditLog('Forum post created', session.username, title);
  
  document.getElementById('postTitle').value = '';
  document.getElementById('postBody').value = '';
  if (imageInput) imageInput.value = '';
  closeModal('postModal');
  renderForum();
});

/* ─────────────────────────────────────────────
   CUSTOM CONFIRM MODAL
───────────────────────────────────────────── */
const customConfirm = (message, title = 'This page says') => {
  return new Promise((resolve) => {
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmTitle').textContent = title;

    const cancelBtn = document.getElementById('confirmCancelBtn');
    const acceptBtn = document.getElementById('confirmAcceptBtn');
    const closeBtn = document.getElementById('confirmClose');

    const cleanup = () => {
      cancelBtn.removeEventListener('click', onCancel);
      closeBtn.removeEventListener('click', onCancel);
      acceptBtn.removeEventListener('click', onAccept);
      closeModal('confirmModal');
    };

    const onCancel = () => { cleanup(); resolve(false); };
    const onAccept = () => { cleanup(); resolve(true); };

    cancelBtn.addEventListener('click', onCancel);
    closeBtn.addEventListener('click', onCancel);
    acceptBtn.addEventListener('click', onAccept);

    openModal('confirmModal');
  });
};

/* ─────────────────────────────────────────────
   VIEW POST
───────────────────────────────────────────── */
window.openViewAnnouncement = (id) => {
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

const openViewPost = (postId) => {
  const posts = Store.get('posts');
  const users = Store.get('users');
  const post = posts.find(p => p.id === postId);
  if (!post) return;
  const commentCount = (Store.get('comments') || []).filter(c => c.postId === post.id).length;
  const likeCount = (Store.get('likes') || []).filter(l => l.postId === post.id).length;
  let author = users.find(u => u.id === post.userId);
  if (!author && post.authorName) author = { username: post.authorName, role: post.authorRole || 'member' };
  const date = new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const session = Store.get('session');
  const isLiked = session && (Store.get('likes') || []).some(l => l.postId === post.id && l.userId === session.userId);
  let canDelete = false;
  let canReport = false;
  if (session) {
    if (session.userId === post.userId) canDelete = true;
    else canReport = true;

    // Elevate privileges strictly based on the active frontend user session, not the background admin cookie
    if (['owner', 'admin', 'staff'].includes(session.role)) canDelete = true;
  }

  document.getElementById('viewPostBody').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
      <div class="post-category-tag" style="margin-bottom:1rem;">${categoryLabels[post.category] || post.category}</div>
      <div style="display:flex; gap:0.5rem; align-items:center;">
        ${canReport ? `<button id="reportPostBtn" style="background:transparent; border:1px solid var(--border); color:var(--mid); cursor:pointer; font-size:0.85rem; padding:0.4rem 0.6rem; border-radius:var(--radius-sm); transition:background 0.2s;" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='transparent'">🚩 Report Post</button>` : ''}
        ${canDelete ? `<button id="deletePostBtn" style="background:transparent; border:1px solid transparent; color:var(--error); cursor:pointer; font-size:0.85rem; padding:0.4rem 0.6rem; border-radius:var(--radius-sm); transition:border-color 0.2s;" onmouseover="this.style.borderColor='var(--error)'" onmouseout="this.style.borderColor='transparent'">🗑️ Delete Post</button>` : ''}
      </div>
    </div>
    <h2 style="font-size:1.4rem;margin-bottom:1rem;">${sanitize(post.title)}</h2>
    <div class="post-header" style="margin-bottom:1.5rem; cursor:pointer;" onclick="if(typeof openPublicProfile === 'function') openPublicProfile('${sanitize(post.userId)}');" title="View Profile">
      ${author && author.profilePicture ? `<div class="post-avatar" style="background-image:url('${author.profilePicture}'); background-size: cover; border-radius: 50%;"></div>` : `<div class="post-avatar">${sanitize(author ? author.username[0] : '?')}</div>`}
      <span class="post-author">${sanitize(author ? (author.displayName || author.username) : 'Unknown')}</span>
      ${author ? `<span class="post-role-badge">${sanitize(author.role)}</span>` : ''}
      <span class="post-date">${date}</span>
    </div>
    <p style="color:var(--mid);line-height:1.8;font-size:1rem;">${sanitize(post.body).replace(/\n/g, '<br>')}</p>
    ${post.image ? `<img src="${post.image}" alt="Attached image" style="margin-top:1.5rem;border-radius:var(--radius-lg);max-height:500px;width:100%;object-fit:cover;border:1px solid var(--border);" />` : ''}
    <div class="post-footer" style="margin-top:1.5rem;">
      <button id="postModalLikeBtn" class="post-action ${isLiked ? 'liked' : ''}" style="background:transparent;border:none;cursor:pointer;">
        ❤️ <span id="postModalLikeCount">${sanitize(String(likeCount))}</span>
      </button>
      <span class="post-action">💬 ${sanitize(String(commentCount))}</span>
    </div>
    
    <div class="comments-section" style="margin-top:2rem;padding-top:1.5rem;border-top:1px solid var(--border);">
      <h3 style="font-size:1.1rem;margin-bottom:1rem;">Comments</h3>
      <div id="modalCommentsContainer" class="comments-list"></div>
      
      ${session ? `
        <div class="comment-reply-box" style="margin-top:1.5rem;display:flex;flex-direction:column;gap:0.5rem;">
          <textarea id="modalCommentInput" class="form-input form-textarea" placeholder="Add a comment..." style="min-height:80px;"></textarea>
          <button id="modalCommentSubmit" class="btn-primary btn-sm" style="align-self:flex-end;">Reply</button>
        </div>
      ` : `
        <div class="sign-in-wall" style="padding:1.5rem;margin-top:1.5rem;">
          <p style="margin:0;font-size:0.9rem;">Sign In to Interact and join the conversation.</p>
        </div>
      `}
    </div>

    <div style="margin-top:2rem;padding-top:1.5rem;border-top:1px solid var(--border);color:var(--mid);font-size:0.88rem;text-align:center;">
      <p>Join the full discussion on <a href="https://discord.gg/peaksociety" target="_blank" rel="noopener noreferrer" style="color:var(--white);text-decoration:underline;">our Discord</a>.</p>
    </div>
  `;

  let commentsLimit = 2; // Initial visible comments limit

  const renderComments = () => {
    const allComments = Store.get('comments') || [];
    const postComments = allComments.filter(c => c.postId === postId);
    const container = document.getElementById('modalCommentsContainer');
    if (!container) return;

    if (postComments.length === 0) {
      container.innerHTML = '<p style="color:var(--mid);font-size:0.9rem;">No comments yet. Be the first to share your thoughts!</p>';
      return;
    }

    const visibleComments = postComments.slice(0, commentsLimit);

    let html = visibleComments.map(c => {
      let cAuthor = users.find(u => u.username === c.userId);
      if (!cAuthor) cAuthor = { username: c.authorName || 'Unknown', role: c.authorRole || 'member' };
      const cDate = new Date(c.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return `
        <div class="comment-block">
          <div class="post-header" style="margin-bottom:0.4rem; cursor:pointer;" onclick="if(typeof openPublicProfile === 'function') openPublicProfile('${sanitize(c.userId)}');" title="View Profile">
            ${cAuthor && cAuthor.profilePicture ? `<div class="post-avatar" style="width:24px;height:24px;background-image:url('${cAuthor.profilePicture}'); background-size: cover; border-radius: 50%;"></div>` : `<div class="post-avatar" style="width:24px;height:24px;font-size:0.7rem;">${sanitize(cAuthor.username[0])}</div>`}
            <span class="post-author" style="font-size:0.8rem;">${sanitize(cAuthor.displayName || cAuthor.username)}</span>
            <span class="post-role-badge" style="font-size:0.6rem;">${sanitize(cAuthor.role)}</span>
            <span class="post-date" style="font-size:0.7rem;margin-left:auto;">${cDate}</span>
          </div>
          <div class="comment-body" style="padding-left:32px;font-size:0.9rem;color:var(--off-white);line-height:1.5;">
            ${sanitize(c.body).replace(/\n/g, '<br>')}
          </div>
        </div>
      `;
    }).join('');

    if (postComments.length > commentsLimit) {
      html += `
        <div style="text-align:center; padding-top:1rem;">
          <button id="viewMoreCommentsBtn" class="admin-btn" style="padding:0.4rem 1rem; border-radius:var(--radius-lg);">View More Comments (${postComments.length - commentsLimit} remaining)</button>
        </div>
      `;
    }

    container.innerHTML = html;

    const viewMoreBtn = document.getElementById('viewMoreCommentsBtn');
    if (viewMoreBtn) {
      viewMoreBtn.addEventListener('click', () => {
        commentsLimit += 3; // Load 3 more
        renderComments(); // Re-render
      });
    }
  };

  setTimeout(renderComments, 0);

  if (session) {
    setTimeout(() => {
      // Like listener
      const likeBtn = document.getElementById('postModalLikeBtn');
      const likeCount = document.getElementById('postModalLikeCount');
      if (likeBtn) {
        likeBtn.addEventListener('click', async () => {
          let currentPosts = Store.get('posts');
          let currentPostIndex = currentPosts.findIndex(p => p.id === postId);
          if (currentPostIndex === -1) return;
          let currentPost = currentPosts[currentPostIndex];

          let allLikes = Store.get('likes') || [];
          const existingLikeIndex = allLikes.findIndex(l => l.postId === currentPost.id && l.userId === session.userId);

          if (existingLikeIndex !== -1) {
            // Unlike
            allLikes.splice(existingLikeIndex, 1);
            likeBtn.classList.remove('liked');
            Store.set('likes', allLikes);
            if(sbClient) {
                const { error } = await sbClient.from('likes').delete().match({postId: currentPost.id, userId: session.userId});
                if(error) alert('Unlike failed: ' + error.message);
            }
          } else {
            // Like
            const newLike = { id: crypto.randomUUID ? crypto.randomUUID() : 'l'+Date.now(), postId: currentPost.id, userId: session.userId };
            allLikes.push(newLike);
            likeBtn.classList.add('liked');
            Store.set('likes', allLikes);
            if(sbClient) {
                // We omit the id parameter completely during injection so that Supabase generates its own native postgres UUID locally, bypassing formatting crashes!
                const { error } = await sbClient.from('likes').insert([{postId: newLike.postId, userId: newLike.userId}]);
                if(error) alert('Like failed: ' + error.message);
            }

            addAuditLog('Post liked', session.username, currentPost.title);
            if (currentPost.userId !== session.userId) {
              dispatchNotification(currentPost.userId, 'like', 'New Like', `${session.username} liked your post: "${currentPost.title}"`, { postId: currentPost.id });
            }
          }

          likeCount.textContent = (Store.get('likes') || []).filter(l => l.postId === currentPost.id).length;
          renderForum();
        });
      }

      // Comment listener
      const replyBtn = document.getElementById('modalCommentSubmit');
      const replyInput = document.getElementById('modalCommentInput');
      if (replyBtn && replyInput) {
        replyBtn.addEventListener('click', async () => {
          const body = replyInput.value.trim();
          if (!body) return;

          replyBtn.disabled = true;
          replyBtn.textContent = 'Posting...';

          const allComments = Store.get('comments') || [];
          const newComment = {
            id: 'c' + Date.now(),
            postId: postId,
            userId: session.username,
            authorName: session.username,
            authorRole: session.role,
            body: body,
            date: new Date().toISOString()
          };
          allComments.push(newComment);
          Store.set('comments', allComments);
          if(sbClient) {
            const { error: commentsErr } = await sbClient.from('comments').insert([{id: newComment.id, postId: newComment.postId, userId: newComment.userId, content: newComment.body, created_at: newComment.date}]);
            if (commentsErr) {
              alert("Supabase Database Error: " + commentsErr.message);
              return;
            }
          }

          let currentPosts = Store.get('posts');
          let currentPostIndex = currentPosts.findIndex(p => p.id === postId);
          if (currentPostIndex !== -1) {
            currentPosts[currentPostIndex].comments = (currentPosts[currentPostIndex].comments || 0) + 1;
            Store.set('posts', currentPosts);
            if(sbClient) sbClient.from('posts').update({commentsCount: currentPosts[currentPostIndex].comments}).eq('id', currentPosts[currentPostIndex].id);
          }

          addAuditLog('Comment added', session.username, `Replying to ${post.title}`);
          if (post.userId !== session.userId) {
            dispatchNotification(post.userId, 'comment', 'New Comment', `${session.username} replied to your post: "${post.title}"`, { postId: post.id });
          }

          replyInput.value = '';
          replyBtn.disabled = false;
          replyBtn.textContent = 'Reply';

          commentsLimit += 1; // Increase limit to show the newly posted comment immediately
          renderComments();
          const commentCounters = document.querySelectorAll('.post-footer .post-action');
          if (commentCounters.length === 2) {
            commentCounters[1].innerHTML = `💬 ${sanitize(String(currentPosts[currentPostIndex].comments))}`;
          }

          renderForum();
        });
      }
    }, 0);
  }

  if (canDelete) {
    document.getElementById('deletePostBtn')?.addEventListener('click', async () => {
      const confirmed = await customConfirm('Are you certain you want to permanently delete this post?');
      if (!confirmed) return;
      let allPosts = Store.get('posts');
      allPosts = allPosts.filter(p => p.id !== postId);
      Store.set('posts', allPosts);
      closeModal('viewPostModal');
      renderForum();
      addAuditLog('Post deleted', session.username, post.title);
      dispatchNotification(post.userId, 'violation', 'Post Deleted', `Your post "${post.title}" was removed. (Self/Moderator action)`);
    });
  }

  if (canReport) {
    document.getElementById('reportPostBtn')?.addEventListener('click', () => {
      document.getElementById('reportPostId').value = postId;
      document.getElementById('reportReason').value = 'Spam or Misleading';
      document.getElementById('reportMessage').value = '';
      openModal('reportModal');
      closeModal('viewPostModal');
    });
  }

  openModal('viewPostModal');
};

document.getElementById('reportModalClose')?.addEventListener('click', () => closeModal('reportModal'));

document.getElementById('reportSubmitBtn')?.addEventListener('click', () => {
  const session = Store.get('session');
  if (!session) return;
  const postId = document.getElementById('reportPostId').value;
  const reason = document.getElementById('reportReason').value;
  const message = document.getElementById('reportMessage').value.trim();

  const allPosts = Store.get('posts');
  const targetPost = allPosts.find(p => p.id === postId);
  if (!targetPost) return;

  const currentReports = Store.get('reports');
  currentReports.push({
    id: 'rep' + Date.now(),
    postId: postId,
    postTitle: targetPost.title,
    uploaderId: targetPost.userId,
    reportedBy: session.userId,
    reporterName: session.username,
    reason: reason,
    message: message,
    date: new Date().toISOString()
  });

  Store.set('reports', currentReports);
  addAuditLog('Post reported', session.username, targetPost.title);

  closeModal('reportModal');
  customConfirm('Your report has been submitted anonymously to the moderation team. Thank you.', 'Report Received');
});

/* ─────────────────────────────────────────────
   ADMIN PORTAL
───────────────────────────────────────────── */
const ADMIN_CREDS = { 'Owner': 'owner123', 'AdminUser': 'admin456' };
// In production these would be server-verified. Demo hashes stored client-side.

const openAdminAuth = () => {
  const session = Store.get('session');
  if (session && ['owner', 'admin', 'staff'].includes(session.role)) {
    Store.set('adminSession', { userId: session.username, username: session.username, role: session.role });
    openAdminPortal();
  } else {
    openModal('adminAuthModal');
  }
};

document.getElementById('adminAnnouncementsBtn').addEventListener('click', openAdminAuth);
document.getElementById('footerAdminBtn').addEventListener('click', openAdminAuth);

document.getElementById('adminAuthSubmit').addEventListener('click', async () => {
  const username = document.getElementById('adminAuthUser').value.trim();
  const password = document.getElementById('adminAuthPass').value;
  const errEl = document.getElementById('adminAuthError');
  errEl.setAttribute('hidden', '');

  const users = Store.get('users');
  const hash = await hashPassword(password);
  const user = users.find(u => u.username === username && (u.passwordHash === hash || !u.passwordHash) && ['owner', 'admin', 'staff'].includes(u.role));

  if (!user) { errEl.textContent = 'Invalid credentials or insufficient permissions.'; errEl.removeAttribute('hidden'); return; }

  Store.set('adminSession', { userId: user.id, username: user.username, role: user.role });
  addAuditLog('Admin login', user.username, 'portal');
  closeModal('adminAuthModal');
  openAdminPortal();
});

const openAdminPortal = () => {
  const session = Store.get('adminSession');
  if (!session) { openAdminAuth(); return; }
  document.getElementById('adminUserInfo').innerHTML = `<strong>${sanitize(session.username)}</strong><br><span class="role-badge role-${session.role}">${sanitize(session.role)}</span>`;
  renderAdminPanel('dashboard');
  openModal('adminModal');
};

document.getElementById('adminLogout').addEventListener('click', () => {
  const s = Store.get('adminSession');
  if (s) addAuditLog('Admin logout', s.username, 'portal');
  Store.set('adminSession', null);
  closeModal('adminModal');
});

document.querySelectorAll('.admin-nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderAdminPanel(btn.dataset.panel);
  });
});

const canDo = (action) => {
  const s = Store.get('adminSession');
  if (!s) return false;
  if (s.role === 'owner') return true;
  if (s.role === 'admin') return ['post_announcement', 'manage_posts', 'view_users', 'manage_users', 'view_audit', 'view_status'].includes(action);
  if (s.role === 'staff') return ['post_announcement', 'manage_posts'].includes(action);
  return false;
};

const renderAdminPanel = (panel) => {
  const main = document.getElementById('adminMain');
  const session = Store.get('adminSession');

  switch (panel) {
    case 'dashboard': {
      const users = Store.get('users');
      const posts = Store.get('posts');
      const announcements = Store.get('announcements');
      main.innerHTML = `
        <div class="admin-panel-title">Dashboard</div>
        <div class="admin-stats-grid">
          <div class="admin-stat-card"><div class="stat-number">${users.length}</div><div class="stat-label">Total Users</div></div>
          <div class="admin-stat-card"><div class="stat-number">${posts.length}</div><div class="stat-label">Forum Posts</div></div>
          <div class="admin-stat-card"><div class="stat-number">${announcements.length}</div><div class="stat-label">Announcements</div></div>
        </div>
        <h3 style="font-size:0.95rem;margin-bottom:1rem;color:var(--mid);">Recent Activity</h3>
        ${Store.get('auditLog').slice(-5).reverse().map(l => `
          <div class="audit-entry">
            <div class="audit-action">${sanitize(l.action)}: <strong>${sanitize(l.target)}</strong></div>
            <div class="audit-meta"><span>By: ${sanitize(l.performedBy)}</span><span>${new Date(l.date).toLocaleString()}</span></div>
          </div>
        `).join('')}
      `;
      break;
    }
    case 'announcements': {
      const ann = Store.get('announcements');
      const canPost = canDo('post_announcement');
      main.innerHTML = `
        <div class="admin-section-header">
          <div class="admin-panel-title" style="border:none;margin:0;padding:0;">Announcements</div>
          ${canPost ? '<button class="btn-primary btn-sm" id="newAnnouncementBtn">+ New Announcement</button>' : '<span style="color:var(--mid);font-size:0.82rem;">View only</span>'}
        </div>
        <div style="overflow-x:auto; width:100%;"><table class="admin-table">
          <thead><tr><th>Subject</th><th>Author</th><th>Date</th>${canPost ? '<th>Actions</th>' : ''}</tr></thead>
          <tbody>
            ${ann.slice().reverse().map(a => {
        const author = Store.get('users').find(u => u.id === a.authorId);
        return `<tr>
                <td>${sanitize(a.subject)}</td>
                <td>${sanitize(author ? author.username : '—')}</td>
                <td>${new Date(a.date).toLocaleDateString()}</td>
                ${canPost ? `<td><button class="admin-btn danger" data-delete-ann="${sanitize(a.id)}">Delete</button></td>` : ''}
              </tr>`;
      }).join('')}
          </tbody>
        </table></div>
      `;
      document.getElementById('newAnnouncementBtn')?.addEventListener('click', () => openModal('composerModal'));
      main.querySelectorAll('[data-delete-ann]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!confirm('Delete this announcement?')) return;
          const anns = Store.get('announcements').filter(a => a.id !== btn.dataset.deleteAnn);
          Store.set('announcements', anns);
          addAuditLog('Announcement deleted', session.username, btn.dataset.deleteAnn);
          renderAnnouncements();
          renderAdminPanel('announcements');
        });
      });
      break;
    }
    case 'posts': {
      const posts = Store.get('posts');
      const users = Store.get('users');
      const canManage = canDo('manage_posts');
      main.innerHTML = `
        <div class="admin-panel-title">Forum Posts</div>
        <div style="overflow-x:auto; width:100%;"><table class="admin-table">
          <thead><tr><th>Title</th><th>Author</th><th>Category</th><th>Date</th>${canManage ? '<th>Actions</th>' : ''}</tr></thead>
          <tbody>
            ${posts.slice().reverse().map(p => {
        const author = users.find(u => u.username === p.userId);
        return `<tr>
                <td>${sanitize(p.title.slice(0, 40))}${p.title.length > 40 ? '…' : ''}</td>
                <td>${sanitize(author ? author.username : '—')}</td>
                <td>${sanitize(categoryLabels[p.category] || p.category)}</td>
                <td>${new Date(p.date).toLocaleDateString()}</td>
                ${canManage ? `<td><button class="admin-btn danger" data-delete-post="${sanitize(p.id)}">Delete</button></td>` : ''}
              </tr>`;
      }).join('')}
          </tbody>
        </table></div>
      `;
      main.querySelectorAll('[data-delete-post]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!confirm('Delete this post?')) return;
          const targetPost = Store.get('posts').find(p => p.id === btn.dataset.deletePost);
          const postsArr = Store.get('posts').filter(p => p.id !== btn.dataset.deletePost);
          Store.set('posts', postsArr);
          addAuditLog('Forum post deleted', session.username, btn.dataset.deletePost);
          if (targetPost && targetPost.userId !== session.username) {
            dispatchNotification(targetPost.userId, 'violation', 'Post Deleted', `Your post "${targetPost.title}" was removed by an Administrator.`);
          }
          renderForum();
          renderAdminPanel('posts');
        });
      });
      break;
    }
    case 'reports': {
      if (!canDo('manage_posts')) { main.innerHTML = '<div class="admin-panel-title">Report Logs</div><p style="color:var(--mid);">You do not have permission to view reports.</p>'; return; }
      const reports = Store.get('reports') || [];
      main.innerHTML = `
        <div class="admin-panel-title">Report Logs (${reports.length})</div>
        <div style="overflow-x:auto; width:100%;"><table class="admin-table">
          <thead><tr><th>Date</th><th>Reported By</th><th>Post Title</th><th>Reason</th><th>Message</th><th>Actions</th></tr></thead>
          <tbody>
            ${reports.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:var(--mid);">No active reports</td></tr>' : ''}
            ${reports.slice().reverse().map(r => `<tr>
              <td style="white-space:nowrap;">${new Date(r.date).toLocaleDateString()}</td>
              <td>${sanitize(r.reporterName || 'Unknown')}</td>
              <td><a href="#" class="report-view-post" data-post-id="${sanitize(r.postId)}" style="color:var(--white);text-decoration:underline;">${sanitize(r.postTitle ? r.postTitle.slice(0, 30) : '—')}${r.postTitle && r.postTitle.length > 30 ? '…' : ''}</a></td>
              <td><span style="color:var(--error);">${sanitize(r.reason)}</span></td>
              <td>${sanitize(r.message || '—')}</td>
              <td style="white-space:nowrap;">
                <button class="admin-btn danger" style="margin-right:0.4rem;" data-report-delete-post="${sanitize(r.postId)}" data-report-id="${sanitize(r.id)}">Delete Post</button>
                <button class="admin-btn danger" style="margin-right:0.4rem;" data-report-delete-user="${sanitize(r.uploaderId)}" data-report-id="${sanitize(r.id)}">Delete Account</button>
                <button class="admin-btn" style="color:var(--mid);" data-report-dismiss="${sanitize(r.id)}">Dismiss</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table></div>
      `;

      main.querySelectorAll('.report-view-post').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          openViewPost(link.dataset.postId);
        });
      });

      main.querySelectorAll('[data-report-dismiss]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!await customConfirm('Dismiss this report? No action will be taken.')) return;
          const rid = btn.dataset.reportDismiss;
          Store.set('reports', Store.get('reports').filter(r => r.id !== rid));
          if(sbClient) sbClient.from('reports').delete().eq('id', rid);
          addAuditLog('Report dismissed', session.username, rid);
          renderAdminPanel('reports');
        });
      });

      main.querySelectorAll('[data-report-delete-post]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!await customConfirm('Are you certain you want to delete the reported post?')) return;
          const pid = btn.dataset.reportDeletePost;
          const rid = btn.dataset.reportId;

          const targetPost = Store.get('posts').find(p => p.id === pid);
          if(sbClient) await sbClient.from('posts').delete().eq('id', pid); else Store.set('posts', Store.get('posts').filter(p => p.id !== pid));
          Store.set('reports', Store.get('reports').filter(r => r.id !== rid));
          if(sbClient) sbClient.from('reports').delete().eq('id', rid);
          addAuditLog('Post deleted via Report', session.username, pid);
          if (targetPost && targetPost.userId !== session.username) {
            dispatchNotification(targetPost.userId, 'violation', 'Post Removed', `Your post "${targetPost.title}" was removed for violating community guidelines.`);
          }
          renderForum();
          renderAdminPanel('reports');
        });
      });

      main.querySelectorAll('[data-report-delete-user]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!await customConfirm("DANGER: Delete the uploader's entire account, wipe all their posts, and clear their reports?")) return;
          const uid = btn.dataset.reportDeleteUser;
          const rid = btn.dataset.reportId;

          if (uid) {
            Store.set('users', Store.get('users').filter(u => u.id !== uid));
            const currentSession = Store.get('session');
            if (currentSession && currentSession.userId === uid) {
              Store.set('session', null);
              updateNavForSession();
            }
            Store.set('posts', Store.get('posts').filter(p => p.userId !== uid));
            Store.set('reports', Store.get('reports').filter(r => r.uploaderId !== uid));
            addAuditLog('User and posts wiped via Report', session.username, uid);
          } else {
            Store.set('reports', Store.get('reports').filter(r => r.id !== rid));
          }

          renderForum();
          renderAdminPanel('reports');
        });
      });
      break;
    }
    case 'users': {
      if (!canDo('view_users')) { main.innerHTML = '<div class="admin-panel-title">Users</div><p style="color:var(--mid);">You do not have permission to view users.</p>'; return; }
      const isOwner = session.role === 'owner';
      const canManage = canDo('manage_users');
      
      main.innerHTML = `<div class="admin-panel-title">Loading Users...</div>`;

      if (sbClient) {
        sbClient.from('users').select('*').then(({ data, error }) => {
          if (error) {
            main.innerHTML = `<p style="color:var(--error);">Failed to load users from Supabase.</p>`;
            return;
          }
          
          let usersList = data || [];
          // Organize by role logic (owner > admin > staff > member)
          const roleWeight = { 'owner': 4, 'admin': 3, 'staff': 2, 'member': 1 };
          usersList.sort((a, b) => {
            const diff = (roleWeight[b.role] || 0) - (roleWeight[a.role] || 0);
            return diff !== 0 ? diff : a.username.localeCompare(b.username);
          });

          main.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
              <div class="admin-panel-title">Users (${usersList.length})</div>
              <input type="text" id="adminUserSearch" class="form-input" placeholder="Search a username..." style="width:100%; max-width:250px; padding:0.4rem 0.8rem; margin-bottom:1.5rem;" />
            </div>
            <div style="overflow-x:auto; width:100%;"><table class="admin-table">
              <thead><tr><th>Username</th><th>Role</th><th>Joined</th>${canManage ? '<th>Actions</th>' : ''}</tr></thead>
              <tbody id="adminUsersTableBody">
                ${usersList.map(u => `<tr data-row-username="${sanitize(u.username)}">
                  <td>${sanitize(u.username)}</td>
                  <td><span class="role-badge role-${u.role}" id="badge-${sanitize(u.username)}">${sanitize(u.role)}</span></td>
                  <td>${sanitize(u.joined)}</td>
                  ${canManage && u.username !== session.username ? `<td>
                    ${isOwner ? `<select class="form-input form-select" style="padding:0.2rem 0.4rem;font-size:0.78rem;width:auto;display:inline-block;" data-role-user="${sanitize(u.username)}">
                      <option value="member"${u.role === 'member' ? ' selected' : ''}>member</option>
                      <option value="staff"${u.role === 'staff' ? ' selected' : ''}>staff</option>
                      <option value="admin"${u.role === 'admin' ? ' selected' : ''}>admin</option>
                    </select>
                    <button class="admin-btn" style="margin-left:0.4rem;" data-save-role="${sanitize(u.username)}">Save</button>` : ''}
                    <button class="admin-btn danger" style="margin-left:0.4rem;" data-delete-user="${sanitize(u.username)}">Delete</button>
                  </td>` : canManage ? '<td><span style="color:var(--mid);font-size:0.78rem;">You</span></td>' : ''}
                </tr>`).join('')}
              </tbody>
            </table></div>
          `;
          
          // Search functionality
          const searchInput = document.getElementById('adminUserSearch');
          if (searchInput) {
            searchInput.addEventListener('input', (e) => {
              const term = e.target.value.toLowerCase();
              document.querySelectorAll('#adminUsersTableBody tr').forEach(row => {
                const uname = row.dataset.rowUsername.toLowerCase();
                row.style.display = uname.includes(term) ? '' : 'none';
              });
            });
          }

          // Deletion handler
          main.querySelectorAll('[data-delete-user]').forEach(btn => {
            btn.addEventListener('click', async () => {
              if (!confirm('Are you sure you want to permanently delete this user account?')) return;
              const uname = btn.dataset.deleteUser;
              
              // Instant UI update
              const row = document.querySelector(`tr[data-row-username="${sanitize(uname)}"]`);
              if (row) row.remove();
              
              await sbClient.from('users').delete().eq('username', uname);
              
              const usersArr = Store.get('users').filter(u => u.username !== uname);
              Store.set('users', usersArr);

              if (session.username === uname) {
                Store.set('session', null);
                updateNavForSession();
                renderForum();
              }
              addAuditLog('User deleted', session.username, uname);
            });
          });

          // Role change handler
          main.querySelectorAll('[data-save-role]').forEach(btn => {
            btn.addEventListener('click', async () => {
              const uname = btn.dataset.saveRole;
              const select = main.querySelector(`[data-role-user="${sanitize(uname)}"]`);
              if (!select) return;
              const newRole = select.value;
              
              // Instant optimistic UI update
              const badge = main.querySelector(`#badge-${sanitize(uname)}`);
              let oldRole = 'unknown';
              if (badge) {
                oldRole = badge.textContent;
                badge.className = `role-badge role-${newRole}`;
                badge.textContent = newRole;
              }
              btn.textContent = 'Saved!';
              setTimeout(() => { if (btn) btn.textContent = 'Save'; }, 1500);
              
              await sbClient.from('users').update({ role: newRole }).eq('username', uname);

              const usersArr = Store.get('users');
              const user = usersArr.find(u => u.username === uname);
              if (user) {
                user.role = newRole;
                Store.set('users', usersArr);
                addAuditLog(`Role changed ${oldRole} → ${newRole}`, session.username, uname);
              }
            });
          });
        });
      } else {
        main.innerHTML = `<p style="color:var(--error);">Supabase disconnected.</p>`;
      }
      break;
    }
    case 'audit': {
      if (!canDo('view_audit')) { main.innerHTML = '<div class="admin-panel-title">Audit Log</div><p style="color:var(--mid);">You do not have permission to view the audit log.</p>'; return; }
      
      const allLogs = Store.get('auditLog').slice().reverse();
      
      const renderLogs = (filterDate) => {
         const filtered = filterDate 
            ? allLogs.filter(l => {
                const d = new Date(l.date);
                const lDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                return lDate === filterDate;
              })
            : allLogs;
            
         const countEl = document.getElementById('auditLogCount');
         if (countEl) countEl.textContent = `(${filtered.length} entries)`;
         
         const container = document.getElementById('auditLogContainer');
         if (!container) return;
         
         if (filtered.length === 0) {
             container.innerHTML = '<p style="color:var(--mid); padding:1rem 0;">No audit logs found for this date.</p>';
         } else {
             container.innerHTML = filtered.map(l => `
              <div class="audit-entry">
                <div class="audit-action">${sanitize(l.action)}: <strong>${sanitize(l.target)}</strong></div>
                <div class="audit-meta"><span>By: ${sanitize(l.performedBy)}</span><span>${new Date(l.date).toLocaleString()}</span></div>
              </div>
            `).join('');
         }
      };

      main.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom: 1.5rem;">
          <div class="admin-panel-title" style="margin-bottom:0;">Audit Log <span id="auditLogCount" style="font-size:1rem; color:var(--mid);"></span></div>
          <div style="display:flex; gap:0.5rem; align-items:center;">
             <span style="color:var(--mid); font-size:0.85rem;">Filter:</span>
             <input type="date" id="auditDateFilter" class="form-input" style="padding:0.4rem 0.8rem; width:auto; cursor:pointer;" />
             <button id="auditDateClearBtn" class="admin-btn" style="padding:0.4rem 0.8rem; display:none;">Clear</button>
          </div>
        </div>
        <div id="auditLogContainer"></div>
      `;
      
      renderLogs('');
      
      const dateInput = document.getElementById('auditDateFilter');
      const clearBtn = document.getElementById('auditDateClearBtn');
      
      dateInput.addEventListener('change', (e) => {
         const d = e.target.value;
         clearBtn.style.display = d ? 'inline-block' : 'none';
         renderLogs(d);
      });
      
      clearBtn.addEventListener('click', () => {
         dateInput.value = '';
         clearBtn.style.display = 'none';
         renderLogs('');
      });

      break;
    }
    case 'status': {
      if (!canDo('view_status')) { main.innerHTML = '<div class="admin-panel-title">System Status</div><p style="color:var(--mid);">You do not have permission to view the system status.</p>'; return; }

      const dbStatus = supabase ? '<span style="color:var(--primary); font-weight:bold;">Online (Connected)</span>' : '<span style="color:var(--error); font-weight:bold;">Offline</span>';

      main.innerHTML = `
        <div class="admin-panel-title">System Status</div>
        <div class="admin-stats-grid" style="grid-template-columns: 1fr;">
          <div class="admin-stat-card" style="text-align: left; padding: 2rem;">
            <div style="font-size: 1.2rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; color:var(--white);">Database Services</div>
            <p style="margin-bottom: 0.5rem;"><strong style="color:var(--white);">Supabase PostgreSQL:</strong> ${dbStatus}</p>
            <p style="margin-bottom: 0.5rem;"><strong style="color:var(--white);">Local Cache Storage:</strong> <span style="color:var(--primary); font-weight:bold;">Active</span></p>
            
            <div style="margin-top: 1.5rem; padding: 1.5rem; background: rgba(0,0,0,0.2); border-radius: var(--radius-lg); border: 1px solid var(--border);">
               <h4 style="margin-bottom: 1rem; color:var(--white); font-size:1rem;">Cloud Connectivity Test</h4>
               <button id="adminPingDbBtn" class="btn-primary btn-sm">Start Connection Test</button>
               <div id="adminPingDbResult" style="margin-top:1rem; font-size:0.95rem; color:var(--mid);">Awaiting test execution...</div>
            </div>
            
            <div style="font-size: 1.2rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; margin-top: 2rem; color:var(--white);">Application State</div>
            <p style="margin-bottom: 0.5rem;"><strong style="color:var(--white);">Version:</strong> 2.0.0</p>
            <p style="margin-bottom: 0.5rem;"><strong style="color:var(--white);">Total Data Collections:</strong> <span style="color:var(--primary); font-weight:bold;">Synchronized</span></p>
            <p style="margin-bottom: 0.5rem;"><strong style="color:var(--white);">Global Health:</strong> <span style="color:var(--primary); font-weight:bold;">All Systems Operational</span></p>
          </div>
        </div>
      `;

      setTimeout(() => {
        const pingBtn = document.getElementById('adminPingDbBtn');
        const pingRes = document.getElementById('adminPingDbResult');
        if (pingBtn && sbClient) {
          pingBtn.addEventListener('click', () => {
            pingBtn.disabled = true;
            pingRes.innerHTML = 'Connecting to cloud... <span class="loading-spinner" style="display:inline-block;width:12px;height:12px;border:2px solid var(--mid);border-top-color:var(--primary);border-radius:50%;animation:spin 1s linear infinite;"></span>';

            // Quick connection test for Supabase
            sbClient.from('status_check').upsert({ id: 'ping', last_online: new Date().toISOString(), message: "Hello from Peak Society Admin!" })
              .then(({ error }) => {
                if (error) throw error;
                const time = new Date().toLocaleTimeString();
                pingRes.innerHTML = `<span style="color:var(--primary);">✅ Supabase Connection Successful!</span> <span style="color:var(--mid);font-size:0.8rem;">(Last check: ${time})</span>`;
                console.log("✅ Supabase Connection Successful!");
                pingBtn.disabled = false;
                pingBtn.textContent = 'Run Test Again';
              })
              .catch((error) => {
                pingRes.innerHTML = `<span style="color:var(--error);">❌ Supabase Connection Error: ${sanitize(error.message || error)}</span>`;
                console.error("❌ Supabase Connection Error: ", error);
                pingBtn.disabled = false;
                pingBtn.textContent = 'Retry Test';
              });
          });
        } else if (pingBtn && !sbClient) {
          pingBtn.disabled = true;
          pingRes.innerHTML = '<span style="color:var(--error);">❌ Supabase is not initialized.</span>';
        }
      }, 0);
      break;
    }
  }
};

/* ─────────────────────────────────────────────
   AUDIT LOG HELPER
───────────────────────────────────────────── */
const addAuditLog = (action, performedBy, target) => {
  const logs = Store.get('auditLog');
  logs.push({ id: 'log' + Date.now(), action, performedBy, target, date: new Date().toISOString() });
  Store.set('auditLog', logs);
};

/* ─────────────────────────────────────────────
   RICH TEXT ANNOUNCEMENT COMPOSER
───────────────────────────────────────────── */
document.querySelectorAll('.toolbar-btn[data-cmd]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.execCommand(btn.dataset.cmd, false, null);
    document.getElementById('announcementBody').focus();
  });
});

document.getElementById('textColorPicker').addEventListener('input', (e) => {
  document.execCommand('foreColor', false, e.target.value);
  document.getElementById('announcementBody').focus();
});

document.getElementById('composerSubmit').addEventListener('click', async () => {
  const session = Store.get('adminSession');
  if (!session || !canDo('post_announcement')) { closeModal('composerModal'); return; }

  const subject = document.getElementById('announcementSubject').value.trim();
  const body = document.getElementById('announcementBody').innerHTML.trim();
  const errEl = document.getElementById('composerError');
  errEl.setAttribute('hidden', '');

  if (!subject) { errEl.textContent = 'Please provide a subject/title.'; errEl.removeAttribute('hidden'); return; }
  if (!body || body === '<br>') { errEl.textContent = 'Please write some content.'; errEl.removeAttribute('hidden'); return; }

  const newAnn = { id: 'a' + Date.now(), authorId: session.username, subject, body: sanitizeHTML(body), date: new Date().toISOString() };
  const newAnnDB = { id: newAnn.id, title: newAnn.subject, content: newAnn.body, author: newAnn.authorId, tag: 'Staff', created_at: newAnn.date };
  if (sbClient) {
      const { error } = await sbClient.from('announcements').insert([newAnnDB]);
      if (error) {
          errEl.textContent = 'Database Error: ' + error.message;
          errEl.removeAttribute('hidden');
          return;
      }
      // Optimistic UI Update so we don't have to wait for websocket bounce back
      const announcements = Store.get('announcements');
      announcements.push(newAnn);
      Store.set('announcements', announcements);
  } else {
      const announcements = Store.get('announcements');
      announcements.push(newAnn);
      Store.set('announcements', announcements);
  }
  addAuditLog('Announcement posted', session.username, subject);
  dispatchNotification('all', 'announcement', 'New Announcement', `Admin posted a new announcement: "${subject}".`, { hash: '#announcements' });

  document.getElementById('announcementSubject').value = '';
  document.getElementById('announcementBody').innerHTML = '';
  closeModal('composerModal');
  renderAnnouncements();
  renderAdminPanel('announcements');
});

/* ─────────────────────────────────────────────
   SECURITY: Prevent common attacks
───────────────────────────────────────────── */
// Disable right-click inspection of sensitive elements
document.querySelectorAll('.admin-main, .modal').forEach(el => {
  el.addEventListener('contextmenu', e => e.preventDefault());
});

// Rate limiting is handled inside the authSubmit listener above.

// Disable dev tools shortcut hint
document.addEventListener('keydown', e => {
  if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key))) {
    // Note: We don't block DevTools (impossible and counterproductive), 
    // but we ensure no sensitive data is in window scope
  }
});

// Freeze admin session check to prevent console manipulation
Object.freeze(canDo);
/* ─────────────────────────────────────────────
   PROFILE & ACCOUNT LOGIC
───────────────────────────────────────────── */
if (document.getElementById('navProfileWidget')) {
  document.getElementById('navProfileWidget').addEventListener('click', () => {
    const session = Store.get('session');
    if (!session) return;
    const users = Store.get('users');
    const me = users.find(u => u.username === session.username);
    if (!me) return;

    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.profile-panel').forEach(p => p.setAttribute('hidden', ''));
    document.querySelector('.profile-tab[data-target="profileDisplay"]')?.classList.add('active');
    document.getElementById('profileDisplay')?.removeAttribute('hidden');

    document.getElementById('profileDisplayName').value = me.displayName || me.username;
    document.getElementById('profileBio').value = me.bio || '';
    document.getElementById('profileYoutube').value = me.youtube || '';
    document.getElementById('profileDiscord').value = me.discord || '';

    const avatarEl = document.getElementById('profileEditAvatar');
    const innerBase = `<div class="profile-avatar-overlay">Upload</div><input type="file" id="profileImageUpload" accept="image/png, image/jpeg" />`;
    if (me.profilePicture) {
      avatarEl.style.backgroundImage = `url('${me.profilePicture}')`;
      avatarEl.innerHTML = innerBase;
      avatarEl.dataset.b64 = me.profilePicture;
    } else {
      avatarEl.style.backgroundImage = 'none';
      avatarEl.innerHTML = innerBase + '<span style="font-size: 2.5rem; color: var(--mid);">&#128100;</span>';
      avatarEl.dataset.b64 = '';
    }

    // Re-attach event listener since innerHTML replaced the input
    setTimeout(() => {
      document.getElementById('profileImageUpload')?.addEventListener('change', window.profileUploadCallback || (window.profileUploadCallback = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          const b64 = ev.target.result;
          const aEl = document.getElementById('profileEditAvatar');
          aEl.style.backgroundImage = `url('${b64}')`;
          aEl.innerHTML = innerBase; // Remove the user icon visually when uploaded
          aEl.dataset.b64 = b64;
        };
        reader.readAsDataURL(file);
      }));
    }, 50);

    document.getElementById('profileNewUsername').value = me.username;
    const lockEl = document.getElementById('usernameLockLabel');
    if (me.lastUsernameChange) {
      const ms = Date.now() - new Date(me.lastUsernameChange).getTime();
      const days = Math.floor(ms / (1000 * 60 * 60 * 24));
      if (days < 14) {
        lockEl.innerHTML = `<span style="color:var(--error);">Username locked for ${14 - days} more day(s)</span>`;
      } else {
        lockEl.innerHTML = `You can change your username.`;
      }
    } else {
      lockEl.innerHTML = `You can change your username.`;
    }
    document.getElementById('profileCurrentPass').value = '';
    document.getElementById('profileNewPass').value = '';

    openModal('profileModal');
  });
}

document.querySelectorAll('.profile-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.profile-panel').forEach(p => p.setAttribute('hidden', ''));

    tab.classList.add('active');
    document.getElementById(tab.dataset.target)?.removeAttribute('hidden');

    if (tab.dataset.target === 'profileActivity') {
      renderProfileActivity();
    }
  });
});

const renderProfileActivity = () => {
  const session = Store.get('session');
  const posts = Store.get('posts').filter(p => p.userId === session.username).sort((a, b) => new Date(b.date) - new Date(a.date));
  const list = document.getElementById('profileActivityList');
  if (!posts.length) {
    list.innerHTML = `<p style="color:var(--mid);">You haven't posted anything yet.</p>`;
    return;
  }
  list.innerHTML = posts.map(p => `
      <div class="activity-item" data-pid="${sanitize(p.id)}">
        <div class="activity-title">${sanitize(p.title)}</div>
        <div class="activity-meta"><span>❤️ ${likeCount}</span><span>💬 ${p.comments}</span><span>📅 ${new Date(p.date).toLocaleDateString()}</span></div>
      </div>
    `).join('');
  list.querySelectorAll('.activity-item').forEach(item => {
    item.addEventListener('click', () => { closeModal('profileModal'); openViewPost(item.dataset.pid); });
  });
};

document.getElementById('profileEditAvatar')?.addEventListener('click', () => {
  document.getElementById('profileImageUpload')?.click();
});

document.getElementById('profileImageUpload')?.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const b64 = ev.target.result;
    const avatarEl = document.getElementById('profileEditAvatar');
    avatarEl.style.backgroundImage = `url('${b64}')`;
    avatarEl.dataset.b64 = b64;
  };
  reader.readAsDataURL(file);
});

document.getElementById('saveProfileDisplayBtn')?.addEventListener('click', () => {
  const session = Store.get('session');
  const users = Store.get('users');
  const me = users.find(u => u.username === session.username);
  if (!me) return;

  me.displayName = document.getElementById('profileDisplayName').value.trim();
  me.bio = document.getElementById('profileBio').value.trim();
  me.youtube = document.getElementById('profileYoutube').value.trim();
  me.discord = document.getElementById('profileDiscord').value.trim();
  const newB64 = document.getElementById('profileEditAvatar')?.dataset.b64;
  me.profilePicture = newB64 || null;

  Store.set('users', users);
  if (sbClient) sbClient.from('users').update({profilePicture: me.profilePicture, displayName: me.displayName, bio: me.bio, youtube: me.youtube, discord: me.discord}).eq('username', me.username);
  updateNavForSession();
  renderForum();

  const succ = document.getElementById('profileDisplaySuccess');
  if (succ) { succ.removeAttribute('hidden'); setTimeout(() => { succ.setAttribute('hidden', ''); }, 3000); }
});

document.getElementById('saveUsernameBtn')?.addEventListener('click', () => {
  const newName = document.getElementById('profileNewUsername').value.trim();
  const session = Store.get('session');
  const users = Store.get('users');
  const me = users.find(u => u.username === session.username);

  if (!newName || newName === me.username) return;
  if (!/^[a-zA-Z0-9_]+$/.test(newName)) { alert('Only letters, numbers, and underscores allowed.'); return; }
  if (newName.length < 3 || newName.length > 32) { alert('Username must be 3-32 chars.'); return; }

  if (me.lastUsernameChange) {
    const ms = Date.now() - new Date(me.lastUsernameChange).getTime();
    if (ms < 14 * 24 * 60 * 60 * 1000) { alert("You can only change your username once every 14 days."); return; }
  }

  if (users.some(u => u.username.toLowerCase() === newName.toLowerCase() && u.id !== me.id)) { alert("Username is already taken."); return; }

  me.username = newName;
  me.lastUsernameChange = new Date().toISOString();
  Store.set('users', users);

  session.username = newName;
  Store.set('session', session);
  if (sbClient) sbClient.from('users').update({username: newName, lastUsernameChange: me.lastUsernameChange}).eq('id', me.id);
  alert('Username updated successfully!');
  updateNavForSession();
  renderForum();
});

document.getElementById('savePasswordBtn')?.addEventListener('click', async () => {
  const currPass = document.getElementById('profileCurrentPass').value;
  const newPass = document.getElementById('profileNewPass').value;
  const err = document.getElementById('profileAccountError');
  const succ = document.getElementById('profileAccountSuccess');
  if (err) err.setAttribute('hidden', '');
  if (succ) succ.style.display = 'none';

  if (!currPass || newPass.length < 6) {
    if (err) { err.textContent = 'Enter current password and a new password (min 6 chars).'; err.removeAttribute('hidden'); }
    return;
  }

  const session = Store.get('session');
  const users = Store.get('users');
  const me = users.find(u => u.username === session.username);

  const currHash = await hashPassword(currPass);
  if (me.passwordHash !== currHash) {
    if (err) { err.textContent = 'Current password is incorrect.'; err.removeAttribute('hidden'); }
    return;
  }

  me.passwordHash = await hashPassword(newPass);
  Store.set('users', users);
  if (sbClient) sbClient.from('users').update({passwordHash: me.passwordHash}).eq('username', session.username);

  if (succ) { succ.removeAttribute('hidden'); setTimeout(() => { succ.setAttribute('hidden', ''); }, 3000); }
  document.getElementById('profileCurrentPass').value = '';
  document.getElementById('profileNewPass').value = '';
});

document.getElementById('profileSignOutBtn')?.addEventListener('click', () => {
  closeModal('profileModal');
  signOut();
});

const openPublicProfile = (userId) => {
  const users = Store.get('users');
  const u = users.find(x => x.username === userId);
  if (!u) return;

  document.getElementById('publicUsername').textContent = u.displayName || u.username;
  document.getElementById('publicRoleBadge').innerHTML = `<span class="role-badge role-${u.role}">${u.role}</span>`;
  document.getElementById('publicBio').textContent = u.bio || 'This user has not set a bio yet.';

  const avatarBox = document.getElementById('publicAvatarBox');
  if (u.profilePicture) {
    avatarBox.style.backgroundImage = `url('${u.profilePicture}')`;
    avatarBox.innerHTML = '';
  } else {
    avatarBox.style.backgroundImage = 'none';
    avatarBox.innerHTML = '<span style="font-size: 2.5rem; color: var(--mid);">&#128100;</span>';
  }

  const socials = document.getElementById('publicSocials');
  let sHTML = '';
  if (u.youtube) sHTML += `<a href="${sanitize(u.youtube)}" target="_blank" style="padding:0.3rem 0.6rem; border-radius:10px; background:rgba(255,0,0,0.1); color:#ff4040; text-decoration:none; font-size:0.8rem;">▶ YouTube</a>`;
  if (u.discord) sHTML += `<span style="padding:0.3rem 0.6rem; border-radius:10px; background:rgba(88,101,242,0.1); color:#8899fa; font-size:0.8rem;">💬 ${sanitize(u.discord)}</span>`;
  socials.innerHTML = sHTML;

  const posts = Store.get('posts').filter(p => p.userId === u.id).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const activityList = document.getElementById('publicActivityList');
  if (!posts.length) {
    activityList.innerHTML = `<p style="color:var(--mid); font-size:0.85rem; text-align:center;">No posts yet.</p>`;
  } else {
    activityList.innerHTML = posts.map(p => `
         <div class="activity-item" data-pid="${sanitize(p.id)}" style="padding:0.8rem; text-align:left;">
           <div class="activity-title" style="font-size:0.95rem;">${sanitize(p.title)}</div>
           <div class="activity-meta"><span>❤️ ${likeCount}</span><span>📅 ${new Date(p.date).toLocaleDateString()}</span></div>
         </div>
       `).join('');
    activityList.querySelectorAll('.activity-item').forEach(item => {
      item.addEventListener('click', () => { closeModal('publicProfileModal'); openViewPost(item.dataset.pid); });
    });
  }

  openModal('publicProfileModal');
};

// Global listener for Firebase Real-time Updates
window.addEventListener('ps_db_updated', (e) => {
  const key = e.detail;
  if (key === 'posts') {
    if (typeof renderForum === 'function') renderForum();
    if (typeof renderAdminPosts === 'function' && !document.getElementById('adminModal').hasAttribute('hidden')) renderAdminPosts();
  } else if (key === 'announcements') {
    if (typeof renderAnnouncements === 'function') renderAnnouncements();
    if (typeof renderAdminAnnouncements === 'function' && !document.getElementById('adminModal').hasAttribute('hidden')) renderAdminAnnouncements();
  } else if (key === 'notifications') {
    if (typeof renderNotifications === 'function') renderNotifications();
  } else if (key === 'users') {
    // Just refresh admin panel if open
    if (typeof renderAdminUsers === 'function' && !document.getElementById('adminModal').hasAttribute('hidden')) renderAdminUsers();
  }
});
