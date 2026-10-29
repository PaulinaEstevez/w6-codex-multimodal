const imageInput = document.querySelector('#image-input');
const preview = document.querySelector('#image-preview');
const statusMessage = document.querySelector('#status');
const description = document.querySelector('#description');
const describeButton = document.querySelector('#describe-button');

// The preview uses dataUrl; Ollama receives only the Base64 portion.
let selectedImage = null; // { name, dataUrl, base64 }
let activeReader = null;
let activeRequest = null;
let selectionId = 0;

function showPlaceholder() {
  const message = document.createElement('p');
  message.textContent = 'Your image preview will appear here.';
  preview.replaceChildren(message);
}

imageInput.addEventListener('change', () => {
  const currentSelection = ++selectionId;
  if (activeRequest) activeRequest.abort();
  activeRequest = null;
  describeButton.disabled = true;
  describeButton.textContent = 'Describe Image';
  if (activeReader) activeReader.abort();
  activeReader = null;
  selectedImage = null;
  showPlaceholder();
  description.replaceChildren();

  const file = imageInput.files[0];
  if (!file) {
    statusMessage.textContent = 'Choose a JPG or PNG image to preview it.';
    return;
  }

  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    statusMessage.textContent = 'This file cannot be used. Please choose a JPG or PNG image.';
    imageInput.value = '';
    return;
  }

  const reader = new FileReader();
  activeReader = reader;
  statusMessage.textContent = 'Reading your image…';

  function showReadError() {
    if (currentSelection !== selectionId) return;
    activeReader = null;
    selectedImage = null;
    showPlaceholder();
    imageInput.value = '';
    statusMessage.textContent = 'This image could not be read. Try another JPG or PNG image.';
  }

  reader.addEventListener('error', showReadError);
  reader.addEventListener('load', () => {
    if (currentSelection !== selectionId) return;
    activeReader = null;
    const dataUrl = reader.result;
    const image = new Image();
    image.alt = `Preview of ${file.name}`;

    // Check that the browser can actually display the file before keeping it.
    image.addEventListener('error', showReadError);
    image.addEventListener('load', () => {
      if (currentSelection !== selectionId) return;
      selectedImage = {
        name: file.name,
        dataUrl,
        base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
      };
      preview.replaceChildren(image);
      describeButton.disabled = false;
      statusMessage.textContent = 'Image ready. Click Describe Image to get a description.';
    });
    image.src = dataUrl;
  });

  reader.readAsDataURL(file);
});

describeButton.addEventListener('click', async () => {
  if (!selectedImage || activeRequest) return;

  const currentSelection = selectionId;
  const controller = new AbortController();
  activeRequest = controller;
  describeButton.disabled = true;
  describeButton.textContent = 'Describing…';
  description.textContent = '';
  statusMessage.textContent = 'Ollama is describing your image. This may take a moment…';

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
          images: [selectedImage.base64],
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
    if (currentSelection !== selectionId) return;

    // Display the model's answer as plain text, never as HTML.
    description.textContent = data.message.content;
    statusMessage.textContent = 'Description ready.';
  } catch (error) {
    if (currentSelection !== selectionId) return;
    statusMessage.textContent = error instanceof TypeError
      ? 'Could not reach Ollama. Check that it is running and allows requests from this webpage.'
      : `Could not describe the image: ${error.message}`;
  } finally {
    if (currentSelection === selectionId) {
      activeRequest = null;
      describeButton.disabled = !selectedImage;
      describeButton.textContent = 'Describe Image';
    }
  }
});

// Image 2 has its own data and reading state. Ollama still uses Image 1 only.
const secondImage = {
  input: document.querySelector('#image-2-input'),
  preview: document.querySelector('#image-2-preview'),
  status: document.querySelector('#image-2-status'),
  description: document.querySelector('#image-2-description'),
  data: null,
  reader: null,
  selectionId: 0,
};

function resetSecondPreview() {
  const message = document.createElement('p');
  message.textContent = 'Your image preview will appear here.';
  secondImage.preview.replaceChildren(message);
}

secondImage.input.addEventListener('change', () => {
  const currentSelection = ++secondImage.selectionId;
  if (secondImage.reader) secondImage.reader.abort();
  secondImage.reader = null;
  secondImage.data = null;
  resetSecondPreview();
  secondImage.description.textContent = '';

  const file = secondImage.input.files[0];
  if (!file) {
    secondImage.status.textContent = 'Choose a JPG or PNG image to preview it.';
    return;
  }
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    secondImage.status.textContent = 'This file cannot be used. Please choose a JPG or PNG image.';
    secondImage.input.value = '';
    return;
  }

  function showError() {
    if (currentSelection !== secondImage.selectionId) return;
    secondImage.reader = null;
    secondImage.data = null;
    resetSecondPreview();
    secondImage.input.value = '';
    secondImage.status.textContent = 'This image could not be read. Try another JPG or PNG image.';
  }

  const reader = new FileReader();
  secondImage.reader = reader;
  secondImage.status.textContent = 'Reading your image…';
  reader.addEventListener('error', showError);
  reader.addEventListener('load', () => {
    if (currentSelection !== secondImage.selectionId) return;
    secondImage.reader = null;
    const dataUrl = reader.result;
    const image = new Image();
    image.alt = `Image 2 preview of ${file.name}`;
    image.addEventListener('error', showError);
    image.addEventListener('load', () => {
      if (currentSelection !== secondImage.selectionId) return;
      secondImage.data = {
        name: file.name,
        dataUrl,
        base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
      };
      secondImage.preview.replaceChildren(image);
      secondImage.status.textContent = 'Image 2 ready. Descriptions for Image 2 are not connected yet.';
    });
    image.src = dataUrl;
  });
  reader.readAsDataURL(file);
});
