"use client";

import { useState } from "react";

export default function Page() {
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [detailFile, setDetailFile] = useState<File | null>(null);

  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setImages([]);

      const formData = new FormData();

      if (frontFile) formData.append("front", frontFile);
      if (backFile) formData.append("back", backFile);
      if (detailFile) formData.append("detail", detailFile);

      formData.append("shootType", "editorial");

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      console.log("API RESPONSE:", data);

      if (Array.isArray(data.images)) {
        setImages(data.images);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>AI Fashion Generator</h1>

      {/* UPLOAD FILES */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          type="file"
          onChange={(e) => setFrontFile(e.target.files?.[0] || null)}
        />
        <input
          type="file"
          onChange={(e) => setBackFile(e.target.files?.[0] || null)}
        />
        <input
          type="file"
          onChange={(e) => setDetailFile(e.target.files?.[0] || null)}
        />
      </div>

      {/* BUTTON */}
      <button
        onClick={handleGenerate}
        disabled={loading}
        style={{ marginTop: 20 }}
      >
        {loading ? "Generating..." : "Generate"}
      </button>

      {/* LOADING */}
      {loading && <p>Creating fashion campaign...</p>}

      {/* IMAGES */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginTop: 20,
        }}
      >
        {images.map((img, i) => (
          <img
            key={i}
            src={img}
            style={{
              width: "100%",
              borderRadius: 12,
            }}
          />
        ))}
      </div>
    </div>
  );
}