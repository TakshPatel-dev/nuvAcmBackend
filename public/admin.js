// API endpoint - adjust this if backend is on different port
const API = 'http://localhost:4000';

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
    const btn = div.querySelector('[data-action="delete"]');
    if (btn && evt.id) {
      btn.onclick = () => deleteEvent(evt.id);
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

document.getElementById('event-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  statusEl.textContent = 'Uploading...';
  statusEl.className = 'muted';
  try {
    // Upload images directly to ImageBB from the browser
    const files = Array.from(imagesInput.files || []);
    console.log('Uploading', files.length, 'images to ImageBB...');
    const imageUrls = await uploadImagesClient(files);
    console.log('Uploaded image URLs:', imageUrls);

    const payload = {
      Heading: document.getElementById('heading').value.trim(),
      Description: document.getElementById('description').value.trim(),
      date: document.getElementById('date').value.trim(),
      formLink: document.getElementById('formLink').value.trim(),
      qrLink: document.getElementById('qrLink').value.trim(),
      reverse: document.getElementById('reverse').value === 'true',
      imageUrls,
    };
    console.log('Sending payload to backend:', { ...payload, imageUrls });

    const res = await fetch(API + '/events', {
      method: 'POST',
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
    statusEl.textContent = 'Saved';
    statusEl.className = 'ok';
    e.target.reset();
    preview.innerHTML = '';
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
