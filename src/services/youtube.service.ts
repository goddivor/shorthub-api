import { env } from '../config/env';
import { GraphQLError } from 'graphql';
import { logger } from '../utils/logger';

interface ChannelData {
  channelId: string;
  username: string;
  subscriberCount: number;
}

interface YouTubeChannelResponse {
  items: Array<{
    id: string;
    snippet: {
      title: string;
      customUrl?: string;
    };
    statistics: {
      subscriberCount: string;
    };
  }>;
}

interface YouTubeSearchResponse {
  items: Array<{
    id: {
      videoId: string;
    };
    snippet: {
      channelId: string;
      title: string;
      publishedAt: string;
    };
  }>;
}

interface YouTubeVideoResponse {
  items: Array<{
    id: string;
    snippet: {
      title: string;
      description: string;
      tags?: string[];
    };
    contentDetails: {
      duration: string;
    };
  }>;
}

export class YouTubeService {
  private static API_KEY = env.YOUTUBE_API_KEY;
  private static BASE_URL = 'https://www.googleapis.com/youtube/v3';

  /**
   * Extrait l'ID de la chaîne depuis différents formats d'URL YouTube
   */
  static extractChannelIdFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      // Format: /channel/UC...
      if (pathname.includes('/channel/')) {
        return pathname.split('/channel/')[1].split('/')[0];
      }

      // Format: /@handle - nécessite une recherche
      if (pathname.startsWith('/@')) {
        return null; // Nécessite searchChannelByHandle
      }

