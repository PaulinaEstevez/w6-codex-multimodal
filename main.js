const describeButton = document.querySelector('#describe-button');
const processingStatus = document.querySelector('#processing-status');
let processing = false;

// Each slot keeps its own picture, answer area, and reading state together.
const images = [
  { label: 'Image 1', inputId: 'image-input', previewId: 'image-preview',
    statusId: 'status', descriptionId: 'description' },
  { label: 'Image 2', inputId: 'image-2-input', previewId: 'image-2-preview',
    statusId: 'image-2-status', descriptionId: 'image-2-description' },
].map((slot) => ({
  label: slot.label,
  input: document.getElementById(slot.inputId),
  preview: document.getElementById(slot.previewId),
  status: document.getElementById(slot.statusId),
  description: document.getElementById(slot.descriptionId),
  data: null,
  reader: null,
  selectionId: 0,
  request: null,
}));

function updateButton() {
  describeButton.disabled = processing;
  describeButton.textContent = processing ? 'Describing…' : 'Describe Images';
  images.forEach((slot) => { slot.input.disabled = processing; });
}

function showPlaceholder(slot) {
  const message = document.createElement('p');
  message.textContent = 'Your image preview will appear here.';
  slot.preview.replaceChildren(message);
}

images.forEach((slot) => {
  slot.input.addEventListener('change', () => {
    processingStatus.textContent = 'Choose both images, then click Describe Images.';
    const selection = ++slot.selectionId;
    if (slot.reader) slot.reader.abort();
    if (slot.request) slot.request.abort();
    slot.reader = null;
    slot.data = null;
    slot.description.textContent = '';
    showPlaceholder(slot);
    updateButton();

    const file = slot.input.files[0];
    if (!file) {
      slot.status.textContent = 'Choose a JPG or PNG image to preview it.';
      return;
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      slot.status.textContent = 'This file cannot be used. Please choose a JPG or PNG image.';
      slot.input.value = '';
      return;
    }

    function showError() {
      if (selection !== slot.selectionId) return;
      slot.reader = null;
      slot.data = null;
      slot.input.value = '';
      showPlaceholder(slot);
      slot.status.textContent = 'This image could not be read. Try another JPG or PNG image.';
      updateButton();
    }

    const reader = new FileReader();
    slot.reader = reader;
    slot.status.textContent = 'Reading your image…';
    reader.addEventListener('error', showError);
    reader.addEventListener('load', () => {
      if (selection !== slot.selectionId) return;
      slot.reader = null;
      const dataUrl = reader.result;
      const image = new Image();
      image.alt = `${slot.label} preview of ${file.name}`;
      image.addEventListener('error', showError);
      image.addEventListener('load', () => {
        if (selection !== slot.selectionId) return;
        slot.data = {
          name: file.name,
          dataUrl,
          base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
        };
        slot.preview.replaceChildren(image);
        slot.status.textContent = `${slot.label} ready. Click Describe Images.`;
        updateButton();
      });
      image.src = dataUrl;
    });
    reader.readAsDataURL(file);
  });
});

async function describeImage(job) {
  const { slot, data: imageData, selection } = job;
  // Skip an image replaced after the button was clicked.
  if (selection !== slot.selectionId) return;
  const controller = new AbortController();
  slot.request = controller;
  slot.status.textContent = `Describing ${slot.label}. This may take a moment…`;

  try {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gemma3:4b',
        messages: [{
          role: 'user',
          content: 'Describe this image in simple words.',
          images: [imageData.base64],
        }],
        stream: false,
      }),
    });
    if (!response.ok) {
      throw new Error(`Ollama returned an error (HTTP ${response.status}).`);
    }
    const data = await response.json();
    if (data.error) throw new Error(String(data.error));
    if (typeof data.message?.content !== 'string' || !data.message.content.trim()) {
      throw new Error('Ollama did not return a description. Please try again.');
    }
    if (selection !== slot.selectionId) return;
    slot.description.textContent = data.message.content;
    slot.status.textContent = `${slot.label} description ready.`;
    return true;
  } catch (error) {
    if (selection !== slot.selectionId) return;
    slot.status.textContent = error instanceof TypeError
      ? `Could not reach Ollama for ${slot.label}. Check that it is running and allows requests from this webpage.`
      : `Could not describe ${slot.label}: ${error.message}`;
    return false;
  } finally {
    if (slot.request === controller) slot.request = null;
  }
}

describeButton.addEventListener('click', async () => {
  if (processing) return;
  const missing = images.filter((slot) => !slot.data);
  if (missing.length) {
    processingStatus.textContent = missing.length === 2
      ? 'Please choose both Image 1 and Image 2 as JPG or PNG images and wait for their previews.'
      : `Please choose ${missing[0].label} as a JPG or PNG image and wait for its preview.`;
    return;
  }
  // Capture each picture and its destination together, in Image 1 / Image 2 order.
  const jobs = images.map((slot) => ({
    slot, data: slot.data, selection: slot.selectionId,
  }));
  processing = true;
  updateButton();
  const failed = [];
  try {
    for (const job of jobs) {
      processingStatus.textContent = `Processing ${job.slot.label} of 2…`;
      // Wait for this request to finish before starting the next one.
      const success = await describeImage(job);
      if (!success) failed.push(job.slot.label);
    }
    processingStatus.textContent = failed.length
      ? `Finished. Failed: ${failed.join(', ')}. Any successful descriptions have been kept.`
      : 'Finished. Both image descriptions are ready.';
  } finally {
    processing = false;
    updateButton();
  }
});

updateButton();
