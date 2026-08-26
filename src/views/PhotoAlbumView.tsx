import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Heart,
  Calendar,
  MapPin,
  Trash2,
  Image as ImageIcon,
  FolderPlus,
  Maximize2,
  X,
  Sparkles,
  Layers,
  ArrowLeft,
  Folder,
  Edit3,
  UploadCloud,
  Check,
  Filter,
  ExternalLink,
  RefreshCw,
  Cloud,
  CheckCircle2,
  AlertCircle,
  FolderTree,
  Eye,
  Link,
  Settings,
  Copy,
} from 'lucide-react';
import { useCouple } from '../context/CoupleContext';
import { PhotoMemory, Album } from '../types';
import { THEMES } from '../utils/theme';
import { soundService } from '../services/sound';
import { ImageLightbox, LightboxImageItem } from '../components/ImageLightbox';
import {
  uploadOriginalImageToDrive,
  uploadDataUrlImageToDrive,
  scanGoogleDriveFoldersAndPhotos,
  getCustomPhotosFolder,
  setCustomPhotosFolder,
  clearCustomPhotosFolder,
  extractDriveFolderId,
  getFolderDetails,
} from '../services/googleDrive';
import { getAccessToken, googleSignIn } from '../services/googleAuth';
import { formatDateVN } from '../utils/date';
import { DateInputVN } from '../components/DateInputVN';
import { SmartDriveImage } from '../components/SmartDriveImage';

interface BatchPreviewItem {
  id: string;
  url: string;
  title: string;
  file?: File;
  size?: number;
}

const FRAME_STYLES = [
  { id: 'polaroid', label: 'Polaroid Lãng Mạn', emoji: '📸' },
  { id: 'sakura', label: 'Khung Hoa Anh Đào', emoji: '🌸' },
  { id: 'vintage', label: 'Cổ Điển Vintage', emoji: '🎞️' },
  { id: 'heart', label: 'Viền Trái Tim', emoji: '💖' },
  { id: 'classic', label: 'Tối Giản Hiện Đại', emoji: '✨' },
];

const DEFAULT_ALBUMS: Album[] = [
  {
    id: 'hen_ho',
    name: 'Khoảnh Khắc Hẹn Hò ☕',
    description: 'Những buổi cafe, xem phim và dạo phố cùng nhau',
    coverImage: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80',
    color: '#FF758F',
    createdAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'du_lich',
    name: 'Chuyến Đi Của Đôi Ta ✈️',
    description: 'Cùng nhau đi khắp muôn nơi và lưu giữ cảnh đẹp',
    coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80',
    color: '#70A6FF',
    createdAt: Date.now() - 86400000 * 20,
  },
  {
    id: 'dang_yeu',
    name: 'Ảnh Đáng Yêu Của Em 🌸',
    description: 'Những khoảnh khắc em cười tươi nhất trên đời',
    coverImage: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&auto=format&fit=crop&q=80',
    color: '#FF9A9E',
    createdAt: Date.now() - 86400000 * 15,
  },
  {
    id: 'ky_niem',
    name: 'Kỷ Niệm Ngày Yêu 💕',
    description: 'Những cột mốc và ngày đặc biệt không thể nào quên',
    coverImage: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&auto=format&fit=crop&q=80',
    color: '#F472B6',
    createdAt: Date.now() - 86400000 * 10,
  },
];

const STORAGE_ALBUMS_KEY = 'lovesync_custom_albums_v2';

