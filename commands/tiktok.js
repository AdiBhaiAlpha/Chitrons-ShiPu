/*
# Scrape : TikTok Downloader (No Watermark Video, HD, Photo Slides & Audio)
# Type : CJS Command & Auto-Downloader
# Source : TikWM & Multi-API Fallback Engine
*/

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

/**
 * Scrapes TikTok video, slideshow or audio details with multiple fallback providers
 */
async function tiktokScrape(url) {
  let cleanUrl = url.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl;
  }

  // Normalize shortened links (e.g. vt.tiktok.com, vm.tiktok.com) if needed
  const urlMatch = cleanUrl.match(/(https?:\/\/(?:www\.|vt\.|vm\.|v\.|t\.)?(?:tiktok\.com|douyin\.com)\/[^\s]+)/i);
  const targetUrl = urlMatch ? urlMatch[1] : cleanUrl;

  // Primary Provider: TikWM API
  try {
    const res = await axios.post(
      'https://www.tikwm.com/api/',
      new URLSearchParams({ url: targetUrl, hd: '1' }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01'
        },
        timeout: 18000
      }
    );

    if (res.data && res.data.code === 0 && res.data.data) {
      const d = res.data.data;
      const isImages = Array.isArray(d.images) && d.images.length > 0;
      const videoUrl = d.hdplay || d.play || d.wmplay;
      const downloadUrl = isImages ? (d.images[0] || d.cover) : (videoUrl || d.music);

      return {
        id: d.id || ('tt_' + Date.now()),
        title: d.title || 'TikTok Video',
        author: {
          username: d.author?.unique_id || d.author?.id || 'tiktok_user',
          nickname: d.author?.nickname || 'TikTok Creator',
          avatar: d.author?.avatar || ''
        },
        videoUrl: videoUrl,
        downloadUrl: downloadUrl,
        images: isImages ? d.images : [],
        isImages: isImages,
        isVideo: !isImages && Boolean(videoUrl),
        music: d.music || d.music_info?.play,
        musicTitle: d.music_info?.title || d.title || 'Original Audio',
        musicAuthor: d.music_info?.author || d.author?.nickname || '',
        cover: d.cover || d.origin_cover,
        duration: d.duration || 0,
        likes: d.digg_count || 0,
        comments: d.comment_count || 0,
        shares: d.share_count || 0,
        views: d.play_count || 0
      };
    }
  } catch (err) {
    console.warn('[TikTokScrape] TikWM API Error:', err.message);
  }

  // Fallback 1: Delirius API
  try {
    const { data } = await axios.get(
      `https://deliriussapi.vercel.app/download/tiktok?url=${encodeURIComponent(targetUrl)}`,
      { timeout: 15000, headers: { 'User-Agent': 'ShiPuAi' } }
    );

    if (data && data.status && data.data) {
      const d = data.data;
      const videoUrl = d.meta?.media?.find((m) => m.type === 'video')?.url || d.meta?.media?.[0]?.url || d.play || d.video;
      const isImages = Array.isArray(d.images) && d.images.length > 0;
      const downloadUrl = isImages ? d.images[0] : (videoUrl || d.music);

      return {
        id: d.id || ('tt_' + Date.now()),
        title: d.title || d.description || 'TikTok Video',
        author: {
          username: d.author?.username || 'tiktok_user',
          nickname: d.author?.nickname || d.author?.name || 'TikTok Creator',
          avatar: d.author?.avatar || ''
        },
        videoUrl: videoUrl,
        downloadUrl: downloadUrl,
        images: isImages ? d.images : [],
        isImages: isImages,
        isVideo: !isImages && Boolean(videoUrl),
        music: d.music,
        musicTitle: d.music_info?.title || 'Original Sound',
        musicAuthor: d.music_info?.author || '',
        cover: d.cover,
        duration: d.duration || 0,
        likes: d.stats?.likeCount || d.digg_count || 0,
        comments: d.stats?.commentCount || d.comment_count || 0,
        shares: d.stats?.shareCount || d.share_count || 0,
        views: d.stats?.playCount || d.play_count || 0
      };
    }
  } catch (err) {
    console.warn('[TikTokScrape] Delirius Fallback Error:', err.message);
  }

  // Fallback 2: Vidsaver / Tikwm Direct GET
  try {
    const { data } = await axios.get(
      `https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}&hd=1`,
      { timeout: 15000 }
    );
    if (data && data.code === 0 && data.data) {
      const d = data.data;
      const isImages = Array.isArray(d.images) && d.images.length > 0;
      const videoUrl = d.hdplay || d.play || d.wmplay;
      const downloadUrl = isImages ? (d.images[0] || d.cover) : (videoUrl || d.music);

      return {
        id: d.id || ('tt_' + Date.now()),
        title: d.title || 'TikTok Video',
        author: {
          username: d.author?.unique_id || 'tiktok_user',
          nickname: d.author?.nickname || 'TikTok Creator',
          avatar: d.author?.avatar || ''
        },
        videoUrl: videoUrl,
        downloadUrl: downloadUrl,
        images: isImages ? d.images : [],
        isImages: isImages,
        isVideo: !isImages && Boolean(videoUrl),
        music: d.music,
        musicTitle: d.music_info?.title || 'Original Audio',
        musicAuthor: d.music_info?.author || '',
        cover: d.cover,
        duration: d.duration || 0,
        likes: d.digg_count || 0,
        comments: d.comment_count || 0,
        shares: d.share_count || 0,
        views: d.play_count || 0
      };
    }
  } catch (err) {
    console.warn('[TikTokScrape] TikWM GET fallback error:', err.message);
  }

  throw new Error('Unable to download TikTok media. Please ensure the TikTok link is public and valid.');
}