      // Format: /c/customname ou /user/username
      return null; // Nécessite une recherche
    } catch (error) {
      logger.error('Error parsing YouTube URL:', error);
      return null;
    }
  }

  /**
   * Recherche une chaîne par nom/handle
   */
  static async searchChannelByName(query: string): Promise<string | null> {
    if (!this.API_KEY) {
      throw new GraphQLError('YouTube API key not configured');
    }

    try {
      const response = await fetch(
        `${this.BASE_URL}/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=1&key=${this.API_KEY}`
      );

      if (!response.ok) {
        if (response.status === 403) {
          throw new GraphQLError('YouTube API quota exceeded or invalid API key');
        }
        throw new GraphQLError(`YouTube API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.items && data.items.length > 0) {
        return data.items[0].snippet.channelId;
      }

      return null;
    } catch (error) {
      logger.error('Error searching for channel:', error);
      throw error;
    }
  }

  /**
   * Récupère les données d'une chaîne par son ID
   */
  static async getChannelById(channelId: string): Promise<ChannelData> {
    if (!this.API_KEY) {
      throw new GraphQLError('YouTube API key not configured');
    }

    try {
      const response = await fetch(
        `${this.BASE_URL}/channels?part=snippet,statistics&id=${channelId}&key=${this.API_KEY}`
      );

      if (!response.ok) {
        throw new GraphQLError(`YouTube API error: ${response.status}`);
      }

      const data: YouTubeChannelResponse = await response.json();

      if (!data.items || data.items.length === 0) {
        throw new GraphQLError('Channel not found');
      }

      const channel = data.items[0];

      let username = channel.snippet.customUrl || channel.snippet.title;
      if (username && !username.startsWith('@') && channel.snippet.customUrl) {
        username = `@${username}`;
      }

      return {
        channelId: channel.id,
        username: username || channel.snippet.title,
        subscriberCount: parseInt(channel.statistics.subscriberCount) || 0,
      };
    } catch (error) {
      logger.error('Error fetching channel details:', error);
      throw error;
    }
  }

  /**
   * Extrait les données d'une chaîne depuis une URL
   */
  static async extractChannelDataFromUrl(url: string): Promise<ChannelData> {
    let channelId = this.extractChannelIdFromUrl(url);

    // Si pas d'ID direct, rechercher par nom
    if (!channelId) {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      let searchQuery = '';
      if (pathname.startsWith('/@')) {
        searchQuery = pathname.substring(2).split('/')[0];
      } else if (pathname.includes('/c/')) {
        searchQuery = pathname.split('/c/')[1].split('/')[0];
      } else if (pathname.includes('/user/')) {
        searchQuery = pathname.split('/user/')[1].split('/')[0];
      }

      if (searchQuery) {
        channelId = await this.searchChannelByName(searchQuery);
      }
    }

    if (!channelId) {
      throw new GraphQLError('Unable to extract channel ID from URL');
    }

    return await this.getChannelById(channelId);
  }

  /**
   * Parse la durée ISO 8601 (PT1M30S) en secondes
   */
  private static parseDuration(duration: string): number {
    const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const matches = duration.match(regex);

    if (!matches) return 0;

    const hours = parseInt(matches[1] || '0');
    const minutes = parseInt(matches[2] || '0');
    const seconds = parseInt(matches[3] || '0');

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Récupère les YouTube Shorts d'une chaîne (vidéos ≤ 60 secondes)
   */
  static async getChannelShorts(
    channelId: string,
    maxResults: number = 50
  ): Promise<Array<{ url: string; title: string; tags: string[] }>> {
    if (!this.API_KEY) {
      throw new GraphQLError('YouTube API key not configured');
    }

    try {
      // Rechercher les vidéos de la chaîne
      const searchResponse = await fetch(
        `${this.BASE_URL}/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=${maxResults}&key=${this.API_KEY}`
      );

      if (!searchResponse.ok) {
        if (searchResponse.status === 403) {
          throw new GraphQLError('YouTube API quota exceeded');
        }
        throw new GraphQLError(`YouTube API error: ${searchResponse.status}`);
      }

      const searchData: YouTubeSearchResponse = await searchResponse.json();

      if (!searchData.items || searchData.items.length === 0) {
        return [];
      }

      // Récupérer les détails des vidéos pour vérifier la durée
      const videoIds = searchData.items.map((item) => item.id.videoId);

      const videosResponse = await fetch(
        `${this.BASE_URL}/videos?part=contentDetails,snippet&id=${videoIds.join(',')}&key=${this.API_KEY}`
      );

      if (!videosResponse.ok) {
        throw new GraphQLError(`YouTube API error: ${videosResponse.status}`);
      }

      const videosData: YouTubeVideoResponse = await videosResponse.json();

      // Filtrer les Shorts (≤ 60 secondes)
      const shorts: Array<{ url: string; title: string; tags: string[] }> = [];

      videosData.items?.forEach((video) => {
        const durationInSeconds = this.parseDuration(video.contentDetails.duration);

        if (durationInSeconds > 0 && durationInSeconds <= 60) {
          shorts.push({
            url: `https://youtube.com/shorts/${video.id}`,
            title: video.snippet.title,
            tags: video.snippet.tags || [],
          });
        }
      });

      return shorts;
    } catch (error) {
      logger.error('Error fetching channel shorts:', error);
      throw error;
    }
  }

  /**
   * Rafraîchit le nombre d'abonnés d'une chaîne
   */
  static async refreshSubscriberCount(channelId: string): Promise<number> {
    const channelData = await this.getChannelById(channelId);
    return channelData.subscriberCount;
  }

  /**
   * Sélectionne un Short aléatoire qui n'a pas encore été rollé
   */
  static async rollRandomShort(
    channelId: string,
    excludeUrls: string[]
  ): Promise<{ url: string; title: string; tags: string[] } | null> {
    const shorts = await this.getChannelShorts(channelId);

    // Filtrer les vidéos déjà rollées
    const availableShorts = shorts.filter((short) => !excludeUrls.includes(short.url));

    if (availableShorts.length === 0) {
      return null;
    }

    // Sélectionner aléatoirement
    const randomIndex = Math.floor(Math.random() * availableShorts.length);
    return availableShorts[randomIndex];
  }
}
