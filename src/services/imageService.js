import imageCompression from 'browser-image-compression';

/**
 * Compresses an image client-side before uploading.
 * @param {File} file 
 * @returns {Promise<File>} Compressed file
 */
export const compressImage = async (file) => {
  const options = {
    maxSizeMB: 0.2, // ~200 KB
    maxWidthOrHeight: 1280,
    useWebWorker: false, // Disabled to prevent hangs in Vite dev mode
    fileType: 'image/webp'
  };

  try {
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    console.error('Error compressing image:', error);
    throw error;
  }
};

/**
 * Uploads an attachment to Firebase Storage under the project's folder.
 * @param {File} file - The file to upload
 * @param {string} projectId - The SO number
 * @param {function} onProgress - Callback for upload progress
 * @returns {Promise<string>} Download URL of the uploaded file
 */
export const uploadNoteAttachment = async (file, projectId, onProgress) => {
  return new Promise((resolve, reject) => {
    // Simulate initial progress
    if (onProgress) onProgress(10);
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = () => {
      // Simulate completion progress
      if (onProgress) onProgress(100);
      resolve(reader.result); // Returns the Base64 string
    };
    
    reader.onerror = (error) => {
      console.error('Error reading file:', error);
      reject(error);
    };
  });
};

export const deleteProjectImages = async (projectId) => {
  // No longer needed since images are saved as text (Base64) directly inside the RTDB notes.
  // They will be automatically deleted when the note or project is deleted.
  return Promise.resolve();
};
