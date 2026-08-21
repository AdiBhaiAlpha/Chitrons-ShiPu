/*
# Scrape : Instagram Downloader (Reels, Posts, Carousel, IGTV)
# Type : CJS Command & Auto-Downloader
# Source : Clipssaver API
*/

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

async function instagramScrape(url) {
  let cleanUrl = url.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl;
  }
  
  const baseMatch = cleanUrl.match(/(https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/(?:p|reel|reels|tv|share\/(?:reel|p))\/[\w-]+)/i);
  const targetUrl = baseMatch ? baseMatch[1] : cleanUrl.split('?')[0];

  try {
    const { data } = await axios.post(
      'https://clipssaver.com/api/instagram/instagramDownloader/download-post',
      { url: targetUrl },
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 18000
      }
    );

    if (data && data.status === 'success' && data.data?.post) {
      const result = data.data.post;
      const caption = result.edge_media_to_caption?.edges?.[0]?.node?.text || result.caption || '';
      const videoUrl = result.video_url || result.download_url;
      const imageUrl = result.display_url || result.image || result.thumbnail_src;
      const isVideo = Boolean(result.video_url || result.type === 2 || result.is_video);
      const downloadUrl = isVideo ? videoUrl : imageUrl;

      return {
        id: result.id || result.short_code,
        shortcode: result.short_code || '',
        username: result.owner?.username || 'instagram_user',
        fullName: result.owner?.full_name || '',
        caption: caption,
        thumbnail: result.thumbnail_src || imageUrl,
        downloadUrl: downloadUrl,
        isVideo: isVideo,
        likes: result.edge_liked_by?.count || 0,
        comments: result.edge_media_to_comment?.count || 0,
        duration: result.video_duration || 0,
        type: result.type || (isVideo ? 'Reel/Video' : 'Post/Image')
      };
    }
  } catch (err) {
    console.warn('[InstaScrape] Clipssaver API error:', err.message);
  }

  try {
    const { data } = await axios.get(`https://api.v2.vidsaver.net/api/ig?url=${encodeURIComponent(targetUrl)}`, { timeout: 12000 });
    if (data && (data.url || data.video || data.data)) {
      const downloadUrl = data.url || data.video || (Array.isArray(data.data) ? data.data[0]?.url : null);
      if (downloadUrl) {
        return {
          id: 'ig_' + Date.now(),
          shortcode: '',
          username: data.username || 'instagram_user',
          fullName: '',
          caption: data.caption || '',
          thumbnail: downloadUrl,
          downloadUrl: downloadUrl,
          isVideo: Boolean(data.video || downloadUrl.includes('.mp4')),
          likes: 0,
          comments: 0,
          duration: 0,
          type: 'Instagram Media'
        };
      }
    }
  } catch (err) {
    console.warn('[InstaScrape] Fallback 1 error:', err.message);
  }

  try {
    const { data } = await axios.get(`https://deliriussapi.vercel.app/download/instagram?url=${encodeURIComponent(targetUrl)}`, { timeout: 12000 });
    if (data && data.status && data.data) {
      const item = Array.isArray(data.data) ? data.data[0] : data.data;
      const downloadUrl = item.url || item.download_url;
      if (downloadUrl) {
        return {
          id: 'ig_' + Date.now(),
          shortcode: '',
          username: data.username || 'instagram_user',
          fullName: '',
          caption: data.caption || '',
          thumbnail: downloadUrl,
          downloadUrl: downloadUrl,
          isVideo: item.type === 'video' || downloadUrl.includes('.mp4'),
          likes: 0,
          comments: 0,
          duration: 0,
          type: 'Instagram Media'
        };
      }
    }
  } catch (err) {
    console.warn('[InstaScrape] Fallback 2 error:', err.message);
  }

  throw new Error('Unable to download Instagram content. Make sure the post is public and the URL is valid.');
}

