import React, { useState } from 'react';
import { Upload, Download, Play, Trash2, CheckCircle2, Loader2, FolderOpen, FileArchive as Zip } from 'lucide-react';
import JSZip from 'jszip';
import type { FileStatus } from './hooks/useVideoConverter';
import { useVideoConverter } from './hooks/useVideoConverter';

console.log('App component mounting...');

/**
 * AI 视频批量转音频工具 - 主组件
 */
const App: React.FC = () => {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [format, setFormat] = useState<'mp3' | 'wav'>('mp3');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dirHandle, setDirHandle] = useState<any>(null);
  const { convertFile } = useVideoConverter();

  // 导出到本地文件夹
  const exportToFolder = async () => {
    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker();
      setDirHandle(handle);

      const completedFiles = files.filter(f => f.status === 'completed' && f.outputUrl);
      if (completedFiles.length === 0) {
        alert('没有已完成的文件可供导出');
        return;
      }

      for (const f of completedFiles) {
        const response = await fetch(f.outputUrl!);
        const blob = await response.blob();
        const fileName = `${f.file.name.split('.')[0]}.${format}`;
        const fileHandle = await handle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      }
      alert(`成功导出 ${completedFiles.length} 个文件到：${handle.name}`);
    } catch (err) {
      console.warn('Export cancelled or failed', err);
    }
  };

  const downloadAllAsZip = async () => {
    const zip = new JSZip();
    const completedFiles = files.filter(f => f.status === 'completed' && f.outputUrl);
    
    if (completedFiles.length === 0) return;

    for (const f of completedFiles) {
      const response = await fetch(f.outputUrl!);
      const blob = await response.blob();
      zip.file(`${f.file.name.split('.')[0]}.${format}`, blob);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audio_pack_${new Date().getTime()}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let uploadedFiles: File[] = [];
    if ('files' in e.target && e.target.files) {
      uploadedFiles = Array.from(e.target.files);
    } else if ('dataTransfer' in e && e.dataTransfer.files) {
      e.preventDefault();
      uploadedFiles = Array.from(e.dataTransfer.files);
    }

    const newFiles: FileStatus[] = uploadedFiles
      .filter(f => f.type.startsWith('video/') || f.name.match(/\.(mp4|mov|avi|flv|mkv|wmv)$/i))
      .map(f => ({
        file: f,
        id: Math.random().toString(36).substr(2, 9),
        progress: 0,
        status: 'idle'
      }));

    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const startConversion = async () => {
    setIsProcessing(true);
    const maxConcurrent = 2;
    const queue = [...files].filter(f => f.status !== 'completed');
    
    const processQueue = async () => {
      while (queue.length > 0) {
        const fileStatus = queue.shift();
        if (!fileStatus) break;

        setFiles(prev => prev.map(f => f.id === fileStatus.id ? { ...f, status: 'processing', progress: 0 } : f));

        try {
          const blob = await convertFile(fileStatus.file, format, (progress) => {
            setFiles(prev => prev.map(f => f.id === fileStatus.id ? { ...f, progress } : f));
          });

          const outputUrl = URL.createObjectURL(blob);
          
          if (dirHandle) {
            try {
              const fileName = `${fileStatus.file.name.split('.')[0]}.${format}`;
              const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
              const writable = await fileHandle.createWritable();
              await writable.write(blob);
              await writable.close();
            } catch (err) {
              console.error('Auto-save failed', err);
            }
          }

          setFiles(prev => prev.map(f => f.id === fileStatus.id ? { ...f, status: 'completed', progress: 100, outputUrl } : f));
        } catch (err) {
          console.error(err);
          setFiles(prev => prev.map(f => f.id === fileStatus.id ? { ...f, status: 'error', error: '转换失败' } : f));
        }
      }
    };

    const workers = Array(Math.min(maxConcurrent, queue.length)).fill(null).map(processQueue);
    await Promise.all(workers);
    setIsProcessing(false);
  };

  return (
    <div className="container">
      <header>
        <h1>AI 视频批量转音频</h1>
        <p className="subtitle">高性能并行转码 • 自定义路径导出 • 100% 隐私安全</p>
      </header>

      <main>
        <div 
          className="upload-zone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileUpload}
          onClick={() => document.getElementById('fileInput')?.click()}
        >
          <Upload className="upload-icon" />
          <h3>点击或拖拽视频文件到此处</h3>
          <p className="subtitle">支持 MP4, MOV, mkv, FLV 等主流格式</p>
          <input 
            id="fileInput"
            type="file" 
            multiple 
            accept="video/*" 
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
          />
        </div>

        {files.length > 0 && (
          <div className="file-list">
            {files.map(f => (
              <div key={f.id} className="file-item">
                <div className="file-info">
                  <div className="file-name">{f.file.name}</div>
                  <div className="file-meta">{(f.file.size / (1024 * 1024)).toFixed(2)} MB • {f.status}</div>
                </div>

                <div className="file-actions">
                  {(f.status === 'processing' || (f.status === 'completed' && f.progress < 100)) && (
                    <div className="progress-container">
                      <div className="progress-bar" style={{ width: `${f.progress}%` }}></div>
                    </div>
                  )}
                  
                  {f.status === 'completed' && (
                    <div style={{ display: 'flex', gap: '8px', color: '#10b981' }}>
                      <CheckCircle2 size={20} />
                      <a href={f.outputUrl} download={`${f.file.name.split('.')[0]}.${format}`}>
                        <Download size={20} className="btn-icon" style={{ color: '#f8fafc', cursor: 'pointer' }} />
                      </a>
                    </div>
                  )}

                  {f.status === 'idle' && (
                    <Trash2 
                      size={20} 
                      className="btn-icon" 
                      style={{ color: '#f43f5e', cursor: 'pointer' }} 
                      onClick={(e) => { e.stopPropagation(); removeFile(f.id); }} 
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {files.length > 0 && (
          <div className="controls">
            <div className="config-group">
              <label>输出格式：</label>
              <select value={format} onChange={(e) => setFormat(e.target.value as any)}>
                <option value="mp3">MP3</option>
                <option value="wav">WAV</option>
              </select>
            </div>

            <div className="config-group">
              {files.some(f => f.status === 'completed') && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" onClick={downloadAllAsZip}>
                    <Zip size={18} /> 打包 ZIP
                  </button>
                  <button className="btn btn-secondary" onClick={exportToFolder}>
                    <FolderOpen size={18} /> 导出到文件夹
                  </button>
                </div>
              )}
              <button 
                className="btn btn-primary" 
                onClick={startConversion}
                disabled={isProcessing || files.every(f => f.status === 'completed')}
              >
                {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
                {isProcessing ? '处理中' : '开始并行转码'}
              </button>
            </div>
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .btn-icon:hover { filter: brightness(1.5); }
      `}} />
    </div>
  );
};

export default App;
