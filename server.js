import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { Blob } from 'buffer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Config
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://admin:ACMadmin@cluster0.gzl0kaw.mongodb.net/?appName=Cluster0';
const MONGODB_DB = process.env.MONGODB_DB || 'nuvacm';
const IMGHIPPO_API_KEY = process.env.IMGHIPPO_API_KEY || '0e5829420afdd52bc447cf220d3b95e0';

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI env var. Set it to your Mongo connection string.');
  process.exit(1);
}

// App
const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use('/admin-assets', express.static(path.join(__dirname, 'public')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Explicit route to serve admin JS with correct MIME in case static fails
app.get('/admin-assets/admin.js', (_req, res) => {
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'public', 'admin.js'));
});
app.get('/admin-assets/blog-admin.js', (_req, res) => {
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'public', 'blog-admin.js'));
});

// Mongo
mongoose
  .connect(MONGODB_URI, { dbName: MONGODB_DB })
  .then(() => console.log('Connected to MongoDB', { db: MONGODB_DB }))
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

// Model
const eventSchema = new mongoose.Schema(
  {
    Heading: { type: String, required: true },
    Description: { type: mongoose.Schema.Types.Mixed, required: true },
    images: { type: [String], default: [] },
    date: String,
    formLink: String,
    qrLink: String,
    reverse: { type: Boolean, default: false },
    eventNumber: Number,
  },
  { timestamps: true }
);
// Indexes to speed sorting and numbering
eventSchema.index({ eventNumber: 1 });
eventSchema.index({ createdAt: 1 });
const EventModel = mongoose.model('Event', eventSchema);
const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    tag: { type: String, default: 'Blog' },
    date: String,
    readTime: String,
    excerpt: { type: String, required: true },
    image: String,
    content: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);
const BlogModel = mongoose.model('Blog', blogSchema);

const formatEvent = (doc) => {
  const obj = doc.toObject();
  obj.id = obj._id.toString();
  delete obj._id;
  delete obj.__v;
  return obj;
};

// Helpers
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } });

function fileToBlob(file) {
  if (!file || !file.buffer) return null;
  return new Blob([file.buffer], { type: file.mimetype || 'application/octet-stream' });
}

async function uploadToImgHippoFromBlob(blob, title = 'upload') {
  if (!blob) throw new Error('Invalid image data');
  const form = new FormData();
  form.append('api_key', IMGHIPPO_API_KEY);
  form.append('file', blob, title);
  if (title) form.append('title', title);

  const res = await fetch('https://api.imghippo.com/v1/upload', {
    method: 'POST',
    body: form,
    // Avoid Cloudflare challenges by sending a browser-like UA
    headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36' },
  });
  const text = await res.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch (_err) {
    // leave json empty
  }
  if (!res.ok || !json.success) {
    console.error('ImgHippo upload failed', {
      status: res.status,
      statusText: res.statusText,
      body: text?.slice(0, 500),
    });
    throw new Error(json.message || text || 'Image upload failed');
  }
  // prefer direct_url, fall back to url
  return json.direct_url || json.url;
}

async function uploadFilesArray(files = [], title = 'upload') {
  if (!Array.isArray(files) || !files.length) return [];
  const uploads = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    if (!file) continue;
    const blob = fileToBlob(file);
    const filename = file?.originalname || `${title}-${i + 1}`;
    const url = await uploadToImgHippoFromBlob(blob, filename);
    uploads.push(url);
  }
  return uploads;
}

