/**
 * Google Drive Photo Storage Service for LoveSync.
 * Firebase/Firestore is the sole source of truth for accounts, diaries, cards, anniversaries and
 * settings. Google Drive is used for exactly one thing: storing the original image files behind
 * photo album uploads, in a dedicated folder in the user's own Google Drive.
 */

import { PhotoMemory } from '../types';

export const APP_FOLDER_NAME = '📁 LoveSync - Nhật Ký & Kỷ Niệm Tình Yêu';
export const PHOTOS_ROOT_FOLDER_NAME = '📷 Album Ảnh & Kỷ Niệm (Photos)';

export const CUSTOM_PHOTOS_FOLDER_ID_KEY = 'LOVESYNC_CUSTOM_PHOTOS_FOLDER_ID';
export const CUSTOM_PHOTOS_FOLDER_NAME_KEY = 'LOVESYNC_CUSTOM_PHOTOS_FOLDER_NAME';
export const CUSTOM_PHOTOS_FOLDER_URL_KEY = 'LOVESYNC_CUSTOM_PHOTOS_FOLDER_URL';

/**
 * Extracts Google Drive Folder ID from a full Drive URL or a raw ID string
 * Supports:
 * - https://drive.google.com/drive/folders/1ABCxyz...
 * - https://drive.google.com/drive/u/0/folders/1ABCxyz...
 * - https://drive.google.com/open?id=1ABCxyz...
 * - Raw ID string
 */
export function extractDriveFolderId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();

  // Match /folders/ID
  const foldersMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (foldersMatch && foldersMatch[1]) {
    return foldersMatch[1];
  }

  // Match id=ID
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }

  // If already pure ID string (Google Drive IDs are usually 25-45 characters long)
  const cleanId = trimmed.replace(/[^a-zA-Z0-9_-]/g, '');
  return cleanId;
}

/**
 * Get custom photos folder stored in local storage
 */
export function getCustomPhotosFolder(): { id: string; name?: string; url: string } | null {
  if (typeof window === 'undefined') return null;
  const id = localStorage.getItem(CUSTOM_PHOTOS_FOLDER_ID_KEY)?.trim();
  if (!id) return null;
  const name = localStorage.getItem(CUSTOM_PHOTOS_FOLDER_NAME_KEY)?.trim() || undefined;
  const url = localStorage.getItem(CUSTOM_PHOTOS_FOLDER_URL_KEY)?.trim() || `https://drive.google.com/drive/folders/${id}`;
  return { id, name, url };
}

/**
 * Set custom photos folder to point photo uploads & scans to a user-chosen folder
 */
export function setCustomPhotosFolder(idOrUrl: string, name?: string): { id: string; name?: string; url: string } | null {
  if (typeof window === 'undefined') return null;
  const folderId = extractDriveFolderId(idOrUrl);
  if (!folderId) {
    clearCustomPhotosFolder();
    return null;
  }
  const url = `https://drive.google.com/drive/folders/${folderId}`;
  localStorage.setItem(CUSTOM_PHOTOS_FOLDER_ID_KEY, folderId);
  localStorage.setItem(CUSTOM_PHOTOS_FOLDER_URL_KEY, url);
  if (name) {
    localStorage.setItem(CUSTOM_PHOTOS_FOLDER_NAME_KEY, name.trim());
  }
  return { id: folderId, name: name?.trim(), url };
}

/**
 * Clear custom photos folder (revert to default LoveSync folder)
 */
export function clearCustomPhotosFolder(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CUSTOM_PHOTOS_FOLDER_ID_KEY);
  localStorage.removeItem(CUSTOM_PHOTOS_FOLDER_NAME_KEY);
  localStorage.removeItem(CUSTOM_PHOTOS_FOLDER_URL_KEY);
}

/**
 * Query Drive folder details (Name, link, trashed status) to verify folder existence & permissions
 */