/**
 * Downloads TikTok media and delivers formatted response to chat
 */
async function processAndSendTikTok({ url, message, threadID, api, requestedAudioOnly = false }) {
  const tempFiles = [];
  try {
    if (message && typeof message.react === 'function') {
      try { await message.react('📥'); } catch (e) {}
    }

    const data = await tiktokScrape(url);

    let captionText = data.title.trim();
    if (captionText.length > 300) {
      captionText = captionText.substring(0, 300) + '...';
    }

    let responseMsg = `🎬 **TIKTOK ${data.isImages ? 'PHOTO SLIDESHOW' : (requestedAudioOnly ? 'AUDIO / SOUND' : 'NO WATERMARK VIDEO')}**\n`;
    responseMsg += `─────────────────────────\n`;
    responseMsg += `👤 **Creator:** ${data.author.nickname} (@${data.author.username})\n`;
    if (data.likes > 0 || data.comments > 0 || data.shares > 0) {
      responseMsg += `❤️ **Likes:** ${data.likes.toLocaleString()} | 💬 **Comments:** ${data.comments.toLocaleString()} | 🔄 **Shares:** ${data.shares.toLocaleString()}\n`;
    }
    if (data.duration > 0) {
      responseMsg += `⏱️ **Duration:** ${Math.round(data.duration)}s\n`;
    }
    if (data.musicTitle) {
      responseMsg += `🎵 **Sound:** ${data.musicTitle}${data.musicAuthor ? ` - ${data.musicAuthor}` : ''}\n`;
    }
    if (captionText) {
      responseMsg += `\n📝 **Caption:**\n${captionText}\n`;
    }
    responseMsg += `─────────────────────────\n`;
    responseMsg += `🤖 *Downloaded automatically by ShiPu Ai*`;

    // 1. Audio-only requested or Music file
    if (requestedAudioOnly && data.music) {
      const tempAudio = path.join(process.cwd(), `tmp_tt_audio_${Date.now()}_${Math.floor(Math.random() * 1000)}.mp3`);
      tempFiles.push(tempAudio);

      const res = await axios.get(data.music, {
        responseType: 'arraybuffer',
        timeout: 35000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      await fs.writeFile(tempAudio, Buffer.from(res.data));

      if (message && typeof message.reply === 'function') {
        await message.reply({
          body: responseMsg,
          attachment: fs.createReadStream(tempAudio)
        });
      } else if (api && typeof api.sendMessage === 'function') {
        await api.sendMessage(threadID, responseMsg, fs.createReadStream(tempAudio));
      }
    }
    // 2. Photo Slideshow (Images Carousel)
    else if (data.isImages && Array.isArray(data.images) && data.images.length > 0) {
      const imageStreams = [];
      const imagesToDownload = data.images.slice(0, 6); // Cap at 6 images per batch

      for (let i = 0; i < imagesToDownload.length; i++) {
        const imgUrl = imagesToDownload[i];
        const tempImg = path.join(process.cwd(), `tmp_tt_img_${Date.now()}_${i}.jpg`);
        tempFiles.push(tempImg);

        const res = await axios.get(imgUrl, {
          responseType: 'arraybuffer',
          timeout: 25000,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        await fs.writeFile(tempImg, Buffer.from(res.data));
        imageStreams.push(fs.createReadStream(tempImg));
      }

      if (message && typeof message.reply === 'function') {
        await message.reply({
          body: responseMsg,
          attachment: imageStreams.length === 1 ? imageStreams[0] : imageStreams
        });
      } else if (api && typeof api.sendMessage === 'function') {
        await api.sendMessage(threadID, responseMsg, imageStreams[0]);
      }
    }
    // 3. HD Video (Default)
    else if (data.downloadUrl) {
      const tempVideo = path.join(process.cwd(), `tmp_tt_video_${Date.now()}_${Math.floor(Math.random() * 1000)}.mp4`);
      tempFiles.push(tempVideo);

      const res = await axios.get(data.downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 45000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
      });
      await fs.writeFile(tempVideo, Buffer.from(res.data));

      if (message && typeof message.reply === 'function') {
        await message.reply({
          body: responseMsg,
          attachment: fs.createReadStream(tempVideo)
        });
      } else if (api && typeof api.sendMessage === 'function') {
        await api.sendMessage(threadID, responseMsg, fs.createReadStream(tempVideo));
      }
    }

    if (message && typeof message.react === 'function') {
      try { await message.react('✅'); } catch (e) {}
    }

  } catch (err) {
    console.error('[TikTokPlugin Error]:', err.message);
    if (message && typeof message.react === 'function') {
      try { await message.react('❌'); } catch (e) {}
    }
    if (message && typeof message.reply === 'function') {
      await message.reply(`❌ **TikTok Downloader Error:** ${err.message || 'Failed to download TikTok media.'}`);
    }
  } finally {
    if (tempFiles.length > 0) {
      setTimeout(() => {
        for (const f of tempFiles) {
          fs.remove(f).catch(() => {});
        }
      }, 25000);
    }
  }
}

module.exports = {
  config: {
    name: 'tiktok',
    aliases: ['tiktokdl', 'tt', 'ttdl', 'tik'],
    version: '2.0.0',
    role: 0,
    author: 'ShiPu Ai',
    description: 'Auto download TikTok videos (no watermark), photo carousels & audio when link is detected in chat or commanded',
    category: 'downloader',
    guide: '{pref}tiktok <url> [or type audio/mp3]',
    countDown: 3,
    enabled: true
  },

  // Direct Command: #tiktok <url> [audio]
  onStart: async function ({ message, args, threadID, api }) {
    const input = args.join(' ');
    const tiktokRegex = /(https?:\/\/(?:www\.|vt\.|vm\.|v\.|t\.)?(?:tiktok\.com|douyin\.com)\/[^\s]+)/gi;
    const match = input.match(tiktokRegex) || (input.includes('tiktok.com') ? [input.trim().split(' ')[0]] : null);

    if (!match || match.length === 0) {
      return await message.reply(
        '🎬 **TIKTOK DOWNLOADER**\n' +
        '─────────────────────────\n' +
        'Please provide a valid TikTok video or photo URL.\n\n' +
        '💡 **Usage Examples:**\n' +
        '• `#tiktok https://vt.tiktok.com/ZS9Xexample/`\n' +
        '• `#tiktok https://www.tiktok.com/@user/video/1234567890 audio` (for mp3)\n' +
        '• Or simply paste any TikTok link directly into the chat!'
      );
    }

    const url = match[0];
    const requestedAudioOnly = args.some((a) => ['audio', 'mp3', 'sound', 'music'].includes(a.toLowerCase()));
    await processAndSendTikTok({ url, message, threadID, api, requestedAudioOnly });
  },

  // Auto Detection in Chat messages
  onChat: async function ({ message, event, threadID, api }) {
    if (!event || !event.body) return;
    const body = event.body;

    const prefix = event.prefixUsed || '#';
    const trimmed = body.trim().toLowerCase();

    // Skip if explicitly executing tiktok command to avoid double processing
    if (
      trimmed.startsWith(`${prefix}tiktok`) ||
      trimmed.startsWith(`${prefix}tiktokdl`) ||
      trimmed.startsWith(`${prefix}tt`) ||
      trimmed.startsWith(`${prefix}ttdl`) ||
      trimmed.startsWith(`${prefix}tik`)
    ) {
      return;
    }

    // Match TikTok links anywhere in message text
    const tiktokRegex = /(https?:\/\/(?:www\.|vt\.|vm\.|v\.|t\.)?(?:tiktok\.com|douyin\.com)\/[^\s]+)/gi;
    const matches = body.match(tiktokRegex);

    if (matches && matches.length > 0) {
      const url = matches[0];
      const requestedAudioOnly = body.toLowerCase().includes('audio') || body.toLowerCase().includes('mp3');
      await processAndSendTikTok({ url, message, threadID, api, requestedAudioOnly });
    }
  }
};
