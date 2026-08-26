import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, RefreshCw, ExternalLink } from 'lucide-react';
import { getAuthenticatedDriveImageUrl, driveBlobCache } from '../services/googleDrive';
import { getAccessToken } from '../services/googleAuth';

interface SmartDriveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt?: string;
  originalFileId?: string;
  driveViewUrl?: string;
  className?: string;
  containerClassName?: string;
  showDriveBadge?: boolean;
  thumbnailSize?: number; // e.g. 500 for fast grid rendering, or null/undefined for full size
}

export const SmartDriveImage: React.FC<SmartDriveImageProps> = ({
  src,
  alt = 'LoveSync Photo',
  originalFileId,
  driveViewUrl,
  className = '',
  containerClassName = '',
  showDriveBadge = false,
  thumbnailSize = 500,
  onClick,
  ...imgProps
}) => {
  // Compute optimized URL based on thumbnail size
  const getOptimizedSrc = (rawSrc: string): string => {
    if (!rawSrc) return '';
    if (thumbnailSize && rawSrc.includes('drive.google.com/thumbnail')) {
      return rawSrc.replace(/sz=w\d+/, `sz=w${thumbnailSize}`);
    }
    return rawSrc;
  };

  const [currentSrc, setCurrentSrc] = useState<string>(() => {
    if (originalFileId && driveBlobCache.has(originalFileId)) {
      return driveBlobCache.get(originalFileId)!;
    }
    return getOptimizedSrc(src);
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isResolvingBlob, setIsResolvingBlob] = useState<boolean>(false);

  // Extract file ID from google drive URLs if not explicitly provided
  const resolvedFileId = React.useMemo(() => {
    if (originalFileId) return originalFileId;
    if (src && src.includes('drive.google.com')) {
      const match = src.match(/id=([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
      const match2 = src.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match2) return match2[1];
    }
    if (src && src.includes('googleusercontent.com/d/')) {
      const match = src.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
    }
    return undefined;
  }, [originalFileId, src]);

  // Update src when prop changes
  useEffect(() => {
    if (resolvedFileId && driveBlobCache.has(resolvedFileId)) {
      setCurrentSrc(driveBlobCache.get(resolvedFileId)!);
      setIsLoading(false);
      setHasError(false);
      return;
    }
    setCurrentSrc(getOptimizedSrc(src));
    setIsLoading(true);
    setHasError(false);
  }, [src, resolvedFileId, thumbnailSize]);

  // Fallback handler if image fails to load
  const handleImageError = async () => {
    if (resolvedFileId && !isResolvingBlob) {
      setIsResolvingBlob(true);
      try {
        const token = await getAccessToken();
        if (token) {
          const blobUrl = await getAuthenticatedDriveImageUrl(token, resolvedFileId);
          if (blobUrl) {
            setCurrentSrc(blobUrl);
            setIsLoading(false);
            setHasError(false);
            setIsResolvingBlob(false);
            return;
          }
        }
      } catch (err) {
        console.warn('SmartDriveImage resolution fallback failed:', err);
      }
      setIsResolvingBlob(false);
    }
    setIsLoading(false);
    setHasError(true);
  };

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);
    setHasError(false);
    if (resolvedFileId) {
      setIsResolvingBlob(true);
      try {
        const token = await getAccessToken();
        if (token) {
          const blobUrl = await getAuthenticatedDriveImageUrl(token, resolvedFileId);
          if (blobUrl) {
            setCurrentSrc(blobUrl);
            setIsLoading(false);
            setIsResolvingBlob(false);
            return;
          }
        }
      } catch {}
      setIsResolvingBlob(false);
    }
    // Try alternate Google Drive thumbnail parameter
    if (resolvedFileId) {
      setCurrentSrc(`https://drive.google.com/thumbnail?id=${resolvedFileId}&sz=w1600&t=${Date.now()}`);
    }
  };

  return (
    <div className={`relative overflow-hidden ${containerClassName}`} onClick={onClick}>
      {/* Loading Skeleton */}
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-r from-rose-100/50 via-pink-100/70 to-rose-100/50 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800 animate-pulse flex items-center justify-center z-10">
          <RefreshCw className="w-5 h-5 text-rose-400 animate-spin opacity-60" />
        </div>
      )}

      {/* Error Fallback */}
      {hasError ? (
        <div className="w-full h-full min-h-[120px] bg-rose-50/60 dark:bg-zinc-800 flex flex-col items-center justify-center p-3 text-center border border-rose-100 dark:border-zinc-700 rounded-xl">
          <ImageIcon className="w-6 h-6 text-rose-300 dark:text-zinc-500 mb-1" />
          <span className="text-[11px] text-zinc-600 dark:text-zinc-400 font-cute line-clamp-1 mb-1.5">
            Ảnh Google Drive
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleRetry}
              className="px-2 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-rose-700 dark:text-rose-300 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              <span>Tải lại</span>
            </button>
            {driveViewUrl && (
              <a
                href={driveViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="px-2 py-1 rounded-lg bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-[10px] font-bold transition flex items-center gap-1"
                title="Mở ảnh trong Google Drive"
              >
                <span>Drive</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        </div>
      ) : (
        <img
          loading="lazy"
          decoding="async"
          {...imgProps}
          src={currentSrc}
          alt={alt}
          referrerPolicy="no-referrer"
          onLoad={() => setIsLoading(false)}
          onError={handleImageError}
          className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100 transition-opacity duration-200'}`}
        />
      )}

      {/* Drive quality badge if enabled */}
      {showDriveBadge && resolvedFileId && !hasError && !isLoading && (
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-emerald-300 text-[9px] font-bold flex items-center gap-1 pointer-events-none shadow-sm">
          <span>Drive Gốc ✨</span>
        </div>
      )}
    </div>
  );
};
