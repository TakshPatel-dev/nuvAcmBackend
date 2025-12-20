const API = window.location.origin;
const eventsList = document.getElementById('events');
const statusEl = document.getElementById('status');
const preview = document.getElementById('preview');
const refreshBtn = document.getElementById('refresh');
const imagesInput = document.getElementById('images');

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
    const res = await fetch(API + '/events');
    if (!res.ok) throw new Error('Fetch failed');
    const data = await res.json();
    renderEvents(data);
    statusEl.textContent = '';
    statusEl.className = 'muted';
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Failed to load events';
    statusEl.className = 'err';
  }
}

function renderEvents(list) {
  eventsList.innerHTML = '';
  if (!Array.isArray(list) || !list.length) {
    eventsList.innerHTML = '<div class="muted">No events yet.</div>';
    return;
  }
  list.forEach((evt) => {
    const div = document.createElement('div');
    div.className = 'event-item';
    div.innerHTML = `
      <div class="event-head">
        <div>
          <div><strong>${evt.Heading || ''}</strong></div>
          <div class="muted">${evt.date || 'No date'} • Images: ${evt.images?.length || 0}</div>
        </div>
        <button class="danger" data-id="${evt.id || ''}">Delete</button>
      </div>
      <div class="muted">Reverse: ${evt.reverse ? 'Yes' : 'No'} • Form: ${evt.formLink ? 'set' : '—'} • QR: ${evt.qrLink ? 'set' : '—'}</div>
    `;
    const btn = div.querySelector('button');
    if (btn && evt.id) {
      btn.onclick = () => deleteEvent(evt.id);
    }
    eventsList.appendChild(div);
  });
}

async function deleteEvent(id) {
  if (!confirm('Delete this event?')) return;
  try {
    const res = await fetch(API + '/events/' + id, { method: 'DELETE' });
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
    // Upload images directly to ImgHippo from the browser to avoid server-side CF blocks
    const files = Array.from(imagesInput.files || []);
    console.log('Uploading', files.length, 'images to ImgHippo...');
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
      headers: { 'Content-Type': 'application/json' },
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

// ImgHippo client upload (browser side to avoid CF challenges)
async function uploadImagesClient(files) {
  if (!files.length) return [];
  const uploads = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const form = new FormData();
    form.append('api_key', '0e5829420afdd52bc447cf220d3b95e0');
    form.append('file', file, file.name || `upload-${i + 1}`);
    form.append('title', file.name || `upload-${i + 1}`);

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
    uploads.push(imageUrl);
  }
  return uploads;
}