export async function getFolderDetails(
  accessToken: string,
  folderId: string
): Promise<{ id: string; name: string; webViewLink?: string } | null> {
  try {
    const cleanId = extractDriveFolderId(folderId);
    if (!cleanId) return null;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${cleanId}?fields=id,name,mimeType,webViewLink,trashed`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.trashed || data.mimeType !== 'application/vnd.google-apps.folder') return null;
    return {
      id: data.id,
      name: data.name,
      webViewLink: data.webViewLink || `https://drive.google.com/drive/folders/${data.id}`,
    };
  } catch (err) {
    console.warn('getFolderDetails error:', err);
    return null;
  }
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
  // Check if a custom photos folder has been set by the user
  const custom = getCustomPhotosFolder();
  if (custom && custom.id) {
    const verified = await getFolderDetails(accessToken, custom.id);
    if (verified && verified.id) {
      return verified.id;
    }
  }

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
 * In-memory cache for resolved authenticated image blob URLs
 */
export const driveBlobCache = new Map<string, string>();

/**
 * Fetch and return an authenticated blob URL for a Google Drive file ID
 */
export async function getAuthenticatedDriveImageUrl(
  accessToken: string,
  fileId: string
): Promise<string | null> {
  if (!fileId) return null;
  if (driveBlobCache.has(fileId)) {
    return driveBlobCache.get(fileId)!;
  }

  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      return null;
    }

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    driveBlobCache.set(fileId, objectUrl);
    return objectUrl;
  } catch (err) {
    console.warn(`Failed to fetch authenticated Drive blob for ${fileId}:`, err);
    return null;
  }
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
 * Saves at 100% original quality with no compression loss and pristine binary preservation!
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

    // 3. Construct multipart upload request using raw binary Blob (prevents UTF-8 encoding distortion)
    const boundary = '-------LoveSyncPhotoUploadBoundary' + Math.random().toString(36).substring(2);
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: cleanFileName,
      mimeType: mimeType,
      parents: [folderId],
      description: `Ảnh kỷ niệm album "${albumName}" - Đăng tải chất lượng gốc`,
    };

    const metadataPart = new TextEncoder().encode(
      delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${mimeType}\r\n\r\n`
    );
    const closePart = new TextEncoder().encode(closeDelimiter);

    // Combined multipart body with exact pristine binary byte array
    const multipartBody = new Blob([metadataPart, bytes, closePart], {
      type: `multipart/related; boundary=${boundary}`,
    });

    const uploadUrl =
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink,thumbnailLink';

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Lỗi tải ảnh lên Google Drive: ${errText}`);
    }

    const uploadedData = await uploadRes.json();
    const fileId = uploadedData.id;

    // 4. Set permission to allow reading in web app
    await makeDriveFilePublic(accessToken, fileId);

    // Cache the original blob in memory for instant high-speed rendering
    try {
      const localBlobUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
      driveBlobCache.set(fileId, localBlobUrl);
    } catch {}

    // Direct high-quality view links:
    const directUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w2560`;
    const thumbnailUrl = uploadedData.thumbnailLink || `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
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

export interface DriveScannedFolder {
  id: string;
  name: string;
  driveFolderId: string;
  driveFolderUrl: string;
  parentFolderId?: string;
  parentFolderName?: string;
  subfolders?: Array<{ id: string; name: string; driveFolderId: string; photoCount?: number }>;
  photos: PhotoMemory[];
  photoCount: number;
  coverImage?: string;
  createdAt: number;
  modifiedAt: number;
}

export interface DriveScanResult {
  success: boolean;
  folders: DriveScannedFolder[];
  photos: PhotoMemory[];
  photosFolderId?: string;
  photosFolderUrl?: string;
  totalPhotosCount: number;
  totalFoldersCount: number;
  truncated?: boolean;
  error?: string;
}

// Hard safety caps for scanning. This is meant for a couple's shared album folder (dozens to a
// few thousand photos) — if it's accidentally pointed at something like a full personal camera-
// roll backup (hundreds of thousands of files), scanning everything would take forever, risk
// hitting Drive API rate limits, and — worse — trying to sync that many photo entries through
// Firestore (a single ~1MiB document) would break sync for the entire room. Stop well short of
// that and tell the caller it was truncated instead of silently hanging or failing.
// Each synced photo entry carries several URLs/fields (~400-800 bytes as JSON), and the whole
// photos array shares the same ~1MiB Firestore document as diaries/cards/anniversaries/profiles.
// 2000 photos alone could already approach that limit; 500 keeps real headroom for everything
// else while still comfortably covering a genuine couple's shared album.
const MAX_SCAN_PHOTOS = 500;
const MAX_SCAN_FOLDERS = 100;

