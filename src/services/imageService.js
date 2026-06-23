import imageCompression from 'browser-image-compression';
import { storage, storageRef, uploadBytesResumable, getDownloadURL, deleteObject, listAll } from '../utils/firebase';

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
  if (!storage) throw new Error('Firebase Storage is not initialized');

  const timestamp = Date.now();
  const fileExt = file.name.split('.').pop() || 'file';
  const filePath = `project_images/${projectId}/att_${timestamp}.${fileExt}`;
  
  const imgRef = storageRef(storage, filePath);
  const uploadTask = uploadBytesResumable(imgRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      },
      (error) => {
        console.error('Upload failed:', error);
        reject(error);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        } catch (error) {
          reject(error);
        }
      }
    );
  });
};

/**
 * Deletes all images associated with a project from Firebase Storage.
 * @param {string} projectId - The SO number
 * @returns {Promise<void>}
 */
export const deleteProjectImages = async (projectId) => {
  if (!storage) return;

  const folderRef = storageRef(storage, `project_images/${projectId}`);
  
  try {
    const dir = await listAll(folderRef);
    const deletePromises = dir.items.map((itemRef) => deleteObject(itemRef));
    
    await Promise.all(deletePromises);
    console.log(`Successfully deleted all images for project ${projectId}`);
  } catch (error) {
    // If the folder doesn't exist, Firebase might throw an error. It's safe to ignore.
    if (error.code !== 'storage/object-not-found') {
      console.error(`Error deleting images for project ${projectId}:`, error);
    }
  }
};
