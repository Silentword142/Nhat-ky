/**
 * Google Drive Storage & Synchronization Service for LoveSync
 * Replaces Firestore by saving all couple data (Diaries, Photos, Cards, Anniversaries, Settings)
 * directly into a dedicated private folder in the user's Google Drive.
 */

import { CoupleFullState, PhotoMemory } from '../types';

export const APP_FOLDER_NAME = '📁 LoveSync - Nhật Ký & Kỷ Niệm Tình Yêu';
export const PHOTOS_ROOT_FOLDER_NAME = '📷 Album Ảnh & Kỷ Niệm (Photos)';
export const MASTER_ACCOUNTS_FILE_NAME = 'lovesync_accounts_vault.json';

export interface DriveBackupInfo {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  webViewLink?: string;
}

export interface DriveSyncResult {
  success: boolean;
  fileId?: string;
  folderId?: string;
  folderUrl?: string;
  modifiedTime?: string;
  error?: string;
}

export interface DrivePhotoUploadResult {
  success: boolean;
  fileId?: string;
  directUrl?: string;
  thumbnailUrl?: string;
  webViewLink?: string;
  downloadUrl?: string;
  folderId?: string;
  folderUrl?: string;
  albumName?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  error?: string;
}

/**
 * Find or create the dedicated LoveSync root folder in user's Google Drive
 */
export async function findOrCreateAppFolder(accessToken: string): Promise<string> {
  const query = `name = '${APP_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, webViewLink)&spaces=drive`;

  const searchRes = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    if (errText.includes('insufficient') || errText.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
      throw new Error('Chưa cấp quyền Google Drive. Vui lòng kết nối lại và cấp quyền truy cập Google Drive.');
    }
    if (errText.includes('API has not been used') || errText.includes('has not been enabled')) {
      throw new Error('Chưa kích hoạt Google Drive API trên Google Cloud.');
    }
    throw new Error(`Không thể tìm kiếm thư mục Google Drive: ${errText}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder if it doesn't exist
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: APP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Thư mục riêng lưu trữ vĩnh viễn toàn bộ dữ liệu LoveSync (Tài khoản, Nhật ký, Album Ảnh gốc, Thư tay, Danh sách nhạc)',
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Không thể tạo thư mục Google Drive: ${errText}`);
  }

  const folderData = await createRes.json();
  return folderData.id;
}

/**
 * Find or create the Photos root folder inside LoveSync app directory
 */
export async function findOrCreatePhotosFolder(accessToken: string, appFolderId?: string): Promise<string> {
  const parentId = appFolderId || (await findOrCreateAppFolder(accessToken));
  const query = `name = '${PHOTOS_ROOT_FOLDER_NAME}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name)&spaces=drive`;

  const searchRes = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // Create Photos root folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: PHOTOS_ROOT_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
      description: 'Thư mục lưu trữ tất cả Album ảnh kỷ niệm cặp đôi chất lượng gốc',
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Không thể tạo thư mục Album Ảnh: ${err}`);
  }

  const created = await createRes.json();
  return created.id;
}

/**
 * Find or create an Album subfolder inside the Photos folder (named after the Album)
 */
export async function findOrCreateAlbumFolder(
  accessToken: string,
  albumName: string,
  photosFolderId?: string
): Promise<{ folderId: string; folderUrl: string }> {
  const cleanAlbumName = (albumName || 'Album Chung').trim();
  const parentPhotosId = photosFolderId || (await findOrCreatePhotosFolder(accessToken));

  // Escape single quotes for drive query
  const safeQueryName = cleanAlbumName.replace(/'/g, "\\'");
  const query = `name = '${safeQueryName}' and '${parentPhotosId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, webViewLink)&spaces=drive`;

  const searchRes = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      const f = data.files[0];
      return {
        folderId: f.id,
        folderUrl: f.webViewLink || `https://drive.google.com/drive/folders/${f.id}`,
      };
    }
  }

  // Create Album subfolder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: cleanAlbumName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentPhotosId],
      description: `Album ảnh kỷ niệm: ${cleanAlbumName} - Lưu chất lượng gốc`,
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Không thể tạo thư mục album "${cleanAlbumName}": ${err}`);
  }

  const created = await createRes.json();
  return {
    folderId: created.id,
    folderUrl: created.webViewLink || `https://drive.google.com/drive/folders/${created.id}`,
  };
}

/**
 * Make a Google Drive file accessible for web viewing (anyone with link can view)
 */
