import { getYouTubeApiKey } from './googleAuth';

export interface YouTubeSearchResultItem {
  id: string;
  youtubeId: string;
  title: string;
  artist: string;
  coverImage: string;
  duration?: string;
}

export interface YouTubeSearchResponse {
  results: YouTubeSearchResultItem[];
  error?: string;
  needsApiKey?: boolean;
}

function formatDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseInt(match[3] || '0', 10);
  const parts: string[] = [];
  if (h > 0) {
    parts.push(String(h));
    parts.push(String(m).padStart(2, '0'));
  } else {
    parts.push(String(m));
  }
  parts.push(String(s).padStart(2, '0'));
  return parts.join(':');
}

/**
 * Search for songs on YouTube directly from the browser via the YouTube Data API v3 — this app
 * is a static site (GitHub Pages) with no backend, so the search MUST happen client-side. Needs a
 * YouTube Data API v3 key configured (Settings → "Cấu hình YouTube API Key") since the key is
 * tied to whoever's Google Cloud project/quota it draws from and can't be shipped as a shared
 * default the way the OAuth client ID is.
 */
export async function searchYouTubeVideos(query: string): Promise<YouTubeSearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) return { results: [] };

  const apiKey = getYouTubeApiKey();
  if (!apiKey) {
    return { results: [], needsApiKey: true, error: 'Chưa cấu hình YouTube API Key.' };
  }

  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=15&q=${encodeURIComponent(trimmed)}&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(searchUrl);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const reason = data?.error?.errors?.[0]?.reason;
      if (reason === 'keyInvalid' || res.status === 400) {
        return { results: [], needsApiKey: true, error: 'YouTube API Key không hợp lệ — kiểm tra lại đã dán đúng chưa.' };
      }
      if (reason === 'accessNotConfigured') {
        return {
          results: [],
          error: 'Chưa bật "YouTube Data API v3" cho project này. Vào Google Cloud Console → APIs & Services → Library → tìm "YouTube Data API v3" → bấm Enable, rồi thử lại.',
        };
      }
      if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded' || reason === 'rateLimitExceeded') {
        return {
          results: [],
          error: 'Đã dùng hết hạn ngạch tìm kiếm miễn phí hôm nay (khoảng 100 lượt/ngày). Thử lại vào ngày mai nhé.',
        };
      }
      if (reason === 'ipRefererBlocked' || reason === 'forbidden') {
        return {
          results: [],
          error:
            'Key bị chặn theo tên miền — kiểm tra lại mục "Website restrictions" trong Google Cloud Console đã có đúng tên miền web hiện tại của bạn chưa (bấm F12 → Console để xem tên miền chính xác nếu cần).',
        };
      }
      if (res.status === 403) {
        return {
          results: [],
          error:
            data?.error?.message ||
            'YouTube API Key bị từ chối (có thể do vượt hạn ngạch miễn phí hôm nay, hoặc chưa bật YouTube Data API v3 / chưa thêm đúng tên miền vào giới hạn Key).',
        };
      }
      return { results: [], error: data?.error?.message || `Lỗi tìm kiếm (HTTP ${res.status}).` };
    }

    const items = Array.isArray(data?.items) ? data.items : [];
    const videoIds = items.map((it: any) => it.id?.videoId).filter(Boolean);
    if (videoIds.length === 0) return { results: [] };

    // A second call is needed for video duration — search.list never returns it.
    const durationById: Record<string, string> = {};
    try {
      const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds.join(',')}&key=${encodeURIComponent(apiKey)}`;
      const detailsRes = await fetch(detailsUrl);
      const detailsData = await detailsRes.json().catch(() => null);
      if (detailsRes.ok && Array.isArray(detailsData?.items)) {
        for (const item of detailsData.items) {
          durationById[item.id] = formatDuration(item.contentDetails?.duration || '');
        }
      }
    } catch {}

    const results: YouTubeSearchResultItem[] = items
      .filter((it: any) => it.id?.videoId)
      .map((it: any) => ({
        id: it.id.videoId,
        youtubeId: it.id.videoId,
        title: it.snippet?.title || 'Không rõ tên bài hát',
        artist: it.snippet?.channelTitle || 'YouTube',
        coverImage: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || '',
        duration: durationById[it.id.videoId],
      }));

    return { results };
  } catch (err: any) {
    return { results: [], error: err?.message || 'Lỗi kết nối tới YouTube.' };
  }
}