/**
 * Deeply scan Google Drive to discover all folders, nested subfolders, and photos uploaded directly or via app
 */
export async function scanGoogleDriveFoldersAndPhotos(
  accessToken: string,
  currentUserId?: string,
  currentUserName?: string
): Promise<DriveScanResult> {
  try {
    const appFolderId = await findOrCreateAppFolder(accessToken);
    const photosFolderId = await findOrCreatePhotosFolder(accessToken, appFolderId);
    const photosFolderUrl = `https://drive.google.com/drive/folders/${photosFolderId}`;

    const authorId = currentUserId || 'user_drive';
    const authorName = currentUserName || 'Google Drive';

    let photosCollected = 0;
    let foldersVisited = 0;
    let truncated = false;

    // Helper: Query subfolders of a given parent folder with full pagination (capped)
    async function getSubfoldersOf(parentId: string): Promise<Array<{ id: string; name: string; webViewLink?: string; createdTime?: string; modifiedTime?: string }>> {
      const allFolders: Array<{ id: string; name: string; webViewLink?: string; createdTime?: string; modifiedTime?: string }> = [];
      let pageToken: string | undefined = undefined;
      const q = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      const fields = 'nextPageToken, files(id, name, webViewLink, createdTime, modifiedTime)';

      do {
        if (foldersVisited + allFolders.length >= MAX_SCAN_FOLDERS) {
          truncated = true;
          break;
        }
        let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&orderBy=name&pageSize=1000&spaces=drive`;
        if (pageToken) {
          url += `&pageToken=${encodeURIComponent(pageToken)}`;
        }
        try {
          const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
          if (!res.ok) break;
          const data = await res.json();
          if (data.files && Array.isArray(data.files)) {
            allFolders.push(...data.files);
          }
          pageToken = data.nextPageToken;
        } catch (err) {
          console.warn(`Error fetching subfolders for ${parentId}:`, err);
          break;
        }
      } while (pageToken);

      foldersVisited += allFolders.length;
      return allFolders;
    }

    // Helper: Query image files of a given parent folder with full pagination, stopping once
    // the global MAX_SCAN_PHOTOS budget is used up.
    async function getImagesOf(
      parentId: string,
      albumId: string,
      albumName: string,
      subfolderName?: string
    ): Promise<PhotoMemory[]> {
      if (photosCollected >= MAX_SCAN_PHOTOS) {
        truncated = true;
        return [];
      }
      const allFiles: any[] = [];
      let pageToken: string | undefined = undefined;
      const q = `'${parentId}' in parents and mimeType contains 'image/' and trashed = false`;
      const fields = 'nextPageToken, files(id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink, createdTime, modifiedTime, imageMediaMetadata)';

      do {
        if (photosCollected + allFiles.length >= MAX_SCAN_PHOTOS) {
          truncated = true;
          break;
        }
        let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&orderBy=createdTime desc&pageSize=1000&spaces=drive`;
        if (pageToken) {
          url += `&pageToken=${encodeURIComponent(pageToken)}`;
        }
        try {
          const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
          if (!res.ok) {
            console.warn(`Fetch images failed for folder ${parentId}:`, res.statusText);
            break;
          }
          const data = await res.json();
          if (data.files && Array.isArray(data.files)) {
            allFiles.push(...data.files);
          }
          pageToken = data.nextPageToken;
        } catch (err) {
          console.warn(`Error fetching page of images for ${parentId}:`, err);
          break;
        }
      } while (pageToken);

      photosCollected += allFiles.length;

      return allFiles.map((file: any) => {
        const createdMs = file.createdTime ? new Date(file.createdTime).getTime() : Date.now();
        const dateStr = file.createdTime ? file.createdTime.split('T')[0] : new Date().toISOString().split('T')[0];
        const directUrl = `https://drive.google.com/thumbnail?id=${file.id}&sz=w2560`;
        const thumbnailUrl = `https://drive.google.com/thumbnail?id=${file.id}&sz=w500`;
        const driveViewUrl = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
        const driveDownloadUrl = `https://drive.google.com/uc?export=download&id=${file.id}`;

        return {
          id: `drive_photo_${file.id}`,
          albumId,
          albumName,
          title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
          caption: subfolderName ? `Thư mục con: ${subfolderName}` : `Từ thư mục Google Drive "${albumName}"`,
          imageUrl: directUrl,
          thumbnailUrl,
          originalFileId: file.id,
          driveFolderId: parentId,
          driveViewUrl,
          driveDownloadUrl,
          originalQuality: true,
          fileSize: file.size ? Number(file.size) : undefined,
          fileName: file.name,
          date: dateStr,
          frameStyle: 'classic' as const,
          authorId,
          authorName,
          likes: [],
          tags: ['Google Drive', albumName],
          createdAt: createdMs,
          subfolderName,
        };
      });
    }

    // 1. Get all 1st level folders inside Photos root folder
    const level1Folders = await getSubfoldersOf(photosFolderId);

    // 2. Also check if user created any custom photo folders directly in App root folder (excluding standard system files)
    const appLevelFolders = await getSubfoldersOf(appFolderId);
    const extraAppFolders = appLevelFolders.filter(
      (f) => f.id !== photosFolderId && !f.name.startsWith('.')
    );

    const allMainFolders = [...level1Folders, ...extraAppFolders];

    const scannedFolders: DriveScannedFolder[] = [];
    const allCollectedPhotos: PhotoMemory[] = [];

    // Process each main folder (stop early once the safety budget is used up)
    for (const folder of allMainFolders) {
      if (photosCollected >= MAX_SCAN_PHOTOS || foldersVisited >= MAX_SCAN_FOLDERS) {
        truncated = true;
        break;
      }

      // Find sub-subfolders (e.g. "Đà Lạt -> Ngày 1", "Đà Lạt -> Ngày 2")
      const childSubfolders = await getSubfoldersOf(folder.id);

      // Photos directly in this folder
      const directPhotos = await getImagesOf(folder.id, folder.id, folder.name);
      const folderAllPhotos: PhotoMemory[] = [...directPhotos];

      const subfolderMetaList: Array<{ id: string; name: string; driveFolderId: string; photoCount?: number }> = [];

      // Photos inside each child subfolder
      for (const child of childSubfolders) {
        if (photosCollected >= MAX_SCAN_PHOTOS) {
          truncated = true;
          break;
        }
        const childPhotos = await getImagesOf(child.id, folder.id, folder.name, child.name);
        subfolderMetaList.push({
          id: child.id,
          name: child.name,
          driveFolderId: child.id,
          photoCount: childPhotos.length,
        });
        folderAllPhotos.push(...childPhotos);
      }

      const coverPhoto = folderAllPhotos.length > 0 ? folderAllPhotos[0].imageUrl : undefined;

      scannedFolders.push({
        id: folder.id,
        name: folder.name,
        driveFolderId: folder.id,
        driveFolderUrl: folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`,
        photos: folderAllPhotos,
        photoCount: folderAllPhotos.length,
        subfolders: subfolderMetaList,
        coverImage: coverPhoto,
        createdAt: folder.createdTime ? new Date(folder.createdTime).getTime() : Date.now(),
        modifiedAt: folder.modifiedTime ? new Date(folder.modifiedTime).getTime() : Date.now(),
      });

      allCollectedPhotos.push(...folderAllPhotos);
    }

    // 3. Also check if there are any loose photos placed directly in the Photos root / custom folder
    const customFolder = getCustomPhotosFolder();
    const rootDisplayName = customFolder?.name || 'Ảnh Chung Trên Drive';
    const rootLoosePhotos = await getImagesOf(photosFolderId, 'root_photos', rootDisplayName);
    if (rootLoosePhotos.length > 0) {
      scannedFolders.push({
        id: 'root_photos',
        name: rootDisplayName,
        driveFolderId: photosFolderId,
        driveFolderUrl: photosFolderUrl,
        photos: rootLoosePhotos,
        photoCount: rootLoosePhotos.length,
        coverImage: rootLoosePhotos[0]?.imageUrl,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      });
      allCollectedPhotos.push(...rootLoosePhotos);
    }

    return {
      success: true,
      folders: scannedFolders,
      photos: allCollectedPhotos,
      photosFolderId,
      photosFolderUrl,
      totalPhotosCount: allCollectedPhotos.length,
      totalFoldersCount: scannedFolders.length,
      truncated,
    };
  } catch (err: any) {
    console.error('scanGoogleDriveFoldersAndPhotos Error:', err);
    return {
      success: false,
      folders: [],
      photos: [],
      totalPhotosCount: 0,
      totalFoldersCount: 0,
      error: err.message || 'Lỗi khi quét thư mục trên Google Drive.',
    };
  }
}

export interface DriveFolderPageResult {
  success: boolean;
  photos: PhotoMemory[];
  nextPageToken?: string;
  folderName?: string;
  error?: string;
}

/**
 * Load exactly one page of images directly inside a given Drive folder (no subfolder
 * recursion — deliberately simple/flat). Meant for browsing a large personal folder a fixed
 * number of photos at a time instead of scanning everything in it at once: pass the
 * `nextPageToken` from the previous call back in to continue where it left off.
 */
export async function loadDriveFolderPage(
  accessToken: string,
  folderId: string,
  pageToken?: string,
  pageSize: number = 100,
  currentUserId?: string,
  currentUserName?: string
): Promise<DriveFolderPageResult> {
  try {
    const details = await getFolderDetails(accessToken, folderId);
    const albumName = details?.name || 'Thư mục Drive';
    const authorId = currentUserId || 'user_drive';
    const authorName = currentUserName || 'Google Drive';

    const q = `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`;
    const fields = 'nextPageToken, files(id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink, createdTime, modifiedTime)';
    let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&orderBy=createdTime desc&pageSize=${Math.max(1, Math.min(1000, pageSize))}&spaces=drive`;
    if (pageToken) {
      url += `&pageToken=${encodeURIComponent(pageToken)}`;
    }

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Không thể tải ảnh từ thư mục: ${errText}`);
    }
    const data = await res.json();
    const files: any[] = Array.isArray(data.files) ? data.files : [];

    const photos: PhotoMemory[] = files.map((file) => {
      const createdMs = file.createdTime ? new Date(file.createdTime).getTime() : Date.now();
      const dateStr = file.createdTime ? file.createdTime.split('T')[0] : new Date().toISOString().split('T')[0];
      const directUrl = `https://drive.google.com/thumbnail?id=${file.id}&sz=w2560`;
      const thumbnailUrl = `https://drive.google.com/thumbnail?id=${file.id}&sz=w500`;
      const driveViewUrl = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
      const driveDownloadUrl = `https://drive.google.com/uc?export=download&id=${file.id}`;

      return {
        id: `drive_photo_${file.id}`,
        albumId: folderId,
        albumName,
        title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        caption: `Từ thư mục Google Drive "${albumName}"`,
        imageUrl: directUrl,
        thumbnailUrl,
        originalFileId: file.id,
        driveFolderId: folderId,
        driveViewUrl,
        driveDownloadUrl,
        originalQuality: true,
        fileSize: file.size ? Number(file.size) : undefined,
        fileName: file.name,
        date: dateStr,
        frameStyle: 'classic' as const,
        authorId,
        authorName,
        likes: [],
        tags: ['Google Drive', albumName],
        createdAt: createdMs,
      };
    });

    return {
      success: true,
      photos,
      nextPageToken: data.nextPageToken || undefined,
      folderName: albumName,
    };
  } catch (err: any) {
    console.error('loadDriveFolderPage Error:', err);
    return {
      success: false,
      photos: [],
      error: err.message || 'Lỗi khi tải ảnh từ thư mục Google Drive.',
    };
  }
}

export interface DriveFolderNode {
  id: string;
  name: string;
  driveFolderUrl: string;
  approxPhotoCount: number;
  hasMorePhotosThanCounted: boolean;
  subfolders: DriveFolderNode[];
}

export interface DriveFolderStructureResult {
  success: boolean;
  rootName?: string;
  folders: DriveFolderNode[];
  truncated?: boolean;
  error?: string;
}

/**
 * Discover the folder *structure* (names + subfolder names, 2 levels deep) under a root Drive
 * folder — deliberately WITHOUT ever fetching the photos inside. This is what makes it safe and
 * cheap to run against a large personal folder: listing folder names is a handful of API calls
 * regardless of how many images live inside them. Each folder's photo count is only an
 * approximation (one page, up to 1000) so a huge folder doesn't turn counting into its own slow
 * full scan — `hasMorePhotosThanCounted` tells the caller the real count is at least that high.
 * Actually viewing a folder's photos is a separate step: loadDriveFolderPage(), called only once
 * the user opens that specific folder, and never persisted anywhere.
 */
export async function scanDriveFolderStructure(
  accessToken: string,
  rootFolderId: string
): Promise<DriveFolderStructureResult> {
  try {
    const rootDetails = await getFolderDetails(accessToken, rootFolderId);
    if (!rootDetails) {
      return { success: false, folders: [], error: 'Không tìm thấy thư mục hoặc chưa có quyền truy cập.' };
    }

    let foldersVisited = 0;
    let truncated = false;

    async function listSubfolders(parentId: string): Promise<Array<{ id: string; name: string; webViewLink?: string }>> {
      if (foldersVisited >= MAX_SCAN_FOLDERS) {
        truncated = true;
        return [];
      }
      const q = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      const fields = 'files(id, name, webViewLink)';
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&orderBy=name&pageSize=1000&spaces=drive`;
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!res.ok) return [];
        const data = await res.json();
        const files = Array.isArray(data.files) ? data.files : [];
        foldersVisited += files.length;
        if (foldersVisited >= MAX_SCAN_FOLDERS) truncated = true;
        return files;
      } catch (err) {
        console.warn(`listSubfolders error for ${parentId}:`, err);
        return [];
      }
    }

    // One cheap page (up to 1000) to approximate how many photos are directly in a folder,
    // without paginating through the whole thing.
    async function countPhotosApprox(folderId: string): Promise<{ count: number; hasMore: boolean }> {
      const q = `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`;
      const fields = 'nextPageToken, files(id)';
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=1000&spaces=drive`;
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!res.ok) return { count: 0, hasMore: false };
        const data = await res.json();
        const files = Array.isArray(data.files) ? data.files : [];
        return { count: files.length, hasMore: !!data.nextPageToken };
      } catch {
        return { count: 0, hasMore: false };
      }
    }

    async function buildNode(id: string, name: string, webViewLink: string | undefined, depth: number): Promise<DriveFolderNode> {
      const [{ count, hasMore }, children] = await Promise.all([
        countPhotosApprox(id),
        depth > 0 ? listSubfolders(id) : Promise.resolve([]),
      ]);

      const subfolders: DriveFolderNode[] = [];
      for (const child of children) {
        if (foldersVisited >= MAX_SCAN_FOLDERS) {
          truncated = true;
          break;
        }
        subfolders.push(await buildNode(child.id, child.name, child.webViewLink, depth - 1));
      }

      return {
        id,
        name,
        driveFolderUrl: webViewLink || `https://drive.google.com/drive/folders/${id}`,
        approxPhotoCount: count,
        hasMorePhotosThanCounted: hasMore,
        subfolders,
      };
    }

    const topLevel = await listSubfolders(rootFolderId);
    const folders: DriveFolderNode[] = [];
    for (const f of topLevel) {
      if (foldersVisited >= MAX_SCAN_FOLDERS) {
        truncated = true;
        break;
      }
      // 1 extra level of subfolders under each top-level folder (matches the couple album's
      // usual "Album -> Ngày 1 / Ngày 2" nesting pattern)
      folders.push(await buildNode(f.id, f.name, f.webViewLink, 1));
    }

    return {
      success: true,
      rootName: rootDetails.name,
      folders,
      truncated,
    };
  } catch (err: any) {
    console.error('scanDriveFolderStructure Error:', err);
    return {
      success: false,
      folders: [],
      error: err.message || 'Lỗi khi quét cấu trúc thư mục Google Drive.',
    };
  }
}

