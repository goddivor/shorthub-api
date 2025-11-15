import ImageKit from 'imagekit';

class ImageKitService {
  private imagekit: ImageKit | null = null;

  constructor() {
    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY || 'dummy_public_key';
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/dummy';

    if (privateKey) {
      this.imagekit = new ImageKit({
        publicKey,
        privateKey,
        urlEndpoint,
      });
    } else {
      // eslint-disable-next-line no-console
      console.warn('ImageKit private key not configured. Profile image upload will be disabled.');
    }
  }

  /**
   * Upload image from base64 string
   */
  async uploadBase64Image(base64Data: string, fileName: string, folder: string = 'profile-images'): Promise<string> {
    if (!this.imagekit) {
      throw new Error('ImageKit is not configured');
    }

    try {
      const response = await this.imagekit.upload({
        file: base64Data,
        fileName: fileName,
        folder: folder,
        useUniqueFileName: true,
      });

      return response.url;
    } catch (error) {
      throw new Error('Failed to upload image');
    }
  }

  /**
   * Delete image by file ID
   */
  async deleteImage(fileId: string): Promise<boolean> {
    if (!this.imagekit) {
      throw new Error('ImageKit is not configured');
    }

    try {
      await this.imagekit.deleteFile(fileId);
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('ImageKit delete error:', error);
      return false;
    }
  }

  /**
   * Get authentication parameters for client-side upload
   */
  getAuthenticationParameters(): { token: string; expire: number; signature: string } | null {
    if (!this.imagekit) {
      return null;
    }

    return this.imagekit.getAuthenticationParameters();
  }

  /**
   * Check if ImageKit is configured
   */
  isConfigured(): boolean {
    return this.imagekit !== null;
  }
}

export default new ImageKitService();