// Routes
app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/events', async (_req, res) => {
  try {
    // Use indexed sort for fast response
    const events = await EventModel.find().sort({ eventNumber: 1, createdAt: 1 }).lean();
    res.json(
      events.map((e) => ({
        ...e,
        id: e._id.toString(),
        _id: undefined,
        __v: undefined,
      }))
    );
  } catch (e) {
    console.error('Failed to fetch events:', e);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

app.post('/events', upload.array('images', 10), async (req, res) => {
  try {
    const { Heading, Description, date, formLink, qrLink, imageUrls } = req.body || {};
    const reverse = req.body?.reverse === 'true' || req.body?.reverse === true;
    const imagesFromBody = Array.isArray(imageUrls) ? imageUrls : imageUrls ? [imageUrls] : [];
    const files = Array.isArray(req.files) ? req.files : [];
    
    console.log('Received imageUrls:', imageUrls);
    console.log('Parsed imagesFromBody:', imagesFromBody);
    console.log('Received files:', files.length);
    
    if (!Heading || !Description) {
      return res.status(400).json({ error: 'Heading and Description are required' });
    }

    // Upload images to ImgHippo (files first, then any pre-hosted URLs)
    const uploadedFiles = await uploadFilesArray(files, Heading || 'event');
    const uploadedStrings = imagesFromBody.filter((u) => typeof u === 'string' && /^https?:\/\//.test(u));
    const uploadedImages = [...uploadedFiles, ...uploadedStrings];
    
    console.log('Final uploadedImages:', uploadedImages);

    // Find the maximum eventNumber to ensure sequential numbering
    const maxEvent = await EventModel.findOne().sort({ eventNumber: -1 }).lean();
    const nextEventNumber = maxEvent && maxEvent.eventNumber ? maxEvent.eventNumber + 1 : 1;
    const event = await EventModel.create({
      Heading,
      Description,
      images: uploadedImages,
      date,
      formLink,
      qrLink,
      reverse,
      eventNumber: nextEventNumber,
    });
    res.status(201).json(formatEvent(event));
  } catch (e) {
    console.error('Failed to create event:', e);
    res.status(500).json({ error: 'Failed to create event', detail: e.message });
  }
});

app.put('/events/:id', async (req, res) => {
  try {
    const updated = await EventModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(formatEvent(updated));
  } catch (e) {
    console.error('Failed to update event:', e);
    res.status(500).json({ error: 'Failed to update event', detail: e.message });
  }
});

app.delete('/events/:id', async (req, res) => {
  try {
    const deleted = await EventModel.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('Failed to delete event:', e);
    res.status(500).json({ error: 'Failed to delete event', detail: e.message });
  }
});

// Blog routes
app.get('/blogs', async (_req, res) => {
  try {
    // Use native MongoDB collection to enable allowDiskUse for large sorts
    const collection = BlogModel.collection;
    const blogs = await collection.find({}).sort({ createdAt: -1 }).allowDiskUse(true).toArray();
    res.json(
      blogs.map((b) => {
        const { _id, __v, ...rest } = b;
        return {
          ...rest,
          id: _id.toString(),
        };
      })
    );
  } catch (e) {
    console.error('Failed to fetch blogs:', e);
    res.status(500).json({ error: 'Failed to fetch blogs' });
  }
});

app.post('/blogs', async (req, res) => {
  try {
    const { title, tag = 'Blog', date, readTime, excerpt, image, content } = req.body || {};
    console.log('Received blog data:', { title, image, hasImage: !!image });
    if (!title || !excerpt) return res.status(400).json({ error: 'Title and excerpt are required' });
    const blog = await BlogModel.create({ title, tag, date, readTime, excerpt, image: image || '', content });
    console.log('Created blog with image URL:', blog.image);
    res.status(201).json({ ...blog.toObject(), id: blog._id.toString() });
  } catch (e) {
    console.error('Failed to create blog:', e);
    res.status(500).json({ error: 'Failed to create blog', detail: e.message });
  }
});

app.put('/blogs/:id', async (req, res) => {
  try {
    const updated = await BlogModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ ...updated.toObject(), id: updated._id.toString() });
  } catch (e) {
    console.error('Failed to update blog:', e);
    res.status(500).json({ error: 'Failed to update blog', detail: e.message });
  }
});

app.delete('/blogs/:id', async (req, res) => {
  try {
    const deleted = await BlogModel.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('Failed to delete blog:', e);
    res.status(500).json({ error: 'Failed to delete blog', detail: e.message });
  }
});

app.get('/blogs/:id', async (req, res) => {
  try {
    const blog = await BlogModel.findById(req.params.id).lean();
    if (!blog) return res.status(404).json({ error: 'Not found' });
    res.json({ ...blog, id: blog._id.toString() });
  } catch (e) {
    console.error('Failed to fetch blog:', e);
    res.status(500).json({ error: 'Failed to fetch blog', detail: e.message });
  }
});

// Admin UI
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});
app.get('/admin/blogs', (_req, res) => {
  res.sendFile(path.join(__dirname, 'admin-blogs.html'));
});

app.listen(PORT, () => {
  console.log(`Events backend running on http://localhost:${PORT}`);
});


