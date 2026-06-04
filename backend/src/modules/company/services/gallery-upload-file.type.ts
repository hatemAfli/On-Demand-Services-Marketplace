/** Minimal shape from NestJS `FileInterceptor` / multer memory storage. */
export type GalleryUploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
};
