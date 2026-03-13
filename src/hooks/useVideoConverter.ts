import { } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export interface FileStatus {
  file: File;
  id: string;
  progress: number;
  status: 'idle' | 'processing' | 'completed' | 'error';
  outputUrl?: string;
  error?: string;
}

export const useVideoConverter = () => {
  const createInstance = async () => {
    const ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    return ffmpeg;
  };

  const convertFile = async (
    file: File, 
    format: 'mp3' | 'wav', 
    onProgress: (p: number) => void
  ): Promise<Blob> => {
    const ffmpeg = await createInstance();
    const inputName = `input_${Math.random().toString(36).substr(2, 5)}_${file.name}`;
    const outputName = `output_${Math.random().toString(36).substr(2, 5)}.${format}`;

    try {
      await ffmpeg.writeFile(inputName, await fetchFile(file));
      ffmpeg.on('progress', ({ progress }) => {
        onProgress(Math.round(progress * 100));
      });

      if (format === 'mp3') {
        await ffmpeg.exec(['-i', inputName, '-vn', '-ab', '192k', '-ar', '44100', outputName]);
      } else {
        await ffmpeg.exec(['-i', inputName, '-vn', '-acodec', 'pcm_s16le', outputName]);
      }

      const data = await ffmpeg.readFile(outputName);
      // 使用 any 绕过 SharedArrayBuffer 的类型限制
      return new Blob([(data as any)], { type: `audio/${format}` });
    } finally {
      ffmpeg.terminate();
    }
  };

  return { convertFile };
};
