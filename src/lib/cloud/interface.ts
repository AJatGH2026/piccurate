// Provider-agnostic cloud export. A provider authenticates the user (client-side
// OAuth) and copies the selected originals into a "PicCurate Auswahl" folder.
// Photos go browser → cloud directly; they never touch our server (variable cost,
// privacy-friendly — see docs/product-pipeline.md §7.3).

export interface CloudFile {
  name: string;
  blob: Blob;
}

export interface CloudProgress {
  done: number;
  total: number;
  current: string;
}

export interface CloudProvider {
  id: string;
  label: string;
  /** True when the provider's OAuth app key is configured (env). */
  isConfigured(): boolean;
  /** OAuth (popup) + upload all files into the selection folder. Returns the folder name and count. */
  uploadSelection(
    files: CloudFile[],
    onProgress?: (p: CloudProgress) => void
  ): Promise<{ folderName: string; uploaded: number }>;
}

/** Folder created in the user's cloud to hold the curated selection. */
export const SELECTION_FOLDER = 'PicCurate Auswahl';
