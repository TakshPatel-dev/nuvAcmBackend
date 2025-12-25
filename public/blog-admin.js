// API endpoint - adjust this if backend is on different port
const API = 'http://localhost:4000';

// Get auth token from localStorage
const getAuthToken = () => localStorage.getItem('admin_token');
const getAuthHeaders = () => {
  const token = getAuthToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const statusEl = () => document.getElementById('status');
const listEl = () => document.getElementById('blog-list');

// Edit mode variables
let isEditMode = false;
let editingBlogId = null;
let imageMarkedForRemoval = false;

const setStatus = (msg, type = 'info') => {
  const el = statusEl();
  if (!el) return;

  // Clear existing classes
  el.className = 'text-sm px-3 py-2 rounded-lg border transition-all duration-300 inline-flex items-center gap-2';

  if (type === 'success') {
    el.classList.add('status-success');
    el.innerHTML = `<span>✓</span> ${msg || ''}`;
  } else if (type === 'error') {
    el.classList.add('status-error');
    el.innerHTML = `<span>✕</span> ${msg || ''}`;
  } else if (type === 'loading') {
    el.classList.add('status-info');
    el.innerHTML = `<div class="loading-spinner"></div> ${msg || ''}`;
  } else {
    el.classList.add('status-info');
    el.textContent = msg || '';
  }
};

const renderBlogs = (blogs = []) => {
  const container = listEl();
  const emptyState = document.getElementById('empty-state');
  if (!container || !emptyState) return;

  if (!blogs.length) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  container.innerHTML = '';

  blogs.forEach((b) => {
    const div = document.createElement('div');
    div.className = 'p-6 hover:bg-gray-50 transition-colors duration-200';
    div.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="flex-1 min-w-0">
          <div class="flex items-center space-x-2 mb-2">
            <h3 class="text-lg font-semibold text-gray-900 truncate">${b.title || 'Untitled Post'}</h3>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              ${b.tag || 'Blog'}
            </span>
          </div>
          <p class="text-gray-600 text-sm mb-3 line-clamp-2" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
            ${b.excerpt || 'No description available'}
          </p>
          <div class="flex items-center text-xs text-gray-500 space-x-4">
            <span class="flex items-center">
              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              ${b.date || 'No date'}
            </span>
            ${b.readTime ? `
            <span class="flex items-center">
              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              ${b.readTime}
            </span>
            ` : ''}
          </div>
        </div>
        <div class="flex items-center space-x-2 ml-4">
          <button
            class="inline-flex items-center px-3 py-1.5 border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors duration-200"
            data-id="${b.id}"
            data-action="edit"
          >
            <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
            Edit
          </button>
          <button
            class="inline-flex items-center px-3 py-1.5 border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors duration-200"
            data-id="${b.id}"
            data-action="delete"
          >
            <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
            Delete
          </button>
        </div>
      </div>
    `;
    const editBtn = div.querySelector('[data-action="edit"]');
    const deleteBtn = div.querySelector('[data-action="delete"]');
    if (editBtn && b.id) {
      editBtn.onclick = () => editBlog(b);
    }
    if (deleteBtn && b.id) {
      deleteBtn.onclick = async () => {
        if (!confirm('Are you sure you want to delete this blog post? This action cannot be undone.')) return;
        try {
          setStatus('Deleting blog post...', 'loading');
          const res = await fetch(`${API}/blogs/${b.id}`, { method: 'DELETE', headers: getAuthHeaders() });
          if (!res.ok) throw new Error('Delete failed');
          setStatus('Blog post deleted successfully', 'success');
          loadBlogs();
        } catch (e) {
          setStatus('Failed to delete blog post', 'error');
        }
      };
    }
    container.appendChild(div);
  });
};

const loadBlogs = async () => {
  try {
    setStatus('Loading blogs...', 'loading');
    const res = await fetch(`${API}/blogs`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed');
    const data = await res.json();
    renderBlogs(Array.isArray(data) ? data : []);
    setStatus('Blogs loaded successfully', 'success');
  } catch (e) {
    setStatus('Failed to load blogs', 'error');
  }
};

function editBlog(blog) {
  // Set edit mode
  isEditMode = true;
  editingBlogId = blog.id;

  // Populate form with existing data
  document.getElementById('title').value = blog.title || '';
  document.getElementById('tag').value = blog.tag || 'Blog';
  document.getElementById('date').value = blog.date || '';
  document.getElementById('readTime').value = blog.readTime || '';
  document.getElementById('excerpt').value = blog.excerpt || '';
  document.getElementById('content').value = blog.content || '';

  // Update form UI
  const formTitle = document.querySelector('h2.text-lg.font-semibold');
  const submitBtn = document.querySelector('button[type="submit"]');

  if (formTitle) formTitle.textContent = 'Edit Blog Post';
  if (submitBtn) {
    submitBtn.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
      </svg>
      <span>Update Blog Post</span>
    `;
  }

  // Show existing image in preview
  if (blog.image) {
    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.display = 'inline-block';

    const img = document.createElement('img');
    img.src = blog.image;
    img.style.maxWidth = '200px';
    img.style.maxHeight = '200px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '8px';
    img.style.marginTop = '8px';
    img.style.border = '2px solid #e5e7eb';
    img.title = 'Current blog image';

    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = '×';
    removeBtn.style.position = 'absolute';
    removeBtn.style.top = '3px';
    removeBtn.style.right = '3px';
    removeBtn.style.background = '#ef4444';
    removeBtn.style.color = 'white';
    removeBtn.style.border = 'none';
    removeBtn.style.borderRadius = '50%';
    removeBtn.style.width = '20px';
    removeBtn.style.height = '20px';
    removeBtn.style.fontSize = '14px';
    removeBtn.style.fontWeight = 'bold';
    removeBtn.style.cursor = 'pointer';
    removeBtn.style.display = 'flex';
    removeBtn.style.alignItems = 'center';
    removeBtn.style.justifyContent = 'center';
    removeBtn.title = 'Remove this image';
    removeBtn.onclick = () => {
      container.remove();
      // Mark for removal
      imageMarkedForRemoval = true;
      document.getElementById('image-preview').innerHTML = '<p style="color: #6b7280; font-size: 12px; margin-top: 8px;">Image will be removed when you save.</p>';
    };

    container.appendChild(img);
    container.appendChild(removeBtn);

    // Add note about existing image
    const note = document.createElement('p');
    note.textContent = 'Select a new image above to replace this, or click × to remove current image.';
    note.style.fontSize = '12px';
    note.style.color = '#6b7280';
    note.style.marginTop = '8px';

    document.getElementById('image-preview').innerHTML = '';
    document.getElementById('image-preview').appendChild(container);
    document.getElementById('image-preview').appendChild(note);
  } else {
    document.getElementById('image-preview').innerHTML = '';
  }

  document.getElementById('image').value = '';

  // Scroll to form
  document.querySelector('.bg-white.rounded-xl').scrollIntoView({ behavior: 'smooth' });
}

function resetForm() {
  isEditMode = false;
  editingBlogId = null;
  imageMarkedForRemoval = false; // Reset the removal flag

  // Reset form UI
  const formTitle = document.querySelector('h2.text-lg.font-semibold');
  const submitBtn = document.querySelector('button[type="submit"]');

  if (formTitle) formTitle.textContent = 'New Blog Post';
  if (submitBtn) {
    submitBtn.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
      </svg>
      <span>Create Blog Post</span>
    `;
  }
}

// ImageBB client upload (browser side)
async function uploadImageClient(file) {
  if (!file) return null;

  // Convert file to base64 for ImageBB API
  const base64 = await fileToBase64(file);

  const form = new FormData();
  form.append('image', base64);

  const res = await fetch('https://api.imgbb.com/1/upload?key=05ed47146407ec4673e86cf2108594d8', {
    method: 'POST',
    body: form,
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    console.error('ImageBB upload failed:', {
      status: res.status,
      statusText: res.statusText,
      response: json,
    });
    throw new Error(json.error?.message || 'Image upload failed');
  }

  // ImageBB returns URL in data.url
  const imageUrl = json.data?.url;
  if (!imageUrl) {
    console.error('No URL in ImageBB response:', json);
    throw new Error('No image URL returned from upload service');
  }
  return imageUrl;
}

// Helper function to convert file to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Remove the "data:image/jpeg;base64," prefix
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
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
      setStatus('Title and excerpt are required', 'error');
      return;
    }

    try {
      // For editing, we want to preserve existing image unless new one is uploaded
      let imageUrl = '';
      if (isEditMode) {
        // When editing, start with empty string - only set if new image uploaded
        imageUrl = '';
      } else {
        // For new posts, use any existing value from form
        imageUrl = typeof payload.image === 'string' ? payload.image : '';
      }

      const imageFile = imageInput?.files?.[0];
      console.log('Image file present?', !!imageFile, imageFile?.name);
      console.log('Existing image URL value:', imageUrl);

      if (imageFile) {
        setStatus('Uploading image...', 'loading');

        // Show loading spinner in preview area
        imagePreview.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; padding: 20px; color: #6b7280;">
            <div style="width: 40px; height: 40px; border: 3px solid #e5e7eb; border-top: 3px solid #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 12px;"></div>
            <p style="font-size: 14px; margin: 0;">Uploading image...</p>
          </div>
          <style>
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        `;

        console.log('Uploading image to ImageBB...');
        imageUrl = await uploadImageClient(imageFile);
        console.log('Uploaded image URL:', imageUrl);

        // Show uploaded image in preview
        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.maxWidth = '200px';
        img.style.maxHeight = '200px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '8px';
        img.style.marginTop = '8px';
        img.style.border = '2px solid #10b981';
        img.title = 'Uploaded image';

        // Add success note
        const note = document.createElement('p');
        note.textContent = 'Image uploaded successfully!';
        note.style.fontSize = '12px';
        note.style.color = '#10b981';
        note.style.marginTop = '8px';
        note.style.fontWeight = '500';

        imagePreview.innerHTML = '';
        imagePreview.appendChild(img);
        imagePreview.appendChild(note);
      }

      // Handle image updates for editing
      if (isEditMode) {
        console.log('EDIT MODE: imageUrl present?', !!imageUrl, 'imageMarkedForRemoval?', imageMarkedForRemoval);
        if (imageUrl) {
          // New image uploaded - use it
          payload.image = imageUrl;
          imageMarkedForRemoval = false; // Reset the flag
          console.log('EDIT MODE: Setting payload.image to new URL:', imageUrl);
        } else if (imageMarkedForRemoval) {
          // Image marked for removal - set to null
          payload.image = null;
          imageMarkedForRemoval = false; // Reset the flag
          console.log('EDIT MODE: Setting payload.image to null (removal)');
        } else {
          console.log('EDIT MODE: No changes to image, preserving existing');
        }
        // If no new image and not marked for removal, don't include image field to preserve existing
      } else {
        // For new posts, only set image if uploaded
        if (imageUrl) {
          payload.image = imageUrl;
          console.log('NEW POST: Setting payload.image to:', imageUrl);
        } else {
          console.log('NEW POST: No image uploaded');
        }
      }
      console.log('Final payload image:', payload.image !== undefined ? payload.image : '(preserving existing)');

      setStatus('Saving blog post...', 'loading');

      setStatus('Saving blog post...', 'loading');
      console.log('Sending payload to backend:', payload);

      const method = isEditMode ? 'PUT' : 'POST';
      const url = isEditMode ? `${API}/blogs/${editingBlogId}` : `${API}/blogs`;

      const res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed');
      }

      const successMsg = isEditMode ? 'Blog post updated successfully' : 'Blog post saved successfully';
      setStatus(successMsg, 'success');

      form.reset();
      imagePreview.innerHTML = '';
      resetForm(); // Reset edit mode
      loadBlogs();
    } catch (err) {
      console.error(err);
      setStatus('Failed to save blog: ' + err.message, 'error');
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