export async function makeDriveFilePublic(accessToken: string, fileId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Upload an original image file to its dedicated album subfolder in Google Drive
 * Saves at 100% original quality with no compression loss!
 */
export async function uploadOriginalImageToDrive(
  accessToken: string,
  fileOrBlob: File | Blob,
  fileName: string,
  albumName: string
): Promise<DrivePhotoUploadResult> {
  try {
    // 1. Find or create the album subfolder
    const { folderId, folderUrl } = await findOrCreateAlbumFolder(accessToken, albumName);

    // 2. Prepare file binary data
    const arrayBuffer = await fileOrBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const mimeType = fileOrBlob.type || 'image/jpeg';
    const cleanFileName = fileName || `photo_${Date.now()}_original.jpg`;

    // 3. Construct multipart upload request
    const boundary = '-------LoveSyncPhotoUploadBoundary' + Math.random().toString(36).substring(2);
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: cleanFileName,
      mimeType: mimeType,
      parents: [folderId],
      description: `Ảnh kỷ niệm album "${albumName}" - Đăng tải chất lượng gốc`,
    };

    // Convert Uint8Array to binary string for multipart assembly
    let binaryData = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binaryData += String.fromCharCode.apply(null, chunk as any);
    }

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n` +
      'Content-Transfer-Encoding: binary\r\n\r\n' +
      binaryData +
      closeDelimiter;

    const uploadUrl =
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink';

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Lỗi tải ảnh lên Google Drive: ${errText}`);
    }

    const uploadedData = await uploadRes.json();
    const fileId = uploadedData.id;

    // 4. Set permission to allow reading in web app
    await makeDriveFilePublic(accessToken, fileId);

    // Direct high-quality view links:
    // lh3.googleusercontent.com/d/{fileId} delivers full original quality through Google's global CDN
    const directUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
    const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w2560`;
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const webViewLink = uploadedData.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

    return {
      success: true,
      fileId,
      directUrl,
      thumbnailUrl,
      webViewLink,
      downloadUrl,
      folderId,
      folderUrl,
      albumName,
      fileName: cleanFileName,
      fileSize: fileOrBlob.size,
      mimeType,
    };
  } catch (err: any) {
    console.error('uploadOriginalImageToDrive Error:', err);
    return {
      success: false,
      error: err.message || 'Lỗi không xác định khi lưu ảnh lên Google Drive',
    };
  }
}

/**
 * Upload an image from base64 Data URL to Google Drive at original quality
 */
export async function uploadDataUrlImageToDrive(
  accessToken: string,
  dataUrl: string,
  fileName: string,
  albumName: string
): Promise<DrivePhotoUploadResult> {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return await uploadOriginalImageToDrive(accessToken, blob, fileName, albumName);
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Không thể chuyển đổi data URL sang Google Drive.',
    };
  }
}

/**
 * Save user accounts registry into Google Drive
 */
export async function saveAccountsVaultToDrive(accessToken: string, accounts: Record<string, any>): Promise<DriveSyncResult> {
  try {
    const folderId = await findOrCreateAppFolder(accessToken);
    const searchFileQuery = `name = '${MASTER_ACCOUNTS_FILE_NAME}' and '${folderId}' in parents and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchFileQuery)}&fields=files(id, name)&spaces=drive`;

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const searchData = searchRes.ok ? await searchRes.json() : { files: [] };
    const existingFile = searchData.files && searchData.files.length > 0 ? searchData.files[0] : null;

    const fileContent = JSON.stringify(
      {
        accounts,
        savedAt: new Date().toISOString(),
        timestamp: Date.now(),
        appVersion: '2.0.0-gdrive',
      },
      null,
      2
    );

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    let uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,webViewLink';
    let method = 'POST';

    const metadata: Record<string, any> = {
      name: MASTER_ACCOUNTS_FILE_NAME,
      mimeType: 'application/json',
      description: `Danh sách tài khoản LoveSync - Cập nhật lúc ${new Date().toLocaleString('vi-VN')}`,
    };

    if (existingFile) {
      uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart&fields=id,name,modifiedTime,webViewLink`;
      method = 'PATCH';
    } else {
      metadata.parents = [folderId];
    }

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      fileContent +
      closeDelimiter;

    const uploadRes = await fetch(uploadUrl, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Lỗi khi lưu tài khoản lên Google Drive: ${errText}`);
    }

    const resultData = await uploadRes.json();
    return {
      success: true,
      fileId: resultData.id,
      folderId,
      folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
      modifiedTime: resultData.modifiedTime || new Date().toISOString(),
    };
  } catch (err: any) {
    console.error('saveAccountsVaultToDrive Error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Load user accounts registry from Google Drive
 */
export async function loadAccountsVaultFromDrive(accessToken: string): Promise<{ success: boolean; accounts?: Record<string, any>; error?: string }> {
  try {
    const folderId = await findOrCreateAppFolder(accessToken);
    const searchFileQuery = `name = '${MASTER_ACCOUNTS_FILE_NAME}' and '${folderId}' in parents and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchFileQuery)}&fields=files(id, name, modifiedTime)&spaces=drive`;

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchRes.ok) {
      return { success: false, error: 'Không thể truy cập tệp tài khoản trên Google Drive.' };
    }

    const searchData = await searchRes.json();
    if (!searchData.files || searchData.files.length === 0) {
      return { success: false, accounts: {} };
    }

    const file = searchData.files[0];
    const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!downloadRes.ok) {
      return { success: false, accounts: {} };
    }

    const parsed = await downloadRes.json();
    return {
      success: true,
      accounts: parsed.accounts || parsed || {},
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Save complete Couple Data to a JSON file inside the dedicated Google Drive folder
 */
export async function saveCoupleDataToDrive(
  accessToken: string,
  roomCode: string,
  fullData: Partial<CoupleFullState> & Record<string, any>
): Promise<DriveSyncResult> {
  try {
    const cleanRoomCode = (roomCode || 'DEFAULT').toUpperCase().trim();
    const folderId = await findOrCreateAppFolder(accessToken);
    const fileName = `lovesync_data_${cleanRoomCode}.json`;

    // 1. Check if the file already exists in the folder
    const searchFileQuery = `name = '${fileName}' and '${folderId}' in parents and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchFileQuery)}&fields=files(id, name)&spaces=drive`;

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const searchData = searchRes.ok ? await searchRes.json() : { files: [] };
    const existingFile = searchData.files && searchData.files.length > 0 ? searchData.files[0] : null;

    const fileContent = JSON.stringify(
      {
        ...fullData,
        roomCode: cleanRoomCode,
        savedAt: new Date().toISOString(),
        timestamp: Date.now(),
        appVersion: '2.0.0-gdrive',
      },
      null,
      2
    );

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    let uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,webViewLink';
    let method = 'POST';

    const metadata: Record<string, any> = {
      name: fileName,
      mimeType: 'application/json',
      description: `Dữ liệu sao lưu tình yêu phòng ${cleanRoomCode} - Lưu lúc ${new Date().toLocaleString('vi-VN')}`,
    };

    if (existingFile) {
      // Update existing file
      uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart&fields=id,name,modifiedTime,webViewLink`;
      method = 'PATCH';
    } else {
      metadata.parents = [folderId];
    }

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      fileContent +
      closeDelimiter;

    const uploadRes = await fetch(uploadUrl, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Lỗi khi lưu dữ liệu lên Google Drive: ${errText}`);
    }

    const resultData = await uploadRes.json();

    return {
      success: true,
      fileId: resultData.id,
      folderId,
      folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
      modifiedTime: resultData.modifiedTime || new Date().toISOString(),
    };
  } catch (err: any) {
    console.error('saveCoupleDataToDrive Error:', err);
    return {
      success: false,
      error: err.message || 'Lỗi không xác định khi lưu vào Google Drive.',
    };
  }
}

/**
 * Load / Restore Couple Data from Google Drive dedicated folder
 */
export async function loadCoupleDataFromDrive(
  accessToken: string,
  roomCode: string
): Promise<{ success: boolean; data?: any; modifiedTime?: string; error?: string }> {
  try {
    const cleanRoomCode = (roomCode || 'DEFAULT').toUpperCase().trim();
    const folderId = await findOrCreateAppFolder(accessToken);
    const fileName = `lovesync_data_${cleanRoomCode}.json`;

    // Search for file
    const searchFileQuery = `name = '${fileName}' and '${folderId}' in parents and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchFileQuery)}&fields=files(id, name, modifiedTime)&spaces=drive`;

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchRes.ok) {
      throw new Error('Không thể tìm tệp dữ liệu trên Google Drive.');
    }

    const searchData = await searchRes.json();
    if (!searchData.files || searchData.files.length === 0) {
      return {
        success: false,
        error: `Chưa tìm thấy tệp sao lưu "${fileName}" trong thư mục Google Drive của bạn.`,
      };
    }

    const file = searchData.files[0];
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;

    const downloadRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!downloadRes.ok) {
      throw new Error('Không thể tải nội dung tệp từ Google Drive.');
    }

    const parsedData = await downloadRes.json();
    return {
      success: true,
      data: parsedData,
      modifiedTime: file.modifiedTime,
    };
  } catch (err: any) {
    console.error('loadCoupleDataFromDrive Error:', err);
    return {
      success: false,
      error: err.message || 'Lỗi khi đọc dữ liệu từ Google Drive.',
    };
  }
}

/**
 * List all backup files in user's LoveSync folder on Google Drive
 */
export async function listDriveBackups(accessToken: string): Promise<DriveBackupInfo[]> {
  try {
    const folderId = await findOrCreateAppFolder(accessToken);
    const query = `'${folderId}' in parents and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, mimeType, modifiedTime, size, webViewLink)&orderBy=modifiedTime desc`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.error('listDriveBackups Error:', err);
    return [];
  }
}
