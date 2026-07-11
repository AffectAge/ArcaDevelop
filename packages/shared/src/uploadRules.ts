export type ImageUploadRule = {
  maxWidth: number;
  maxHeight: number;
  maxBytes: number;
  mimeTypes: readonly string[];
  extensions: readonly string[];
  ratioWidth?: number;
  ratioHeight?: number;
};

export const IMAGE_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

export const IMAGE_UPLOAD_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const IMAGE_UPLOAD_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;

const makeImageUploadRule = (maxWidth: number, maxHeight: number): ImageUploadRule => ({
  maxWidth,
  maxHeight,
  maxBytes: IMAGE_UPLOAD_MAX_BYTES,
  mimeTypes: IMAGE_UPLOAD_MIME_TYPES,
  extensions: IMAGE_UPLOAD_EXTENSIONS,
});

export const COUNTRY_FLAG_UPLOAD_RULE = makeImageUploadRule(192, 128);
export const COUNTRY_CREST_UPLOAD_RULE = makeImageUploadRule(128, 146);
export const COUNTRY_IDENTITY_LOGO_UPLOAD_RULE = makeImageUploadRule(64, 64);
