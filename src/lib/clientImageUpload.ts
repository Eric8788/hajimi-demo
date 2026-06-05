export const MAX_FORUM_IMAGE_SIZE = 1 * 1024 * 1024;
export const TARGET_COMPRESSED_FORUM_IMAGE_SIZE = 900 * 1024;
export const MAX_FORUM_IMAGE_DIMENSION = 1600;
export const FORUM_ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const FORUM_COMPRESSIBLE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function formatFileSize(bytes: number) {
    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function optimizedImageName(name: string) {
    const baseName = name.replace(/\.[^/.]+$/, '') || 'image';
    return `${baseName}-optimized.webp`;
}

function loadImage(file: File) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        const url = URL.createObjectURL(file);

        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Could not read image'));
        };
        image.src = url;
    });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('Could not optimize image'));
            }
        }, type, quality);
    });
}

export async function compressForumImageForUpload(file: File) {
    const image = await loadImage(file);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;

    if (!sourceWidth || !sourceHeight) {
        throw new Error('Invalid image dimensions');
    }

    const maxSourceDimension = Math.max(sourceWidth, sourceHeight);
    const initialScale = Math.min(1, MAX_FORUM_IMAGE_DIMENSION / maxSourceDimension);
    const dimensionScales = [1, 0.85, 0.7, 0.55];
    const qualities = [0.82, 0.74, 0.66, 0.58, 0.5];
    let smallestBlob: Blob | null = null;

    for (const dimensionScale of dimensionScales) {
        const scale = initialScale * dimensionScale;
        const width = Math.max(1, Math.round(sourceWidth * scale));
        const height = Math.max(1, Math.round(sourceHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Could not prepare image optimizer');
        }

        context.drawImage(image, 0, 0, width, height);

        for (const quality of qualities) {
            const blob = await canvasToBlob(canvas, 'image/webp', quality);
            if (!smallestBlob || blob.size < smallestBlob.size) {
                smallestBlob = blob;
            }

            if (blob.size <= TARGET_COMPRESSED_FORUM_IMAGE_SIZE) {
                return new File([blob], optimizedImageName(file.name), { type: 'image/webp' });
            }
        }
    }

    if (!smallestBlob) {
        throw new Error('Could not optimize image');
    }

    return new File([smallestBlob], optimizedImageName(file.name), { type: 'image/webp' });
}
