"use client";

import { useState } from "react";

type Mode =
  | "cyclorama"
  | "product"
  | "creative"
  | "image"
  | "mobile"
  | "tryon";

type Ratio = "4:5" | "3:4" | "9:16" | "1:1" | "2:3";

async function compressImage(file: File, maxSize = 1400, quality = 0.82) {
  const imageBitmap = await createImageBitmap(file);

  const scale = Math.min(1, maxSize / Math.max(imageBitmap.width, imageBitmap.height));
  const width = Math.round(imageBitmap.width * scale);
  const height = Math.round(imageBitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas is not supported.");
  }

  ctx.drawImage(imageBitmap, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Image compression failed."));
      },
      "image/jpeg",
      quality
    );
  });

  return new File(
    [blob],
    file.name.replace(/\.[^.]+$/, "") + "-compressed.jpg",
    { type: "image/jpeg" }
  );
}

export default function Page() {
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [detailFiles, setDetailFiles] = useState<File[]>([]);

  const [mode, setMode] = useState<Mode>("cyclorama");
  const [aspectRatio, setAspectRatio] = useState<Ratio>("4:5");
  const [userPrompt, setUserPrompt] = useState("");

  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!frontFile) {
      setError("Загрузи FRONT фото.");
      return;
    }

    setLoading(true);
    setError("");
    setImage("");

    try {
      const formData = new FormData();

      const compressedFront = await compressImage(frontFile);
      formData.append("front", compressedFront);

      if (backFile) {
        const compressedBack = await compressImage(backFile);
        formData.append("back", compressedBack);
      }

      for (const file of detailFiles) {
        const compressedDetail = await compressImage(file);
        formData.append("details", compressedDetail);
      }

      formData.append("mode", mode);
      formData.append("aspectRatio", aspectRatio);
      formData.append("userPrompt", userPrompt);

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Ошибка генерации.");
        return;
      }

      setImage(data.image);
    } catch (err: any) {
      setError(err?.message || "Ошибка запроса к API.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: 32, maxWidth: 900, margin: "0 auto", fontFamily: "Arial" }}>
      <h1>SSSWEAR AI</h1>
      <p>Загрузи фото изделия, выбери режим, формат и получи одну генерацию.</p>

      <h3>1. Фото изделия</h3>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr 1fr" }}>
        <UploadBox title="FRONT" file={frontFile} onChange={setFrontFile} />
        <UploadBox title="BACK" file={backFile} onChange={setBackFile} />
        <div>
          <strong>DETAILS</strong>
          <br />
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setDetailFiles(Array.from(e.target.files || []))}
          />
          {detailFiles.length > 0 && (
            <ul>
              {detailFiles.map((file, index) => (
                <li key={index}>
                  {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <h3>2. Режим съемки</h3>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
        <Radio label="Циклорама" value="cyclorama" current={mode} onChange={setMode} />
        <Radio label="Предметный кадр" value="product" current={mode} onChange={setMode} />
        <Radio label="Креативный кадр" value="creative" current={mode} onChange={setMode} />
        <Radio label="Имиджевая съемка" value="image" current={mode} onChange={setMode} />
        <Radio label="Мобильная съемка" value="mobile" current={mode} onChange={setMode} />
        <Radio label="Примерка" value="tryon" current={mode} onChange={setMode} />
      </div>

      <h3>3. Формат</h3>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {(["4:5", "3:4", "9:16", "1:1", "2:3"] as Ratio[]).map((ratio) => (
          <button
            key={ratio}
            onClick={() => setAspectRatio(ratio)}
            style={{
              padding: "10px 18px",
              border: aspectRatio === ratio ? "2px solid black" : "1px solid #ccc",
              background: aspectRatio === ratio ? "#eee" : "white",
              cursor: "pointer",
            }}
          >
            {ratio}
          </button>
        ))}
      </div>

      <h3>4. Уточнение промпта</h3>

      <textarea
        value={userPrompt}
        onChange={(e) => setUserPrompt(e.target.value)}
        placeholder="Например: девушка европейской внешности, лето, зеленые деревья, естественный свет, фото как на iPhone"
        rows={5}
        style={{ width: "100%", padding: 12, fontSize: 14 }}
      />

      <br />
      <br />

      <button
        onClick={handleGenerate}
        disabled={loading}
        style={{
          padding: "14px 24px",
          background: "black",
          color: "white",
          border: 0,
          cursor: "pointer",
        }}
      >
        {loading ? "Сжимаем фото и генерируем..." : "Сгенерировать фото"}
      </button>

      {loading && <p>Генерация может занять около минуты...</p>}

      {error && <p style={{ color: "red" }}>{error}</p>}

      {image && (
        <div style={{ marginTop: 30 }}>
          <h3>Результат</h3>
          <img src={image} alt="Generated result" style={{ width: "100%", borderRadius: 16 }} />
        </div>
      )}
    </main>
  );
}

function UploadBox({
  title,
  file,
  onChange,
}: {
  title: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <div>
      <strong>{title}</strong>
      <br />
      <input
        type="file"
        accept="image/*"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
      {file && (
        <p>
          ✅ {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
        </p>
      )}
    </div>
  );
}

function Radio({
  label,
  value,
  current,
  onChange,
}: {
  label: string;
  value: Mode;
  current: Mode;
  onChange: (value: Mode) => void;
}) {
  return (
    <label
      style={{
        border: current === value ? "2px solid black" : "1px solid #ccc",
        padding: 12,
        cursor: "pointer",
      }}
    >
      <input
        type="radio"
        checked={current === value}
        onChange={() => onChange(value)}
      />{" "}
      {label}
    </label>
  );
}