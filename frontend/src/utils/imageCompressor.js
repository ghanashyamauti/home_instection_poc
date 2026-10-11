/**
 * High-performance client-side image compression utility.
 * Optimizes smartphone camera uploads (8MB - 18MB) down to crisp ~350KB - 650KB JPEGs.
 * Speeds up mobile network uploads by 10x, saves mobile data, and prevents memory spikes.
 */

export function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export async function compressImage(file, options = {}) {
  const {
    maxDimension = 1600,
    quality = 0.82,
    outputType = 'image/jpeg'
  } = options;

  if (!file) {
    return { file: null, preview: null, originalSize: 0, compressedSize: 0, ratio: '0%' };
  }

  // Pass through SVG files directly without raster canvas conversion
  if (file.type === 'image/svg+xml' || (file.name && file.name.endsWith('.svg'))) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          file,
          preview: reader.result,
          originalSize: file.size,
          compressedSize: file.size,
          ratio: '0%',
          compressed: false
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // If already small (< 280KB) and JPEG, preserve without recompression
  if (file.size < 280 * 1024 && (file.type === 'image/jpeg' || file.type === 'image/jpg')) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          file,
          preview: reader.result,
          originalSize: file.size,
          compressedSize: file.size,
          ratio: '0%',
          compressed: false
        });
      };
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Proportional aspect ratio downscaling capped at maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        // Clean white background for transparency handling
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const previewDataUrl = canvas.toDataURL(outputType, quality);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve({
                file,
                preview: previewDataUrl,
                originalSize: file.size,
                compressedSize: file.size,
                ratio: '0%',
                compressed: false
              });
              return;
            }

            const cleanName = (file.name || `photo_${Date.now()}`).replace(/\.[^.]+$/, '.jpg');
            const compressedFile = new File([blob], cleanName, {
              type: outputType,
              lastModified: Date.now()
            });

            const reductionPct = Math.round((1 - blob.size / file.size) * 100);

            resolve({
              file: compressedFile,
              preview: previewDataUrl,
              originalSize: file.size,
              compressedSize: blob.size,
              ratio: `${reductionPct > 0 ? reductionPct : 0}%`,
              compressed: reductionPct > 0
            });
          },
          outputType,
          quality
        );
      };

      img.onerror = () => {
        resolve({
          file,
          preview: e.target.result,
          originalSize: file.size,
          compressedSize: file.size,
          ratio: '0%',
          compressed: false
        });
      };

      img.src = e.target.result;
    };

    reader.onerror = () => {
      resolve({
        file,
        preview: null,
        originalSize: file.size,
        compressedSize: file.size,
        ratio: '0%',
        compressed: false
      });
    };

    reader.readAsDataURL(file);
  });
}

export async function compressMultipleImages(files, onProgress = null, options = {}) {
  const results = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const file = files[i];
    const res = await compressImage(file, options);
    results.push(res);
    if (onProgress) {
      onProgress(i + 1, total, res);
    }
  }

  return results;
}