async function processAndSendInstagram({ url, message, threadID, api }) {
  let tempFilePath = null;
  try {
    if (message && typeof message.react === 'function') {
      try { await message.react('📥'); } catch (e) {}
    }

    const data = await instagramScrape(url);

    const isVideo = data.isVideo;
    const ext = isVideo ? 'mp4' : 'jpg';
    tempFilePath = path.join(process.cwd(), `tmp_insta_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`);

    const res = await axios.get(data.downloadUrl, {
      responseType: 'arraybuffer',
      timeout: 35000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    await fs.writeFile(tempFilePath, Buffer.from(res.data));

    let captionText = data.caption.trim();
    if (captionText.length > 350) {
      captionText = captionText.substring(0, 350) + '...';
    }

    let responseMsg = `📸 **INSTAGRAM ${data.isVideo ? 'REEL / VIDEO' : 'POST'}**\n`;
    responseMsg += `─────────────────────────\n`;
    responseMsg += `👤 **User:** @${data.username}${data.fullName ? ` (${data.fullName})` : ''}\n`;
    if (data.likes > 0 || data.comments > 0) {
      responseMsg += `❤️ **Likes:** ${data.likes.toLocaleString()}  |  💬 **Comments:** ${data.comments.toLocaleString()}\n`;
    }
    if (data.duration > 0) {
      responseMsg += `⏱️ **Duration:** ${Math.round(data.duration)}s\n`;
    }
    if (captionText) {
      responseMsg += `\n📝 **Caption:**\n${captionText}\n`;
    }
    responseMsg += `─────────────────────────\n`;
    responseMsg += `🤖 *Downloaded automatically by ShiPu Ai*`;

    const attachmentStream = fs.createReadStream(tempFilePath);

    if (message && typeof message.reply === 'function') {
      await message.reply({
        body: responseMsg,
        attachment: attachmentStream
      });
    } else if (api && typeof api.sendMessage === 'function') {
      await api.sendMessage(threadID, responseMsg, attachmentStream);
    }

    if (message && typeof message.react === 'function') {
      try { await message.react('✅'); } catch (e) {}
    }

  } catch (err) {
    console.error('[InstaPlugin Error]:', err.message);
    if (message && typeof message.react === 'function') {
      try { await message.react('❌'); } catch (e) {}
    }
    if (message && typeof message.reply === 'function') {
      await message.reply(`❌ **Instagram Downloader Error:** ${err.message || 'Failed to download content'}`);
    }
  } finally {
    if (tempFilePath) {
      setTimeout(() => {
        fs.remove(tempFilePath).catch(() => {});
      }, 20000);
    }
  }
}

module.exports = {
  config: {
    name: 'insta',
    aliases: ['instagram', 'ig', 'igdl', 'instadl', 'reel', 'reels'],
    version: '1.0.0',
    role: 0,
    author: 'ShiPu Ai',
    description: 'Auto download Instagram reels, posts, IGTV and carousels when link is detected in chat or commanded',
    category: 'downloader',
    guide: '{pref}insta <instagram_link>',
    countDown: 3,
    enabled: true
  },

  onStart: async function ({ message, args, threadID, api }) {
    const input = args.join(' ');
    const instaRegex = /(https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/(?:p|reel|reels|tv|share\/(?:reel|p))\/[\w-]+(?:\/|\?[^\s]*)?)/gi;
    const match = input.match(instaRegex) || (input.includes('instagram.com') ? [input.trim()] : null);

    if (!match || match.length === 0) {
      return await message.reply(
        '📌 **INSTAGRAM DOWNLOADER**\n' +
        '─────────────────────────\n' +
        'Please provide a valid Instagram Reel or Post URL.\n\n' +
        '💡 **Usage:**\n' +
        '• `#insta https://www.instagram.com/reel/DZ2zV8UhBQZ/`\n' +
        '• Or simply paste any Instagram link directly in the chat!'
      );
    }

    const url = match[0];
    await processAndSendInstagram({ url, message, threadID, api });
  },

  onChat: async function ({ message, event, threadID, api }) {
    if (!event || !event.body) return;
    const body = event.body;

    const prefix = event.prefixUsed || '#';
    const trimmed = body.trim().toLowerCase();
    if (
      trimmed.startsWith(`${prefix}insta`) ||
      trimmed.startsWith(`${prefix}instagram`) ||
      trimmed.startsWith(`${prefix}ig`) ||
      trimmed.startsWith(`${prefix}igdl`) ||
      trimmed.startsWith(`${prefix}instadl`) ||
      trimmed.startsWith(`${prefix}reel`) ||
      trimmed.startsWith(`${prefix}reels`)
    ) {
      return;
    }

    const instaRegex = /(https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/(?:p|reel|reels|tv|share\/(?:reel|p))\/[\w-]+(?:\/|\?[^\s]*)?)/gi;
    const matches = body.match(instaRegex);

    if (matches && matches.length > 0) {
      const url = matches[0];
      await processAndSendInstagram({ url, message, threadID, api });
    }
  }
};