export const PhotoAlbumView: React.FC = () => {
  const {
    photos,
    myProfile,
    settings,
    addPhotosBatch,
    deletePhoto,
    togglePhotoLike,
    isGoogleDriveConnected,
    googleDriveFolderUrl,
    connectGoogleDrive,
  } = useCouple();
  const currentTheme = THEMES[settings.theme] || THEMES.sakura;

  // Custom albums state
  const [albumsList, setAlbumsList] = useState<Album[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ALBUMS_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_ALBUMS;
    } catch {
      return DEFAULT_ALBUMS;
    }
  });

  // Save albums
  useEffect(() => {
    localStorage.setItem(STORAGE_ALBUMS_KEY, JSON.stringify(albumsList));
  }, [albumsList]);

  // Google Drive folder discovery & scanning state
  const [isScanningDrive, setIsScanningDrive] = useState(false);
  const [driveScanFeedback, setDriveScanFeedback] = useState<string | null>(null);
  const [activeSubfolder, setActiveSubfolder] = useState<string | null>(null);

  // Selected Album: null = Folder Overview list, 'all' = All photos, or album ID/name
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);

  // Reset subfolder when active album changes
  useEffect(() => {
    setActiveSubfolder(null);
  }, [activeAlbumId]);

  // Lightbox Zoom Viewer state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Create / Edit Album Dialog
  const [isAlbumModalOpen, setIsAlbumModalOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [albumFormName, setAlbumFormName] = useState('');
  const [albumFormDesc, setAlbumFormDesc] = useState('');
  const [albumFormCover, setAlbumFormCover] = useState('');
  const [albumFormColor, setAlbumFormColor] = useState('#FF758F');

  // Batch Upload Modal State
  const [isBatchUploadModalOpen, setIsBatchUploadModalOpen] = useState(false);
  const [uploadAlbumTarget, setUploadAlbumTarget] = useState<string>('Khoảnh Khắc Hẹn Hò ☕');
  const [batchFilesPreview, setBatchFilesPreview] = useState<BatchPreviewItem[]>([]);
  const [batchDefaultDate, setBatchDefaultDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [batchDefaultLocation, setBatchDefaultLocation] = useState('');
  const [batchDefaultFrame, setBatchDefaultFrame] = useState<PhotoMemory['frameStyle']>('polaroid');
  const [batchDefaultCaption, setBatchDefaultCaption] = useState('');
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [isSyncingAllPhotos, setIsSyncingAllPhotos] = useState(false);

  // Delete Album confirmation state
  const [deleteConfirmAlbum, setDeleteConfirmAlbum] = useState<Album | null>(null);

  // Custom Google Drive Photos Folder Configuration Modal
  const [isDriveFolderModalOpen, setIsDriveFolderModalOpen] = useState(false);
  const [customFolderInput, setCustomFolderInput] = useState('');
  const [customFolderNameInput, setCustomFolderNameInput] = useState('');
  const [isVerifyingCustomFolder, setIsVerifyingCustomFolder] = useState(false);
  const [customFolderVerifyResult, setCustomFolderVerifyResult] = useState<{ id: string; name: string; url: string } | null>(null);
  const [customFolderVerifyError, setCustomFolderVerifyError] = useState<string | null>(null);
  const [activeCustomFolder, setActiveCustomFolder] = useState(() => getCustomPhotosFolder());

  // Open Custom Drive Folder Modal
  const openDriveFolderModal = () => {
    soundService.playPop();
    const current = getCustomPhotosFolder();
    setActiveCustomFolder(current);
    setCustomFolderInput(current?.url || (current?.id ? `https://drive.google.com/drive/folders/${current.id}` : ''));
    setCustomFolderNameInput(current?.name || '');
    setCustomFolderVerifyResult(null);
    setCustomFolderVerifyError(null);
    setIsDriveFolderModalOpen(true);
  };

  // Test & Save Custom Folder
  const handleSaveCustomDriveFolder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const input = customFolderInput.trim();
    if (!input) {
      // Revert to default
      clearCustomPhotosFolder();
      setActiveCustomFolder(null);
      setCustomFolderVerifyResult(null);
      setCustomFolderVerifyError(null);
      soundService.playSparkle();
      setDriveScanFeedback('✓ Đã khôi phục về thư mục ảnh mặc định của LoveSync!');
      setIsDriveFolderModalOpen(false);
      handleScanDriveFolders(false);
      return;
    }

    const folderId = extractDriveFolderId(input);
    if (!folderId) {
      setCustomFolderVerifyError('Đường dẫn không hợp lệ. Vui lòng dán link Google Drive hoặc Folder ID.');
      return;
    }

    try {
      setIsVerifyingCustomFolder(true);
      setCustomFolderVerifyError(null);
      setCustomFolderVerifyResult(null);

      let token = await getAccessToken();
      if (!token) {
        const res = await googleSignIn();
        token = res?.accessToken || null;
      }
      if (!token) {
        setCustomFolderVerifyError('Chưa kết nối Google Drive. Vui lòng kết nối Google Drive trước.');
        return;
      }

      const details = await getFolderDetails(token, folderId);
      if (!details) {
        setCustomFolderVerifyError('Không tìm thấy thư mục hoặc tài khoản chưa có quyền truy cập thư mục này. Vui lòng kiểm tra lại quyền truy cập hoặc link chia sẻ trên Google Drive.');
        return;
      }

      const finalName = customFolderNameInput.trim() || details.name;
      const saved = setCustomPhotosFolder(details.id, finalName);
      setActiveCustomFolder(saved);
      setCustomFolderVerifyResult(saved ? { id: saved.id, name: finalName, url: saved.url } : null);
      soundService.playSparkle();
      setDriveScanFeedback(`✓ Đã đổi đường dẫn lưu ảnh sang thư mục "${finalName}"!`);
      setTimeout(() => {
        setIsDriveFolderModalOpen(false);
        handleScanDriveFolders(true);
      }, 1200);
    } catch (err: any) {
      setCustomFolderVerifyError(err.message || 'Lỗi kiểm tra thư mục Google Drive.');
    } finally {
      setIsVerifyingCustomFolder(false);
    }
  };

  const handleResetToDefaultFolder = () => {
    soundService.playPop();
    clearCustomPhotosFolder();
    setActiveCustomFolder(null);
    setCustomFolderInput('');
    setCustomFolderNameInput('');
    setCustomFolderVerifyResult(null);
    setCustomFolderVerifyError(null);
    soundService.playSparkle();
    setDriveScanFeedback('✓ Đã khôi phục về thư mục ảnh mặc định của LoveSync!');
    setIsDriveFolderModalOpen(false);
    handleScanDriveFolders(false);
  };

  // Active current album object (if selected)
  const currentAlbumObj = useMemo(() => {
    if (!activeAlbumId || activeAlbumId === 'all') return null;
    return albumsList.find((a) => a.id === activeAlbumId || a.name === activeAlbumId) || null;
  }, [activeAlbumId, albumsList]);

  // Available subfolders for the current album
  const currentAlbumSubfolders = useMemo(() => {
    if (!currentAlbumObj) return [];
    if (currentAlbumObj.subfolders && currentAlbumObj.subfolders.length > 0) {
      return currentAlbumObj.subfolders;
    }
    // Also derive from photos with subfolderName
    const albumName = currentAlbumObj.name;
    const albumPhotos = photos.filter(
      (p) => p.albumName === albumName || p.albumId === currentAlbumObj.id
    );
    const subNames = Array.from(
      new Set(albumPhotos.map((p) => p.subfolderName).filter(Boolean) as string[])
    );
    return subNames.map((name) => ({
      id: name,
      name: name,
      photoCount: albumPhotos.filter((p) => p.subfolderName === name).length,
    }));
  }, [currentAlbumObj, photos]);

  // Filtered photos for view
  const currentViewPhotos = useMemo(() => {
    let result = photos;
    if (activeAlbumId && activeAlbumId !== 'all') {
      const albumName = currentAlbumObj?.name || activeAlbumId;
      result = photos.filter(
        (p) => p.albumName === albumName || p.albumId === activeAlbumId || p.albumName === activeAlbumId
      );
    }
    if (activeSubfolder) {
      result = result.filter((p) => p.subfolderName === activeSubfolder);
    }
    return result;
  }, [photos, activeAlbumId, currentAlbumObj, activeSubfolder]);

  // Scan Drive Folders handler
  const handleScanDriveFolders = useCallback(async (showNotice = true) => {
    try {
      setIsScanningDrive(true);
      let token = await getAccessToken();
      if (!token) {
        const res = await googleSignIn();
        token = res?.accessToken || null;
      }
      if (!token) {
        if (showNotice) {
          alert('Vui lòng kết nối Google Drive để đồng bộ và quét các thư mục ảnh.');
        }
        return;
      }

      setDriveScanFeedback('Đang quét thư mục và thư mục con trên Google Drive (Photos/)...');
      const scanResult = await scanGoogleDriveFoldersAndPhotos(token, myProfile.id, myProfile.name);

      if (scanResult.folders && scanResult.folders.length > 0) {
        setAlbumsList((prev) => {
          const updated = [...prev];
          for (const newAlb of scanResult.folders) {
            const existingIdx = updated.findIndex(
              (a) => a.id === newAlb.id || a.name.toLowerCase() === newAlb.name.toLowerCase()
            );
            if (existingIdx >= 0) {
              updated[existingIdx] = {
                ...updated[existingIdx],
                ...newAlb,
                subfolders: newAlb.subfolders || updated[existingIdx].subfolders,
                driveFolderId: newAlb.driveFolderId || updated[existingIdx].driveFolderId,
                driveFolderUrl: newAlb.driveFolderUrl || updated[existingIdx].driveFolderUrl,
              };
            } else {
              updated.push(newAlb);
            }
          }
          return updated;
        });
      }

      if (scanResult.photos && scanResult.photos.length > 0) {
        // Filter out photos that already exist in state by originalFileId or id
        const existingIds = new Set(photos.map((p) => p.originalFileId || p.id));
        const newDiscoveredPhotos = scanResult.photos.filter(
          (p) => !existingIds.has(p.originalFileId) && !existingIds.has(p.id)
        );

        if (newDiscoveredPhotos.length > 0) {
          addPhotosBatch(newDiscoveredPhotos);
        }
      }

      soundService.playSparkle();
      setDriveScanFeedback(
        `✓ Đã đồng bộ ${scanResult.totalFoldersCount || 0} thư mục và ${scanResult.totalPhotosCount || 0} ảnh từ Google Drive!`
      );
      setTimeout(() => setDriveScanFeedback(null), 6000);
    } catch (err) {
      console.warn('Scan Google Drive error:', err);
      setDriveScanFeedback('Không thể quét thư mục Google Drive lúc này.');
      setTimeout(() => setDriveScanFeedback(null), 4000);
    } finally {
      setIsScanningDrive(false);
    }
  }, [myProfile.id, myProfile.name, photos, addPhotosBatch]);

  // Auto scan once on mount if drive is connected
  useEffect(() => {
    if (isGoogleDriveConnected) {
      handleScanDriveFolders(false);
    }
  }, [isGoogleDriveConnected]);

  // Prepare images for Lightbox
  const lightboxItems: LightboxImageItem[] = useMemo(() => {
    return currentViewPhotos.map((p) => ({
      url: p.imageUrl,
      title: p.title,
      caption: p.caption,
      date: formatDateVN(p.date),
      location: p.location,
      authorName: p.authorName,
      originalQuality: true,
      originalFileId: p.originalFileId,
      driveViewUrl: p.driveViewUrl,
      driveDownloadUrl: p.driveDownloadUrl,
      fileSize: p.fileSize,
      fileName: p.fileName,
    }));
  }, [currentViewPhotos]);

  const openLightboxForPhoto = (photo: PhotoMemory) => {
    soundService.playPop();
    const idx = currentViewPhotos.findIndex((p) => p.id === photo.id);
    setLightboxIndex(idx >= 0 ? idx : 0);
    setLightboxOpen(true);
  };

  // Handle Multi-file upload for Batch with 100% Original Quality
  const handleBatchFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    soundService.playPop();
    Array.from(files).forEach((file: File, index) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const originalUrl = event.target.result as string;
          const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          setBatchFilesPreview((prev) => [
            ...prev,
            {
              id: `temp_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`,
              url: originalUrl,
              title: cleanName || `Ảnh kỷ niệm ${prev.length + 1}`,
              file: file,
              size: file.size,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
    // Reset file input value so user can upload again
    e.target.value = '';
  };

  // Remove single image from batch preview
  const handleRemoveBatchPreviewItem = (id: string) => {
    soundService.playPop();
    setBatchFilesPreview((prev) => prev.filter((item) => item.id !== id));
  };

  // Submit Batch Upload with Original Quality Google Drive Sync
  const handleSubmitBatchUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (batchFilesPreview.length === 0) return;

    const targetAlbum = uploadAlbumTarget.trim() || 'Khoảnh Khắc Hẹn Hò ☕';
    setIsUploadingToDrive(true);
    soundService.playSparkle();

    let token = await getAccessToken();

    const newPhotosPayload: any[] = [];

    for (let i = 0; i < batchFilesPreview.length; i++) {
      const item = batchFilesPreview[i];
      setUploadProgressText(
        `Đang lưu ảnh ${i + 1}/${batchFilesPreview.length} chất lượng gốc vào Google Drive (Thư mục: Photos/${targetAlbum})...`
      );

      let driveData: any = null;
      if (token) {
        try {
          if (item.file) {
            driveData = await uploadOriginalImageToDrive(token, item.file, item.file.name, targetAlbum);
          } else if (item.url) {
            driveData = await uploadDataUrlImageToDrive(token, item.url, `${item.title}.png`, targetAlbum);
          }
        } catch (uploadErr) {
          console.warn('Upload to Google Drive notice:', uploadErr);
        }
      }

      newPhotosPayload.push({
        title: item.title.trim() || `Kỷ niệm ngọt ngào ${i + 1}`,
        caption: batchDefaultCaption.trim(),
        imageUrl: item.url, // Original full-resolution image for instant crisp display
        date: batchDefaultDate,
        location: batchDefaultLocation.trim() || undefined,
        frameStyle: batchDefaultFrame,
        albumId: targetAlbum,
        albumName: targetAlbum,
        tags: [targetAlbum],
        originalQuality: true,
        originalFileId: driveData?.fileId,
        driveFolderId: driveData?.folderId,
        driveViewUrl: driveData?.webViewLink,
        driveDownloadUrl: driveData?.downloadUrl,
        fileSize: item.size,
        fileName: item.file?.name,
      });
    }

    addPhotosBatch(newPhotosPayload);

    // If album doesn't have cover yet, set first photo as cover
    setAlbumsList((prev) =>
      prev.map((alb) => {
        if ((alb.id === targetAlbum || alb.name === targetAlbum) && (!alb.coverImage || alb.coverImage.includes('unsplash'))) {
          return { ...alb, coverImage: batchFilesPreview[0].url };
        }
        return alb;
      })
    );

    // Reset and close
    setIsUploadingToDrive(false);
    setUploadProgressText('');
    setBatchFilesPreview([]);
    setBatchDefaultCaption('');
    setBatchDefaultLocation('');
    setIsBatchUploadModalOpen(false);
    soundService.playSuccess();
  };

  // Sync any unsynced local photos to Google Drive
  const handleSyncAllPhotosToDrive = async () => {
    try {
      setIsSyncingAllPhotos(true);
      let token = await getAccessToken();
      if (!token) {
        const loginRes = await googleSignIn();
        token = loginRes?.accessToken || null;
      }
      if (!token) {
        alert('Vui lòng kết nối tài khoản Google Drive để đồng bộ ảnh chất lượng gốc.');
        return;
      }

      const unsynced = photos.filter((p) => !p.originalFileId && p.imageUrl?.startsWith('data:'));
      if (unsynced.length === 0) {
        soundService.playSparkle();
        alert('Tất cả ảnh của bạn đã được đồng bộ lên Google Drive trong các thư mục album!');
        return;
      }

      for (let i = 0; i < unsynced.length; i++) {
        const photo = unsynced[i];
        const albumTarget = photo.albumName || photo.albumId || 'Khoảnh Khắc Hẹn Hò ☕';
        try {
          const driveData = await uploadDataUrlImageToDrive(
            token,
            photo.imageUrl,
            photo.fileName || `${photo.title || 'memory'}.png`,
            albumTarget
          );
          if (driveData?.fileId) {
            photo.originalFileId = driveData.fileId;
            photo.driveFolderId = driveData.folderId;
            photo.driveViewUrl = driveData.webViewLink;
            photo.driveDownloadUrl = driveData.downloadUrl;
            photo.originalQuality = true;
          }
        } catch (err) {
          console.warn('Sync photo error:', err);
        }
      }
      soundService.playSuccess();
    } finally {
      setIsSyncingAllPhotos(false);
    }
  };

  // Create or Update Album
  const handleSaveAlbum = (e: React.FormEvent) => {
    e.preventDefault();
    if (!albumFormName.trim()) return;

    soundService.playSparkle();

    if (editingAlbum) {
      // Edit existing album
      setAlbumsList((prev) =>
        prev.map((a) =>
          a.id === editingAlbum.id
            ? {
                ...a,
                name: albumFormName.trim(),
                description: albumFormDesc.trim(),
                coverImage: albumFormCover.trim() || a.coverImage,
                color: albumFormColor,
              }
            : a
        )
      );
    } else {
      // Create new album
      const newAlbum: Album = {
        id: `alb_${Date.now()}`,
        name: albumFormName.trim(),
        description: albumFormDesc.trim(),
        coverImage:
          albumFormCover.trim() ||
          'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&auto=format&fit=crop&q=80',
        color: albumFormColor,
        createdAt: Date.now(),
      };
      setAlbumsList((prev) => [...prev, newAlbum]);
    }

    setEditingAlbum(null);
    setAlbumFormName('');
    setAlbumFormDesc('');
    setAlbumFormCover('');
    setIsAlbumModalOpen(false);
  };

  // Delete Album initiation & execution
  const handleDeleteAlbum = (album: Album) => {
    soundService.playPop();
    setDeleteConfirmAlbum(album);
  };

  const confirmDeleteAlbum = () => {
    if (!deleteConfirmAlbum) return;
    const albumId = deleteConfirmAlbum.id;
    soundService.playPop();
    setAlbumsList((prev) => prev.filter((a) => a.id !== albumId));
    if (activeAlbumId === albumId || activeAlbumId === deleteConfirmAlbum.name) {
      setActiveAlbumId(null);
    }
    setDeleteConfirmAlbum(null);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 pb-28 sm:pb-16 select-none">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & BREADCRUMB */}
      {/* ========================================================================= */}
      <div
        className={`p-5 rounded-[32px] ${currentTheme.cardBg} border ${currentTheme.borderSubtle} shadow-xl shadow-rose-100/30 dark:shadow-none mb-6 flex flex-col md:flex-row items-center justify-between gap-4`}
      >
        <div className="flex items-center gap-3 w-full md:w-auto">
          {activeAlbumId && (
            <button
              onClick={() => {
                soundService.playPop();
                setActiveAlbumId(null);
              }}
              className="p-2.5 rounded-full bg-rose-50 dark:bg-zinc-800 text-rose-500 hover:bg-rose-100 dark:hover:bg-zinc-700 transition flex items-center gap-1.5 text-xs font-bold active:scale-95 cursor-pointer"
              title="Quay lại danh sách tệp album"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Tất cả Tệp Album</span>
            </button>
          )}

          <div>
            <h2 className="font-serif italic text-xl sm:text-2xl text-[#333] dark:text-[#f4effa] flex items-center gap-2">
              <span>{activeAlbumId ? currentAlbumObj?.name || 'Tất Cả Ảnh' : 'Bộ Sưu Tập Tệp Album'}</span>
              <span className="text-xs font-sans not-italic font-bold px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300">
                {activeAlbumId ? `${currentViewPhotos.length} ảnh` : `${albumsList.length} tệp album`}
              </span>
            </h2>
            {activeAlbumId && currentAlbumObj?.description && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {currentAlbumObj.description}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          {/* New Album Folder Button (when in overview) */}
          {!activeAlbumId ? (
            <button
              onClick={() => {
                soundService.playPop();
                setEditingAlbum(null);
                setAlbumFormName('');
                setAlbumFormDesc('');
                setAlbumFormCover('');
                setAlbumFormColor('#FF758F');
                setIsAlbumModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-full bg-white dark:bg-zinc-800 border border-rose-200 dark:border-zinc-700 text-rose-600 dark:text-rose-300 text-xs sm:text-sm font-bold shadow-sm hover:bg-rose-50 dark:hover:bg-zinc-700 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Tạo Tệp Album Mới</span>
            </button>
          ) : currentAlbumObj ? (
            /* Edit & Delete current Album button when inside an album */
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  soundService.playPop();
                  setEditingAlbum(currentAlbumObj);
                  setAlbumFormName(currentAlbumObj.name);
                  setAlbumFormDesc(currentAlbumObj.description || '');
                  setAlbumFormCover(currentAlbumObj.coverImage || '');
                  setAlbumFormColor(currentAlbumObj.color || '#FF758F');
                  setIsAlbumModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-700 flex items-center gap-1 transition"
                title="Chỉnh sửa thông tin album này"
              >
                <Edit3 className="w-3.5 h-3.5 text-zinc-500" />
                <span>Sửa Tệp</span>
              </button>
              <button
                onClick={() => handleDeleteAlbum(currentAlbumObj)}
                className="px-3.5 py-2 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-300 text-xs font-bold hover:bg-red-100 transition flex items-center gap-1"
                title="Xóa tệp album này"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa Tệp Album</span>
              </button>
            </div>
          ) : null}

          {/* Batch Upload Photos Button */}
          <button
            onClick={() => {
              soundService.playPop();
              setUploadAlbumTarget(currentAlbumObj?.name || albumsList[0]?.name || 'Khoảnh Khắc Hẹn Hò ☕');
              setBatchFilesPreview([]);
              setIsBatchUploadModalOpen(true);
            }}
            className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#FF758F] to-[#FF9A9E] hover:from-[#ff607e] hover:to-[#ff8d92] text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-200 dark:shadow-rose-950 flex items-center gap-2 transition active:scale-95 cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Thêm Nhiều Ảnh Vào Album ✨</span>
          </button>
        </div>
      </div>

      {/* Google Drive Photo Sync Status Bar */}
      <div className="mb-6 p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-rose-100 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl ${isGoogleDriveConnected ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-950/50 text-rose-500'}`}>
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100">
                {isGoogleDriveConnected
                  ? 'Lưu Trữ Ảnh Gốc Google Drive (Photos / Tên Album)'
                  : 'Chưa Kết Nối Google Drive Để Lưu Ảnh Gốc'}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                isGoogleDriveConnected
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
              }`}>
                {isGoogleDriveConnected ? '✓ Tự động lưu chất lượng gốc' : 'Chỉ lưu tạm trên máy'}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {isGoogleDriveConnected
                ? 'Mỗi album được lưu thành một thư mục con riêng trong Google Drive với độ phân giải và chất lượng gốc 100%.'
                : 'Kết nối Google Drive để mọi ảnh chụp và video được lưu vĩnh viễn vào Google Drive với chất lượng gốc.'}
            </p>
            {driveScanFeedback && (
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 animate-pulse">
                <span>{driveScanFeedback}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          {isGoogleDriveConnected ? (
            <>
              {/* Scan & Open Drive Folders */}
              <button
                onClick={() => handleScanDriveFolders(true)}
                disabled={isScanningDrive}
                className="px-3.5 py-2 rounded-2xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                title="Quét các thư mục và thư mục con từ Google Drive"
              >
                <FolderTree className={`w-3.5 h-3.5 ${isScanningDrive ? 'animate-spin' : ''}`} />
                <span>{isScanningDrive ? 'Đang quét Drive...' : 'Quét Thư Mục Drive'}</span>
              </button>

              <button
                onClick={openDriveFolderModal}
                className="px-3.5 py-2 rounded-2xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Đổi đường link hoặc Folder ID của thư mục Google Drive lưu ảnh"
              >
                <Link className="w-3.5 h-3.5" />
                <span>{activeCustomFolder ? 'Đổi Link Thư Mục Drive' : 'Đổi Link Thư Mục Drive'}</span>
              </button>

              {googleDriveFolderUrl && (
                <a
                  href={googleDriveFolderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Folder className="w-3.5 h-3.5 text-rose-400" />
                  <span>Mở Google Drive</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <button
                onClick={handleSyncAllPhotosToDrive}
                disabled={isSyncingAllPhotos}
                className="px-3.5 py-2 rounded-2xl bg-rose-50 dark:bg-zinc-800 hover:bg-rose-100 dark:hover:bg-zinc-700 text-rose-600 dark:text-rose-300 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                title="Đồng bộ ảnh chưa tải lên Drive"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAllPhotos ? 'animate-spin' : ''}`} />
                <span>{isSyncingAllPhotos ? 'Đang đồng bộ...' : 'Đồng bộ ảnh lên Drive'}</span>
              </button>
            </>
          ) : (
            <button
              onClick={connectGoogleDrive}
              className="px-4 py-2 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-bold shadow-sm hover:scale-105 transition active:scale-95 cursor-pointer"
            >
              Kết Nối Google Drive Ngay
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. OVERVIEW MODE: ALBUM FOLDERS LIST (Giao diện từng tệp / Folder Cards) */}
      {/* ========================================================================= */}
      {!activeAlbumId && (
        <div className="space-y-6">
          {/* Master "All Photos" Folder Banner */}
          <motion.div
            whileHover={{ y: -3 }}
            onClick={() => {
              soundService.playPop();
              setActiveAlbumId('all');
            }}
            className="relative rounded-3xl p-5 sm:p-6 bg-gradient-to-r from-rose-400 via-pink-400 to-rose-300 text-white shadow-xl shadow-rose-200/50 dark:shadow-none cursor-pointer overflow-hidden group"
          >
            <div className="absolute -right-6 -bottom-6 w-36 h-36 rounded-full bg-white/20 blur-xl pointer-events-none" />
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition duration-300">
                  🌟
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif font-bold text-lg sm:text-xl text-white">
                      Tất Cả Khoảnh Khắc Cùng Nhau
                    </h3>
                    <span className="px-3 py-1 rounded-full bg-white/25 text-xs font-bold backdrop-blur-xs">
                      {photos.length} ảnh
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-rose-50/90 mt-1">
                    Tổng hợp toàn bộ kỷ niệm của hai bạn theo dòng thời gian
                  </p>
                </div>
              </div>

              <div className="px-5 py-2.5 rounded-full bg-white text-rose-600 font-bold text-xs sm:text-sm shadow-md group-hover:bg-rose-50 transition flex items-center gap-1.5 self-end sm:self-auto">
                <span>Mở Toàn Bộ Thư Viện</span>
                <span>→</span>
              </div>
            </div>
          </motion.div>

          {/* Grid of Individual Folder / Album Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
            {albumsList.map((album) => {
              const albumPhotos = photos.filter(
                (p) => p.albumName === album.name || p.albumId === album.id || p.albumName === album.id
              );
              const coverImg =
                albumPhotos[0]?.imageUrl ||
                album.coverImage ||
                'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&auto=format&fit=crop&q=80';

              return (
                <motion.div
                  key={album.id}
                  whileHover={{ y: -6 }}
                  className="group relative flex flex-col rounded-3xl bg-white dark:bg-zinc-900 border border-rose-100 dark:border-zinc-800 shadow-md hover:shadow-2xl hover:shadow-rose-100 dark:hover:shadow-none transition-all duration-300 overflow-hidden cursor-pointer"
                  onClick={() => {
                    soundService.playPop();
                    setActiveAlbumId(album.id);
                  }}
                >
                  {/* Folder Tab Decorative Top */}
                  <div className="relative pt-3 px-4 bg-rose-50/70 dark:bg-zinc-800/60 border-b border-rose-100/60 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: album.color || '#FF758F' }}
                      />
                      <span className="text-[11px] font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                        {album.isDriveFolder ? 'Thư mục Drive 📁' : 'Tệp Album'}
                      </span>
                    </div>

                    {/* Edit / Manage Album Button */}
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          soundService.playPop();
                          setEditingAlbum(album);
                          setAlbumFormName(album.name);
                          setAlbumFormDesc(album.description || '');
                          setAlbumFormCover(album.coverImage || '');
                          setAlbumFormColor(album.color || '#FF758F');
                          setIsAlbumModalOpen(true);
                        }}
                        className="p-1.5 rounded-full hover:bg-rose-100 dark:hover:bg-zinc-700 text-zinc-400 hover:text-rose-600 transition"
                        title="Chỉnh sửa album"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteAlbum(album)}
                        className="p-1.5 rounded-full hover:bg-rose-100 dark:hover:bg-zinc-700 text-zinc-400 hover:text-red-500 transition"
                        title="Xóa album"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Album Cover Image Preview with SmartDriveImage */}
                  <div className="relative aspect-4/3 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                    <SmartDriveImage
                      src={coverImg}
                      originalFileId={albumPhotos[0]?.originalFileId}
                      driveViewUrl={albumPhotos[0]?.driveViewUrl}
                      alt={album.name}
                      containerClassName="w-full h-full"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />

                    {/* Count badge over image */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white pointer-events-none">
                      <span className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-md text-xs font-bold border border-white/20">
                        📷 {albumPhotos.length} bức ảnh
                      </span>
                      {album.subfolders && album.subfolders.length > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-500/80 backdrop-blur-md text-[11px] font-bold">
                          {album.subfolders.length} thư mục con 📂
                        </span>
                      )}
                      <span className="text-xs font-bold text-rose-200 group-hover:translate-x-1 transition-transform">
                        Xem tệp →
                      </span>
                    </div>
                  </div>

                  {/* Album Info Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between bg-white dark:bg-zinc-900">
                    <div>
                      <h4 className="font-bold text-base text-zinc-800 dark:text-zinc-100 font-cute group-hover:text-rose-500 transition-colors">
                        {album.name}
                      </h4>
                      {album.description && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-1 font-cute">
                          {album.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
                      <span className="flex items-center gap-1 truncate max-w-[160px]" title={`Photos/${album.name}`}>
                        <Cloud className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="truncate">Photos/{album.name}</span>
                      </span>
                      <span className="text-rose-500 font-bold text-xs group-hover:underline">
                        Mở Album →
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. DETAIL MODE: PHOTOS INSIDE SELECTED ALBUM */}
      {/* ========================================================================= */}
      {activeAlbumId && (
        <div className="space-y-6">
          {/* Subfolder filter pills if current album has subfolders */}
          {currentAlbumSubfolders.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-rose-100 dark:border-zinc-800 shadow-xs flex items-center gap-2 overflow-x-auto">
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 shrink-0 flex items-center gap-1 ml-1">
                <FolderTree className="w-3.5 h-3.5 text-rose-500" />
                <span>Thư mục con:</span>
              </span>
              <button
                onClick={() => {
                  soundService.playPop();
                  setActiveSubfolder(null);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  activeSubfolder === null
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200'
                }`}
              >
                Tất cả thư mục
              </button>
              {currentAlbumSubfolders.map((sub) => (
                <button
                  key={sub.id || sub.name}
                  onClick={() => {
                    soundService.playPop();
                    setActiveSubfolder(sub.name);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                    activeSubfolder === sub.name
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200'
                  }`}
                >
                  <Folder className="w-3 h-3 text-amber-400" />
                  <span>{sub.name}</span>
                  {sub.photoCount !== undefined && (
                    <span className="text-[10px] opacity-80">({sub.photoCount})</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {currentViewPhotos.length === 0 ? (
            <div
              className={`text-center py-16 px-4 rounded-3xl ${currentTheme.cardBg} border ${currentTheme.borderSubtle}`}
            >
              <div className="w-20 h-20 mx-auto rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center text-3xl mb-3 animate-float-slow">
                📸
              </div>
              <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mb-1 font-cute">
                {activeSubfolder
                  ? `Thư mục con "${activeSubfolder}" chưa có bức ảnh nào`
                  : 'Tệp album này chưa có bức ảnh nào'}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-5">
                Hãy chọn và tải nhiều bức ảnh cùng lúc để lưu giữ những khoảnh khắc tuyệt vời vào album này nhé!
              </p>
              <button
                onClick={() => {
                  soundService.playPop();
                  setUploadAlbumTarget(currentAlbumObj?.name || 'Khoảnh Khắc Hẹn Hò ☕');
                  setBatchFilesPreview([]);
                  setIsBatchUploadModalOpen(true);
                }}
                className="px-6 py-3 rounded-full bg-gradient-to-r from-[#FF758F] to-[#FF9A9E] text-white text-xs sm:text-sm font-bold shadow-lg shadow-rose-200 dark:shadow-rose-950 hover:scale-105 transition active:scale-95 cursor-pointer"
              >
                ✨ Tải Lên Nhiều Ảnh Vào Album Này
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 sm:gap-6">
              {currentViewPhotos.map((photo) => {
                const isLiked = photo.likes.includes(myProfile.id);

                return (
                  <motion.div
                    key={photo.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ y: -4 }}
                    className={`group relative rounded-3xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border ${
                      photo.frameStyle === 'polaroid'
                        ? 'bg-[#fffefb] dark:bg-zinc-900 border-[#eae3d9] dark:border-zinc-800 p-3.5 pb-4'
                        : photo.frameStyle === 'sakura'
                        ? 'bg-rose-50/90 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40 p-3'
                        : photo.frameStyle === 'vintage'
                        ? 'bg-[#fcf8f2] dark:bg-stone-900 border-[#e3d7c5] dark:border-stone-800 p-3'
                        : photo.frameStyle === 'heart'
                        ? 'bg-pink-50/80 dark:bg-pink-950/20 border-pink-200 dark:border-pink-900/40 p-3'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 p-3'
                    }`}
                  >
                    {/* Photo with SmartDriveImage & click to open Lightbox with Zoom */}
                    <div
                      onClick={() => openLightboxForPhoto(photo)}
                      className="relative aspect-square rounded-2xl overflow-hidden cursor-pointer group-hover:brightness-105 transition duration-300 bg-zinc-100 dark:bg-zinc-800"
                    >
                      <SmartDriveImage
                        src={photo.imageUrl}
                        originalFileId={photo.originalFileId}
                        driveViewUrl={photo.driveViewUrl}
                        alt={photo.title}
                        containerClassName="w-full h-full"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        showDriveBadge={true}
                      />

                      {/* Decorative accents */}
                      {photo.frameStyle === 'sakura' && (
                        <span className="absolute top-2 right-2 text-xl drop-shadow-md pointer-events-none">🌸</span>
                      )}
                      {photo.frameStyle === 'heart' && (
                        <span className="absolute top-2 left-2 text-xl drop-shadow-md pointer-events-none">💖</span>
                      )}

                      {/* Zoom indicator on hover */}
                      <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 pointer-events-none">
                        <span className="px-3 py-1.5 rounded-full bg-white/95 text-zinc-900 font-bold text-xs shadow-lg flex items-center gap-1.5">
                          <Maximize2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>Phóng to & Zoom</span>
                        </span>
                      </div>
                    </div>

                    {/* Polaroid Bottom Bar */}
                    <div className="mt-3">
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-100 truncate font-cute">
                          {photo.title}
                        </h4>
                        {/* Like button */}
                        <button
                          onClick={() => togglePhotoLike(photo.id)}
                          className={`p-1.5 rounded-full transition flex items-center gap-1 text-xs font-bold ${
                            isLiked ? 'text-rose-500' : 'text-zinc-400 hover:text-rose-400'
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500' : ''}`} />
                          <span>{photo.likes.length}</span>
                        </button>
                      </div>

                      {photo.caption && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2 leading-relaxed mb-2 font-cute">
                          {photo.caption}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formatDateVN(photo.date)}
                        </span>

                        <div className="flex items-center gap-2">
                          {photo.subfolderName && (
                            <span className="flex items-center gap-0.5 text-amber-500 truncate max-w-[80px]" title={photo.subfolderName}>
                              <Folder className="w-3 h-3 shrink-0" />
                              <span className="truncate">{photo.subfolderName}</span>
                            </span>
                          )}
                          {photo.location && (
                            <span className="flex items-center gap-0.5 truncate max-w-[90px]">
                              <MapPin className="w-3 h-3" /> {photo.location}
                            </span>
                          )}
                          <button
                            onClick={() => deletePhoto(photo.id)}
                            className="p-1 text-zinc-300 hover:text-red-500 transition cursor-pointer"
                            title="Xóa ảnh này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODAL: BATCH MULTIPLE PHOTO UPLOAD (Thêm nhiều ảnh cùng lúc) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isBatchUploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-3xl p-6 shadow-2xl border border-rose-100 dark:border-zinc-800 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-2xl bg-rose-100 dark:bg-rose-950/40 text-rose-500">
                    <UploadCloud className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-zinc-800 dark:text-zinc-100 font-cute">
                      Thêm Nhiều Ảnh Vào Album
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Chọn cùng lúc nhiều ảnh từ máy tính hoặc điện thoại
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsBatchUploadModalOpen(false)}
                  className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitBatchUpload} className="space-y-4">
                {/* Album Target Selection */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Chọn Tệp Album Lưu Trữ
                  </label>
                  <select
                    value={uploadAlbumTarget}
                    onChange={(e) => setUploadAlbumTarget(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-rose-50/50 dark:bg-zinc-800 border border-rose-200 dark:border-zinc-700 text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100"
                  >
                    {albumsList.map((alb) => (
                      <option key={alb.id} value={alb.name}>
                        📂 {alb.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Multiple Files Upload Dropzone */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Chọn Các Tấm Ảnh (Có thể chọn nhiều ảnh cùng lúc)
                  </label>
                  <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-rose-300 dark:border-rose-800/60 rounded-3xl bg-rose-50/30 dark:bg-zinc-800/40 hover:bg-rose-50 dark:hover:bg-zinc-800 cursor-pointer transition group">
                    <ImageIcon className="w-10 h-10 text-rose-400 group-hover:scale-110 transition-transform mb-2" />
                    <span className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-300">
                      Bấm vào đây để chọn nhiều ảnh 📁
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-1">
                      Hỗ trợ PNG, JPG, JPEG, GIF, WEBP
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleBatchFileInput}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Preview Grid of Selected Images */}
                {batchFilesPreview.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        Đã chọn ({batchFilesPreview.length} ảnh):
                      </span>
                      <button
                        type="button"
                        onClick={() => setBatchFilesPreview([])}
                        className="text-xs text-red-500 hover:underline font-bold"
                      >
                        Xóa tất cả
                      </button>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-2 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                      {batchFilesPreview.map((item) => (
                        <div
                          key={item.id}
                          className="relative aspect-square rounded-xl overflow-hidden group shadow-sm bg-zinc-200 dark:bg-zinc-700"
                        >
                          <img
                            src={item.url}
                            alt="preview"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveBatchPreviewItem(item.id)}
                            className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white shadow-md hover:scale-110 transition"
                            title="Bỏ ảnh này"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Batch Common Info: Date, Location, Frame Style */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <DateInputVN
                      label="Ngày Kỷ Niệm"
                      value={batchDefaultDate}
                      onChange={(val) => setBatchDefaultDate(val)}
                      placeholder="dd/mm/yyyy"
                      inputClassName="!bg-white dark:!bg-zinc-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 font-cute">
                      Địa Điểm (Tùy chọn)
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Hồ Tây, Đà Lạt..."
                      value={batchDefaultLocation}
                      onChange={(e) => setBatchDefaultLocation(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                </div>

                {/* Frame Style Selector */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Kiểu Khung Ảnh
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {FRAME_STYLES.map((frame) => (
                      <button
                        key={frame.id}
                        type="button"
                        onClick={() => setBatchDefaultFrame(frame.id as any)}
                        className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 transition ${
                          batchDefaultFrame === frame.id
                            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 text-rose-600 dark:text-rose-300'
                            : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        <span>{frame.emoji}</span>
                        <span className="truncate">{frame.label.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Caption */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Lời Nhắn / Chú Thích Chung
                  </label>
                  <input
                    type="text"
                    placeholder="Khoảnh khắc đáng nhớ của chúng mình..."
                    value={batchDefaultCaption}
                    onChange={(e) => setBatchDefaultCaption(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-100"
                  />
                </div>

                {/* Upload Status & Progress */}
                {isUploadingToDrive && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-rose-500 animate-spin shrink-0" />
                    <div className="text-xs text-rose-700 dark:text-rose-300 font-bold">
                      {uploadProgressText || 'Đang lưu ảnh chất lượng gốc vào Google Drive...'}
                    </div>
                  </div>
                )}

                {/* Submit button */}
                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={isUploadingToDrive}
                    onClick={() => setIsBatchUploadModalOpen(false)}
                    className="px-4 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-bold disabled:opacity-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={batchFilesPreview.length === 0 || isUploadingToDrive}
                    className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-200 transition flex items-center gap-2"
                  >
                    {isUploadingToDrive ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Đang Lưu Lên Google Drive...</span>
                      </>
                    ) : (
                      <span>Lưu {batchFilesPreview.length > 0 ? `${batchFilesPreview.length} ảnh` : ''} Chất Lượng Gốc ✨</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 5. MODAL: CREATE / EDIT ALBUM FOLDER */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isAlbumModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-rose-100 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-2xl bg-rose-100 dark:bg-rose-950/40 text-rose-500">
                    <FolderPlus className="w-5 h-5" />
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-zinc-800 dark:text-zinc-100 font-cute">
                    {editingAlbum ? 'Chỉnh Sửa Tệp Album' : 'Tạo Tệp Album Mới'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsAlbumModalOpen(false)}
                  className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveAlbum} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Tên Tệp Album *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Chuyến Đi SaPa 🏔️, Ăn Uống Cùng Nhau 🍜"
                    value={albumFormName}
                    onChange={(e) => setAlbumFormName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-2xl bg-rose-50/40 dark:bg-zinc-800 border border-rose-200 dark:border-zinc-700 text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Mô Tả Ngắn Về Album
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Lưu lại những kỷ niệm đẹp khi chúng mình bên nhau..."
                    value={albumFormDesc}
                    onChange={(e) => setAlbumFormDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Ảnh Bìa Cho Album (Tùy chọn tải ảnh hoặc dán link)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Dán link ảnh hoặc tải ảnh lên bên cạnh"
                      value={albumFormCover}
                      onChange={(e) => setAlbumFormCover(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-100"
                    />
                    <label className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-zinc-800 border border-rose-200 dark:border-zinc-700 text-rose-600 dark:text-rose-300 text-xs font-bold cursor-pointer hover:bg-rose-100 transition whitespace-nowrap">
                      <span>Tải ảnh</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              if (event.target?.result) {
                                setAlbumFormCover(event.target.result as string);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {albumFormCover && (
                    <div className="mt-2 w-24 h-16 rounded-xl overflow-hidden border border-rose-200 shadow-sm">
                      <img src={albumFormCover} alt="cover" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                {/* Color Selector */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Màu Thẻ Kẹp Bìa
                  </label>
                  <div className="flex items-center gap-2">
                    {['#FF758F', '#FF9A9E', '#70A6FF', '#A78BFA', '#34D399', '#FBBF24'].map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setAlbumFormColor(col)}
                        className={`w-8 h-8 rounded-full transition flex items-center justify-center ${
                          albumFormColor === col ? 'ring-2 ring-offset-2 ring-rose-500 scale-110' : ''
                        }`}
                        style={{ backgroundColor: col }}
                      >
                        {albumFormColor === col && <Check className="w-4 h-4 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAlbumModalOpen(false)}
                    className="px-4 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-bold"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-200 transition"
                  >
                    {editingAlbum ? 'Cập Nhật Tệp Album' : 'Tạo Tệp Album'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 6. IN-APP DELETE ALBUM CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {deleteConfirmAlbum && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-7 shadow-2xl border border-rose-200 dark:border-zinc-800 text-center"
            >
              <div className="w-16 h-16 mx-auto rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center mb-4 shadow-inner">
                <Trash2 className="w-8 h-8" />
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-2 font-cute">
                Xác Nhận Xóa Tệp Album?
              </h3>

              <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6 leading-relaxed">
                Bạn có chắc chắn muốn xóa tệp album{' '}
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  "{deleteConfirmAlbum.name}"
                </span>{' '}
                không?
                <br />
                <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 block bg-rose-50 dark:bg-rose-950/30 p-2 rounded-xl">
                  ✨ Các bức ảnh bên trong album vẫn sẽ được lưu giữ an toàn trong kho ảnh chung của hai bạn.
                </span>
              </p>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmAlbum(null)}
                  className="px-5 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs sm:text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteAlbum}
                  className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-500/20 hover:scale-105 active:scale-95 transition cursor-pointer"
                >
                  Xác Nhận Xóa
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 6.5. GOOGLE DRIVE CUSTOM PHOTOS FOLDER CONFIGURATION MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isDriveFolderModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative max-w-lg w-full bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-7 shadow-2xl border border-blue-200 dark:border-zinc-800 text-left max-h-[90vh] overflow-y-auto"
            >
              <button
                type="button"
                onClick={() => setIsDriveFolderModalOpen(false)}
                className="absolute top-5 right-5 p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner">
                  <Folder className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 font-cute">
                    Đổi Thư Mục Lưu Ảnh Google Drive
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-cute">
                    Liên kết với bất kỳ thư mục Google Drive nào mà bạn muốn lưu ảnh
                  </p>
                </div>
              </div>

              {/* Current Active Folder Banner */}
              <div className="mb-4 p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 space-y-1.5">
                <span className="text-[11px] font-bold text-blue-900 dark:text-blue-200 block font-cute">
                  📂 Thư mục hiện tại đang dùng:
                </span>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 break-all">
                    {activeCustomFolder?.name || '📷 Album Ảnh & Kỷ Niệm (Mặc định trong LoveSync)'}
                  </div>
                  {activeCustomFolder?.url && (
                    <a
                      href={activeCustomFolder.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 transition flex items-center gap-1 shrink-0"
                    >
                      <span>Mở thư mục</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                {activeCustomFolder?.id && (
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                    ID: {activeCustomFolder.id}
                  </div>
                )}
              </div>

              <form onSubmit={handleSaveCustomDriveFolder} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 font-cute mb-1.5">
                    🔗 Đường link hoặc ID thư mục Google Drive mới:
                  </label>
                  <input
                    type="text"
                    value={customFolderInput}
                    onChange={(e) => {
                      setCustomFolderInput(e.target.value);
                      setCustomFolderVerifyError(null);
                      setCustomFolderVerifyResult(null);
                    }}
                    placeholder="https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoP... hoặc 1aBcDe..."
                    className="w-full px-3.5 py-2.5 text-xs font-mono rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-400"
                  />
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 block">
                    💡 Hỗ trợ mọi định dạng: Link đầy đủ (copy từ thanh trình duyệt/nút Chia sẻ) hoặc chuỗi ID thư mục.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 font-cute mb-1.5">
                    🏷️ Đặt tên hiển thị cho thư mục (tùy chọn):
                  </label>
                  <input
                    type="text"
                    value={customFolderNameInput}
                    onChange={(e) => setCustomFolderNameInput(e.target.value)}
                    placeholder="Ví dụ: Kho Ảnh Kỷ Niệm 2026 Của Đôi Mình"
                    className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-400 font-cute"
                  />
                </div>

                {/* Feedback notices */}
                {customFolderVerifyError && (
                  <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{customFolderVerifyError}</span>
                  </div>
                )}

                {customFolderVerifyResult && (
                  <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Đã liên kết thành công với thư mục "{customFolderVerifyResult.name}"!</span>
                  </div>
                )}

                {/* Step by step guide */}
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 space-y-1.5 font-cute leading-relaxed">
                  <div className="font-bold flex items-center gap-1 text-amber-800 dark:text-amber-300">
                    <span>💡 Hướng dẫn lấy đường link thư mục từ Google Drive:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 pl-1">
                    <li>Mở <strong>Google Drive</strong> (trên máy tính hoặc điện thoại).</li>
                    <li>Tìm thư mục ảnh của bạn ➔ Bấm chuột phải (hoặc dấu 3 chấm) ➔ Chọn <strong>Chia sẻ</strong> (Share).</li>
                    <li>Bấm <strong>Sao chép đường liên kết</strong> (Copy link) rồi dán vào ô bên trên.</li>
                    <li>Bấm <strong>Kiểm Tra & Áp Dụng</strong>.</li>
                  </ol>
                </div>

                <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleResetToDefaultFolder}
                    className="px-3.5 py-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-bold transition cursor-pointer"
                  >
                    Khôi phục mặc định
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsDriveFolderModalOpen(false)}
                      className="px-4 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-bold"
                    >
                      Đóng
                    </button>
                    <button
                      type="submit"
                      disabled={isVerifyingCustomFolder}
                      className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5 disabled:opacity-50 transition cursor-pointer"
                    >
                      {isVerifyingCustomFolder ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Đang kiểm tra...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Kiểm Tra & Áp Dụng</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 7. UNIVERSAL IMAGE LIGHTBOX WITH ZOOM IN / ZOOM OUT / PAN / ROTATE */}
      {/* ========================================================================= */}
      <ImageLightbox
        images={lightboxItems}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
};
