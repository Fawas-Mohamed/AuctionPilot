// src/components/ImageUploader.tsx
import React, { useState } from "react";
import api from "@/lib/api";

type Props = {
  onUploaded: (url: string) => void;
  initialUrl?: string | null;
};

const ImageUploader: React.FC<Props> = ({ onUploaded, initialUrl = null }) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(initialUrl);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await api.post("/uploads", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res.data?.url;
      if (url) {
        setPreview(url);
        onUploaded(url);
      }
    } catch (err) {
      console.error("Upload failed", err);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {preview ? (
        <img src={preview} alt="preview" className="w-48 h-48 object-cover rounded mb-2" />
      ) : (
        <div className="w-48 h-48 bg-muted/30 rounded mb-2 flex items-center justify-center">Preview</div>
      )}
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <button type="button" className="btn">
          {uploading ? "Uploading..." : "Choose Image"}
        </button>
      </label>
    </div>
  );
};

export default ImageUploader;
