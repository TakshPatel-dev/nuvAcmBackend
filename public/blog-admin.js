const API = window.location.origin;

const statusEl = () => document.getElementById('status');
const listEl = () => document.getElementById('blog-list');

const setStatus = (msg, isError = false) => {
  const el = statusEl();
  if (!el) return;
  el.textContent = msg || '';
  el.style.color = isError ? '#fca5a5' : '#a5f3fc';
};

const renderBlogs = (blogs = []) => {
  const container = listEl();
  if (!container) return;
  container.innerHTML = '';
  if (!blogs.length) {
    container.innerHTML = '<div class="muted">No blogs yet. Add one above.</div>';
    return;
  }
  blogs.forEach((b) => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <div class="item-head">
        <div>
          <div style="font-weight:700;font-size:16px;">${b.title || ''}</div>
          <div class="muted">${b.date || ''}${b.readTime ? ' • ' + b.readTime : ''}</div>
        </div>
        <div class="tag">${b.tag || 'Blog'}</div>
      </div>
      <div class="muted" style="white-space:pre-line">${b.excerpt || ''}</div>
      <div class="actions">
        <button class="ghost" data-id="${b.id}" data-action="delete">Delete</button>
      </div>
    `;
    const delBtn = div.querySelector('[data-action="delete"]');
    if (delBtn) {
      delBtn.onclick = async () => {
        if (!b.id) return;
        try {
          const res = await fetch(`${API}/blogs/${b.id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Delete failed');
          setStatus('Deleted blog.');
          loadBlogs();
        } catch (e) {
          setStatus('Failed to delete blog.', true);
        }
      };
    }
    container.appendChild(div);
  });
};

const loadBlogs = async () => {
  try {
    setStatus('Loading blogs...');
    const res = await fetch(`${API}/blogs`);
    if (!res.ok) throw new Error('Failed');
    const data = await res.json();
    renderBlogs(Array.isArray(data) ? data : []);
    setStatus('Loaded.');
  } catch (e) {
    setStatus('Failed to load blogs.', true);
  }
};

// ImgHippo client upload (browser side to avoid CF challenges)
async function uploadImageClient(file) {
  if (!file) return null;
  const form = new FormData();
  form.append('api_key', '0e5829420afdd52bc447cf220d3b95e0');
  form.append('file', file, file.name || 'upload');
  form.append('title', file.name || 'upload');

  const res = await fetch('https://api.imghippo.com/v1/upload', {
    method: 'POST',
    body: form,
  });
  const text = await res.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch (err) {
    console.error('Failed to parse ImgHippo response:', text);
    throw new Error('Invalid response from image host');
  }
  
  if (!res.ok || !json.success) {
    console.error('ImgHippo upload failed:', {
      status: res.status,
      statusText: res.statusText,
      response: json,
    });
    throw new Error(json.message || json.error || 'Image upload failed');
  }
  
  // ImgHippo returns URL in data.url or data.direct_url
  const imageUrl = json.data?.direct_url || json.data?.url || json.direct_url || json.url;
  if (!imageUrl) {
    console.error('No URL in ImgHippo response:', json);
    throw new Error('No image URL returned from upload service');
  }
  return imageUrl;
}

const handleSubmit = () => {
  const form = document.getElementById('blog-form');
  const imageInput = document.getElementById('image');
  const imagePreview = document.getElementById('image-preview');
  
  if (!form) return;
  
  // Preview image on selection
  if (imageInput) {
    imageInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.style.maxWidth = '200px';
        img.style.maxHeight = '200px';
        img.style.borderRadius = '8px';
        img.style.marginTop = '8px';
        imagePreview.innerHTML = '';
        imagePreview.appendChild(img);
      } else {
        imagePreview.innerHTML = '';
      }
    });
  }
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    
    // cleanup
    Object.keys(payload).forEach((k) => {
      if (typeof payload[k] === 'string') payload[k] = payload[k].trim();
    });
    
    if (!payload.title || !payload.excerpt) {
      setStatus('Title and excerpt are required.', true);
      return;
    }
    
    try {
      setStatus('Uploading image...');
      
      let imageUrl = typeof payload.image === 'string' ? payload.image : '';
      const imageFile = imageInput?.files?.[0];
      console.log('Image file present?', !!imageFile, imageFile?.name);
      console.log('Existing image URL value:', imageUrl);
      if (imageFile) {
        console.log('Uploading image to ImgHippo...');
        imageUrl = await uploadImageClient(imageFile);
        console.log('Uploaded image URL:', imageUrl);
      }
      payload.image = imageUrl || '';
      console.log('Final payload image URL:', payload.image);
      
      setStatus('Saving blog...');
      console.log('Sending payload to backend:', payload);
      
      const res = await fetch(`${API}/blogs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed');
      }
      setStatus('Saved blog.');
      form.reset();
      imagePreview.innerHTML = '';
      loadBlogs();
    } catch (err) {
      console.error(err);
      setStatus('Failed to save blog: ' + err.message, true);
    }
  });
};

const init = () => {
  const refreshBtn = document.getElementById('refresh');
  if (refreshBtn) refreshBtn.onclick = loadBlogs;
  handleSubmit();
  loadBlogs();
};

document.addEventListener('DOMContentLoaded', init);

