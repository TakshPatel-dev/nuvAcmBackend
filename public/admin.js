// API endpoint - uses current domain for Vercel deployment
const API = window.location.origin;

// Get auth token from localStorage
const getAuthToken = () => localStorage.getItem('admin_token');
const getAuthHeaders = () => {
  const token = getAuthToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const eventsList = document.getElementById('events');
const statusEl = document.getElementById('status');
const preview = document.getElementById('preview');
const refreshBtn = document.getElementById('refresh');
const imagesInput = document.getElementById('images');

// Edit mode variables
let isEditMode = false;
let editingEventId = null;

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

imagesInput.addEventListener('change', (e) => {
  preview.innerHTML = '';
  Array.from(e.target.files || []).forEach((file) => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    preview.appendChild(img);
  });
});

async function fetchEvents() {
  try {
    const res = await fetch(API + '/events', {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Fetch failed');
    const data = await res.json();
    renderEvents(data);
    setStatus('Events loaded successfully', 'success');
  } catch (err) {
    console.error(err);
    setStatus('Failed to load events', 'error');
  }
}

function renderEvents(list) {
  const container = eventsList;
  const emptyState = document.getElementById('empty-state');
  if (!container || !emptyState) return;

  if (!Array.isArray(list) || !list.length) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  container.innerHTML = '';

  list.forEach((evt) => {
    const div = document.createElement('div');
    div.className = 'p-6 hover:bg-gray-50 transition-colors duration-200';
    div.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="flex-1 min-w-0">
          <div class="flex items-center space-x-2 mb-2">
            <h3 class="text-lg font-semibold text-gray-900 truncate">${evt.Heading || 'Untitled Event'}</h3>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              ${evt.reverse ? 'Reverse Layout' : 'Normal Layout'}
            </span>
          </div>
          <p class="text-gray-600 text-sm mb-3 line-clamp-2" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
            ${evt.Description ? evt.Description.substring(0, 150) + (evt.Description.length > 150 ? '...' : '') : 'No description available'}
          </p>
          <div class="flex items-center text-xs text-gray-500 space-x-4">
            <span class="flex items-center">
              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              ${evt.date || 'No date'}
            </span>
            <span class="flex items-center">
              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              ${evt.images?.length || 0} images
            </span>
            ${evt.formLink ? '<span class="text-green-600">Form ✓</span>' : '<span class="text-gray-400">No form</span>'}
            ${evt.qrLink ? '<span class="text-green-600 ml-2">QR ✓</span>' : '<span class="text-gray-400 ml-2">No QR</span>'}
          </div>
        </div>
        <div class="flex items-center space-x-2 ml-4">
          <button
            class="inline-flex items-center px-3 py-1.5 border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors duration-200"
            data-id="${evt.id}"
            data-action="edit"
          >
            <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
            Edit
          </button>
          <button
            class="inline-flex items-center px-3 py-1.5 border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors duration-200"
            data-id="${evt.id}"
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
    if (editBtn && evt.id) {
      editBtn.onclick = () => editEvent(evt);
    }
    if (deleteBtn && evt.id) {
      deleteBtn.onclick = () => deleteEvent(evt.id);
    }
    container.appendChild(div);
  });
}

async function deleteEvent(id) {
  if (!confirm('Delete this event?')) return;
  try {
    const res = await fetch(API + '/events/' + id, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Delete failed');
    fetchEvents();
  } catch (err) {
    console.error(err);
    alert('Delete failed');
  }
}

function editEvent(event) {
  // Set edit mode
  isEditMode = true;
  editingEventId = event.id;

  // Populate form with existing data
  document.getElementById('heading').value = event.Heading || '';
  document.getElementById('description').value = event.Description || '';
  document.getElementById('date').value = event.date || '';
  document.getElementById('formLink').value = event.formLink || '';
  document.getElementById('qrLink').value = event.qrLink || '';
  document.getElementById('reverse').value = event.reverse ? 'true' : 'false';

  // Update form UI
  const formTitle = document.querySelector('h2.text-lg.font-semibold');
  const submitBtn = document.querySelector('button[type="submit"]');

  if (formTitle) formTitle.textContent = 'Edit Event';
  if (submitBtn) {
    submitBtn.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
      </svg>
      <span>Update Event</span>
    `;
  }

  // Show existing images in preview
  if (event.images && event.images.length > 0) {
    preview.innerHTML = '';
    event.images.forEach((imageUrl, index) => {
      const container = document.createElement('div');
      container.style.position = 'relative';
      container.style.display = 'inline-block';
      container.style.margin = '4px';

      const img = document.createElement('img');
      img.src = imageUrl;
      img.style.maxWidth = '150px';
      img.style.maxHeight = '100px';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '8px';
      img.style.border = '2px solid #e5e7eb';
      img.title = `Current image ${index + 1}`;

      const removeBtn = document.createElement('button');
      removeBtn.innerHTML = '×';
      removeBtn.style.position = 'absolute';
      removeBtn.style.top = '-5px';
      removeBtn.style.right = '-5px';
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
        // Update the images array to mark this image for removal
        event.images[index] = null; // Mark for removal
      };

      container.appendChild(img);
      container.appendChild(removeBtn);
      preview.appendChild(container);
    });

    // Add note about existing images
    const note = document.createElement('p');
    note.textContent = 'Select new images above to add more, or click × to remove existing images.';
    note.style.fontSize = '12px';
    note.style.color = '#6b7280';
    note.style.marginTop = '8px';
    preview.appendChild(note);
  } else {
    preview.innerHTML = '';
  }

  imagesInput.value = '';

  // Scroll to form
  document.querySelector('.bg-white.rounded-xl').scrollIntoView({ behavior: 'smooth' });
}

function resetForm() {
  isEditMode = false;
  editingEventId = null;

  // Reset form UI
  const formTitle = document.querySelector('h2.text-lg.font-semibold');
  const submitBtn = document.querySelector('button[type="submit"]');

  if (formTitle) formTitle.textContent = 'New Event';
  if (submitBtn) {
    submitBtn.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
      </svg>
      <span>Create Event</span>
    `;
  }
}

document.getElementById('event-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  statusEl.textContent = 'Uploading...';
  statusEl.className = 'muted';
  try {
    // Upload images directly to ImageBB from the browser (only for new uploads)
    let imageUrls = [];
    if (imagesInput.files && imagesInput.files.length > 0) {
      const files = Array.from(imagesInput.files || []);
      console.log('Uploading', files.length, 'images to ImageBB...');

      // Show loading spinner in preview area
      preview.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; padding: 20px; color: #6b7280;">
          <div style="width: 40px; height: 40px; border: 3px solid #e5e7eb; border-top: 3px solid #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 12px;"></div>
          <p style="font-size: 14px; margin: 0;">Uploading ${files.length} image${files.length > 1 ? 's' : ''}...</p>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;

      imageUrls = await uploadImagesClient(files);
      console.log('Uploaded image URLs:', imageUrls);

      // Show uploaded images in preview
      if (imageUrls.length > 0) {
        preview.innerHTML = '';
        imageUrls.forEach((imageUrl, index) => {
          const img = document.createElement('img');
          img.src = imageUrl;
          img.style.maxWidth = '150px';
          img.style.maxHeight = '100px';
          img.style.objectFit = 'cover';
          img.style.borderRadius = '8px';
          img.style.margin = '4px';
          img.style.border = '2px solid #10b981';
          img.title = `Uploaded image ${index + 1}`;
          preview.appendChild(img);
        });

        const note = document.createElement('p');
        note.textContent = 'Images uploaded successfully!';
        note.style.fontSize = '12px';
        note.style.color = '#10b981';
        note.style.marginTop = '8px';
        note.style.fontWeight = '500';
        preview.appendChild(note);
      }
    }

    const payload = {
      Heading: document.getElementById('heading').value.trim(),
      Description: document.getElementById('description').value.trim(),
      date: document.getElementById('date').value.trim(),
      formLink: document.getElementById('formLink').value.trim(),
      qrLink: document.getElementById('qrLink').value.trim(),
      reverse: document.getElementById('reverse').value === 'true',
    };

    // Handle image updates for editing
    if (isEditMode) {
      // For editing, combine remaining existing images with new uploads
      const remainingImages = (event.images || []).filter(img => img !== null); // Remove marked for deletion
      payload.imageUrls = [...remainingImages, ...imageUrls];
    } else {
      // For new events, just use uploaded images
      if (imageUrls.length > 0) {
        payload.imageUrls = imageUrls;
      }
    }

    console.log('Sending payload to backend:', payload);

    const method = isEditMode ? 'PUT' : 'POST';
    const url = isEditMode ? `${API}/events/${editingEventId}` : `${API}/events`;

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
      throw new Error(txt || 'Error saving');
    }

    const successMsg = isEditMode ? 'Updated' : 'Saved';
    statusEl.textContent = successMsg;
    statusEl.className = 'ok';

    e.target.reset();
    preview.innerHTML = '';
    resetForm(); // Reset edit mode
    fetchEvents();
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Error: ' + err.message;
    statusEl.className = 'err';
  } finally {
    setTimeout(() => (statusEl.textContent = ''), 2500);
  }
});

refreshBtn.onclick = fetchEvents;
fetchEvents();

// ImageBB client upload (browser side)
async function uploadImagesClient(files) {
  if (!files.length) return [];
  const uploads = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];

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
    uploads.push(imageUrl);
  }
  return uploads;
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
