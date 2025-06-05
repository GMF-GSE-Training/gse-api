/**
 * Interface for storage providers to handle file operations.
 * @description Defines methods for uploading, downloading, and deleting files across different storage systems (e.g., local, GCP, AWS, NAS, Alibaba OSS).
 * Ensures consistent behavior across providers with strict input validation and error handling.
 * @example
 * class MyStorageProvider implements StorageProvider {
 *   async upload(file: Express.Multer.File, fileName: string, requestId?: string): Promise<string> {
 *     // Upload file to custom storage
 *     return 'path/to/file';
 *   }
 *   async download(filePath: string, requestId?: string): Promise<{ buffer: Buffer; mimeType: string }> {
 *     // Download file from storage
 *     return { buffer: Buffer.from('content'), mimeType: 'text/plain' };
 *   }
 *   async delete(filePath: string, requestId?: string): Promise<void> {
 *     // Delete file from storage
 *   }
 * }
 */
export interface StorageProvider {
  /**
   * Uploads a file to the storage provider.
   * @param file Multer file containing buffer, original name, MIME type, and size.
   * @param fileName Sanitized file name or path in storage (e.g., 'participants/123/ktp/file.jpg').
   * @param requestId Optional unique ID for request tracking and logging.
   * @returns File path in storage (e.g., '/path/to/file.jpg' or 'bucket/file.jpg').
   * @throws FileValidationException If file or fileName is invalid (e.g., empty file, invalid characters).
   * @throws StorageOperationException If upload operation fails (e.g., permission denied, network error).
   */
  upload(
    file: Express.Multer.File,
    fileName: string,
    requestId?: string
  ): Promise<string>;

  /**
   * Downloads a file from the storage provider.
   * @param filePath File path in storage (e.g., '/path/to/file.jpg' or 'bucket/file.jpg').
   * @param requestId Optional unique ID for request tracking and logging.
   * @returns Object containing the file buffer and its MIME type (e.g., 'image/jpeg').
   * @throws FileValidationException If filePath is invalid or file is not found.
   * @throws StorageOperationException If download operation fails (e.g., network error, access denied).
   */
  download(
    filePath: string,
    requestId?: string
  ): Promise<{ buffer: Buffer; mimeType: string }>;

  /**
   * Deletes a file from the storage provider.
   * @param filePath File path in storage (e.g., '/path/to/file.jpg' or 'bucket/file.jpg').
   * @param requestId Optional unique ID for request tracking and logging.
   * @throws StorageOperationException If deletion operation fails (e.g., file not found, permission denied).
   */
  delete(filePath: string, requestId?: string): Promise<void>;

  /**
   * Checks if a file exists in the storage provider.
   * @param filePath File path in storage (e.g., '/path/to/file.jpg' or 'bucket/file.jpg').
   * @param requestId Optional unique ID for request tracking and logging.
   * @returns Boolean indicating whether the file exists.
   * @throws StorageOperationException If the operation fails (e.g., network error, access denied).
   */
  checkExists?(filePath: string, requestId?: string): Promise<boolean>;

  /**
   * Checks the health of the storage provider.
   * @returns Promise that resolves if the provider is healthy.
   * @throws StorageOperationException If the health check fails (e.g., unable to connect to storage).
   */
  checkHealth?(): Promise<void>;
}
