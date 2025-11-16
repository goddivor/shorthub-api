/**
 * Email helper functions for formatting and utilities
 */

/**
 * Format a date to a readable French format
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };

  return d.toLocaleDateString('fr-FR', options);
}

/**
 * Format a date to short format (only date, no time)
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };

  return d.toLocaleDateString('fr-FR', options);
}

/**
 * Get relative time string (e.g., "il y a 2 heures")
 * @param date - Date to compare
 * @returns Relative time string
 */
export function getRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'à l\'instant';
  if (diffMins < 60) return `il y a ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
  if (diffHours < 24) return `il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 30) return `il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;

  return formatDateShort(d);
}

/**
 * Calculate days until a deadline
 * @param deadline - Deadline date
 * @returns Number of days until deadline (negative if past)
 */
export function daysUntilDeadline(deadline: Date | string): number {
  const d = typeof deadline === 'string' ? new Date(deadline) : deadline;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);

  const diffTime = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Format duration in hours to human-readable format
 * @param hours - Duration in hours
 * @returns Formatted duration string
 */
export function formatDuration(hours: number): string {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }

  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h${m}m` : `${h} heure${h > 1 ? 's' : ''}`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  return remainingHours > 0
    ? `${days} jour${days > 1 ? 's' : ''} ${remainingHours}h`
    : `${days} jour${days > 1 ? 's' : ''}`;
}

/**
 * Truncate text to a maximum length
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text with ellipsis if needed
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Escape HTML special characters
 * @param text - Text to escape
 * @returns Escaped text
 */
export function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Convert newlines to <br> tags
 * @param text - Text to convert
 * @returns Text with <br> tags
 */
export function nl2br(text: string): string {
  return text.replace(/\n/g, '<br>');
}

/**
 * Generate a YouTube video URL from video ID
 * @param videoId - YouTube video ID
 * @returns Full YouTube URL
 */
export function getYouTubeUrl(videoId: string): string {
  return `https://youtube.com/watch?v=${videoId}`;
}

/**
 * Generate a YouTube thumbnail URL from video ID
 * @param videoId - YouTube video ID
 * @param quality - Thumbnail quality (default, medium, high, maxres)
 * @returns YouTube thumbnail URL
 */
export function getYouTubeThumbnail(
  videoId: string,
  quality: 'default' | 'medium' | 'high' | 'maxres' = 'high'
): string {
  return `https://img.youtube.com/vi/${videoId}/${quality === 'high' ? 'hqdefault' : quality === 'medium' ? 'mqdefault' : quality === 'maxres' ? 'maxresdefault' : 'default'}.jpg`;
}
