import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Post Submission Logic
old_post_submit = """  const posts = Store.get('posts');
  const newPost = { id: 'p' + Date.now(), userId: session.username, authorName: session.username, authorRole: session.role, category, title, body, image: imageBase64, likes: 0, comments: 0, likedBy: [], date: new Date().toISOString() };
  posts.push(newPost);
  Store.set('posts', posts);
  addAuditLog('Forum post created', session.username, title);"""

new_post_submit = """  const newPost = { id: 'p' + Date.now(), userId: session.username, category, title, body, image: imageBase64, likes: 0, comments: 0, likedBy: [], date: new Date().toISOString() };
  
  if (sbClient) {
      await sbClient.from('posts').insert([newPost]);
  } else {
      const posts = Store.get('posts');
      posts.push(newPost);
      Store.set('posts', posts);
  }
  addAuditLog('Forum post created', session.username, title);"""

content = content.replace(old_post_submit, new_post_submit)

# 2. Update Announcements Submission Logic
old_ann_submit = """  const announcements = Store.get('announcements');
  const newAnn = { id: 'a' + Date.now(), authorId: session.userId, subject, body: sanitizeHTML(body), date: new Date().toISOString() };
  announcements.push(newAnn);
  Store.set('announcements', announcements);
  addAuditLog('Announcement posted', session.username, subject);"""

new_ann_submit = """  const newAnn = { id: 'a' + Date.now(), authorId: session.username, subject, body: sanitizeHTML(body), date: new Date().toISOString() };
  if (sbClient) {
      await sbClient.from('announcements').insert([newAnn]);
  } else {
      const announcements = Store.get('announcements');
      announcements.push(newAnn);
      Store.set('announcements', announcements);
  }
  addAuditLog('Announcement posted', session.username, subject);"""

content = content.replace(old_ann_submit, new_ann_submit)

# Update post deletion logic
old_del_post = """Store.set('posts', Store.get('posts').filter(p => p.id !== pid));"""
new_del_post = """if(sbClient) await sbClient.from('posts').delete().eq('id', pid); else Store.set('posts', Store.get('posts').filter(p => p.id !== pid));"""
content = content.replace(old_del_post, new_del_post)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('Phase 2 migrations executed successfully.')
