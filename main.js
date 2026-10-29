const imageInput = document.querySelector('#image-input');
const preview = document.querySelector('#image-preview');
const statusMessage = document.querySelector('#status');
const description = document.querySelector('#description');

// Keep both forms in memory for the future Ollama request. Nothing is sent yet.
let selectedImage = null; // { name, dataUrl, base64 }
let activeReader = null;
let selectionId = 0;

function showPlaceholder() {
  const message = document.createElement('p');
  message.textContent = 'Your image preview will appear here.';
  preview.replaceChildren(message);
}

imageInput.addEventListener('change', () => {
  const currentSelection = ++selectionId;
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
      statusMessage.textContent = 'Image ready. Descriptions are not connected yet.';
    });
    image.src = dataUrl;
  });

  reader.readAsDataURL(file);
});
